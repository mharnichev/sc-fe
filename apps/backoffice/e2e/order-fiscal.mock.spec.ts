import { expect, test, type Page } from '@playwright/test'
const openOrderPanels = async (page: Page) => {
  for (const title of ['Документи та чеки', 'Повернення', 'Автоматизація ЕТТН', 'Звіти каси']) {
    await page.getByText(title, { exact: true }).click()
  }
}
const user = { id: 1, email: 'fixture@example.test', is_active: true, is_superuser: true, role: 'admin' }
const order = { id: 321, status: 'confirmed', channel: 'backoffice_pos', fulfillment_method: 'pickup', total_amount: '123.45', subtotal_amount: '123.45', discount_amount: '0.00', revision: 2, items: [], payment_status: 'simulated_paid', fiscal_status: 'not_requested', simulation: true, payments: [] }
const tax = { code: 'MOCK_NO_TAX', rate_basis_points: 0, amount_minor: 0 }
const snapshot = { document_kind: 'mock_fiscal_receipt', simulation: true, notice: 'MOCK ONLY — не надсилалось до ДПС', is_sent_dps: false, currency: 'UAH', order_id: 321, order_revision: 2, cash_register_id: 'MOCK-KASA-1', credential_kind: 'mock', shift_revision: 1, items: [{ order_item_id: 11, product_id: 8, name: 'Fixture shampoo', sku: 'SKU-8', quantity: 1, base_price_minor: 12345, price_minor: 12345, discount_minor: 0, total_minor: 12345, tax }], subtotal_minor: 12345, discount_minor: 0, additional_discount_minor: 0, amount_minor: 12345, payment: { id: 1, amount_minor: 12345, method: 'cash', source: 'operator_confirmation', simulation: true }, taxes: [tax], tax_mapping: 'mock_only_no_legal_tax_claim', delivery_channel: 'local_display_print' }
const initialPreview = { id: 7, order_id: 321, revision: 2, snapshot_hash: 'a'.repeat(64), cash_register_id: 'MOCK-KASA-1', shift_revision: 1, expires_at: '2099-01-01T00:00:00Z', snapshot, simulation: true, document_kind: 'mock_fiscal_receipt', is_sent_dps: false, allowed_actions: ['submit'], blocking_reasons: [] }
const initialDocument = { id: 9, order_id: 321, status: 'queued', revision: 1, simulation: true, document_kind: 'mock_fiscal_receipt', provider_uuid: '00000000-0000-4000-8000-000000000009', is_sent_dps: false, cash_register_id: 'MOCK-KASA-1', shift_revision: 1, snapshot_hash: initialPreview.snapshot_hash, snapshot, delivery: { status: 'pending_document', channel: 'local_display_print', attempts: 0, last_error: null }, allowed_actions: ['process', 'cancel'], blocking_reasons: [], print_url: null }
async function fixture(page: Page, options: { available?: boolean, timeout?: boolean, actor?: typeof user & { can_manage_fiscal_settings?: boolean, can_fiscalize_sales?: boolean }, processTimeout?: boolean, rejectShift?: boolean, rejectSubmit?: boolean } = {}) {
  const actor = options.actor || user
  let shiftRevision = 0, opened = false, document: any = null, previewCount = 0
  let currentPreview = structuredClone(initialPreview)
  const mutations: Array<{ path: string, key?: string, body: any }> = []
  const readiness = () => ({ mode: 'mock_only', available: options.available !== false, blocking_reasons: options.available === false ? ['mock_only_disabled'] : [], cash_registers: [{ id: 'MOCK-KASA-1', label: 'Тестова каса', credential_kind: 'mock', shift_status: opened ? 'open' : 'closed', shift_revision: shiftRevision }] })
  await page.addInitScript(actor => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', user: actor })), actor)
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (req.method() === 'GET' && path.endsWith('/qr-payment-attempts')) return route.fulfill({ json: [] })
    if (req.method() !== 'GET') mutations.push({ path, key: req.headers()['idempotency-key'], body: req.postDataJSON() })
    if (path.endsWith('/auth/me')) return route.fulfill({ json: actor })
    if (path.endsWith('/integrations/readiness')) return route.fulfill({ json: readiness() })
    if (path.endsWith('/open-shift') || path.endsWith('/close-shift')) {
      if (options.rejectShift && mutations.filter(item => item.path.endsWith('/open-shift')).length === 1) { shiftRevision++; return route.fulfill({ status: 409, json: { detail: { code: 'shift_revision_conflict', message: 'Reload register state' } } }) }
      opened = path.endsWith('/open-shift'); shiftRevision++; return route.fulfill({ json: readiness() }) }
    if (path.endsWith('/fiscal-preview')) { previewCount++; currentPreview = { ...initialPreview, id: 6 + previewCount, snapshot_hash: (previewCount === 1 ? 'a' : 'b').repeat(64), shift_revision: shiftRevision }; return route.fulfill({ json: currentPreview }) }
    if (/\/fiscal-previews\/\d+$/.test(path)) return route.fulfill({ json: { ...currentPreview, allowed_actions: document ? [] : ['submit'], blocking_reasons: document ? ['active_document_exists'] : [] } })
    if (path.endsWith('/fiscal-submissions')) {
      if (options.rejectSubmit && mutations.filter(item => item.path.endsWith('/fiscal-submissions')).length === 1) return route.fulfill({ status: 409, json: { detail: { code: 'stale_preview', message: 'Create a new preview' } } })
      document ||= structuredClone(initialDocument)
      if (req.postDataJSON().mock_outcome === 'timeout_after_acceptance') { document.status = 'unknown'; document.allowed_actions = ['process'] }
      if (options.timeout && mutations.filter(item => item.path.endsWith('/fiscal-submissions')).length === 1) return route.abort('failed')
      return route.fulfill({ json: document })
    }
    if (path.endsWith('/fiscal-documents/9/process')) {
      document = { ...document, status: 'issued', revision: 2, allowed_actions: ['print', 'delivery'], print_url: '/api/v1/backoffice/fiscal-documents/9/print', delivery: { ...document.delivery, status: req.postDataJSON().mock_delivery_outcome === 'failed' ? 'failed' : 'delivered', attempts: 1, last_error: req.postDataJSON().mock_delivery_outcome === 'failed' ? 'MOCK local display failed' : null } }
      if (options.processTimeout && mutations.filter(item => item.path.endsWith('/process')).length === 1) return route.abort('failed')
      return route.fulfill({ status: 202, json: initialDocument })
    }
    if (path.endsWith('/fiscal-documents/9/cancel')) { document = { ...document, status: 'cancelled', revision: 2, allowed_actions: [] }; return route.fulfill({ json: document }) }
    if (path.endsWith('/fiscal-documents/9/delivery')) { document.delivery = { ...document.delivery, status: 'delivered', attempts: 2, last_error: null }; document.revision++; return route.fulfill({ json: document }) }
    if (path.endsWith('/fiscal-documents/9/print')) { expect(req.headers().authorization).toBe('Bearer fixture-only'); return route.fulfill({ contentType: 'text/html', body: '<h1>MOCK чек — до ДПС не надсилалось</h1>' }) }
    if (path.endsWith('/fiscal-documents')) return route.fulfill({ json: document ? [document] : [] })
    if (/\/orders\/\d+$/.test(path)) return route.fulfill({ json: { ...order, id: Number(path.split('/').at(-1)) } })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  return mutations
}
const panel = (page: Page) => page.getByRole('region', { name: 'Checkbox фіскалізація MOCK' })
async function prepare(page: Page) {
  await page.goto('/orders/321'); await openOrderPanels(page)
  await panel(page).getByRole('button', { name: 'Відкрити MOCK зміну', exact: true }).click()
  await panel(page).getByRole('button', { name: 'Створити новий MOCK preview', exact: true }).click()
  await expect(panel(page).getByText('Точна сума MOCK: 123.45 грн', { exact: true })).toBeVisible()
}
test('disabled server capability exposes no mock mutations even to superuser', async ({ page }) => {
  const mutations = await fixture(page, { available: false })
  await page.goto('/orders/321'); await openOrderPanels(page)
  await expect(panel(page).getByText('mock_only_disabled')).toBeVisible()
  await expect(panel(page).getByRole('button', { name: /зміну|preview|подання/ })).toHaveCount(0)
  expect(mutations).toHaveLength(0)
})
test('exact approval, unknown result, timeout reload, explicit reconcile and delivery-only retry stay on one document', async ({ page }) => {
  const mutations = await fixture(page, { timeout: true, processTimeout: true })
  await prepare(page)
  const queue = panel(page).getByRole('button', { name: 'Погодити та поставити MOCK у чергу', exact: true })
  await expect(queue).toBeDisabled()
  await panel(page).getByLabel('Сценарій MOCK подання').selectOption('timeout_after_acceptance')
  await panel(page).getByRole('checkbox', { name: /MOCK preview #7.*123.45 грн/ }).check()
  await queue.click()
  await expect(panel(page).getByRole('alert')).toBeVisible()
  await page.reload(); await openOrderPanels(page)
  await panel(page).getByRole('button', { name: 'Повторити те саме MOCK подання', exact: true }).click()
  await expect(panel(page).getByText('Невідомий результат MOCK — потрібна звірка', { exact: true })).toBeVisible()
  const submissions = mutations.filter(item => item.path.endsWith('/fiscal-submissions'))
  expect(submissions).toHaveLength(2); expect(submissions[0]).toEqual(submissions[1])
  expect(submissions[0].body).toEqual({ preview_id: 7, expected_revision: 2, snapshot_hash: 'a'.repeat(64), cash_register_id: 'MOCK-KASA-1', confirm: true, mock_outcome: 'timeout_after_acceptance' })
  await expect(panel(page).getByRole('button', { name: 'Скасувати погодження до відправки MOCK', exact: true })).toHaveCount(0)
  await panel(page).getByLabel('Сценарій локального показу / друку').selectOption('failed')
  await panel(page).getByRole('button', { name: 'Звірити / обробити поточний MOCK', exact: true }).click()
  await expect(panel(page).getByRole('alert')).toBeVisible()
  await page.reload(); await openOrderPanels(page)
  await panel(page).getByRole('button', { name: 'Повторити команду MOCK документа #9', exact: true }).click()
  await expect(panel(page).getByText('Видано MOCK чек — не надсилалось до ДПС', { exact: true })).toBeVisible()
  await expect(panel(page).getByText('Помилка локального показу / друку · спроб 1', { exact: true })).toBeVisible()
  const processes = mutations.filter(item => item.path.endsWith('/process'))
  expect(processes).toHaveLength(2); expect(processes[0]).toEqual(processes[1])
  await panel(page).getByRole('button', { name: 'Повторити лише локальний показ / друк MOCK', exact: true }).click()
  await expect(panel(page).getByText('Локальний показ / друк зафіксовано · спроб 2', { exact: true })).toBeVisible()
  expect(mutations.filter(item => item.path.endsWith('/fiscal-submissions'))).toHaveLength(2)
  const popupPromise = page.waitForEvent('popup')
  await panel(page).getByRole('button', { name: 'Відкрити MOCK чек / друк', exact: true }).click()
  await expect((await popupPromise).getByRole('heading', { name: 'MOCK чек — до ДПС не надсилалось' })).toBeVisible()
  expect(mutations.every(item => !!item.key)).toBe(true)
  expect(mutations.every(item => /fiscal|shift/.test(item.path))).toBe(true)
})
test('new preview and closed shift invalidate unsent confirmation; queued approval can be cancelled before processing', async ({ page }) => {
  const mutations = await fixture(page)
  await prepare(page)
  await panel(page).getByRole('checkbox', { name: /MOCK preview #/ }).check()
  await panel(page).getByRole('button', { name: 'Створити новий MOCK preview', exact: true }).click()
  await expect(panel(page).getByRole('checkbox', { name: /MOCK preview #/ })).not.toBeChecked()
  await panel(page).getByRole('checkbox', { name: /MOCK preview #/ }).check()
  await panel(page).getByRole('button', { name: 'Закрити MOCK зміну', exact: true }).click()
  await expect(panel(page).getByRole('checkbox', { name: /MOCK preview #/ })).not.toBeChecked()
  await expect(panel(page).getByRole('button', { name: 'Погодити та поставити MOCK у чергу', exact: true })).toBeDisabled()
  await panel(page).getByRole('button', { name: 'Відкрити MOCK зміну', exact: true }).click()
  await panel(page).getByRole('button', { name: 'Створити новий MOCK preview', exact: true }).click()
  await panel(page).getByRole('checkbox', { name: /MOCK preview #/ }).check()
  await panel(page).getByRole('button', { name: 'Погодити та поставити MOCK у чергу', exact: true }).click()
  await panel(page).getByRole('button', { name: 'Скасувати погодження до відправки MOCK', exact: true }).click()
  await expect(panel(page).getByText('MOCK погодження скасовано', { exact: true })).toBeVisible()
  expect(mutations.filter(item => item.path.endsWith('/process'))).toHaveLength(0)
})

test('definitive shift and stale preview rejections release command identity and require a fresh explicit approval', async ({ page }) => {
  const mutations = await fixture(page, { rejectShift: true, rejectSubmit: true })
  await page.goto('/orders/321'); await openOrderPanels(page)
  await panel(page).getByRole('button', { name: 'Відкрити MOCK зміну', exact: true }).click()
  await expect(panel(page).getByText('Reload register state', { exact: true })).toBeVisible()
  await expect(panel(page).getByRole('button', { name: 'Повторити команду MOCK зміни', exact: true })).toHaveCount(0)
  await panel(page).getByRole('button', { name: 'Відкрити MOCK зміну', exact: true }).click()
  await panel(page).getByRole('button', { name: 'Створити новий MOCK preview', exact: true }).click()
  await panel(page).getByRole('checkbox', { name: /MOCK preview #7/ }).check()
  await panel(page).getByRole('button', { name: 'Погодити та поставити MOCK у чергу', exact: true }).click()
  await expect(panel(page).getByText('Create a new preview', { exact: true })).toBeVisible()
  await expect(panel(page).getByRole('button', { name: 'Повторити те саме MOCK подання', exact: true })).toHaveCount(0)
  await expect(panel(page).getByRole('checkbox', { name: /MOCK preview #7/ })).not.toBeChecked()
  await panel(page).getByRole('button', { name: 'Створити новий MOCK preview', exact: true }).click()
  const confirm = panel(page).getByRole('checkbox', { name: /MOCK preview #8/ })
  await expect(confirm).not.toBeChecked()
  await expect(panel(page).getByRole('button', { name: 'Погодити та поставити MOCK у чергу', exact: true })).toBeDisabled()
  await confirm.check()
  await panel(page).getByRole('button', { name: 'Погодити та поставити MOCK у чергу', exact: true }).click()
  await expect(panel(page).getByText('У черзі MOCK — ще не видано', { exact: true })).toBeVisible()
  const opens = mutations.filter(item => item.path.endsWith('/open-shift'))
  expect(opens[0].key).not.toBe(opens[1].key); expect(opens[1].body.expected_shift_revision).toBe(1)
  const submits = mutations.filter(item => item.path.endsWith('/fiscal-submissions'))
  expect(submits[0].key).not.toBe(submits[1].key); expect(submits[1].body.preview_id).toBe(8)
})

test('settings-only operator can manage shifts independently of sales document access', async ({ page }) => {
  const reads: string[] = []
  page.on('request', request => { if (new URL(request.url()).pathname.endsWith('/fiscal-documents')) reads.push(request.url()) })
  const mutations = await fixture(page, { actor: { ...user, is_superuser: false, can_manage_fiscal_settings: true } })
  await page.goto('/orders/321'); await openOrderPanels(page)
  await panel(page).getByRole('button', { name: 'Відкрити MOCK зміну', exact: true }).click()
  await expect(panel(page).getByRole('button', { name: 'Закрити MOCK зміну', exact: true })).toBeVisible()
  await expect(panel(page).getByRole('button', { name: 'Створити новий MOCK preview', exact: true })).toHaveCount(0)
  expect(reads).toHaveLength(0)
  expect(mutations).toHaveLength(1)
})
test('sales-only operator has preview access without shift controls', async ({ page }) => {
  const mutations = await fixture(page, { actor: { ...user, is_superuser: false, can_fiscalize_sales: true } })
  await page.goto('/orders/321'); await openOrderPanels(page)
  await expect(panel(page).getByRole('button', { name: 'Створити новий MOCK preview', exact: true })).toBeVisible()
  await expect(panel(page).getByRole('button', { name: /Відкрити MOCK зміну|Закрити MOCK зміну/ })).toHaveCount(0)
  expect(mutations).toHaveLength(0)
})
