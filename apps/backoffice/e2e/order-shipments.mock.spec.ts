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
  await expect(page.getByRole('region', { name: 'Відправлення Nova Poshta' }).getByRole('alert')).toBeVisible()
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
      current = { ...current, revision: 2, shipments: [{ id: 10, tracking_number: tracking, status: 'created', active: true, simulation: true, carrier: 'mock_nova_poshta', events: [] }], shipment_actions: { ...current.shipment_actions, can_create: false, can_cancel: false, cancel_shipment_id: 10, cancel_blocking_reason: 'shipment_status_stale' } }
      return route.fulfill({ json: current })
    }
    if (path.endsWith('/shipments/10/cancel')) {
      cancelled++
      current = { ...current, revision: 3, shipments: [{ ...current.shipments[0], status: 'cancel_pending' }],
        shipment_actions: { ...current.shipment_actions, can_cancel: false, can_reconcile_cancel: true, cancel_blocking_reason: 'cancel_reconciliation_required' } }
      return route.abort('connectionreset')
    }
    if (path.endsWith('/shipments/10/refresh')) {
      if (current.revision === 2) {
        expect(req.postDataJSON()).toEqual({ expected_revision: 2 })
        current = { ...current, shipment_actions: { ...current.shipment_actions, can_cancel: true, cancel_blocking_reason: null } }
        return route.fulfill({ json: current })
      }
      expect(req.postDataJSON()).toEqual({ expected_revision: 3 })
      current = { ...current, revision: 4, shipments: [{ ...current.shipments[0], status: 'cancelled', active: false }],
        shipment_actions: { ...current.shipment_actions, can_reconcile_cancel: false, cancel_shipment_id: null, cancel_blocking_reason: null } }
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
  await expect(page.getByRole('button', { name: 'Скасувати ТТН до передачі' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Оновити дані перед скасуванням' }).click()
  await page.getByRole('button', { name: 'Скасувати ТТН до передачі', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Скасувати ТТН до передачі', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Звірити скасування ТТН', exact: true }).click()
  await expect(page.getByText(/Скасовано · остання перевірка/)).toBeVisible()
  expect(cancelled).toBe(1)
})

for (const width of [390, 1440]) {
  test(`prepaid Nova Poshta inspection and refund stay separate at ${width}px`, async ({ page, context }, testInfo) => {
    const receiptId = '11111111-1111-4111-8111-111111111111'
    const profileHash = 'a'.repeat(64)
    const original = '20450000000001', reverse = '20450000000002'
    const originalStatus = width === 390 ? 'refused' : 'delivered'
    let revision = 4, stage = 'not_attached', refreshes = 0, receipts = 0, refundStarts = 0, reconciles = 0
    let arrivedReads = 0
    const lines = [{ order_item_id: 501, quantity: 3 }, { order_item_id: 502, quantity: 1 }]
    const inspected = [
      { order_item_id: 501, received_quantity: 2, restock_quantity: 1, damaged_quantity: 1 },
      { order_item_id: 502, received_quantity: 0, restock_quantity: 0, damaged_quantity: 0 },
    ]
    const order = () => ({ ...base, status: 'paid', revision, payment_method: 'card', payment_channel: 'online_monobank', payment_status: 'simulated_paid', simulation: false,
      items: [{ id: 501, product_name: 'Fixture shampoo', quantity: 3 }, { id: 502, product_name: 'Fixture comb', quantity: 1 }] })
    const state = () => ({
      order_id: 321, revision, available: true, profile_id: 'np-test', profile_hash: profileHash, original_shipment_id: 19, original_ttn: original,
      case_id: stage === 'not_attached' ? null : receiptId, return_ttn: stage === 'not_attached' ? null : reverse, status: stage,
      eligible_lines: lines, claimed_lines: stage === 'not_attached' ? [] : lines,
      observation: stage === 'not_attached' ? null : { observed_at: stage === 'awaiting_return' ? '2026-11-11T09:10:00Z' : '2026-11-11T09:12:00Z', original: { status: originalStatus } },
      receipt: stage === 'received' ? { id: receiptId, lines: inspected, evidence: 'Mock inspection', operator_id: user.id, created_at: '2026-11-11T09:15:00Z' } : null,
      financial_refund_path: stage === 'received' ? '/api/v1/backoffice/shop-direct-refunds/orders/321' : null,
      can_attach: stage === 'not_attached', can_refresh: stage === 'awaiting_return' || stage === 'arrived', can_receive: stage === 'arrived',
      blocking_reasons: stage === 'awaiting_return' ? ['np_return_tracking_stale'] : [],
    })
    const refund = () => ({
      order_id: 321, revision, available: stage === 'received' && reconciles < 2,
      can_start: stage === 'received' && !refundStarts, can_reconcile: refundStarts > 0 && reconciles < 2,
      refundable_items: [], carrier_receipt_id: stage === 'received' ? receiptId : null, kind: stage === 'received' ? 'partial' : null, amount_minor: stage === 'received' ? 6000 : null,
      ext_ref: refundStarts ? 'np-refund' : null, bank_confirmed: reconciles > 0, return_receipt_id: reconciles === 2 ? 'return-receipt' : null,
      finalized_at: reconciles === 2 ? '2026-11-11T09:30:00Z' : null, last_checked_at: reconciles ? '2026-11-11T09:30:00Z' : null,
      reason: reconciles === 2 ? 'carrier_partial_refund_finalized' : 'ready',
    })
    await context.route(url => !['127.0.0.1', 'localhost'].includes(url.hostname), route => route.abort())
    await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', user })), user)
    await page.route('**/api/v1/**', route => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
      if (path.endsWith('/backoffice/orders/321')) return route.fulfill({ json: order() })
      if (path.endsWith('/shop-checkbox/orders/321/profile')) return route.fulfill({ json: { order_id: 321, fiscal_profile: 'mono_checkbox_external' } })
      if (path.endsWith('/321/shop-operations')) return route.fulfill({ json: {
        order_id: 321, revision, order: order(), stage: 'dispatched', authority: 'test', payment: null, fulfillment: null, completion: null,
        actions: {}, blocking_reasons: [], available_payment_methods: [],
        external_fiscal_report: { issuer: 'mono_checkbox_external', authority: 'test', currency: 'UAH', net_minor: reconciles === 2 ? 6345 : 12345, entries: [
          { kind: 'sale', receipt_id: 'sale-receipt', amount_minor: 12345, original_receipt_id: null, structured_totals_verified: false },
          ...(reconciles === 2 ? [{ kind: 'return', receipt_id: 'return-receipt', amount_minor: 6000, original_receipt_id: 'sale-receipt', structured_totals_verified: true }] : []),
        ] },
      } })
      if (path.endsWith('/shop-np-direct-returns/orders/321')) {
        if (stage === 'arrived') arrivedReads++
        return route.fulfill({ json: state() })
      }
      if (path.includes('/shop-np-direct-returns/orders/321/')) {
        expect(request.headers()['idempotency-key']).toBeTruthy()
        expect(request.postDataJSON()).toMatchObject({ expected_revision: revision, expected_profile_id: 'np-test', expected_profile_hash: profileHash })
        if (path.endsWith('/attach')) {
          expect(request.postDataJSON()).toMatchObject({ original_shipment_id: 19, return_ttn: reverse, lines })
          stage = 'awaiting_return'
        } else if (path.endsWith('/refresh')) {
          refreshes++
          if (refreshes === 1) {
            revision++
            return route.fulfill({ status: 409, json: { detail: { code: 'revision_conflict' } } })
          }
          stage = 'arrived'
        } else if (path.endsWith('/physical-receipt')) {
          receipts++
          expect(request.postDataJSON()).toMatchObject({ lines: inspected, contents_verified: true, evidence: 'Mock inspection' })
          stage = 'received'
          revision++
          return route.abort('connectionreset')
        }
        revision++
        return route.fulfill({ json: state() })
      }
      if (path.endsWith('/shop-direct-refunds/orders/321')) return route.fulfill({ json: refund() })
      if (path.endsWith('/shop-direct-refunds/orders/321/start')) {
        expect(request.headers()['idempotency-key']).toBeTruthy()
        expect(request.postDataJSON()).toEqual({ expected_revision: revision, kind: 'partial', goods_in_custody: true, quantities: {}, carrier_receipt_id: receiptId })
        refundStarts++; revision++
        return route.fulfill({ json: refund() })
      }
      if (path.endsWith('/shop-direct-refunds/orders/321/reconcile')) {
        reconciles++; revision++
        return route.fulfill({ json: refund() })
      }
      expect(request.method(), path).toBe('GET')
      return route.fulfill({ json: { items: [], total: 0 } })
    })
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/orders/321')
    const panel = page.getByRole('region', { name: 'Повернення передоплати Новою поштою' })
    await panel.getByLabel('Зворотна ТТН').fill(reverse)
    await panel.getByLabel(/Fixture shampoo · заявлено/).fill('3')
    await panel.getByLabel(/Fixture comb · заявлено/).fill('1')
    await panel.getByTestId('np-direct-attach').click()
    await expect(panel.getByText(originalStatus === 'refused' ? 'Відмова під час доставки' : 'Повернення після отримання')).toBeVisible()
    await expect(panel.getByText(/Дані НП застаріли/)).toBeVisible()
    await expect(panel.getByTestId('np-direct-receive')).toHaveCount(0)
    await panel.getByTestId('np-direct-refresh').click()
    await expect(panel.getByRole('alert')).toBeVisible()
    await panel.getByTestId('np-direct-refresh').click()
    await expect.poll(() => arrivedReads).toBeGreaterThanOrEqual(2)
    await expect(panel).toHaveAttribute('aria-busy', 'false')
    await panel.getByLabel('Прийнято · Fixture shampoo').fill('2')
    await panel.getByLabel('Придатні · Fixture shampoo').fill('1')
    await panel.getByLabel('Прийнято · Fixture comb').fill('0')
    await panel.getByLabel('Доказ огляду посилки').fill('Mock inspection')
    await panel.getByRole('checkbox', { name: /кількість і стан/ }).check()
    await panel.screenshot({ path: testInfo.outputPath(`np-inspection-${width}.png`) })
    await panel.getByTestId('np-direct-receive').click()
    await expect(panel.getByText(/прийнято 2, придатні 1, пошкоджені 1/)).toBeVisible()
    await expect(panel.getByTestId('np-direct-receive')).toHaveCount(0)
    expect(receipts).toBe(1)
    await panel.getByRole('link', { name: 'Повернення коштів і чек' }).click()
    const financial = page.getByRole('region', { name: 'Повернення mono → Checkbox' })
    await financial.getByRole('checkbox', { name: /оглянутою посилкою/ }).check()
    await financial.getByTestId('direct-refund-start').click()
    await financial.getByTestId('direct-refund-reconcile').click()
    await expect(financial.getByText('Очікуємо чек', { exact: true })).toBeVisible()
    await financial.getByTestId('direct-refund-reconcile').click()
    await expect(financial.getByText('Повернення завершено')).toBeVisible()
    await page.locator('summary').filter({ hasText: 'Фіскальний звіт замовлення' }).click()
    await expect(page.getByTestId('external-fiscal-net')).toContainText(/63,45\s+грн/)
    expect([refundStarts, reconciles]).toEqual([1, 2])
  })
}

test('unpaid COD refusal closes after inspection without a refund or fiscal command', async ({ page, context }, testInfo) => {
  const hash = 'a'.repeat(64)
  let closed = false
  const writes: string[] = []
  const order = () => ({ ...base, revision: closed ? 8 : 7, status: closed ? 'cancelled' : 'confirmed', payment_method: 'cashOnDelivery', simulation: false })
  const record = () => ({
    id: 7, order_id: 321, order_revision: order().revision, revision: closed ? 4 : 3, profile_id: 'np-test', profile_hash: hash,
    authority: 'test', transport: 'mock_http', test_context: true,
    original_shipment_id: 19, original_ttn: '20450000000001', return_ttn: '20450000000002', financial_mode: 'unpaid_cod',
    linkage_kind: 'easy_return', linkage_authority: 'test', manual_link: null, sale_document_id: null, status: closed ? 'closed_unpaid' : 'received',
    lines: [{ order_item_id: 501, product_id: 8, name: 'Fixture shampoo', quantity: 2 }], observation: null,
    receipt: { id: 11, case_id: 7, observation_id: 10, lines: [{ order_item_id: 501, quantity: 2, disposition: 'not_restock' }],
      contents_verified: true, evidence: 'Mock inspection', snapshot_hash: hash, operator_id: 1, created_at: '2026-11-11T09:00:00Z' },
    closure: closed ? { id: 12, case_id: 7, order_id: 321, receipt_id: 11, evidence: 'Mock refusal' } : null,
    financial_return_id: null, financial_document_id: null, financial_remaining_lines: [],
    actions: { close_unpaid: !closed, financial_claim: false }, blocking_reasons: [],
  })
  await context.route(url => !['127.0.0.1', 'localhost'].includes(url.hostname), route => route.abort())
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', user })), user)
  await page.route('**/api/v1/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (request.method() !== 'GET') writes.push(path)
    if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
    if (path.endsWith('/backoffice/orders/321')) return route.fulfill({ json: order() })
    if (path.endsWith('/shop-checkbox/orders/321/profile')) return route.fulfill({ json: { order_id: 321, fiscal_profile: 'checkbox' } })
    if (path.endsWith('/shop-np-returns/orders/321')) return route.fulfill({ json: {
      order_id: 321, revision: order().revision, enabled: true, original_shipment_id: 19, original_ttn: '20450000000001',
      readiness: { enabled: true, available: true, profile_id: 'np-test', profile_hash: hash, authority: 'test', transport: 'mock_http', manual_link_allowed: false, blocking_reasons: [] },
      financial_mode: 'unpaid_cod', eligible_lines: [], cases: [record()], actions: {}, blocking_reasons: [],
    } })
    if (path.endsWith('/shop-np-returns/cases/7/close-unpaid')) {
      expect(request.postDataJSON()).toEqual({ expected_revision: 3, expected_profile_id: 'np-test', expected_profile_hash: hash, evidence: 'Mock refusal', confirm: true })
      closed = true
      return route.fulfill({ json: record() })
    }
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/orders/321')
  const panel = page.getByRole('region', { name: 'Зовнішні повернення НП магазину' })
  await expect(panel.getByText('Неоплачена відмова', { exact: true })).toBeVisible()
  await panel.getByLabel('Доказ закриття неоплаченої відмови НП').fill('Mock refusal')
  await panel.getByRole('checkbox', { name: /Підтверджую закриття/ }).check()
  await panel.getByRole('button', { name: 'Закрити неоплачену відмову НП' }).click()
  await expect(panel.getByText('Неоплачену COD-відмову закрито без фінансових фактів')).toBeVisible()
  await expect(panel.getByRole('button', { name: /фінансове повернення/i })).toHaveCount(0)
  expect(writes).toEqual(['/api/v1/backoffice/shop-np-returns/cases/7/close-unpaid'])
  await panel.screenshot({ path: testInfo.outputPath('np-cod-closed-390.png') })
})

test('physical receipt uses shipment and inventory permissions independently of sales profile', async ({ page, context }) => {
  const actor = { ...user, is_superuser: false, role: null, can_record_sales: false, can_manage_shipments: true, can_post_inventory: false }
  const state = { order_id: 321, revision: 3, available: true, profile_id: 'np-test', profile_hash: 'a'.repeat(64),
    original_shipment_id: 19, original_ttn: '20450000000001', case_id: 'case-7', return_ttn: '20450000000002', status: 'arrived',
    eligible_lines: [], claimed_lines: [], receipt: null, observation: { observed_at: '2026-11-11T08:00:00Z' },
    can_attach: false, can_receive: false, can_refresh: true, blocking_reasons: [] }
  let allowIntake = false
  await context.route(url => !['127.0.0.1', 'localhost'].includes(url.hostname), route => route.abort())
  await page.addInitScript(actor => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', user: actor })), actor)
  await page.route('**/api/v1/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    expect(request.method(), path).toBe('GET')
    if (path.endsWith('/auth/me')) return route.fulfill({ json: { ...actor, can_post_inventory: allowIntake } })
    if (path.endsWith('/backoffice/orders/321')) return route.fulfill({ json: {
      ...base, revision: 3, simulation: false, payment_method: 'card', payment_channel: 'online_monobank', items: [{ id: 501, product_name: 'Fixture shampoo', quantity: 1 }],
    } })
    if (path.endsWith('/shop-checkbox/orders/321/profile') || path.endsWith('/321/shop-operations')) return route.fulfill({ status: 403, json: {} })
    if (path.endsWith('/shop-np-direct-returns/orders/321')) return route.fulfill({ json: { ...state,
      can_receive: allowIntake, claimed_lines: [{ order_item_id: 501, quantity: 1 }],
    } })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/orders/321')
  const panel = page.getByRole('region', { name: 'Повернення передоплати Новою поштою' })
  await expect(panel.getByText('Немає дозволу на фізичне приймання.')).toBeVisible()
  await expect(panel.getByTestId('np-direct-receive')).toHaveCount(0)
  allowIntake = true
  await panel.getByRole('button', { name: 'Оновити стан' }).click()
  await expect(panel.getByTestId('np-direct-receive')).toBeVisible()
  await expect(panel.getByTestId('np-direct-receive')).toBeDisabled()
  await expect(panel.getByLabel('Прийнято · Fixture shampoo')).toBeVisible()
})
