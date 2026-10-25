import { expect, test } from '@playwright/test'
const customer = { id: 42, name: 'Synthetic', surname: 'Customer', phone: '+380990001234' }
const product = { id: 123, name: 'Mock pomade', slug: 'mock-pomade', price: '100.00', images: [], brand: { id: 1, name: 'Mock', slug: 'mock' }, stock: 10, is_available_for_purchase: true, is_effectively_visible: true, hidden_reason: null }
const city = { ref: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', city_ref: null, name: 'Київ', label: 'Київ, тестова область', area: 'Тестова', region: '', delivery_available: true }
const branch = { ref: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', settlement_ref: city.ref, city_ref: null, number: '1', label: 'Тестове відділення №1', name: 'Тестове відділення №1', address: 'Тестова, 1', type: 'warehouse', status: 'Working' }


for (const authenticated of [false, true]) {
 test(`${authenticated ? 'customer' : 'guest'} online checkout keeps payment and receipt evidence separate`, async ({ page }) => {
  let ordered = false, created = false, phase = 'not_started', posts = 0
  let paymentChannel: string | null = 'online_monobank'
  const external: string[] = []
  await page.route('https://**', route => {
    external.push(route.request().url())
    if (route.request().url() === 'https://pay.mbnk.biz/mock-invoice') return route.fulfill({ contentType: 'text/html', body: '<h1>Mock payment provider</h1>' })
    return route.abort()
  })
  await page.addInitScript(({ product, customer, authenticated }) => {
    localStorage.setItem('shop-cart', JSON.stringify({ items: [{ product, quantity: 2 }] }))
    if (authenticated) localStorage.setItem('shop-customer-auth', JSON.stringify({ accessToken: 'mock-only', tokenType: 'Bearer', customer }))
  }, { product, customer, authenticated })
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (path.endsWith('/online-payment-capabilities')) { await route.fulfill({ json: { enabled: true } }); return }
    if (path.endsWith('/public/orders') && req.method() === 'POST') {
      expect(req.postDataJSON().paymentMethod).toBe('onlineCard'); ordered = true
      await route.fulfill({ status: 201, json: { id: 987, payment_method: 'onlineCard', guest_payment_token: authenticated ? null : 'signed-fixture-capability', status: 'pending', payment_status: 'unpaid', fulfillment_status: 'reserved', fiscal_status: 'not_requested', total_amount: '200.00', items: [{ id: 1, product_id: 123, product_name: product.name, quantity: 2, price: '100.00' }] } }); return
    }
    if (path.endsWith('/987/online-payment')) {
      expect(req.headers().authorization).toBe(authenticated ? 'Bearer mock-only' : undefined)
      expect(req.headers()['x-order-payment-token']).toBe(authenticated ? undefined : 'signed-fixture-capability')
      if (req.method() === 'POST') {
        expect(req.headers()['idempotency-key']).toMatch(/^[a-f0-9-]{36}$/i)
        expect(req.postDataJSON()).toEqual({}); posts++; created = true; phase = 'waiting'
      } else expect(req.method()).toBe('GET')
      await route.fulfill({ json: { order_id: 987, enabled: true, status: phase, paid: ['paid_receipt_pending', 'accepted'].includes(phase), receipt_accepted: phase === 'accepted', page_url: created ? 'https://pay.mbnk.biz/mock-invoice' : null, receipt_url: phase === 'accepted' ? 'https://cabinet.tax.gov.ua/cashregs/check?id=fixture' : null, amount_minor: 20000, currency: 'UAH', retry_after_seconds: 30 } }); return
    }
    expect(req.method(), `Unexpected mutation ${path}`).toBe('GET')
    if (path.endsWith('/customers/me')) { await route.fulfill({ json: customer }); return }
    if (path.endsWith('/public/orders/me/987')) {
      await route.fulfill({ json: { id: 987, created_at: '2026-10-20T10:00:00Z', status: 'pending', payment_method: 'card', payment_channel: paymentChannel, payment_status: 'paid', fiscal_status: phase === 'accepted' ? 'accepted' : 'pending', total_amount: '200.00', items: [], shipments: [] } }); return
    }
    if (path.endsWith('/customers/cart')) { await route.fulfill({ json: { items: ordered ? [] : [{ id: 1, product_id: 123, product, quantity: 2 }], total: ordered ? 0 : 1 } }); return }
    if (path.endsWith('/np/settlements')) { await route.fulfill({ json: { items: [city], cached: true } }); return }
    if (path.endsWith('/np/branches')) { await route.fulfill({ json: { items: [branch], cached: true } }); return }
    await route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/checkout/purchase')
  await page.getByLabel('ІМʼЯ').fill('Synthetic'); await page.getByLabel('ПРІЗВИЩЕ').fill('Customer'); await page.getByLabel('ТЕЛЕФОН').fill(customer.phone)
  await page.getByRole('button', { name: 'Київ', exact: true }).click()
  await expect(page.getByRole('combobox', { name: /^Місто$/i })).toHaveValue(city.label)
  await page.getByRole('combobox', { name: /^Відділення$/i }).focus()
  await page.getByRole('option', { name: branch.label }).click()
  await page.locator('label[for=payment-method-onlineCard]').click()
  await page.getByRole('button', { name: 'ОФОРМИТИ ЗАМОВЛЕННЯ' }).last().click()
  await expect(page.getByTestId('order-confirmation')).toBeVisible()
  const create = page.getByRole('button', { name: 'Перейти до оплати' })
  await expect(create).toBeVisible(); expect(posts).toBe(0)
  await create.click()
  await expect(page).toHaveURL('https://pay.mbnk.biz/mock-invoice')
  // The browser may block even an intercepted bank origin. Simulate its return
  // without relying on provider HTML or changing browser security settings.
  await page.goto('/payment/987')
  await expect(page).toHaveURL(/\/payment\/987$/)
  const bank = page.getByRole('link', { name: 'Перейти до оплати' })
  await expect(bank).toHaveAttribute('href', 'https://pay.mbnk.biz/mock-invoice'); await expect(bank).not.toHaveAttribute('target', '_blank')
  expect(posts).toBe(1)
  await expect(page).toHaveURL(/\/payment\/987$/)
  await expect(bank).toBeVisible()
  await page.reload(); await expect(bank).toBeVisible()
  phase = 'paid_receipt_pending'
  await page.getByRole('button', { name: 'Оновити статус оплати' }).click()
  await expect(page.getByText('Оплату отримано. Готуємо чек.', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Переглянути фіскальний чек' })).toHaveCount(0)
  await expect(bank).toHaveCount(0)
  phase = 'accepted'
  await page.getByRole('button', { name: 'Оновити статус оплати' }).click()
  await expect(page.getByRole('link', { name: 'Переглянути фіскальний чек' })).toHaveAttribute('href', 'https://cabinet.tax.gov.ua/cashregs/check?id=fixture')
  if (authenticated) {
    phase = 'paid_receipt_pending'
    await page.goto('/cabinet/orders/987')
    await expect(page.getByText('Оплату отримано. Готуємо чек.', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByText('Оплату отримано. Готуємо чек.', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Переглянути фіскальний чек' })).toHaveCount(0)
    phase = 'accepted'
    await page.reload()
    await expect(page.getByRole('link', { name: 'Переглянути фіскальний чек' })).toHaveAttribute('href', 'https://cabinet.tax.gov.ua/cashregs/check?id=fixture')
    paymentChannel = null
    await page.reload()
    await expect(page.locator('.order-detail__head')).toContainText('#987')
    await expect(page.getByRole('button', { name: 'Оновити статус оплати' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Переглянути фіскальний чек' })).toHaveCount(0)
    expect(posts).toBe(1)
  }
  expect(external.filter(url => url !== 'https://pay.mbnk.biz/mock-invoice')).toEqual([])
  expect(external.length).toBeLessThanOrEqual(1)
 })
}
for (const unavailable of ['disabled', 'error']) {
 test(`online checkout fails closed when capability ${unavailable}`, async ({ page }) => {
  await page.route('https://**', route => route.abort())
  await page.route('**/api/v1/**', route => route.fulfill(new URL(route.request().url()).pathname.endsWith('/online-payment-capabilities') ? unavailable === 'error' ? { status: 503, json: {} } : { json: { enabled: false } } : { json: { items: [], total: 0 } }))
  await page.goto('/checkout/purchase')
  await expect(page.locator('label[for=payment-method-cashOnDelivery]')).toBeVisible()
  await expect(page.locator('label[for=payment-method-onlineCard]')).toHaveCount(0)
 })
}
