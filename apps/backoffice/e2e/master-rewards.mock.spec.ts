import { expect, test, type Page } from '@playwright/test'
const admin = { id: 1, role: 'admin', is_superuser: true, is_active: true, email: 'internal@example.test' }
const master = { id: 2, role: 'barber', master_id: 7, can_record_sales: false, is_superuser: false, is_active: true, email: 'master@example.test' }
const entry = { id: 11, revision: 1, order_id: 3, order_item_id: 31, master_id: 7, master_name: 'Олександр', product_id: 8, product_name: 'Шампунь Reuzel', quantity: 2, base_minor: 100000, rate_bps: 750, reward_minor: 7500, currency: 'UAH', sold_at: '2026-10-20T12:00:00+03:00', created_at: '2026-10-30T12:00:00+02:00', needs_review: false, settlement_id: null as number | null, status: 'pending' }
async function fixture(page: Page, options: { user?: typeof admin | typeof master, unset?: boolean, timeout?: boolean, conflict?: boolean, recoveryMissing?: boolean, secondEntry?: boolean } = {}) {
  const user = options.user || admin
  let current = { ...entry }, rate: number | null = options.unset ? null : 750
  const requests: { path: string, method: string, key?: string, body?: any, query: URLSearchParams }[] = []
  let history: any[] = [], operations: Record<string, any> = {}, createCount = 0
  const external: string[] = []
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'test-only', user })), user)
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) { external.push(url.origin); return route.abort() }
    if (!url.pathname.includes('/api/v1/')) return route.continue()
    if (url.pathname.endsWith('/auth/me')) return route.fulfill({ json: user })
    if (!url.pathname.includes('/master-rewards')) return route.fulfill({ json: { items: [], total: 0 } })
    const path = url.pathname.split('/master-rewards')[1]
    const body = req.postData() ? req.postDataJSON() : undefined
    const key = req.headers()['idempotency-key']
    requests.push({ path, method: req.method(), key, body, query: url.searchParams })
    if (path === '/policy') {
      if (req.method() === 'PUT') { rate = body.rate_bps; operations[key!] = { operation: 'policy', response: { revision: 2, rate_bps: rate, currency: 'UAH' } } }
      return route.fulfill({ json: { revision: 2, rate_bps: rate, currency: 'UAH' } })
    }
    if (path === '/masters') return route.fulfill({ json: { items: [{ id: 7, name: 'Олександр' }, { id: 8, name: 'Інший майстер' }] } })
    if (path === '/candidates') return route.fulfill({ json: { currency: 'UAH', items: [{ order_id: 3, order_item_id: 31, order_revision: 4, product_id: 8, product_name: entry.product_name, quantity: 2, base_minor: 100000, sold_at: entry.sold_at }] } })
    if (path === '/entries' && req.method() === 'POST') { operations[key!] = { operation: 'entry', response: current }; return route.fulfill({ status: 201, json: current }) }
    if (path === '/entries/11/review') { current = { ...current, revision: current.revision + 1, needs_review: body.needs_review }; operations[key!] = { operation: 'review', response: current }; return route.fulfill({ json: current }) }
    if (path === '/settlements/preview') return route.fulfill({ json: { master_id: 7, entry_ids: [11], total_minor: 7500, currency: 'UAH' } })
    if (path === '/settlements' && req.method() === 'POST') {
      createCount++
      if (options.conflict) return route.fulfill({ status: 409, json: { detail: { code: 'entry_not_available' } } })
      const result = { id: 21, master_id: 7, master_name: 'Олександр', total_minor: 7500, currency: 'UAH', paid_at: body.paid_at, created_at: '2026-10-30T12:00:00+02:00', entry_ids: [11], status: 'transferred' }
      current = { ...current, settlement_id: 21, status: 'transferred' }; history = [result]; operations[key!] = { operation: 'settlement', response: result }
      if (options.timeout && createCount === 1) return route.abort('failed')
      return route.fulfill({ status: 201, json: result })
    }
    if (path.startsWith('/operations/')) {
      const result = options.recoveryMissing ? undefined : operations[path.split('/').at(-1)!]
      return result ? route.fulfill({ json: result }) : route.fulfill({ status: 404, json: { detail: { code: 'not_found' } } })
    }
    if (path.endsWith('/entries')) return route.fulfill({ json: { items: options.secondEntry ? [current, { ...current, id: 12, order_item_id: 32, product_name: 'Помада тієї ж вартості' }] : [current], total: options.secondEntry ? 2 : 1, page: 1, page_size: 20 } })
    if (path.endsWith('/settlements')) return route.fulfill({ json: { items: history, total: history.length, page: 1, page_size: 20 } })
    if (path.endsWith('/summary')) return route.fulfill({ json: { currency: 'UAH', items: [{ master_id: 7, master_name: 'Олександр', sales_count: 1, units: 2, sales_net_minor: 100000, accrued_minor: 7500, transferred_minor: history.length ? 7500 : 0, pending_minor: history.length || current.needs_review ? 0 : 7500, held_minor: !history.length && current.needs_review ? 7500 : 0, balance_minor: history.length ? 0 : 7500 }] } })
    return route.fulfill({ status: 404, json: { detail: { code: 'not_found' } } })
  })
  return { requests, external }
}
async function selectAndPreview(page: Page) {
  await page.getByLabel('Майстер для перегляду та передачі', { exact: true }).selectOption('7')
  const pick = page.getByRole('checkbox', { name: /Обрати нарахування #11/ })
  await expect(pick).toBeEnabled(); await pick.check()
  await page.getByRole('button', { name: 'Перевірити передачу', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Підтвердити передачу', exact: true })).toBeVisible()
}
async function confirmTransfer(page: Page) {
  await page.getByLabel('Дата та час фактичної передачі').fill('2026-10-20T12:30')
  await page.getByLabel('Підстава запису про передачу').fill('Особисто передано готівкою')
  await page.getByRole('checkbox', { name: /Я фактично передав/ }).check()
  await page.getByRole('button', { name: 'Підтвердити передачу', exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click() })
}
test('admin explicitly configures rate and accrues one existing position without any automatic mutation', async ({ page }) => {
  const f = await fixture(page, { unset: true }); await page.goto('/admin/sales-rewards')
  await expect(page.getByText('Ставка не задана', { exact: true })).toBeVisible()
  expect(f.requests.filter(r => r.method !== 'GET')).toHaveLength(0)
  await page.getByText('Задати або змінити ставку', { exact: true }).click()
  await expect(page.getByLabel('Ставка, % (0–100)')).toHaveValue('')
  await page.getByLabel('Ставка, % (0–100)').fill('7,5')
  await page.getByLabel('Підстава зміни ставки').fill('Погоджена нова ставка')
  await page.getByRole('button', { name: 'Зберегти ставку' }).click()
  await expect(page.getByText('Поточна ставка: 7,5%', { exact: true })).toBeVisible()
  expect(f.requests.find(r => r.method === 'PUT')?.body).toEqual({ expected_revision: 2, rate_bps: 750, reason: 'Погоджена нова ставка' })
  await page.getByText('Ручне нарахування', { exact: true }).click()
  await page.getByLabel('Номер існуючого замовлення').fill('3')
  await page.getByRole('button', { name: 'Знайти позиції' }).click()
  await page.getByLabel('Позиція продажу').selectOption('31')
  await page.getByLabel('Майстер-продавець').selectOption('7')
  await page.getByLabel('Підстава ручного нарахування').fill('Продаж майстра підтверджено')
  await page.getByRole('button', { name: 'Нарахувати за вибрану позицію' }).click()
  await expect.poll(() => f.requests.filter(r => r.path === '/entries' && r.method === 'POST').length).toBe(1)
  expect(f.requests.find(r => r.path === '/entries' && r.method === 'POST')?.body).toEqual({ order_id: 3, order_item_id: 31, master_id: 7, expected_order_revision: 4, expected_policy_revision: 2, reason: 'Продаж майстра підтверджено' })
  expect(f.external).toEqual([])
})
test('preview and explicit manual confirmation create one transfer and preserve exact selected entries', async ({ page }) => {
  const f = await fixture(page); await page.goto('/admin/sales-rewards'); await selectAndPreview(page)
  await expect(page.getByRole('button', { name: 'Підтвердити передачу', exact: true })).toBeDisabled()
  expect(f.requests.filter(r => r.path === '/settlements' && r.method === 'POST')).toHaveLength(0)
  await confirmTransfer(page)
  await expect(page.getByText('Запис збережено.', { exact: true })).toBeVisible()
  const posted = f.requests.filter(r => r.path === '/settlements' && r.method === 'POST'); expect(posted).toHaveLength(1)
  expect(posted[0].body).toMatchObject({ master_id: 7, entries: [{ id: 11, expected_revision: 1 }], expected_total_minor: 7500, manual_payment_confirmed: true })
  expect(posted[0].key).toMatch(/^[0-9a-f-]{36}$/)
  await page.getByText('Історія передач', { exact: true }).click(); await expect(page.getByText('Передача #21', { exact: true })).toBeVisible()
  await expect(page.locator('details').filter({ has: page.getByText('Історія передач', { exact: true }) }).getByText('Олександр', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Позначити спір / повернення' }).click()
  await page.getByLabel('Підстава спору або повернення').fill('Повернення після передачі — потрібне рішення')
  await page.getByRole('button', { name: 'Позначити для розгляду' }).click()
  await expect(page.getByText('Передано · потребує рішення', { exact: true })).toBeVisible()
  expect(f.requests.find(r => r.path === '/entries/11/review')?.body).toEqual({ expected_revision: 1, needs_review: true, reason: 'Повернення після передачі — потрібне рішення' })
  expect(f.requests.some(r => /refund|payment|handover|fiscal/.test(r.path))).toBe(false); expect(f.external).toEqual([])
})
for (const recoveryMissing of [false, true]) test(`uncertain transfer survives reload; ${recoveryMissing ? '404 replays exact body/key' : 'operation lookup avoids repeat POST'}`, async ({ page }) => {
  const f = await fixture(page, { timeout: true, recoveryMissing }); await page.goto('/admin/sales-rewards'); await selectAndPreview(page); await confirmTransfer(page)
  await expect(page.getByRole('button', { name: 'Відновити той самий запит' })).toBeVisible()
  await page.reload(); await page.getByRole('button', { name: 'Відновити збережену операцію' }).click()
  await expect(page.getByText('Результат збереженої операції підтверджено.', { exact: true })).toBeVisible()
  const posted = f.requests.filter(r => r.path === '/settlements' && r.method === 'POST')
  expect(posted).toHaveLength(recoveryMissing ? 2 : 1)
  if (recoveryMissing) expect({ key: posted[1].key, body: posted[1].body }).toEqual({ key: posted[0].key, body: posted[0].body })
})
test('final conflict clears stale selection and does not close entries', async ({ page }) => {
  const f = await fixture(page, { conflict: true }); await page.goto('/admin/sales-rewards'); await selectAndPreview(page); await confirmTransfer(page)
  await expect(page.getByText('Нарахування недоступне для передачі. Перевірте спір або повернення.', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /Обрати нарахування #11/ })).not.toBeChecked()
  expect(f.requests.filter(r => r.path === '/settlements' && r.method === 'POST')).toHaveLength(1)
})
test('master sees only me endpoints without sales grant; mobile and separate date filters remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); const f = await fixture(page, { user: master }); await page.goto('/my-sales-rewards')
  await expect(page.getByRole('heading', { name: 'Мої продажі та винагорода' })).toBeVisible()
  await expect(page.getByText(entry.product_name, { exact: true })).toBeVisible()
  await expect(page.getByText('Ставка для нових ручних нарахувань', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Перевірити передачу' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Цей тиждень' }).click()
  await expect.poll(() => f.requests.filter(r => r.path === '/me/entries').length).toBeGreaterThan(1)
  expect(f.requests.every(r => r.path.startsWith('/me/') && !r.query.has('master_id') && r.method === 'GET')).toBe(true)
  for (const width of [320, 390]) { await page.setViewportSize({ width, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true) }
  await page.screenshot({ path: '/tmp/master-rewards-master-mobile.png', fullPage: true })
  expect(f.external).toEqual([])
})
test('role admin without superuser cannot enter management or trigger rewards API', async ({ page }) => {
  const f = await fixture(page, { user: { ...admin, is_superuser: false } }); await page.goto('/admin/sales-rewards')
  await expect(page).toHaveURL(/dashboard/); expect(f.requests).toHaveLength(0)
})
test('admin compact mobile layout, review block and independent history dates', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); const f = await fixture(page); await page.goto('/admin/sales-rewards')
  await page.getByLabel('Майстер для перегляду та передачі', { exact: true }).selectOption('7')
  await page.getByRole('button', { name: 'Позначити спір / повернення' }).click()
  await page.getByLabel('Підстава спору або повернення').fill('Товар повернуто, потрібен розгляд')
  await page.getByRole('button', { name: 'Позначити для розгляду' }).click()
  await expect(page.getByRole('checkbox', { name: /Обрати нарахування #11/ })).toBeDisabled()
  await page.getByText('Окремий фільтр за датами передачі', { exact: true }).click()
  await page.getByLabel('Передачі з').fill('2026-10-01'); await page.getByLabel('Передачі до').fill('2026-10-30')
  await page.getByRole('button', { name: 'Застосувати до історії' }).click()
  await expect.poll(() => f.requests.filter(r => r.path === '/settlements' && r.query.get('date_from') === '2026-10-01').length).toBe(1)
  for (const width of [320, 390]) { await page.setViewportSize({ width, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true) }
  await page.screenshot({ path: '/tmp/master-rewards-admin-mobile.png', fullPage: true })
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.screenshot({ path: '/tmp/master-rewards-admin-desktop.png', fullPage: true })
})


test('preview freezes selection and confirms the exact immutable displayed composition', async ({ page }) => {
 const f = await fixture(page, { secondEntry: true })
 let started = false
 let release = () => {}
 await page.route('**/master-rewards/settlements/preview', async route => {
   started = true
   await new Promise<void>(resolve => { release = resolve })
   return route.fulfill({ json: { master_id: 7, entry_ids: [11], total_minor: 7500, currency: 'UAH' } })
 })
 await page.goto('/admin/sales-rewards')
 await page.getByLabel('Майстер для перегляду та передачі', { exact: true }).selectOption('7')
 const a = page.getByRole('checkbox', { name: /Обрати нарахування #11/ })
 const b = page.getByRole('checkbox', { name: /Обрати нарахування #12/ })
 await a.check(); await page.getByRole('button', { name: 'Перевірити передачу', exact: true }).click()
 await expect.poll(() => started).toBe(true)
 await expect(a).toBeDisabled(); await expect(b).toBeDisabled()
 await expect(a).toBeChecked(); await expect(b).not.toBeChecked()
 release()
 const modal = page.getByRole('dialog', { name: 'Підтвердити передачу винагороди' })
 await expect(modal.getByText(/#11 · Шампунь Reuzel/)).toBeVisible()
 await expect(modal.getByText('Помада тієї ж вартості', { exact: true })).toHaveCount(0)
 await confirmTransfer(page)
 await expect.poll(() => f.requests.filter(r => r.path === '/settlements' && r.method === 'POST').length).toBe(1)
 expect(f.requests.find(r => r.path === '/settlements' && r.method === 'POST')!.body.entries).toEqual([{ id: 11, expected_revision: 1 }])
})
