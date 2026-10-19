import { expect, test } from '@playwright/test'
const user = { id: 1, email: 'fixture@example.test', is_active: true, is_superuser: true, role: 'admin' }
const shipment = { id: 9, tracking_number: 'MOCK-' + 'C'.repeat(32), status: 'delivered', simulation: true, carrier: 'mock_nova_poshta', active: true, events: [] }
const base = { id: 321, status: 'confirmed', channel: 'shop', simulation: true, fulfillment_method: 'nova_poshta', total_amount: '123.45', revision: 4, items: [], payments: [], payment_status: 'unpaid', fulfillment_status: 'simulated_handed_over', shipments: [shipment], shipment_actions: { mode: 'mock_only', can_manage: true, can_create: false, simulation_available: true, can_handover: false, blocking_reasons: [] } }
const settlement = { mode: 'mock_only', available: true, order_id: 321, shipment_id: 9, tracking_number: shipment.tracking_number, revision: 4, amount_minor: 12345, cod_payment: null, return_receipt: null, items: [{ order_item_id: 11, product_id: 1, name: 'Fixture one', quantity: 2 }, { order_item_id: 12, product_id: 2, name: 'Fixture two', quantity: 1 }], allowed_actions: ['confirm_cod', 'create_return_shipment'], blocking_reasons: [] }
const login = async (page: any, actor = user) => page.addInitScript((value: any) => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', user: value })), actor)

test('MOCK COD requires evidence and confirmation; an uncertain result retries the exact persisted request after reload', async ({ page }) => {
  await login(page)
  let current: any = structuredClone(base), facts: any = structuredClone(settlement)
  const posts: Array<{ body: any, key?: string }> = []
  await page.route('**/api/v1/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
    if (path.endsWith('/shipments/9/settlement')) return route.fulfill({ json: facts })
    if (path.endsWith('/shipments/9/cod-payment')) {
      posts.push({ body: request.postDataJSON(), key: request.headers()['idempotency-key'] })
      facts = { ...facts, revision: 5, cod_payment: { id: 21, provider_event_id: 'MOCK-COD-reference-1', amount_minor: 12345 }, allowed_actions: ['create_return_shipment'] }
      current = { ...current, revision: 5, payment_status: 'paid' }
      if (posts.length === 1) return route.abort('failed')
      return route.fulfill({ json: current })
    }
    if (path.endsWith('/orders/321')) return route.fulfill({ json: current })
    return route.fulfill({ json: path.endsWith('/returns') || path.endsWith('/fiscal-documents') ? [] : { items: [], total: 0 } })
  })
  await page.goto('/orders/321')
  const section = page.getByRole('region', { name: 'Окремі MOCK факти ТТН 9' })
  await expect(section.getByText('Післяплата за даними сервера: 123.45 грн', { exact: false })).toBeVisible()
  await expect(page.getByText('Не оплачено', { exact: true })).toBeVisible()
  await expect(section.getByRole('button', { name: 'Підтвердити післяплату MOCK', exact: true })).toBeDisabled()
  await section.getByLabel('Унікальний MOCK-COD-референс оплати').fill('MOCK-COD-reference-1')
  await section.getByLabel('Доказ окремого MOCK підтвердження післяплати').fill('Local fixture evidence')
  await section.getByLabel('Підтверджую окремий MOCK факт отримання', { exact: false }).check()
  await section.getByRole('button', { name: 'Підтвердити післяплату MOCK', exact: true }).click()
  await expect(section.getByRole('button', { name: 'Повторити те саме підтвердження післяплати MOCK' })).toBeVisible()
  await expect(section.getByLabel('Підстава зворотної MOCK ТТН')).toBeDisabled()
  await page.reload()
  await expect(section.getByText('Оплату MOCK підтверджено окремим фактом')).toBeVisible()
  await section.getByRole('button', { name: 'Повторити те саме підтвердження післяплати MOCK' }).click()
  await expect(section.getByRole('button', { name: 'Повторити те саме підтвердження післяплати MOCK' })).toHaveCount(0)
  expect(posts).toHaveLength(2)
  expect(posts[0]).toEqual(posts[1])
  expect(posts[0].key).toBeTruthy()
  expect(posts[0].body).toEqual({ expected_revision: 4, provider_event_id: 'MOCK-COD-reference-1', evidence: 'Local fixture evidence', confirm: true })
})

