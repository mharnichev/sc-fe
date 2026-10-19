import { expect, test, type Page } from '@playwright/test'
const openOrderPanels = async (page: Page) => {
  for (const title of ['Документи та чеки', 'Повернення', 'Автоматизація ЕТТН', 'Звіти каси']) {
    await page.getByText(title, { exact: true }).click()
  }
}
const safety = { mode: 'mock_only', provider_contract: 'unknown', simulation: true, is_sent_dps: false, notice: 'MOCK ONLY — до ДПС не надсилалось' }
const user = { id: 1, email: 'fixture@example.test', is_active: true, is_superuser: true, role: 'admin' }
const shipment = { id: 4, tracking_number: 'MOCK-TTN-321', active: true, simulation: true, status: 'created', events: [] }
const baseOrder = { id: 321, status: 'confirmed', channel: 'backoffice_pos', fulfillment_method: 'nova_poshta', revision: 2, total_amount: '123.45', subtotal_amount: '123.45', discount_amount: '0.00', payment_status: 'simulated_paid', fiscal_status: 'not_requested', simulation: true, items: [], shipments: [shipment], payments: [] }
const snapshot = { amount_minor: 12345, tracking_number: shipment.tracking_number, shipment_id: 4, condition: 'mock_delivery_confirmed', cash_register_id: 'MOCK-KASA-1', order_id: 321, order_revision: 2, shift_revision: 1, payment: { id: 3 }, ...safety }
const initialPreview = { id: 7, order_id: 321, revision: 2, cash_register_id: 'MOCK-KASA-1', shift_revision: 1, snapshot_hash: 'a'.repeat(64), snapshot, expires_at: '2099-01-01T00:00:00Z', allowed_actions: ['arm'], blocking_reasons: [], ...safety }
const initialProject = { id: 9, order_id: 321, payment_id: 3, shipment_id: 4, tracking_number: shipment.tracking_number, status: 'queued', revision: 1, provider_uuid: '00000000-0000-4000-8000-000000000009', external_id: null, cash_register_id: 'MOCK-KASA-1', shift_revision: 1, condition: 'mock_delivery_confirmed', snapshot_hash: initialPreview.snapshot_hash, snapshot, approved_at: '2026-10-17T00:00:00Z', dispatched_at: null, cancellation_confirmed_at: null, result: null, allowed_actions: ['process','cancel'], blocking_reasons: [], ...safety }
type Mutation = { path: string, key?: string, body: any }
async function fixture(page: Page, options: { disabled?: boolean, abortArm?: boolean, abortCancel?: boolean, actor?: typeof user, stale?: boolean, existingOwner?: boolean } = {}) {
  const actor = options.actor || user
  let project: any = options.existingOwner ? { ...initialProject, status: 'armed', external_id: 'MOCK-ETTN-9', allowed_actions: ['cancel','trigger'] } : null, preview = structuredClone(initialPreview), revision = 2, previewCount = 0
  const mutations: Mutation[] = [], applied = new Map<string, any>()
  await page.addInitScript(actor => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', user: actor })), actor)
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname, method = req.method(), key = req.headers()['idempotency-key']
    if (req.method() === 'GET' && path.endsWith('/qr-payment-attempts')) return route.fulfill({ json: [] })
    if (method !== 'GET') mutations.push({ path, key, body: req.postDataJSON() })
    if (path.endsWith('/auth/me')) return route.fulfill({ json: actor })
    if (path.endsWith('/integrations/readiness')) return route.fulfill({ json: { mode: 'mock_only', available: true, blocking_reasons: [], cash_registers: [{ id: 'MOCK-KASA-1', label: 'MOCK каса', credential_kind: 'mock', shift_status: 'open', shift_revision: 1 }] } })
    if (path.endsWith('/fiscal-documents') || path.endsWith('/returns')) return route.fulfill({ json: [] })
    if (path.endsWith('/fiscal-automations') && method === 'GET') return route.fulfill({ json: { ...safety, owner: project && project.status !== 'cancelled' ? 'checkbox_ettn' : null, items: project ? [project] : [], available: !options.disabled, allowed_actions: !options.disabled && (!project || project.status === 'cancelled') ? ['preview'] : [], blocking_reasons: options.disabled ? ['mock_ettn_disabled'] : [] } })
    if (path.endsWith('/fiscal-automation-preview')) { previewCount++; preview = { ...initialPreview, id: 6 + previewCount, revision, snapshot_hash: (previewCount === 1 ? 'a' : 'b').repeat(64) }; return route.fulfill({ json: preview }) }
    if (/\/fiscal-automation-previews\/\d+$/.test(path)) return route.fulfill({ json: { ...preview, allowed_actions: project && project.status !== 'cancelled' ? [] : ['arm'] } })
    if (path.endsWith('/fiscal-automations') && method === 'POST') {
      if (options.stale && mutations.filter(item => item.path.endsWith('/fiscal-automations')).length === 1) { revision++; return route.fulfill({ status: 409, json: { detail: { code: 'stale_preview', message: 'Потрібне нове погодження' } } }) }
      if (!project) { project = structuredClone(initialProject); if (req.postDataJSON().mock_outcome !== 'accepted') { project.status = 'unknown'; project.allowed_actions = ['reconcile'] } }
      if (options.abortArm && mutations.filter(item => item.path.endsWith('/fiscal-automations')).length === 1) return route.abort('failed')
      return route.fulfill({ json: project })
    }
    if (/\/fiscal-automations\/9\/(process|cancel|reconcile|trigger)$/.test(path)) {
      const operation = path.split('/').at(-1)
      if (!applied.has(key!)) {
        project.revision++
        if (operation === 'process' || (operation === 'reconcile' && project.status === 'unknown')) Object.assign(project, { status: 'armed', external_id: 'MOCK-ETTN-9', allowed_actions: ['cancel','trigger'] })
        if (operation === 'cancel') Object.assign(project, req.postDataJSON().mock_outcome === 'confirmed' ? { status: 'cancelled', cancellation_confirmed_at: '2026-10-17T01:00:00Z', allowed_actions: [] } : { status: 'cancel_unknown', allowed_actions: ['reconcile'] })
        if (operation === 'reconcile' && project.status === 'cancel_unknown') Object.assign(project, { status: 'cancelled', cancellation_confirmed_at: '2026-10-17T01:00:00Z', allowed_actions: [] })
        if (operation === 'trigger') Object.assign(project, { status: 'issued', result: { kind: 'mock_automation_result', is_sent_dps: false }, allowed_actions: [] })
        applied.set(key!, structuredClone(project))
      }
      if (operation === 'cancel' && options.abortCancel && mutations.filter(item => item.path.endsWith('/cancel')).length === 1) return route.abort('failed')
      return route.fulfill({ json: applied.get(key!) })
    }
    if (/\/orders\/\d+$/.test(path)) return route.fulfill({ json: { ...baseOrder, revision } })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  return mutations
}
const panel = (page: Page) => page.getByRole('region', { name: 'Checkbox ЕТТН MOCK', exact: true })
async function prepare(page: Page) {
  await page.goto('/orders/321'); await openOrderPanels(page)
  await panel(page).getByRole('button', { name: 'Підготувати ЕТТН MOCK snapshot', exact: true }).click()
  await expect(panel(page).getByText(/ТТН: MOCK-TTN-321 · точна сума: 123.45 грн/)).toBeVisible()
}
async function approve(page: Page) {
  await panel(page).getByRole('checkbox', { name: /Погоджую ТТН MOCK-TTN-321.*123.45 грн.*MOCK-KASA-1.*mock_delivery_confirmed.*hash a{64}/ }).check()
  await panel(page).getByRole('button', { name: 'Погодити саме цю ЕТТН MOCK автоматизацію', exact: true }).click()
}
test('no project before exact consent; armed owner blocks manual sale and explicit synthetic trigger is separate', async ({ page }) => {
  const mutations = await fixture(page)
  await prepare(page)
  expect(mutations.map(item => item.path.split('/').at(-1))).toEqual(['fiscal-automation-preview'])
  await expect(panel(page).getByRole('button', { name: 'Погодити саме цю ЕТТН MOCK автоматизацію', exact: true })).toBeDisabled()
  await approve(page)
  await expect(panel(page).getByText('MOCK у черзі — проект ще не активовано', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Checkbox фіскалізація MOCK', exact: true }).getByRole('button', { name: 'Створити новий MOCK preview', exact: true })).toHaveCount(0)
  await panel(page).getByRole('button', { name: 'Обробити погоджений ЕТТН MOCK', exact: true }).click()
  await expect(panel(page).getByText('MOCK активовано — очікує синтетичної умови', { exact: true })).toBeVisible()
  await panel(page).screenshot({ path: '/tmp/stage6-ettn-armed-desktop.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await panel(page).scrollIntoViewIfNeeded()
  expect(await panel(page).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await panel(page).screenshot({ path: '/tmp/stage6-ettn-armed-mobile.png' })
  await panel(page).getByRole('button', { name: 'Виконати синтетичну умову ЕТТН MOCK', exact: true }).click()
  await expect(panel(page).getByText('MOCK умова виконана — локальний результат ЕТТН', { exact: true })).toBeVisible()
  expect(mutations.every(item => !!item.key && /fiscal-automation/.test(item.path))).toBe(true)
  expect(mutations.find(item => item.path.endsWith('/fiscal-automations'))!.body).toEqual({ preview_id: 7, expected_revision: 2, snapshot_hash: 'a'.repeat(64), cash_register_id: 'MOCK-KASA-1', confirm: true, mock_outcome: 'accepted' })
})
test('network unknown reload keeps exact approval; cancel unknown keeps owner until reconciliation confirms cancellation', async ({ page }) => {
  const mutations = await fixture(page, { abortArm: true, abortCancel: true })
  await prepare(page)
  await panel(page).getByLabel('Сценарій погодження ЕТТН MOCK').selectOption('timeout_after_acceptance')
  await approve(page)
  await expect(panel(page).getByRole('alert')).toBeVisible()
  await page.reload(); await openOrderPanels(page)
  await panel(page).getByRole('button', { name: 'Повторити те саме погодження ЕТТН MOCK', exact: true }).click()
  await expect(panel(page).getByText('MOCK результат невідомий — потрібна звірка', { exact: true })).toBeVisible()
  await panel(page).getByRole('button', { name: 'Звірити той самий ЕТТН MOCK', exact: true }).click()
  await panel(page).getByLabel('Сценарій відміни ЕТТН MOCK').selectOption('timeout_after_acceptance')
  await panel(page).getByRole('button', { name: 'Запросити відміну ЕТТН MOCK', exact: true }).click()
  await expect(panel(page).getByRole('alert')).toBeVisible()
  await page.reload(); await openOrderPanels(page)
  await expect(panel(page).getByText('MOCK відміна невідома — ручний обхід заборонено', { exact: true })).toBeVisible()
  await panel(page).getByRole('button', { name: 'Повторити ту саму команду ЕТТН MOCK #9', exact: true }).click()
  await expect(panel(page).getByText('Поточний власник фіскалізації: Checkbox ЕТТН MOCK.', { exact: true })).toBeVisible()
  await panel(page).getByRole('button', { name: 'Звірити той самий ЕТТН MOCK', exact: true }).click()
  await expect(panel(page).getByText('MOCK відміну підтверджено', { exact: true })).toBeVisible()
  await expect(panel(page).getByText('Поточний власник фіскалізації: ще не обраний.', { exact: true })).toBeVisible()
  await panel(page).getByRole('button', { name: 'Підготувати ЕТТН MOCK snapshot', exact: true }).click()
  await expect(panel(page).getByRole('checkbox', { name: /Погоджую ТТН/ })).not.toBeChecked()
  const arms = mutations.filter(item => item.path.endsWith('/fiscal-automations')), cancels = mutations.filter(item => item.path.endsWith('/cancel'))
  expect(arms).toHaveLength(2); expect(arms[0]).toEqual(arms[1]); expect(cancels).toHaveLength(2); expect(cancels[0]).toEqual(cancels[1])
})
test('fresh preview and stale server rejection invalidate exact consent', async ({ page }) => {
  const mutations = await fixture(page, { stale: true })
  await prepare(page)
  await panel(page).getByRole('checkbox', { name: /Погоджую ТТН/ }).check()
  await panel(page).getByRole('button', { name: 'Підготувати ЕТТН MOCK snapshot', exact: true }).click()
  await expect(panel(page).getByRole('checkbox', { name: /Погоджую ТТН/ })).not.toBeChecked()
  await panel(page).getByRole('checkbox', { name: /Погоджую ТТН/ }).check()
  await panel(page).getByRole('button', { name: 'Погодити саме цю ЕТТН MOCK автоматизацію', exact: true }).click()
  await expect(panel(page).getByRole('alert')).toHaveText('Потрібне нове погодження')
  await expect(panel(page).getByRole('checkbox', { name: /Погоджую ТТН/ })).not.toBeChecked()
  await expect(panel(page).getByRole('button', { name: 'Повторити те саме погодження ЕТТН MOCK', exact: true })).toHaveCount(0)
  expect(mutations.filter(item => item.path.endsWith('/fiscal-automations'))).toHaveLength(1)
})
for (const disabled of [true, false]) test(`disabled capability or permission exposes no ETTN mutations (${disabled})`, async ({ page }) => {
  const mutations = await fixture(page, disabled ? { disabled } : { actor: { ...user, is_superuser: false } })
  await page.goto('/orders/321'); await openOrderPanels(page)
  await expect(panel(page).getByText(disabled ? 'mock_ettn_disabled' : 'Немає права на фіскалізацію продажів.', { exact: true })).toBeVisible()
  await expect(panel(page).getByRole('button', { name: /Підготувати|Погодити|Обробити|Запросити|Виконати/ })).toHaveCount(0)
  expect(mutations).toHaveLength(0)
})

test('server owner on initial read blocks both a new ETTN strategy and the old manual sale UI', async ({ page }) => {
  const mutations = await fixture(page, { existingOwner: true })
  await page.goto('/orders/321'); await openOrderPanels(page)
  await expect(panel(page).getByText('Поточний власник фіскалізації: Checkbox ЕТТН MOCK.', { exact: true })).toBeVisible()
  await expect(panel(page).getByRole('button', { name: 'Підготувати ЕТТН MOCK snapshot', exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Checkbox фіскалізація MOCK', exact: true }).getByRole('button', { name: 'Створити новий MOCK preview', exact: true })).toHaveCount(0)
  expect(mutations).toHaveLength(0)
})
