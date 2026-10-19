import { expect, test } from '@playwright/test'
const shipments = [{ id: 1, tracking_number: 'MOCK-' + 'A'.repeat(32), status: 'delivered', simulation: true, carrier: 'mock_nova_poshta', last_checked_at: '2026-10-17T12:00:00Z', raw_status: 'INTERNAL-SECRET', packaging: { cost: 'secret' } }]
test('customer order labels test data and keeps COD unpaid', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('shop-customer-auth', JSON.stringify({ accessToken: 'fixture-only', tokenType: 'Bearer', customer: { id: 42, phone: '+380990000001' } })))
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill({ json: path.endsWith('/public/orders/me/321') ? { id: 321, status: 'pending', created_at: '2026-10-17T12:00:00Z', total_amount: '123.45', subtotal_amount: '123.45', discount_amount: '0', item_count: 0, items: [], payment_status: 'unpaid', payment_method: 'cashOnDelivery', shipments } : path.endsWith('/public/customers/me') ? { id: 42, phone: '+380990000001' } : { items: [], total: 0 } })
  })
  await page.goto('/cabinet/orders/321')
  await expect(page.getByText('Доставлено', { exact: true })).toBeVisible()
  await expect(page.getByText('Не оплачено', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Тестові дані', { exact: false })).toBeVisible()
  await expect(page.getByText('INTERNAL-SECRET')).toHaveCount(0)
  await expect(page.locator('a[href*="novaposhta"]')).toHaveCount(0)
})
test('scoped guest tracking displays minimal data and rejects expired token safely', async ({ page }) => {
  const token = 'a'.repeat(40)
  let expired = false
  await page.route('**/api/v1/**', route => {
    if (new URL(route.request().url()).pathname.endsWith(`/public/orders/tracking/${token}`)) return expired ? route.fulfill({ status: 403, json: { detail: 'INTERNAL-SECRET' } }) : route.fulfill({ json: { shipments } })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto(`/tracking/${token}`)
  await expect(page.getByText('Доставлено', { exact: true })).toBeVisible()
  expired = true
  await page.getByRole('button', { name: 'Оновити статус' }).click()
  await expect(page.getByRole('alert')).toHaveText('Посилання недоступне або строк його дії закінчився.')
  await expect(page.getByText('Доставлено', { exact: true })).toHaveCount(0)
  await expect(page.getByText('INTERNAL-SECRET')).toHaveCount(0)
})

for (const [status, parcelLabel, summaryLabel] of [
  ['delivered', 'Доставлено', 'Тест: Посилку отримано'],
  ['refused', 'Відмова', 'Тест: Відмова'],
  ['returned', 'Повернено', 'Тест: Повернено'],
] as const) test(`MOCK ${status} stays test data in customer and guest views without receipt or financial facts`, async ({ page }) => {
  const customer = { id: 42, phone: '+380990000001' }
  const token = 'b'.repeat(40)
  const parcels = [{ ...shipments[0], status, provider_event_at: '2026-10-17T10:15:00Z', events: [{ normalized_status: status, event_at: '2026-10-17T10:15:00Z', observed_at: '2026-10-17T12:00:00Z' }] }]
  const order = { id: 321, status: 'pending', created_at: '2026-10-17T12:00:00Z', total_amount: '123.45', subtotal_amount: '123.45', discount_amount: '0', item_count: 0, items: [], payment_status: 'unpaid', payment_method: 'cashOnDelivery', shipments: parcels }
  let mutations = 0
  await page.addInitScript(customer => localStorage.setItem('shop-customer-auth', JSON.stringify({ accessToken: 'fixture-only', tokenType: 'Bearer', customer })), customer)
  await page.route('**/api/v1/**', route => {
    if (route.request().method() !== 'GET') mutations++
    const path = new URL(route.request().url()).pathname
    const json = path.endsWith('/public/customers/me') ? customer
      : path.endsWith('/public/orders/me/321') ? order
      : path.endsWith('/public/orders/me') ? { items: [order], total: 1, page: 1, page_size: 10 }
      : path.endsWith(`/public/orders/tracking/${token}`) ? { shipments: parcels }
      : { items: [], total: 0 }
    return route.fulfill({ json })
  })
  await page.goto('/cabinet/purchase-history')
  const history = page.locator('.purchase-history__card')
  await expect(history.locator('.purchase-history__status')).toHaveText(summaryLabel)
  await expect(history.getByText('Тестові дані', { exact: true })).toBeVisible()
  await expect(history.locator('.order-dates time')).toHaveCount(0)
  await expect(history.getByText(/^(Отримано|Посилку отримано|Усі посилки отримано|Оплачено|Кошти повернуто)$/)).toHaveCount(0)
  for (const path of ['/cabinet/orders/321', `/tracking/${token}`]) {
    await page.goto(path)
    const region = page.getByRole('region', { name: 'Відправлення', exact: true })
    await expect(region.getByText('Тестові дані', { exact: true })).toBeVisible()
    await expect(region.locator('.order-status-badge')).toHaveText(parcelLabel)
    await expect(region.locator('.shipments__received')).toHaveCount(0)
    await expect(page.getByText(/^(Отримано|Посилку отримано|Усі посилки отримано|Оплачено|Кошти повернуто)$/)).toHaveCount(0)
    await expect(region.locator('.shipments__head button')).toHaveCount(0)
  }
  expect(mutations).toBe(0)
})