test('MOCK return shipment and full-parcel warehouse acceptance are separate explicit commands', async ({ page }) => {
  await login(page)
  let current: any = structuredClone(base), facts: any = structuredClone(settlement)
  const actions: Array<{ path: string, body: any, key?: string }> = []
  await page.route('**/api/v1/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
    if (path.endsWith('/shipments/9/settlement')) return route.fulfill({ json: facts })
    if (request.method() === 'POST') {
      actions.push({ path, body: request.postDataJSON(), key: request.headers()['idempotency-key'] })
      if (path.endsWith('/return-shipment')) { current = { ...current, revision: 5, shipments: [{ ...shipment, status: 'returned' }] }; facts = { ...facts, revision: 5, items: [{ ...facts.items[0], quantity: 1 }, facts.items[1]], allowed_actions: ['receive_return'] } }
      if (path.endsWith('/return-receipt')) {
        facts = { ...facts, revision: 6, allowed_actions: [], return_receipt: { id: 31, items: request.postDataJSON().items } }; current = { ...current, revision: 6 }
        if (actions.filter(item => item.path.endsWith('/return-receipt')).length === 1) return route.abort('failed')
      }
      return route.fulfill({ json: current })
    }
    if (path.endsWith('/orders/321')) return route.fulfill({ json: current })
    return route.fulfill({ json: path.endsWith('/returns') || path.endsWith('/fiscal-documents') ? [] : { items: [], total: 0 } })
  })
  await page.goto('/orders/321')
  const section = page.getByRole('region', { name: 'Окремі MOCK факти ТТН 9' })
  await expect(section.getByRole('button', { name: 'Прийняти повернену посилку MOCK' })).toHaveCount(0)
  await section.getByLabel('Кількість зворотної MOCK посилки Fixture one').fill('1')
  await section.getByLabel('Підстава зворотної MOCK ТТН').fill('Local returned parcel')
  await section.getByLabel('Підтверджую створення окремої зворотної MOCK ТТН').check()
  await section.getByRole('button', { name: 'Створити зворотну MOCK ТТН', exact: true }).click()
  const accept = section.getByRole('button', { name: 'Прийняти повернену посилку MOCK', exact: true })
  await expect(accept).toBeDisabled()
  await section.getByRole('combobox', { name: 'Fixture one', exact: false }).selectOption('restock')
  await section.getByRole('combobox', { name: 'Fixture two', exact: false }).selectOption('not_restock')
  await section.getByLabel('Доказ приймання поверненої MOCK посилки').fill('Inspected both items')
  await expect(section.getByLabel('Підтверджую фізичне приймання всієї посилки', { exact: false })).toBeDisabled()
  await section.getByLabel('Товар для оприбуткування перевірено', { exact: false }).check()
  await section.getByLabel('Підтверджую фізичне приймання всієї посилки', { exact: false }).check()
  await accept.click()
  await expect(section.getByRole('button', { name: 'Повторити те саме приймання посилки MOCK' })).toBeVisible()
  await page.reload()
  await expect(section.getByText('Фізичне приймання MOCK зафіксовано')).toBeVisible()
  await section.getByRole('button', { name: 'Повторити те саме приймання посилки MOCK' }).click()
  await expect(section.getByRole('button', { name: 'Повторити те саме приймання посилки MOCK' })).toHaveCount(0)
  expect(actions).toHaveLength(3)
  expect(actions[0].body.items).toEqual([{ order_item_id: 11, quantity: 1 }, { order_item_id: 12, quantity: 1 }])
  expect(actions[1]).toEqual(actions[2])
  expect(actions[1].body).toEqual({ expected_revision: 5, evidence: 'Inspected both items', confirm: true, items: [{ order_item_id: 11, quantity: 1, disposition: 'restock' }, { order_item_id: 12, quantity: 1, disposition: 'not_restock' }] })
  await expect(page.getByText('Не оплачено', { exact: true })).toBeVisible()
})

