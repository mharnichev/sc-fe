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

for (const width of [390, 1440]) {
  test(`linked return shows both tracking numbers without implying money or receipt at ${width}px`, async ({ page, context }, testInfo) => {
    const token = 'r'.repeat(40)
    const outbound = { ...shipments[0], id: 1, tracking_number: '20450000000001', status: width === 390 ? 'refused' : 'delivered' }
    const reverse = { ...shipments[0], id: 2, tracking_number: '20450000000002', status: 'in_transit', return_of_shipment_id: 1 }
    await context.route(url => !['127.0.0.1', 'localhost'].includes(url.hostname), route => route.abort())
    await page.route('**/api/v1/**', route => {
      expect(route.request().method()).toBe('GET')
      return route.fulfill({ json: new URL(route.request().url()).pathname.endsWith(`/public/orders/tracking/${token}`)
        ? { shipments: [outbound, reverse] } : { items: [], total: 0 } })
    })
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`/tracking/${token}`)
    const parcel = page.getByRole('article', { name: 'Відправлення #2', exact: true })
    await expect(parcel.getByRole('heading', { name: 'Зворотна ТТН:' })).toBeVisible()
    await expect(parcel.getByText('Вихідна ТТН · 20450000000001')).toBeVisible()
    await expect(parcel.getByText(width === 390 ? 'Відмова під час доставки' : 'Повернення після отримання')).toBeVisible()
    await expect(parcel.getByRole('button', { name: '20450000000002', exact: true })).toBeVisible()
    await expect(page.getByText(/Оплачено|Кошти повернуто|Прийнято магазином/)).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    await page.screenshot({ path: testInfo.outputPath(`np-linked-shipment-${width}.png`) })
  })
}

for (const width of [390, 1440]) {
  test(`owner and guest see independent direct return facts at ${width}px`, async ({ page, context }, testInfo) => {
    const token = 't'.repeat(40)
    const customer = { id: 42, phone: '+380990000001' }
    const order = { id: 321, status: 'pending', created_at: '2026-11-11T09:00:00Z', total_amount: '123.45', subtotal_amount: '123.45', discount_amount: '0', item_count: 0, items: [], shipments: [] }
    const directReturn = {
      simulation: true, inspection_status: 'awaiting_inspection', received_quantity: null as number | null,
      tracking_stale: false, refund_kind: null as string | null, money_status: 'not_started', refunded_amount_minor: null as number | null,
      currency: null as string | null, return_receipt_status: 'not_started', financial_stale: false,
    }
    let revoked = false
    await context.route(url => !['127.0.0.1', 'localhost'].includes(url.hostname), route => route.abort())
    await page.addInitScript(customer => localStorage.setItem('shop-customer-auth', JSON.stringify({ accessToken: 'fixture-only', tokenType: 'Bearer', customer })), customer)
    await page.route('**/api/v1/**', route => {
      const request = route.request(), path = new URL(request.url()).pathname
      expect(request.method(), path).toBe('GET')
      if (path.endsWith('/public/customers/me')) return route.fulfill({ json: customer })
      if (path.endsWith('/public/orders/me/321')) return route.fulfill({ json: { ...order, direct_return: directReturn } })
      if (path.endsWith(`/public/orders/tracking/${token}`)) return route.fulfill(revoked
        ? { status: 403, json: { detail: 'synthetic-secret' } }
        : { json: { shipments: [], direct_return: directReturn } })
      return route.fulfill({ json: { items: [], total: 0 } })
    })
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/cabinet/orders/321')
    const card = page.getByRole('region', { name: 'Стан повернення' })
    const row = (label: string) => card.locator('dl > div').filter({ has: page.getByText(label, { exact: true }) }).locator('dd')
    await expect(row('Приймання магазином')).toHaveText('Посилка прибула · очікуємо огляду')
    await expect(row('Повернення коштів')).toHaveText('Ще не розпочато')
    await expect(row('Чек повернення')).toHaveText('Ще не розпочато')
    Object.assign(directReturn, {
      inspection_status: 'received', received_quantity: 1, refund_kind: 'partial', money_status: 'confirmed',
      refunded_amount_minor: 10000, currency: 'UAH', return_receipt_status: 'pending',
    })
    for (const [path, view] of [['/cabinet/orders/321', 'owner'], [`/tracking/${token}`, 'guest']]) {
      await page.goto(path)
      await expect(row('Приймання магазином')).toHaveText('Огляд завершено · 1 шт.')
      await expect(row('Повернення коштів')).toContainText(/Підтверджено.*100,00/)
      await expect(row('Повернення коштів')).toContainText('Часткове повернення')
      await expect(row('Чек повернення')).toHaveText('Очікуємо підтвердження')
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
      await card.screenshot({ path: testInfo.outputPath(`direct-return-${view}-${width}.png`) })
    }
    directReturn.return_receipt_status = 'confirmed'
    const refresh = page.getByRole('button', { name: 'Оновити статус' })
    await refresh.click()
    await expect(row('Чек повернення')).toHaveText('Підтверджено')
    revoked = true
    await refresh.click()
    await expect(page.getByRole('alert')).toContainText('Посилання недоступне')
    await expect(card).toHaveCount(0)
    await expect(page.getByText('synthetic-secret')).toHaveCount(0)
  })
}
