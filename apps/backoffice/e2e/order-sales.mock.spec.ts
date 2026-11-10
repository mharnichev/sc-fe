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
  await expect(statusDialog.getByRole('combobox', { name: 'Новий статус' })).toHaveValue('pending')
  await expect(saveStatus).toBeDisabled()
  await statusDialog.getByRole('combobox', { name: 'Новий статус' }).selectOption('confirmed')
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
    ], total_amount: '1150.00', subtotal_amount: '1150.00',
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', user })), user)
  await page.route('**/order-item-demo.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="white"/><rect x="23" y="6" width="18" height="8" rx="2" fill="#333"/><rect x="18" y="14" width="28" height="44" rx="5" fill="#32834e"/><rect x="19" y="28" width="26" height="18" fill="#f5e8bc"/></svg>' }))
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
    if (path.endsWith('/products/8')) return route.fulfill({ json: { id: 8, image_url: '/order-item-demo.svg' } })
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
  await page.screenshot({ path: '/tmp/sc-pos-20261106/legacy-order-detail-desktop.png', fullPage: true })
  await page.getByText('Склад, ціни та знижки', { exact: true }).click()
  await expect(page.getByRole('table', { name: 'Позиції замовлення' })).toBeVisible()
  await page.getByText('Склад, ціни та знижки', { exact: true }).click()
  await page.getByText('Технічні дані та синхронізація', { exact: true }).click()
  await expect(page.getByText('hidden-provider-ref', { exact: true })).toBeVisible()
  await page.getByText('Технічні дані та синхронізація', { exact: true }).click()
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const summary = page.getByRole('region', { name: 'Стан замовлення' })
    const payment = await summary.locator('dt').filter({ hasText: /^Оплата$/ }).boundingBox()
    const fulfillment = await summary.locator('dt').filter({ hasText: /^Виконання$/ }).boundingBox()
    expect(Math.abs(payment!.y - fulfillment!.y)).toBeLessThan(2)
    expect((await summary.boundingBox())!.height).toBeLessThan(290)
  }
  await page.screenshot({ path: '/tmp/sc-pos-20261106/legacy-order-detail-mobile.png', fullPage: true })
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