for (const mode of ['failed_read', 'no_actions', 'master'] as const) test(`MOCK settlement is read-only for ${mode}`, async ({ page }) => {
  const actor = mode === 'master' ? { ...user, is_superuser: false, role: 'master' } : user
  await login(page, actor)
  let mutations = 0
  await page.route('**/api/v1/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (request.method() !== 'GET') mutations++
    if (path.endsWith('/auth/me')) return route.fulfill({ json: actor })
    if (path.endsWith('/shipments/9/settlement')) return mode === 'failed_read' ? route.fulfill({ status: 503, json: { detail: 'fixture read unavailable' } }) : route.fulfill({ json: { ...settlement, allowed_actions: mode === 'no_actions' ? [] : settlement.allowed_actions } })
    if (path.endsWith('/orders/321')) return route.fulfill({ json: base })
    return route.fulfill({ json: path.endsWith('/returns') || path.endsWith('/fiscal-documents') ? [] : { items: [], total: 0 } })
  })
  await page.goto('/orders/321')
  const section = page.getByRole('region', { name: 'Окремі MOCK факти ТТН 9' })
  await expect(section.getByRole('button', { name: 'Оновити окремі MOCK факти' })).toBeVisible()
  if (mode === 'failed_read') await expect(section.getByRole('alert')).toBeVisible()
  else await expect(section.getByText('Післяплата за даними сервера:', { exact: false })).toBeVisible()
  await expect(section.getByRole('button', { name: /Підтвердити післяплату|Створити зворотну|Прийняти повернену/ })).toHaveCount(0)
  expect(mutations).toBe(0)
})

test('definitive duplicate COD rejection reloads durable facts and releases the blocked intent', async ({ page }) => {
  await login(page)
  let facts: any = structuredClone(settlement), posted = 0
  await page.route('**/api/v1/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
    if (path.endsWith('/shipments/9/settlement')) return route.fulfill({ json: facts })
    if (path.endsWith('/shipments/9/cod-payment')) {
      posted++
      facts = { ...facts, cod_payment: { id: 71, payment_id: 72, provider_event_id: 'MOCK-COD-other-operator', amount_minor: 12345, evidence: 'Recorded by another operator' }, allowed_actions: ['create_return_shipment'] }
      return route.fulfill({ status: 409, json: { detail: { code: 'cod_payment_exists', message: 'Already recorded by another operator' } } })
    }
    if (path.endsWith('/orders/321')) return route.fulfill({ json: base })
    return route.fulfill({ json: path.endsWith('/returns') || path.endsWith('/fiscal-documents') ? [] : { items: [], total: 0 } })
  })
  await page.goto('/orders/321')
  const section = page.getByRole('region', { name: 'Окремі MOCK факти ТТН 9' })
  await section.getByLabel('Унікальний MOCK-COD-референс оплати').fill('MOCK-COD-racing-operator')
  await section.getByLabel('Доказ окремого MOCK підтвердження післяплати').fill('Local evidence')
  await section.getByLabel('Підтверджую окремий MOCK факт отримання', { exact: false }).check()
  await section.getByRole('button', { name: 'Підтвердити післяплату MOCK', exact: true }).click()
  await expect(section.getByText('MOCK-COD-other-operator', { exact: false })).toBeVisible()
  await expect(section.getByRole('button', { name: 'Повторити те саме підтвердження післяплати MOCK' })).toHaveCount(0)
  await expect(section.getByLabel('Підстава зворотної MOCK ТТН')).toBeEnabled()
  expect(posted).toBe(1)
})
