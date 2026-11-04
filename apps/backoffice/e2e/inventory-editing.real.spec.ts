import { expect, test } from '@playwright/test'

const env = (globalThis as { process?: { env?: Record<string, string> } }).process?.env || {}
const sandbox = env.INVENTORY_SANDBOX_URL || ''
test.skip(!sandbox, 'Requires the isolated synthetic FastAPI/PostgreSQL inventory sandbox.')
test.describe.configure({ mode: 'serial' })

for (const width of [390, 1440]) {
  test(`real API: edit, replay, post, correct and prefill saved cost at ${width}px`, async ({ page, request }) => {
    expect(new URL(sandbox).hostname).toBe('127.0.0.1')
    expect(new URL(sandbox).port).toBe('58002')
    const response = await request.post(`${sandbox}/__sandbox/reset`)
    expect(response.ok()).toBe(true)
    const seed = await response.json()
    expect(seed.schema).toMatch(/^inventory_browser_test_/)
    const root = `${sandbox}/api/v1/backoffice/inventory`
    const headers = { Authorization: `Bearer ${seed.access_token}` }
    const productId = seed.seed.products.available.id
    const create = await request.post(`${root}/receipts`, { headers: { ...headers, 'Idempotency-Key': `real-create-${width}` }, data: { reason: 'Synthetic UI receipt' } })
    expect(create.ok()).toBe(true)
    const draft = await create.json()
    const add = await request.post(`${root}/receipts/${draft.id}/items`, { headers: { ...headers, 'Idempotency-Key': `real-add-${width}` }, data: { product_id: productId, quantity: 5, purchase_unit_cost: '10.00', allocations: [] } })
    expect(add.ok()).toBe(true)
    const original = await add.json()
    expect(original.revision).toBeGreaterThan(0)
    const itemId = original.items[0].id
    const product = async () => {
      const res = await request.get(`${sandbox}/api/v1/backoffice/products/${productId}`, { headers })
      expect(res.ok()).toBe(true)
      return res.json()
    }
    const salePrice = (await product()).price
    expect((await product()).purchase_unit_cost).toBeNull()
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(({ accessToken, user }) => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken, user })), { accessToken: seed.access_token, user: seed.user })
    await page.goto(`/inventory/receiving?id=${draft.id}`)
    const rows = width < 768 ? page.locator('div[aria-label="Позиції приймання"]') : page.getByRole('table', { name: 'Позиції приймання' })
    const modal = page.getByRole('dialog', { name: 'Редагування позиції приймання' })
    await rows.getByRole('button', { name: 'Редагувати', exact: true }).click()
    await modal.getByLabel('Кількість, од.', { exact: true }).fill('3')
    await modal.getByLabel('Собівартість за одиницю, грн', { exact: true }).fill('12.50')
    const attempts: Array<{ key: string | undefined, body: unknown }> = []
    await page.route(url => url.pathname === `/api/v1/backoffice/inventory/receipts/${draft.id}/items/${itemId}`, async route => {
      if (route.request().method() !== 'PUT') return route.continue()
      attempts.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() })
      if (attempts.length !== 1) return route.continue()
      const committed = await route.fetch()
      expect(committed.ok()).toBe(true)
      return route.abort('connectionfailed')
    })
    await modal.getByRole('button', { name: 'Зберегти зміни', exact: true }).click()
    await expect(modal.getByRole('button', { name: 'Повторити запит', exact: true })).toBeVisible()
    page.on('dialog', dialog => dialog.accept())
    await page.reload()
    await modal.getByRole('button', { name: 'Повторити запит', exact: true }).click()
    await expect(modal).toBeHidden()
    expect(attempts).toHaveLength(2)
    expect(attempts[0]).toEqual(attempts[1])
    expect((await product()).purchase_unit_cost).toBeNull()
    await page.getByRole('button', { name: 'Прийняти товари', exact: true }).click()
    await page.getByRole('button', { name: 'Провести', exact: true }).click()
    await expect(rows.getByRole('button', { name: 'Коригувати', exact: true })).toBeVisible()
    expect((await product()).purchase_unit_cost).toBe('12.50')
    await rows.getByRole('button', { name: 'Коригувати', exact: true }).click()
    await modal.getByLabel('Кількість, од.', { exact: true }).fill('2')
    await modal.getByLabel('Собівартість за одиницю, грн', { exact: true }).fill('15.00')
    await modal.getByLabel('Причина зміни', { exact: true }).fill('Synthetic invoice correction')
    await modal.getByRole('button', { name: 'Зберегти зміни', exact: true }).click()
    await expect(modal).toBeHidden()
    await expect(rows.getByText('30.00 грн', { exact: true })).toBeVisible()
    const saved = await (await request.get(`${root}/receipts/${draft.id}`, { headers })).json()
    expect(saved.items[0]).toMatchObject({ quantity: 3, purchase_unit_cost: '12.50', effective_quantity: 2, effective_purchase_unit_cost: '15.00' })
    expect(await product()).toMatchObject({ purchase_unit_cost: '15.00', price: salePrice })
    const audit = await (await request.get(`${root}/receipts/${draft.id}/changes`, { headers })).json()
    expect(audit.total).toBe(2)
    await page.goto(`/inventory/receiving?product_id=${productId}`)
    await page.getByRole('button', { name: 'Створити чернетку', exact: true }).click()
    await expect(page.getByRole('spinbutton', { name: 'Закупівля, грн/од. (Закупівельна вартість за одиницю, грн)', exact: true })).toHaveValue('15')
  })
}
