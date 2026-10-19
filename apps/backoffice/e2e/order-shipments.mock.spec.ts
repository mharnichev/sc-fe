import { expect, test } from '@playwright/test'
const user = { id: 1, email: 'fixture@example.test', is_active: true, is_superuser: true, role: 'admin' }
const base = { id: 321, status: 'pending', channel: 'shop', fulfillment_method: 'nova_poshta', total_amount: '123.45', revision: 1, items: [], payment_status: 'unpaid', fulfillment_status: 'reserved', shipping_payload_json: { shippingCityRef: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', shippingWarehouseRef: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }, shipping_method: 'warehouse', shipping_city: 'Fixture city', shipping_warehouse_number: '1', shipping_city_ref: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', shipping_warehouse_ref: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', shipments: [], shipment_actions: { mode: 'mock_only', can_manage: true, can_create: true, simulation_available: true, can_handover: false, blocking_reasons: [] } }
test('MOCK shipment preparation survives timeout and reload with exact body/key; handover is separate', async ({ page }) => {
  let current: any = structuredClone(base)
  const creates: Array<{ key?: string, body: any }> = []
  let handovers = 0, refreshes = 0
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', user })), user)
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
    if (req.method() === 'GET' && (path.endsWith('/returns') || path.endsWith('/fiscal-documents'))) return route.fulfill({ json: [] })
    if (path.endsWith('/321/shipments') && req.method() === 'POST') {
      creates.push({ key: req.headers()['idempotency-key'], body: req.postDataJSON() })
      current = { ...current, revision: 2, shipments: [{ id: 9, tracking_number: 'MOCK-' + 'A'.repeat(32), status: 'created', simulation: true, carrier: 'mock_nova_poshta', active: true, events: [], label_url: '/api/v1/backoffice/orders/321/shipments/9/label' }], shipment_actions: { ...current.shipment_actions, can_handover: true } }
      if (creates.length === 1) return route.abort('failed')
      return route.fulfill({ json: current })
    }
    if (path.endsWith('/shipments/9/handover')) {
      handovers++
      current = { ...current, revision: 3, fulfillment_status: 'simulated_handed_over', shipments: [{ ...current.shipments[0], status: 'handed_over', handed_over_at: '2026-10-17T12:00:00Z' }], shipment_actions: { ...current.shipment_actions, can_handover: false } }
      return route.fulfill({ json: current })
    }
    if (path.endsWith('/shipments/9/refresh')) {
      refreshes++; current.shipments[0].status = req.postDataJSON().mock_status
      return route.fulfill({ json: current })
    }
    if (path.endsWith('/shipments/9/label')) {
      expect(req.headers().authorization).toBe('Bearer fixture-only')
      return route.fulfill({ contentType: 'text/html', body: '<h1>MOCK етикетка</h1><p>Не є реальною ТТН</p>' })
    }
    if (path.endsWith('/orders/321')) return route.fulfill({ json: current })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/orders/321')
  await page.getByLabel('Адресу та збережені refs перевірено').check()
  await page.getByRole('button', { name: 'Підготувати MOCK відправлення', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  expect(handovers).toBe(0)
  await page.reload()
  await page.getByRole('button', { name: 'Повторити підготовку MOCK', exact: true }).click()
  await expect(page.getByText('MOCK — тестове відправлення', { exact: false })).toBeVisible()
  expect(creates).toHaveLength(2); expect(creates[0]).toEqual(creates[1])
  await expect(page.getByRole('button', { name: 'Підтвердити тестову видачу' })).toHaveCount(0)
  await expect(page.getByText('Не оплачено', { exact: true })).toBeVisible()
  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'MOCK етикетка / друк' }).click()
  await expect((await popupPromise).getByRole('heading', { name: 'MOCK етикетка' })).toBeVisible()
  await page.getByLabel('Підстава тестової передачі перевізнику').fill('isolated fixture handover')
  await page.getByRole('button', { name: 'Підтвердити передачу MOCK', exact: true }).click()
  await expect(page.getByText('Передано перевізнику', { exact: false })).toBeVisible()
  await page.getByLabel('MOCK стан для перевірки').selectOption('delivered')
  await page.getByRole('button', { name: 'Звірити MOCK стан', exact: true }).click()
  await expect(page.getByText('Доставлено', { exact: false })).toBeVisible()
  expect(handovers).toBe(1); expect(refreshes).toBe(1)
  await expect(page.getByText('Не оплачено', { exact: true })).toBeVisible()
})
test('disabled capability and missing historical refs cannot create shipments', async ({ page }) => {
  let mutations = 0
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', user })), user)
  await page.route('**/api/v1/**', route => {
    if (route.request().method() !== 'GET') mutations++
    const path = new URL(route.request().url()).pathname
    if (route.request().method() === 'GET' && (path.endsWith('/returns') || path.endsWith('/fiscal-documents'))) return route.fulfill({ json: [] })
    return route.fulfill({ json: path.endsWith('/auth/me') ? user : path.endsWith('/orders/321') ? { ...base, shipment_actions: { ...base.shipment_actions, simulation_available: false } } : { items: [], total: 0 } })
  })
  await page.goto('/orders/321')
  await expect(page.getByText('Операції заблоковано сервером.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Підготувати MOCK відправлення', exact: true })).toHaveCount(0)
  expect(mutations).toBe(0)
})

test('terminal NP orders and legacy addresses expose no new shipment command', async ({ page }) => {
  let mutations = 0
  const current: any = { ...base, status: 'completed', shipping_city_ref: null, shipping_warehouse_ref: null, shipment_actions: { ...base.shipment_actions, can_create: false } }
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', user })), user)
  await page.route('**/api/v1/**', route => {
    if (route.request().method() !== 'GET') mutations++
    const path = new URL(route.request().url()).pathname
    return route.fulfill({ json: path.endsWith('/auth/me') ? user : path.endsWith('/orders/321') ? current : { items: [], total: 0 } })
  })
  await page.goto('/orders/321')
  await expect(page.getByRole('heading', { name: 'Доставка Nova Poshta — MOCK' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Підготувати MOCK відправлення', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Створити тестовий MOCK номер', exact: true })).toHaveCount(0)
  expect(mutations).toBe(0)
})

test('MOCK attach uses a verified fixture and cancellation stays a separate command', async ({ page }) => {
  let current: any = structuredClone(base), attached = 0, cancelled = 0
  const tracking = 'MOCK-' + 'B'.repeat(32)
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', user })), user)
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
    if (path.endsWith('/mock-shipment-fixtures')) return route.fulfill({ json: { tracking_number: tracking, simulation: true, revision: current.revision } })
    if (path.endsWith('/321/shipments') && req.method() === 'POST') {
      attached++; expect(req.postDataJSON().source).toBe('attach'); expect(req.postDataJSON().tracking_number).toBe(tracking)
      current = { ...current, revision: 2, shipments: [{ id: 10, tracking_number: tracking, status: 'created', active: true, simulation: true, events: [] }], shipment_actions: { ...current.shipment_actions, can_create: false } }
      return route.fulfill({ json: current })
    }
    if (path.endsWith('/shipments/10/cancel')) {
      cancelled++; current = { ...current, revision: 3, shipments: [{ ...current.shipments[0], status: 'cancelled', active: false }] }
      return route.fulfill({ json: current })
    }
    if (path.endsWith('/orders/321')) return route.fulfill({ json: current })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/orders/321')
  await page.getByRole('combobox', { name: 'Джерело', exact: true }).selectOption('attach')
  await page.getByRole('button', { name: 'Створити тестовий MOCK номер', exact: true }).click()
  await expect(page.getByLabel('MOCK номер', { exact: true })).toHaveValue(tracking)
  await page.getByLabel('Адресу та збережені refs перевірено').check()
  await page.getByRole('button', { name: 'Підготувати MOCK відправлення', exact: true }).click()
  await expect(page.getByText(tracking, { exact: false })).toBeVisible()
  expect(attached).toBe(1)
  await page.getByRole('button', { name: 'Скасувати MOCK', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Скасувати MOCK', exact: true })).toHaveCount(0)
  expect(cancelled).toBe(1)
})
