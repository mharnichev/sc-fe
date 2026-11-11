import { expect, test } from '@playwright/test'
const user = { id: 1, email: 'fixture@example.test', is_active: true, is_superuser: true, role: 'admin' }
const product = { id: 8, name: 'Fixture shampoo', sku: 'SKU-8', barcode: '12345678', on_hand: 2, reserved: 0, available: 2, allow_backorder: false }
const order = (simulation = false) => ({ id: 321, status: 'pending', channel: 'backoffice_pos', fulfillment_method: 'pickup', customer_name: '', customer_phone: null, total_amount: '123.45', subtotal_amount: '123.45', discount_amount: '0.00', revision: 1, items: [{ id: 11, product_id: 8, product_name: product.name, quantity: 1, price: '123.45', total_price: '123.45', quantity_from_stock: 1, quantity_to_order: 0, quantity_received_for_order: 0 }], payment_status: 'unpaid', fulfillment_status: 'reserved', fiscal_status: 'not_requested', simulation, sales_actions: { can_record_payment: simulation, can_handover: false, blocking_reasons: [] }, payments: [], handovers: [] })

test('existing anonymous simulated order recovers payment exactly then records separate handover', async ({ page }) => {
  let current: any = order(true)
  const preparations: Array<{ key?: string, body: any }> = []
  const payments: Array<{ key?: string, body: any }> = []
  let handovers = 0
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', refreshToken: '', user })), user)
  await page.route('**/api/v1/**', async route => {
    const req = route.request(); const path = new URL(req.url()).pathname
    if (path.endsWith('/integrations/monobank-qr/readiness')) return route.fulfill({ json: { mode: 'mock_only', available: false, blocking_reasons: ['mock_qr_disabled'], cash_registers: [] } })
    if (req.method() === 'GET' && path.endsWith('/qr-payment-attempts')) return route.fulfill({ json: [] })
    if (req.method() === 'GET' && (path.endsWith('/returns') || path.endsWith('/fiscal-documents'))) return route.fulfill({ json: [] })
    if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
    if (path.endsWith('/pos-capabilities')) return route.fulfill({ json: { mode: 'local_only', can_prepare: true, simulation_available: true, blocking_reasons: [] } })
    if (path.endsWith('/inventory/stock')) return route.fulfill({ json: { items: [product], total: 1 } })
    if (path.endsWith('/backoffice/orders') && req.method() === 'POST') {
      preparations.push({ key: req.headers()['idempotency-key'], body: req.postDataJSON() })
      if (preparations.length === 1) return route.abort('failed')
      return route.fulfill({ json: current })
    }
    if (path.endsWith('/321/payments')) {
      payments.push({ key: req.headers()['idempotency-key'], body: req.postDataJSON() })
      current = { ...current, revision: 2, payment_status: 'simulated_paid', payments: [{ id: 1, ...req.postDataJSON(), simulation: true, created_at: '2026-10-17T12:00:00Z' }], sales_actions: { can_record_payment: false, can_handover: true, blocking_reasons: [] } }
      if (payments.length === 1) return route.abort('failed')
      return route.fulfill({ json: current })
    }
    if (path.endsWith('/321/handover')) {
      handovers++
      current = { ...current, revision: 3, status: 'completed', fulfillment_status: 'simulated_handed_over', handovers: [{ id: 2, evidence: req.postDataJSON().evidence, simulation: true, created_at: '2026-10-17T12:01:00Z' }], sales_actions: { can_record_payment: false, can_handover: false, blocking_reasons: [] } }
      return route.fulfill({ json: current })
    }
    if (path.endsWith('/orders/321')) return route.fulfill({ json: current })
    if (path.endsWith('/321/fulfillment')) return route.fulfill({ json: { items: current.items } })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  // This is an existing historical simulated order, not the new live-only POS entry screen.
  await page.goto('/orders/321')
  expect(preparations).toHaveLength(0)
  await expect(page.getByText('123,45', { exact: false }).first()).toBeVisible()
  await expect(page.locator('select option[value="paid"]')).toHaveCount(0)
  await page.getByText('Інший тестовий спосіб оплати', { exact: true }).click()
  await page.getByLabel('Підстава тестової оплати').fill('fixture payment')
  await page.getByRole('button', { name: 'Записати тестову оплату' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Повторити тестову оплату' }).click()
  await expect(page.getByText('Тестова оплата (симуляція)', { exact: true })).toBeVisible()
  expect(payments).toHaveLength(2)
  expect(payments[0]).toEqual(payments[1])
  expect(payments[0].body.amount_minor).toBe(12345)
  await page.getByLabel('Підстава тестової видачі').fill('fixture handover')
  await page.getByRole('button', { name: 'Підтвердити тестову видачу' }).click()
  await expect(page.getByText('Тестова видача (симуляція)', { exact: true })).toBeVisible()
  expect(handovers).toBe(1)
})

test('default local mode and lack of permissions expose no real settlement controls', async ({ page }) => {
  let mutations = 0
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', refreshToken: '', user })), user)
  await page.route('**/api/v1/**', async route => {
    if (route.request().method() !== 'GET') mutations++
    const path = new URL(route.request().url()).pathname
    if (route.request().method() === 'GET' && (path.endsWith('/returns') || path.endsWith('/fiscal-documents'))) return route.fulfill({ json: [] })
    if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
    if (path.endsWith('/pos/capabilities')) return route.fulfill({ json: { mode: 'mono_checkbox', currency: 'UAH', max_quantity: 1, cart_limits: { max_items: 100, max_quantity: 100 }, can_search: false, can_start: false, can_view_admin_sales: false, automatic_reconciliation_enabled: false, poll_after_ms: 30000, blocking_reasons: ['record_sales_required'] } })
    if (path.endsWith('/orders/321')) return route.fulfill({ json: order() })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/orders/pos')
  await expect(page.getByText('Продаж через mono зараз недоступний. Зверніться до адміністратора.', { exact: true })).toBeVisible()
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await page.goto('/orders/321')
  await expect(page.getByText('Лише підготовка замовлення.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: /тестову оплату|тестову видачу/ })).toHaveCount(0)
  expect(mutations).toBe(0)
})


test('delegated sales operator discovers the POS from navigation', async ({ page }) => {
  const operator = { ...user, role: null, is_superuser: false, can_record_sales: true }
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', refreshToken: '', user })), operator)
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/auth/me')) return route.fulfill({ json: operator })
    if (path.endsWith('/pos/capabilities')) return route.fulfill({ json: { mode: 'mono_checkbox', currency: 'UAH', max_quantity: 1, cart_limits: { max_items: 100, max_quantity: 100 }, can_search: false, can_start: false, can_view_admin_sales: false, automatic_reconciliation_enabled: false, poll_after_ms: 30000, blocking_reasons: ['accept_qr_required'] } })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/orders/pos')
  await expect(page.getByRole('link', { name: 'Продати товар', exact: true }).first()).toBeAttached()
  await expect(page.getByRole('heading', { name: 'Продати товар' })).toBeVisible()
})


test('ordinary nonmaster staff retains item, contact, address and preliminary order details', async ({ page }) => {
  const staff = { ...user, is_superuser: false, role: null }
  const current = { ...order(), channel: 'shop', customer_name: 'Fixture customer', customer_phone: '+380500000000', shipping_city: 'Fixture city' }
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', user })), staff)
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/auth/me')) return route.fulfill({ json: staff })
    if (path.endsWith('/orders/321')) return route.fulfill({ json: current })
    if (path.endsWith('/321/fulfillment')) return route.fulfill({ json: { items: current.items } })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/orders/321')
  await expect(page.getByRole('heading', { name: 'Позиції', exact: true })).toBeVisible()
  await expect(page.getByText('Fixture customer', { exact: true })).toBeVisible()
  await expect(page.getByText('Fixture city', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Оновити статус', exact: true })).not.toBeVisible()
  await page.getByRole('button', { name: 'Змінити статус', exact: true }).click()
  const statusDialog = page.getByRole('dialog', { name: 'Змінити статус замовлення' })
  const saveStatus = statusDialog.getByRole('button', { name: 'Оновити статус', exact: true })
  const statuses = statusDialog.getByRole('button', { name: 'Новий статус' })
  await expect(statuses).toHaveText('Очікує')
  await expect(saveStatus).toBeDisabled()
  await statuses.click()
  await statusDialog.getByRole('option', { name: 'Підтверджено', exact: true }).click()
  await expect(saveStatus).toBeEnabled()
  await page.getByRole('button', { name: 'Закрити', exact: true }).click()
  await page.getByText('Документи та чеки', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Попередні документи SC', exact: true })).toBeVisible()
})

test('mobile quick POS preserves photos, stock guards and anonymous quantity-one recovery', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 })
  const picturedProduct = { id: product.id, name: product.name, sku: product.sku, barcode: product.barcode, brand_name: 'Fixture', variant_label: '350 мл', amount_minor: 12345, currency: 'UAH', available_quantity: product.available, can_sell: true, blocking_reasons: [], image_url: '/pos-fixture.svg' }
  await page.route('**/pos-fixture.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"><rect width="56" height="56" fill="white"/><rect x="18" y="8" width="20" height="40" rx="4" fill="seagreen"/></svg>' }))
  const submitted: Array<{ body: Record<string, unknown>, key?: string }> = []
  let checkout: Record<string, unknown> | null = null
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', user })), user)
  await page.route('**/api/v1/**', route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
    if (path.endsWith('/pos/capabilities')) return route.fulfill({ json: { mode: 'mono_checkbox', currency: 'UAH', max_quantity: 1, cart_limits: { max_items: 100, max_quantity: 100 }, can_search: true, can_start: true, can_view_admin_sales: true, automatic_reconciliation_enabled: true, poll_after_ms: 30000, blocking_reasons: [] } })
    if (path.endsWith('/pos/products')) return route.fulfill({ json: { items: [picturedProduct, { ...picturedProduct, id: 9, name: 'Unavailable product', available_quantity: 0, can_sell: false }], total: 2, page: 1, page_size: 20 } })
    if (path.endsWith('/pos/checkouts/active')) return route.fulfill({ json: { items: checkout ? [checkout] : [], total: checkout ? 1 : 0, page: 1, page_size: 20 } })
    if (path.includes('/pos/checkouts/by-intent/')) return checkout ? route.fulfill({ json: checkout }) : route.fulfill({ status: 404, json: { detail: { code: 'missing' } } })
    if (path.endsWith('/pos/cart/quote')) return route.fulfill({ json: { items: [{ product_id: 8, quantity: 1, base_unit_minor: 12345, unit_minor: 12345, promotion_id: null, promotion_name: null, promotion_code: null }], subtotal_minor: 12345, discount_minor: 0, amount_minor: 12345, applied_promo_code: null, promotion_id: null, available_promotions: [], quote_revision: 'a'.repeat(64), currency: 'UAH' } })
    if (path.endsWith('/pos/checkouts') && req.method() === 'POST') {
      const body = req.postDataJSON()
      submitted.push({ body, key: req.headers()['idempotency-key'] })
      checkout = { checkout_id: '11111111-1111-4111-8111-111111111111', intent_id: body.intent_id, order_id: 321, revision: 1, created_at: '2026-11-06T12:00:00Z', employee: { user_id: user.id, master_id: null, display_name: 'Fixture seller' }, items: [{ product_id: product.id, name: product.name, sku: product.sku, barcode: product.barcode, image_url: picturedProduct.image_url, variant_label: picturedProduct.variant_label, quantity: 1, unit_minor: 12345, total_minor: 12345 }], amount_minor: 12345, currency: 'UAH', order_status: 'pending', status: 'awaiting_payment', payment: { provider: 'monobank', status: 'pending', invoice_id: 'synthetic-321', confirmed_at: null, qr_payload: 'https://pay.mbnk.biz/synthetic-321' }, receipt: { issuer: 'checkbox', status: 'not_requested', recorded_at: null, pdf_url: null }, handover: { status: 'not_ready', actor_user_id: null, handed_over_at: null }, actions: { can_resume: false, can_refresh: true, can_handover: false, can_recover_invoice: false, can_start_new: false }, poll_after_ms: 30000, blocking_reasons: [] }
      return route.abort('failed')
    }
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/orders/pos')
  await expect(page.getByLabel('Ім’я клієнта (необов’язково)')).toHaveCount(0)
  await expect(page.getByRole('spinbutton')).toHaveCount(0)
  expect(submitted).toHaveLength(0)
  await page.getByLabel('Знайти товар', { exact: true }).fill('SKU-8')
  await page.getByLabel('Знайти товар', { exact: true }).press('Enter')
  const available = page.getByRole('button', { name: /Додати: Fixture shampoo/ })
  await expect(page.getByRole('button', { name: /Додати: Unavailable product/ })).toBeDisabled()
  await expect.poll(() => page.locator('article').filter({ has: available }).locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  expect(submitted).toHaveLength(0)
  await available.click()
  await expect(page.getByRole('region', { name: 'Панель кошика' })).toContainText('123,45')
  await page.getByRole('button', { name: 'Перейти до оплати', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Відновити цей продаж', exact: true })).toBeVisible()
  expect(submitted).toHaveLength(1)
  const intent = submitted[0].body.intent_id
  expect(submitted[0].body).toEqual({ intent_id: intent, items: [{ product_id: 8, quantity: 1 }], promo_code: null, promotion_id: null, quote_revision: 'a'.repeat(64), currency: 'UAH' })
  expect(submitted[0].key).toMatch(/^[0-9a-f-]{36}$/)
  await page.reload()
  await expect(page.getByRole('img', { name: 'QR для оплати mono' })).toBeVisible()
  await expect(page).toHaveURL(/orders\/pos$/)
  await expect.poll(() => page.locator('[aria-label="Поточний продаж"]').locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  expect(submitted).toHaveLength(1)
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 780 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
  await expect(page.getByRole('button', { name: 'Товар видано', exact: true })).toHaveCount(0)
  await page.screenshot({ path: '/tmp/sc-pos-20261106/legacy-suite-quick-pos-mobile.png', fullPage: true })
})


test('desktop order keeps essentials visible and technical data collapsed', async ({ page }) => {
  const current = { ...order(), id: 3, channel: 'shop', fulfillment_method: null, customer_name: 'Олександр Коваль', customer_phone: '+380501234567', customer_email: 'customer@example.test', created_at: '2026-10-18T10:15:00Z', shipping_city: 'Одеса', shipping_company: 'Нова пошта', shipping_warehouse_number: '12', shipping_settlement_ref: 'hidden-provider-ref', external_id: 'hidden-external-id',
    items: [
      { ...order().items[0], product_name: 'Шампунь Reuzel Daily Shampoo', quantity: 2, price: '350.00', total_price: '700.00' },
      { ...order().items[0], id: 12, product_id: 9, product_name: 'Помада Reuzel Blue', price: '450.00', total_price: '450.00' },
      { ...order().items[0], id: 13, product_id: 10, product_name: 'Товар зі збереженим фото', product_image_url: '/order-item-demo.svg', price: '50.00', total_price: '50.00' },
    ], total_amount: '1200.00', subtotal_amount: '1200.00',
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', user })), user)
  await page.route('**/order-item-demo.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="white"/><rect x="23" y="6" width="18" height="8" rx="2" fill="#333"/><rect x="18" y="14" width="28" height="44" rx="5" fill="#32834e"/><rect x="19" y="28" width="26" height="18" fill="#f5e8bc"/></svg>' }))
  await page.route('**/order-item-missing.svg', route => route.fulfill({ status: 404 }))
  let snapshotCatalogReads = 0
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
    if (path.endsWith('/products/8')) return route.fulfill({ json: { id: 8, display_image_urls: ['/order-item-missing.svg', '/order-item-demo.svg'] } })
    if (path.endsWith('/products/10')) snapshotCatalogReads++
    if (path.endsWith('/products/9')) return route.fulfill({ status: 403, json: { detail: 'Catalog unavailable' } })
    if (path.endsWith('/orders/3')) return route.fulfill({ json: current })
    if (path.endsWith('/3/fulfillment')) return route.fulfill({ json: { items: current.items } })
    if (path.endsWith('/returns') || path.endsWith('/fiscal-documents')) return route.fulfill({ json: [] })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/orders/3')
  await expect(page.getByRole('heading', { name: 'Замовлення #3', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Шампунь Reuzel Daily Shampoo', exact: true })).toBeVisible()
  await expect(page.getByText('Олександр Коваль', { exact: true })).toBeVisible()
  await expect(page.getByText('Не оплачено', { exact: true })).toBeVisible()
  await expect(page.getByText('hidden-provider-ref', { exact: true })).not.toBeVisible()
  await expect(page.getByText('hidden-external-id', { exact: true })).not.toBeVisible()
  await expect(page.getByRole('table', { name: 'Позиції замовлення' })).not.toBeVisible()
  const picturedItem = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Шампунь Reuzel Daily Shampoo', exact: true }) })
  await expect(picturedItem.locator('img')).toBeVisible()
  await expect.poll(() => picturedItem.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  const itemWithoutPhoto = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Помада Reuzel Blue', exact: true }) })
  await expect(itemWithoutPhoto.locator('img')).toHaveCount(0)
  const snapshotItem = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Товар зі збереженим фото', exact: true }) })
  await expect.poll(() => snapshotItem.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  expect(snapshotCatalogReads).toBe(0)
  await page.getByText('Склад, ціни та знижки', { exact: true }).click()
  await expect(page.getByRole('table', { name: 'Позиції замовлення' })).toBeVisible()
  await page.getByText('Склад, ціни та знижки', { exact: true }).click()
  await page.getByText('Технічні дані та синхронізація', { exact: true }).click()
  await expect(page.getByText('hidden-provider-ref', { exact: true })).toBeVisible()
  await page.getByText('Технічні дані та синхронізація', { exact: true }).click()
  const summary = page.getByRole('region', { name: 'Стан замовлення' })
  const receipt = summary.getByRole('button', { name: 'Чек та фіскалізація' })
  const fiscal = summary.getByText('Фіскалізація', { exact: true })
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await summary.scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const payment = await summary.getByText('Оплата', { exact: true }).boundingBox()
    const fulfillment = await summary.getByText('Виконання', { exact: true }).boundingBox()
    const receiptBox = (await receipt.boundingBox())!
    expect(Math.abs(payment!.y - fulfillment!.y)).toBeLessThan(2)
    expect(receiptBox.height).toBeGreaterThanOrEqual(44)
    expect(payment!.y + payment!.height).toBeGreaterThan(receiptBox.y)
    expect(payment!.y).toBeLessThan(receiptBox.y + receiptBox.height)
    expect((await summary.boundingBox())!.height).toBeLessThan(100)
    await expect(picturedItem.locator('img')).toBeVisible()
  }
  await expect(fiscal).not.toBeVisible()
  await receipt.press('Enter')
  await expect(receipt).toHaveAttribute('aria-expanded', 'true')
  await expect(fiscal).toBeVisible()
  await receipt.press('Enter')
  await expect(fiscal).not.toBeVisible()
  current.fiscal_status = 'checkbox_fiscal_unknown'
  await page.reload()
  await expect(summary.getByText('Результат Checkbox невідомий', { exact: false })).toBeVisible()
})


test('order layout preserves barber visibility restrictions', async ({ page }) => {
  const barber = { ...user, role: 'barber', is_superuser: false }
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', user })), barber)
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/auth/me')) return route.fulfill({ json: barber })
    if (path.endsWith('/orders/321')) return route.fulfill({ json: { ...order(), channel: 'shop', customer_name: 'Hidden customer' } })
    if (path.endsWith('/321/fulfillment')) return route.fulfill({ json: { items: order().items } })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/orders/321')
  await expect(page.getByRole('heading', { name: 'Замовлення #321', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Стан замовлення' })).toHaveCount(0)
  await expect(page.getByText('Hidden customer', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Документи та чеки', { exact: true })).toHaveCount(0)
})

test('external Mono receipt uses only its own read, refresh and PDF actions', async ({ page, context }, testInfo) => {
  const profile = 'synthetic-mono'
  const hash = 'a'.repeat(64)
  const current = { ...order(), channel: 'shop', payment_method: 'onlineCard', payment_status: 'paid_production' }
  let refreshed = false
  const writes: string[] = []
  await context.route(url => !['127.0.0.1', 'localhost'].includes(url.hostname), route => route.abort())
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', user })), user)
  await page.route('**/api/v1/**', route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() !== 'GET') writes.push(path)
    if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
    if (path.endsWith('/backoffice/orders/321')) return route.fulfill({ json: current })
    if (path.endsWith('/shop-checkbox/orders/321/profile')) return route.fulfill({ status: 500, json: {} })
    if (path.endsWith('/321/shop-operations')) return route.fulfill({ json: { order_id: 321, fiscal_profile: 'mono_checkbox_external' } })
    if (path.endsWith('/shop-payments/orders/321')) return route.fulfill({ json: {
      order_id: 321, revision: 1, mode: 'prepayment', profile_id: profile, profile_hash: hash,
      intent: { status: 'accepted' }, payment: { id: 12 },
    } })
    if (path.endsWith('/external-receipt/pdf')) return route.fulfill({ contentType: 'application/pdf', body: '%PDF-1.4\n%%EOF' })
    if (path.endsWith('/external-receipt/refresh')) {
      expect(request.postDataJSON()).toEqual({ expected_revision: 1, expected_profile_id: profile, expected_profile_hash: hash })
      expect(request.headers()['idempotency-key']).toBeTruthy()
      refreshed = true
    }
    if (/\/external-receipt(?:\/refresh)?$/.test(path)) return route.fulfill({ json: {
      order_id: 321, revision: 1, fiscal_profile: 'mono_checkbox_external', enabled: true, paid: true,
      accepted: refreshed, authority: refreshed ? 'test' : 'none', status: refreshed ? 'accepted' : 'mono_checkbox_receipt_pending',
      receipt: refreshed ? { pdf_available: true, imported_at: '2026-11-11T08:00:00Z' } : null,
    } })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/orders/321')
  await page.getByRole('button', { name: 'Змінити статус', exact: true }).click()
  const statusDialog = page.getByRole('dialog', { name: 'Змінити статус замовлення' })
  await statusDialog.getByRole('button', { name: 'Новий статус' }).click()
  await expect(statusDialog.getByRole('option', { name: 'Підтверджено' })).toBeVisible()
  await expect(statusDialog.getByRole('option', { name: 'Відмова' })).toHaveCount(0)
  await statusDialog.getByRole('button', { name: 'Закрити', exact: true }).click()
  const receipt = page.getByRole('region', { name: 'Чек mono → Checkbox' })
  await page.locator('summary').filter({ hasText: 'Документи та чеки' }).click()
  await expect(receipt.getByText('Чек формується', { exact: true })).toBeVisible()
  await expect(receipt.getByRole('button')).toHaveCount(1)
  await receipt.screenshot({ path: testInfo.outputPath('external-receipt-390.png') })
  await receipt.getByRole('button', { name: 'Звірити чек', exact: true }).click()
  await expect(receipt.getByText('Чек підтверджено', { exact: true })).toBeVisible()
  const download = page.waitForEvent('download')
  await receipt.getByRole('button', { name: 'Завантажити PDF' }).click()
  expect((await download).suggestedFilename()).toBe('receipt-321.pdf')
  expect(writes).toEqual(['/api/v1/backoffice/shop-payments/orders/321/external-receipt/refresh'])
  await page.setViewportSize({ width: 1440, height: 900 })
  await receipt.screenshot({ path: testInfo.outputPath('external-receipt-1440.png') })
})

test('statement discovery uses the canonical action and guards closing during invoice dispatch', async ({ page, context }, testInfo) => {
  const profile = 'synthetic-mono'
  const hash = 'b'.repeat(64)
  const current = { ...order(), channel: 'shop', payment_method: 'onlineCard' }
  const caseRecord = {
    id: 7, order_id: 321, revision: 1, order_revision: 1, kind: 'invoice_review', profile_id: profile, profile_hash: hash,
    status: 'inspection_required', reason: 'Підтвердити результат створення рахунку', test_context: true, snapshot: {},
    known_invoice_ids: [], observations: [], exceptions: [], actions: { discover: true, inspect: true, close_unpaid: true }, blocking_reasons: [],
  }
  let reads = 0, discoveries = 0
  await context.route(url => !['127.0.0.1', 'localhost'].includes(url.hostname), route => route.abort())
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', user })), user)
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
    if (path.endsWith('/backoffice/orders/321')) return route.fulfill({ json: current })
    if (path.endsWith('/shop-checkbox/orders/321/profile')) return route.fulfill({ json: { order_id: 321, fiscal_profile: 'unavailable' } })
    if (path.endsWith('/shop-payment-resolutions/orders/321')) {
      reads++
      return route.fulfill({ json: {
        order_id: 321, revision: 1, enabled: true, paid_profile_hash: null, invoice_profile_hash: hash,
        invoice_candidate_id: 'candidate-synthetic', invoice_dispatch_in_flight: true,
        cases: [caseRecord], actions: {}, blocking_reasons: [],
      } })
    }
    if (path.endsWith('/shop-payment-resolutions/cases/7/discover')) {
      discoveries++
      expect(request.method()).toBe('POST')
      expect(request.headers()['idempotency-key']).toBeTruthy()
      expect(request.postDataJSON()).toEqual({
        expected_revision: 1, expected_profile_id: profile, expected_profile_hash: hash,
        start: expect.stringMatching(/Z$/), end: expect.stringMatching(/Z$/),
      })
      return route.fulfill({ status: 409, json: { detail: { code: 'resolution_revision_conflict' } } })
    }
    expect(request.method(), path).toBe('GET')
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/orders/321')
  await page.getByText('Оплата та звірка', { exact: true }).click()
  const resolution = page.getByRole('region', { name: 'Скасування до видачі та звірка передплати' })
  const action = resolution.getByRole('button', { name: 'Знайти рахунок у виписці' })
  await expect(resolution.getByText('Неперевірений рахунок · candidate-synthetic')).toBeVisible()
  await expect(resolution.getByText(/Закриття тимчасово заблоковано/)).toBeVisible()
  await expect(resolution.getByRole('button', { name: /Закрити неоплачене/ })).toHaveCount(0)
  await expect(action).toBeDisabled()
  await resolution.getByLabel('Початок періоду (місцевий час)').fill('2026-11-10T08:00')
  await resolution.getByLabel('Кінець періоду (місцевий час)').fill('2026-11-10T10:00')
  await expect(action).toBeEnabled()
  await resolution.screenshot({ path: testInfo.outputPath('backoffice-discovery-390.png') })
  await page.setViewportSize({ width: 1440, height: 900 })
  await resolution.screenshot({ path: testInfo.outputPath('backoffice-discovery-1440.png') })
  await action.click()
  await expect(resolution.getByRole('alert')).toContainText('Стан випадку змінився')
  expect(reads).toBeGreaterThan(1)
  expect(discoveries).toBe(1)
})

for (const kind of ['full', 'partial'] as const) {
test(`direct ${kind} test refund recovers a lost start and reports separate fiscal facts`, async ({ page, context }, testInfo) => {
  let starts = 0, checks = 0
  const returned = kind === 'full' ? 12345 : 6000
  const report = () => ({
    issuer: 'mono_checkbox_external', authority: 'test', currency: 'UAH', net_minor: checks === 2 ? 12345 - returned : 12345,
    entries: [
      { kind: 'sale', receipt_id: 'synthetic-sale', original_receipt_id: null, amount_minor: 12345, structured_totals_verified: false },
      ...(checks === 2 ? [{ kind: 'return', receipt_id: 'synthetic-receipt', original_receipt_id: 'synthetic-sale', amount_minor: returned, structured_totals_verified: true }] : []),
    ],
  })
  let current = { ...order(), channel: 'shop', payment_method: 'onlineCard', status: 'paid', payment_status: 'simulated_paid' }
  let comparisons = 0
  let comparisonDenied = false
  const shift = (reportId: string, sold: number, returned: number) => ({
    kind: 'x', report_id: reportId, scope: 'provider_cash_register_shift', authority: 'test',
    currency: 'UAH', reported_at: '2026-11-11T09:00:00Z', shift_sale_minor: sold, shift_return_minor: returned,
  })
  const state = () => ({
    order_id: 321, revision: current.revision, available: checks < 2,
    can_start: starts === 0, can_reconcile: starts > 0 && checks < 2,
    refundable_items: starts ? [] : [{ basket_index: 0, name: 'Fixture shampoo', quantity: 2, unit_amount_minor: 6000 }],
    kind: starts ? kind : null, amount_minor: starts ? returned : null, ext_ref: starts ? 'synthetic-reference' : null,
    bank_confirmed: checks === 2, return_receipt_id: checks ? 'synthetic-receipt' : null,
    finalized_at: checks === 2 ? '2026-11-11T08:00:00Z' : null, last_checked_at: checks ? '2026-11-11T08:00:00Z' : null,
    reason: !starts ? 'ready' : checks === 2 ? 'complete' : 'bank_reconciliation_required',
  })
  await context.route(url => !['127.0.0.1', 'localhost'].includes(url.hostname), route => route.abort())
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', user })), user)
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
    if (path.endsWith('/backoffice/orders/321')) return route.fulfill({ json: current })
    if (path.endsWith('/shop-checkbox/orders/321/profile')) return route.fulfill({ json: { order_id: 321, fiscal_profile: 'mono_checkbox_external' } })
    if (path.endsWith('/321/shop-operations')) return route.fulfill({ json: {
      order_id: 321, revision: current.revision, order: current, stage: 'paid', authority: 'test', payment: null, fulfillment: null, completion: null,
      actions: {}, blocking_reasons: [], available_payment_methods: [], external_fiscal_report: report(),
    } })
    if (path.endsWith('/shop-external-fiscal-reports/orders/321')) {
      expect(request.method()).toBe('GET')
      comparisons++
      return route.fulfill(comparisonDenied ? { status: 403, json: {} } : { json: {
        order_id: 321, revision: current.revision, local_status: 'projected', local_projection: report(), refund_status: 'finalized',
        provider_x: { status: 'matched', evidence: null, missing_receipt_ids: [],
          reports: [shift('synthetic-x1', 80000, 0), shift('synthetic-x2', 34500, 20000)] },
        provider_z: { status: 'missing', reports: [], evidence: null, missing_receipt_ids: [] },
      } })
    }
    if (path.endsWith('/shop-direct-refunds/orders/321/start')) {
      expect(request.method()).toBe('POST')
      expect(request.headers()['idempotency-key']).toBeTruthy()
      expect(request.postDataJSON()).toEqual({ expected_revision: 1, kind, goods_in_custody: true, quantities: kind === 'partial' ? { 0: 1 } : {} })
      starts++
      current = { ...current, revision: 2 }
      return route.abort('connectionreset')
    }
    if (path.endsWith('/shop-direct-refunds/orders/321/reconcile')) {
      expect(request.method()).toBe('POST')
      checks++
      if (checks === 2) current = { ...current, revision: 3, status: kind === 'full' ? 'cancelled' : 'paid' }
      return route.fulfill({ json: state() })
    }
    if (path.endsWith('/shop-direct-refunds/orders/321')) return route.fulfill({ json: state() })
    expect(request.method(), path).toBe('GET')
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/orders/321')
  await page.locator('summary').filter({ hasText: /^Повернення$/ }).click()
  const refund = page.getByRole('region', { name: 'Повернення mono → Checkbox' })
  const start = refund.getByTestId('direct-refund-start')
  const reconcile = refund.getByTestId('direct-refund-reconcile')
  await expect(start).toBeDisabled()
  if (kind === 'partial') {
    await refund.getByRole('button', { name: 'Обсяг повернення' }).click()
    await refund.getByRole('option', { name: 'Часткове повернення' }).click()
    await refund.getByRole('spinbutton', { name: /Fixture shampoo/ }).fill('1')
  }
  await refund.getByRole('checkbox', { name: /весь товар/ }).check()
  await start.click()
  await expect(reconcile).toBeVisible()
  expect(starts).toBe(1)
  await expect(start).toHaveCount(0)
  await reconcile.click()
  await expect(refund.getByText('Чек підтверджено', { exact: true })).toBeVisible()
  await expect(refund.getByText('Очікуємо підтвердження банку', { exact: true })).toBeVisible()
  await expect(refund.getByText(/Остання звірка/)).toBeVisible()
  await refund.screenshot({ path: testInfo.outputPath('direct-refund-reconciliation-390.png') })
  await reconcile.click()
  await expect(refund.getByText('Повернення завершено', { exact: true })).toBeVisible()
  await expect(refund.getByText('Повернення підтверджено', { exact: true })).toBeVisible()
  await expect(reconcile).toHaveCount(0)
  expect(starts).toBe(1)
  expect(checks).toBe(2)
  await page.setViewportSize({ width: 1440, height: 900 })
  await refund.screenshot({ path: testInfo.outputPath('direct-refund-complete-1440.png') })
  await page.locator('summary').filter({ hasText: 'Фіскальний звіт замовлення' }).click()
  const fiscal = page.getByRole('region', { name: 'Фіскальний звіт mono → Checkbox' })
  await expect(fiscal.getByText('Продаж', { exact: true })).toBeVisible()
  await expect(fiscal.getByText('Повернення', { exact: true })).toBeVisible()
  await expect(fiscal.getByText('Чек продажу · synthetic-sale')).toBeVisible()
  await expect(fiscal.getByTestId('external-fiscal-net')).toContainText(kind === 'full' ? /0,00\s+грн/ : /63,45\s+грн/)
  await fiscal.screenshot({ path: testInfo.outputPath(`external-fiscal-report-${kind}-1440.png`) })
  const width = kind === 'full' ? 390 : 1440
  await page.setViewportSize({ width, height: 900 })
  const comparison = page.getByRole('region', { name: 'Звірка зовнішньої зміни' })
  const check = comparison.getByRole('button', { name: 'Перевірити звіти X і Z' })
  expect(comparisons).toBe(0)
  await check.click()
  await expect(comparison.getByText('Чеки замовлення збігаються')).toBeVisible()
  await expect(comparison.getByText('Звіт зміни відсутній')).toBeVisible()
  await expect(comparison.getByText('Продажі за зміну')).toHaveCount(2)
  await expect(comparison.getByText(/800,00/)).toBeVisible()
  await expect(comparison.getByText(/345,00/)).toBeVisible()
  await expect(comparison.getByText(/Залишок за замовленням/)).toContainText(kind === 'full' ? /0,00/ : /63,45/)
  await comparison.screenshot({ path: testInfo.outputPath(`external-shifts-${width}.png`) })
  comparisonDenied = true
  await check.click()
  await expect(comparison.getByRole('alert')).toContainText('Немає дозволу')
  await expect(comparison.getByText('Продажі за зміну')).toHaveCount(0)
  expect(comparisons).toBe(2)
})
}

for (const width of [390, 1440]) {
  test(`operations watch shows bounded queue and only order navigation at ${width}px`, async ({ page, context }, testInfo) => {
    let denied = false
    await context.route(url => !['127.0.0.1', 'localhost'].includes(url.hostname), route => route.abort())
    await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', user })), user)
    await page.route('**/api/v1/**', route => {
      const request = route.request(), path = new URL(request.url()).pathname
      expect(request.method(), path).toBe('GET')
      if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
      if (path.endsWith('/shop-operations-watch')) return route.fulfill(denied ? { status: 403, json: {} } : { json: {
        observed_at: '2026-11-11T10:00:00Z', counts: { payment_without_sale: 1, refund_stale: 2, sms_uncertain: 1 },
        stale_minutes: 60, total: 4, truncated: true, automatic_actions: false,
        issues: [
          { reason: 'payment_without_sale', entity_id: '4', order_id: 321, since: '2026-11-11T07:00:00Z', authority: 'test', reserved_units: null },
          { reason: 'refund_stale', entity_id: '7', order_id: 322, since: '2026-11-11T08:00:00Z', authority: 'test', reserved_units: 1, stage: 'refund_receipt_pending' },
          { reason: 'sms_uncertain', entity_id: 'internal-id', order_id: null, since: '2026-11-11T09:00:00Z', authority: 'unverified', reserved_units: null },
        ], background_process: { role: 'owner', state: 'running', last_error_code: null, scheduler_names: [] },
      } })
      return route.fulfill({ json: { items: [], total: 0 } })
    })
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/orders/operations-watch')
    const queue = page.getByRole('region', { name: 'Черга операцій' })
    await expect(queue.getByText('Показано 3 з 4 операцій.')).toBeVisible()
    await expect(queue.getByText('Оплата очікує чека продажу')).toBeVisible()
    await expect(queue.getByText('Очікуємо чек повернення')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    await expect(queue.getByRole('link', { name: 'Відкрити замовлення №321' })).toHaveAttribute('href', '/orders/321')
    await expect(queue.getByRole('link')).toHaveCount(2)
    await expect(queue.getByText('internal-id')).toHaveCount(0)
    await queue.screenshot({ path: testInfo.outputPath(`operations-queue-${width}.png`) })
    denied = true
    await page.getByRole('button', { name: 'Оновити спостереження' }).click()
    await expect(page.getByRole('alert')).toContainText('Немає прав')
    await expect(queue).toHaveCount(0)
  })
}
