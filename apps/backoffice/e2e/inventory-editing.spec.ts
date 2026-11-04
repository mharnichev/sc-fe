import { expect, test, type Page } from '@playwright/test'

async function setup(page: Page, width: number, poster = true) {
  await page.setViewportSize({ width, height: 900 })
  const user = { id: 5, role: 'admin', is_superuser: poster, is_active: true, can_post_inventory: poster }
  const photo = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="teal"/></svg>')
  const product = { id: 42, name: 'Shampoo 250ml', sku: 'EDIT', barcode: '42', purchase_unit_cost: '10.00', package_size: '250 мл', stock_quantity: 5, reserved_quantity: 0, available_quantity: 5, allow_backorder: false, display_image_urls: [photo] }
  const line = { id: 8, product_id: 42, barcode: '42', quantity: 5, purchase_unit_cost: '10.00', batch_number: null, expiration_date: null, allocations: [{ order_item_id: 90, quantity: 4 }], effective_quantity: 5, effective_purchase_unit_cost: '10.00', effective_purchase_value: '50.00', last_correction_id: null as number | null }
  const receipt = { id: 12, revision: 1, status: 'draft', reason: 'Edit receipt', items: [line], created_at: '2026-11-03T00:00:00Z', posted_at: null as string | null, effective_purchase_value: '50.00' }
  const commands: Array<{ method: string, body: Record<string, any>, key: string | undefined }> = []
  const completed = new Set<string>()
  const history: Array<Record<string, unknown>> = []
  const state = { abortNext: false, conflictNext: false }
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'receipt-edit-test', user })), user)
  await page.route('**/*', async route => {
    const request = route.request()
    if (!['fetch', 'xhr'].includes(request.resourceType())) return route.continue()
    const path = new URL(request.url()).pathname
    if (!path.includes('/backoffice/')) return route.continue()
    if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
    if (path.endsWith('/products/42')) return route.fulfill({ json: product })
    if (path.endsWith('/inventory/stock')) return route.fulfill({ json: { items: [{ ...product, on_hand: product.stock_quantity, reserved: 0, available: product.available_quantity }], total: 1 } })
    if (path.endsWith('/receipts/12/changes')) return route.fulfill({ json: { items: history, total: history.length } })
    if (path.endsWith('/receipts/12/post')) {
      receipt.status = 'posted'; receipt.posted_at = '2026-11-03T12:00:00Z'; receipt.revision++
      product.purchase_unit_cost = receipt.items[0]?.purchase_unit_cost ?? '10.00'
      return route.fulfill({ json: receipt })
    }
    if (path.endsWith('/receipts/12/items/8') || path.endsWith('/receipts/12/items/8/corrections')) {
      const body = request.postDataJSON()
      const key = request.headers()['idempotency-key']
      commands.push({ method: request.method(), body, key })
      if (key && completed.has(key)) return route.fulfill({ json: receipt })
      if (state.conflictNext) { state.conflictNext = false; receipt.revision++; line.quantity = 7; line.effective_quantity = 7; return route.fulfill({ status: 409, json: { detail: 'Receipt revision changed' } }) }
      if (body.expected_revision !== receipt.revision) return route.fulfill({ status: 409, json: { detail: 'Receipt revision changed' } })
      if (request.method() === 'DELETE') receipt.items = []
      else if (path.endsWith('/corrections')) {
        line.effective_quantity = body.quantity; line.effective_purchase_unit_cost = body.purchase_unit_cost; line.last_correction_id = 1
        product.purchase_unit_cost = body.purchase_unit_cost
      } else {
        line.quantity = body.quantity; line.purchase_unit_cost = body.purchase_unit_cost; line.allocations = body.allocations
        line.effective_quantity = body.quantity; line.effective_purchase_unit_cost = body.purchase_unit_cost
      }
      line.effective_purchase_value = (line.effective_quantity * Number(line.effective_purchase_unit_cost)).toFixed(2)
      receipt.revision++
      if (key) completed.add(key)
      history.push({ id: receipt.revision, target_item_id: 8, actor_id: 5, operation: receipt.status === 'posted' ? 'posted_correction' : request.method() === 'DELETE' ? 'draft_delete' : 'draft_update', reason: body.reason, created_at: '2026-11-03T12:01:00Z', on_hand_delta: 0, purchase_value_delta: '0.00' })
      if (state.abortNext) { state.abortNext = false; return route.abort('failed') }
      return route.fulfill({ json: receipt })
    }
    if (path.endsWith('/receipts/12')) return route.fulfill({ json: receipt })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/inventory/receiving?id=12')
  const rows = width < 768 ? page.locator('div[aria-label="Позиції приймання"]') : page.getByRole('table', { name: 'Позиції приймання' })
  await expect(rows.getByText('Shampoo 250ml', { exact: true })).toBeVisible()
  const modal = page.getByRole('dialog', { name: 'Редагування позиції приймання' })
  return { product, receipt, line, commands, state, rows, modal }
}

for (const width of [390, 1440]) {
  test(`edit allocations, post cost, correct and remove draft at ${width}px`, async ({ page }) => {
    const s = await setup(page, width)
    await s.rows.getByRole('button', { name: 'Редагувати', exact: true }).click()
    await s.modal.getByLabel('Кількість, од.', { exact: true }).fill('3')
    await s.modal.getByLabel('Собівартість за одиницю, грн', { exact: true }).fill('12,50')
    await s.modal.getByLabel('Позиція замовлення #90', { exact: true }).fill('0')
    await s.modal.getByRole('button', { name: 'Зберегти зміни', exact: true }).click()
    await expect(s.modal).toBeHidden()
    expect(s.commands[0]?.body).toMatchObject({ quantity: 3, purchase_unit_cost: '12.50', expected_revision: 1, allocations: [] })
    expect(s.product.purchase_unit_cost).toBe('10.00')
    await page.getByRole('button', { name: 'Прийняти товари', exact: true }).click()
    await page.getByRole('button', { name: 'Провести', exact: true }).click()
    await expect(s.rows.getByRole('button', { name: 'Коригувати', exact: true })).toBeVisible()
    expect(s.product.purchase_unit_cost).toBe('12.50')
    await s.rows.getByRole('button', { name: 'Коригувати', exact: true }).click()
    await s.modal.getByLabel('Кількість, од.', { exact: true }).fill('2')
    await s.modal.getByLabel('Собівартість за одиницю, грн', { exact: true }).fill('15')
    await s.modal.getByLabel('Причина зміни', { exact: true }).fill('Помилка у накладній')
    await s.modal.getByRole('button', { name: 'Зберегти зміни', exact: true }).click()
    await expect(s.modal).toBeHidden()
    await expect(s.rows.getByText('30.00 грн', { exact: true })).toBeVisible()
    expect(s.line.quantity).toBe(3)
    expect(s.product.purchase_unit_cost).toBe('15.00')
    expect(s.commands.at(-1)?.body).not.toHaveProperty('allocations')
    await expect(page.getByLabel('Історія змін приймання').getByText('Помилка у накладній', { exact: true })).toBeVisible()
    await s.rows.screenshot({ path: `/tmp/inventory-corrected-${width}.png`, animations: 'disabled' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}

test('lost edit response restores after reload and retries same command/key without a duplicate correction', async ({ page }) => {
  const s = await setup(page, 390)
  s.state.abortNext = true
  await s.rows.getByRole('button', { name: 'Редагувати', exact: true }).click()
  await s.modal.getByLabel('Кількість, од.', { exact: true }).fill('6')
  await s.modal.getByRole('button', { name: 'Зберегти зміни', exact: true }).click()
  await expect(s.modal.getByRole('button', { name: 'Повторити запит', exact: true })).toBeVisible()
  page.on('dialog', dialog => dialog.accept())
  await page.reload()
  await expect(s.modal.getByRole('button', { name: 'Повторити запит', exact: true })).toBeVisible()
  await s.modal.getByRole('button', { name: 'Повторити запит', exact: true }).click()
  await expect(s.modal).toBeHidden()
  expect(s.commands).toHaveLength(2)
  expect(s.commands[1]).toEqual(s.commands[0])
  expect(s.receipt.revision).toBe(2)
})

test('stale revision reloads current values and draft deletion is confirmed', async ({ page }) => {
  const s = await setup(page, 1440)
  s.state.conflictNext = true
  await s.rows.getByRole('button', { name: 'Редагувати', exact: true }).click()
  await s.modal.getByRole('button', { name: 'Зберегти зміни', exact: true }).click()
  await expect(s.modal).toBeHidden()
  await s.rows.getByRole('button', { name: 'Редагувати', exact: true }).click()
  await expect(s.modal.getByLabel('Кількість, од.', { exact: true })).toHaveValue('7')
  await s.modal.getByRole('button', { name: 'Видалити позицію', exact: true }).click()
  await s.modal.getByRole('button', { name: 'Так, видалити', exact: true }).click()
  await expect(s.modal).toBeHidden()
  expect(s.commands.at(-1)?.method).toBe('DELETE')
  expect(s.commands.at(-1)?.body).toEqual({ expected_revision: 2, reason: 'Видалення помилкової позиції' })
  await expect(s.rows.getByRole('button', { name: 'Редагувати', exact: true })).toHaveCount(0)
})

test('warehouse viewer cannot edit or correct without posting permission', async ({ page }) => {
  const s = await setup(page, 390, false)
  await expect(s.rows.getByRole('button', { name: 'Редагувати', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Прийняти товари', exact: true })).toHaveCount(0)
})
