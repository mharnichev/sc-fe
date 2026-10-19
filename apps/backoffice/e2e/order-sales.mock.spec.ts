import { expect, test } from '@playwright/test'
const user = { id: 1, email: 'fixture@example.test', is_active: true, is_superuser: true, role: 'admin' }
const product = { id: 8, name: 'Fixture shampoo', sku: 'SKU-8', barcode: '12345678', on_hand: 2, reserved: 0, available: 2, allow_backorder: false }
const order = (simulation = false) => ({ id: 321, status: 'pending', channel: 'backoffice_pos', fulfillment_method: 'pickup', customer_name: '', customer_phone: null, total_amount: '123.45', subtotal_amount: '123.45', discount_amount: '0.00', revision: 1, items: [{ id: 11, product_id: 8, product_name: product.name, quantity: 1, price: '123.45', total_price: '123.45', quantity_from_stock: 1, quantity_to_order: 0, quantity_received_for_order: 0 }], payment_status: 'unpaid', fulfillment_status: 'reserved', fiscal_status: 'not_requested', simulation, sales_actions: { can_record_payment: simulation, can_handover: false, blocking_reasons: [] }, payments: [], handovers: [] })

test('anonymous POS recovers exact preparation after timeout/reload then records separate simulated facts', async ({ page }) => {
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
  await page.goto('/orders/pos')
  await page.getByLabel('Тестовий режим (без реальної оплати)').check()
  await page.getByRole('button', { name: 'Знайти / сканувати товар' }).click()
  await page.getByLabel('Назва або SKU').fill('SKU-8')
  await page.getByRole('button', { name: 'Пошук', exact: true }).click()
  await page.getByRole('button', { name: 'Вибрати товар' }).click()
  await page.getByRole('button', { name: 'Перевірити суму', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Відновити підготовку' }).click()
  await expect(page).toHaveURL(/orders\/321$/)
  expect(preparations).toHaveLength(2)
  expect(preparations[0]).toEqual(preparations[1])
  expect(preparations[0].body).toEqual({ items: [{ product_id: 8, quantity: 1 }], fulfillment_method: 'pickup', simulation: true })
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
    if (path.endsWith('/pos-capabilities')) return route.fulfill({ json: { mode: 'local_only', can_prepare: false, simulation_available: false, blocking_reasons: ['record_sales_required'] } })
    if (path.endsWith('/orders/321')) return route.fulfill({ json: order() })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/orders/pos')
  await expect(page.getByRole('button', { name: 'Перевірити суму', exact: true })).toBeDisabled()
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
    if (path.endsWith('/pos-capabilities')) return route.fulfill({ json: { mode: 'local_only', can_prepare: true, simulation_available: false, blocking_reasons: [] } })
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
  await page.getByText('Змінити статус замовлення', { exact: true }).click()
  await expect(page.getByRole('button', { name: 'Оновити статус', exact: true })).toBeVisible()
  await page.getByText('Документи та чеки', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Попередні документи SC', exact: true })).toBeVisible()
})

test('mobile POS guides selection, quantity edits and optional customer details without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 })
  const picturedProduct = { ...product, image_url: '/pos-fixture.svg' }
  await page.route('**/pos-fixture.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"><rect width="56" height="56" fill="white"/><rect x="18" y="8" width="20" height="40" rx="4" fill="seagreen"/></svg>' }))
  let submitted: any
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', user })), user)
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
    if (path.endsWith('/pos-capabilities')) return route.fulfill({ json: { mode: 'local_only', can_prepare: true, simulation_available: true, blocking_reasons: [] } })
    if (path.endsWith('/inventory/stock')) return route.fulfill({ json: { items: [picturedProduct], total: 1 } })
    if (path.endsWith('/backoffice/orders') && route.request().method() === 'POST') {
      submitted = route.request().postDataJSON()
      return route.fulfill({ json: order() })
    }
    if (path.endsWith('/orders/321')) return route.fulfill({ json: order() })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/orders/pos')
  const next = page.getByRole('button', { name: 'Перевірити суму', exact: true })
  await expect(next).toBeDisabled()
  await expect(page.getByLabel('Ім’я клієнта (необов’язково)')).not.toBeVisible()
  await page.getByRole('button', { name: 'Знайти / сканувати товар' }).click()
  await expect(page.getByLabel('Штрихкод', { exact: true })).not.toBeVisible()
  await page.getByRole('button', { name: 'Сканувати', exact: true }).click()
  await expect(page.getByLabel('Штрихкод', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Сховати сканер', exact: true }).click()
  await expect(page.getByLabel('Штрихкод', { exact: true })).not.toBeVisible()
  await page.getByLabel('Назва або SKU').fill('SKU-8')
  await page.getByRole('button', { name: 'Пошук', exact: true }).click()
  await expect(page.getByText(`Артикул: ${product.sku}`, { exact: true })).not.toBeVisible()
  await expect(page.getByText(`Штрихкод: ${product.barcode}`, { exact: true })).not.toBeVisible()
  const resultImage = page.getByRole('button', { name: `Додати: ${product.name}`, exact: true }).locator('img')
  await expect(resultImage).toBeVisible()
  await expect.poll(() => resultImage.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  await page.screenshot({ path: '/tmp/pos-mobile-compact-search.png', fullPage: true })
  await page.getByRole('button', { name: `Додати: ${product.name}`, exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Знайти товар', exact: true })).not.toBeVisible()
  const cartRow = page.locator('article').filter({ has: page.getByRole('heading', { name: product.name, exact: true }) })
  await expect(cartRow.locator('img')).toBeVisible()
  await expect.poll(() => cartRow.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  expect((await cartRow.boundingBox())!.height).toBeLessThan(150)
  const quantity = page.getByRole('spinbutton', { name: `Кількість: ${product.name}` })
  await page.getByRole('button', { name: `Збільшити кількість: ${product.name}` }).click()
  await expect(quantity).toHaveValue('2')
  await page.getByRole('button', { name: `Зменшити кількість: ${product.name}` }).click()
  await expect(quantity).toHaveValue('1')
  await quantity.fill('0')
  await expect(next).toBeDisabled()
  await expect(page.getByRole('alert')).toContainText('цілу кількість')
  await quantity.fill('1')
  await page.getByText('Клієнт і промокод · необов’язково', { exact: true }).click()
  await expect(page.getByLabel('Телефон (необов’язково)')).toHaveAttribute('type', 'tel')
  await page.getByLabel('Телефон (необов’язково)').fill('+380501234567')
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 780 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
  await page.getByRole('button', { name: `Прибрати: ${product.name}` }).click()
  await expect(next).toBeDisabled()
  await expect(page.getByText('Додайте перший товар', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Знайти / сканувати товар' }).click()
  await page.getByLabel('Назва або SKU').fill('SKU-8')
  await page.getByRole('button', { name: 'Пошук', exact: true }).click()
  await expect(page.getByText(`Артикул: ${product.sku}`, { exact: true })).not.toBeVisible()
  await expect(page.getByText(`Штрихкод: ${product.barcode}`, { exact: true })).not.toBeVisible()
  await page.getByRole('button', { name: `Додати: ${product.name}`, exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Знайти товар', exact: true })).not.toBeVisible()
  await next.scrollIntoViewIfNeeded()
  await page.screenshot({ path: '/tmp/pos-ui-mobile.png', fullPage: true })
  await next.click()
  await expect(page).toHaveURL(/orders\/321$/)
  expect(submitted).toEqual({ items: [{ product_id: 8, quantity: 1 }], customer_phone: '+380501234567', fulfillment_method: 'pickup', simulation: false })
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
  await page.screenshot({ path: '/tmp/order-detail-desktop.png', fullPage: true })
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
  await page.screenshot({ path: '/tmp/order-detail-mobile.png', fullPage: true })
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
