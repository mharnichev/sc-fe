import { expect, test, type Page } from '@playwright/test'
const openOrderPanels = async (page: Page) => {
  for (const title of ['Документи та чеки', 'Повернення', 'Автоматизація ЕТТН', 'Звіти каси']) {
    await page.getByText(title, { exact: true }).click()
  }
}
const safety = { mode: 'mock_only', provider_contract: 'unknown', simulation: true, is_sent_dps: false, notice: 'MOCK ONLY — до ДПС не надсилалось' }
const admin = { id: 1, email: 'fixture@example.test', is_active: true, is_superuser: true, role: 'admin' }
const line = { order_item_id: 11, product_id: 8, name: 'Fixture shampoo', sku: 'SKU8', quantity: 2, base_price_minor: 1000, price_minor: 1000, discount_minor: 0, total_minor: 2000, tax: { code: 'MOCK_NO_TAX', rate_basis_points: 0, amount_minor: 0 } }
const original = { document_kind: 'mock_automation_project', simulation: true, notice: 'MOCK ONLY', is_sent_dps: false, currency: 'UAH', order_id: 321, order_revision: 2, cash_register_id: 'MOCK-KASA-1', credential_kind: 'mock', shift_revision: 1, items: [line], subtotal_minor: 2000, discount_minor: 0, additional_discount_minor: 0, amount_minor: 2000, payment: { id: 3, amount_minor: 2000, method: 'cash', source: 'operator_confirmation', simulation: true }, taxes: [], tax_mapping: 'mock_only_no_legal_tax_claim', delivery_channel: 'local_display_print', tracking_number: 'MOCK-TTN-321', shipment_id: 4, condition: 'mock_delivery_confirmed' }
const initialProject = { ...safety, id: 9, order_id: 321, payment_id: 3, shipment_id: 4, tracking_number: 'MOCK-TTN-321', status: 'armed', revision: 2, provider_uuid: '00000000-0000-4000-8000-000000000009', external_id: 'MOCK-ETTN-9', cash_register_id: 'MOCK-KASA-1', shift_revision: 1, condition: 'mock_delivery_confirmed', snapshot_hash: 'a'.repeat(64), snapshot: original, approved_at: '2026-10-17', dispatched_at: '2026-10-17', cancellation_confirmed_at: null, result: null as any, fiscal_document_id: null as number | null, allowed_actions: ['trigger','cancel','reconcile'], blocking_reasons: [] as string[] }
const canonical = { id: 19, automation_id: 9, source: 'automation', kind: 'sale', order_id: 321, status: 'issued', revision: 1, simulation: true, document_kind: 'mock_fiscal_receipt', provider_uuid: initialProject.provider_uuid, is_sent_dps: false, cash_register_id: 'MOCK-KASA-1', shift_revision: 1, snapshot_hash: 'b'.repeat(64), snapshot: { ...original, document_kind: 'mock_fiscal_receipt', source: 'mock_ettn', automation: { id: 9, provider_uuid: initialProject.provider_uuid, approval_snapshot_hash: initialProject.snapshot_hash, external_id: initialProject.external_id, shipment_id: 4, tracking_number: 'MOCK-TTN-321', condition: 'mock_delivery_confirmed' } }, delivery: { status: 'delivered', channel: 'local_display_print', attempts: 1, last_error: null }, allowed_actions: ['print','share','revoke_share','delivery'], blocking_reasons: [], print_url: '/api/v1/backoffice/fiscal-documents/19/print' }
async function fixture(page: Page, options: { historical?: boolean, abortMaterialize?: boolean, corrupt?: boolean } = {}) {
 let project: any = structuredClone(initialProject), document: any = null, record: any = null, returnDocument: any = null, shiftRevision = 1, opened = true
 if (options.historical) Object.assign(project, { status: 'issued', result: { kind: 'mock_automation_result', is_fiscal_document: false }, allowed_actions: ['materialize'] })
 if (options.corrupt) { Object.assign(project, { status: 'issued', fiscal_document_id: 19, allowed_actions: ['view_document'] }); document = structuredClone(canonical) }
 const mutations: Array<{ path: string, key?: string, body: any }> = [], reports: any[] = [], applied = new Map<string, any>()
 const readiness = () => ({ mode: 'mock_only', available: true, blocking_reasons: [], cash_registers: [{ id: 'MOCK-KASA-1', label: 'MOCK каса', credential_kind: 'mock', shift_status: opened ? 'open' : 'closed', shift_revision: shiftRevision }] })
 const buckets = () => ({ payments_without_receipts: [], receipts_without_basis: [], unknown: [], refund_pending: [], fiscal_return_pending: [], receipt_pending: [], open_shifts: [], automation_receipt_missing: project.status === 'issued' && !project.fiscal_document_id ? [{ resource_id: '9', order_id: 321, amount_minor: 2000, acknowledgements: [] }] : [] })
 const returnSnapshot = () => ({ document_kind: 'mock_fiscal_receipt', kind: 'return', simulation: true, notice: 'MOCK ONLY', is_sent_dps: false, currency: 'UAH', order_id: 321, return_id: 5, parent_sale_id: 19, parent_sale_hash: canonical.snapshot_hash, refund_id: 6, cash_register_id: 'MOCK-KASA-1', credential_kind: 'mock', shift_revision: shiftRevision, items: record.items, amount_minor: 1000, payment: { id: 6, amount_minor: 1000, method: 'cash', simulation: true }, delivery_channel: 'local_display_print' })
 const preview = () => ({ id: 7, kind: 'return', return_id: 5, parent_sale_id: 19, order_id: 321, revision: 1, snapshot_hash: 'c'.repeat(64), cash_register_id: 'MOCK-KASA-1', shift_revision: shiftRevision, expires_at: '2099-01-01T00:00:00Z', snapshot: returnSnapshot(), allowed_actions: returnDocument ? [] : ['submit'], blocking_reasons: [] })
 await page.addInitScript(actor => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', user: actor })), admin)
 await page.route('**/api/v1/**', async route => {
  const req = route.request(), path = new URL(req.url()).pathname, body = req.method() === 'GET' ? null : req.postDataJSON(), key = req.headers()['idempotency-key']
  if (req.method() === 'GET' && path.endsWith('/qr-payment-attempts')) return route.fulfill({ json: [] })
  if (body) mutations.push({ path, key, body })
  if (path.endsWith('/auth/me')) return route.fulfill({ json: admin })
  if (path.endsWith('/integrations/readiness')) return route.fulfill({ json: readiness() })
  if (path.endsWith('/orders/321/fiscal-automations')) return route.fulfill({ json: { ...safety, available: !options.historical, owner: 'checkbox_ettn', items: [project], allowed_actions: [], blocking_reasons: options.historical ? ['mock_automation_disabled'] : ['fiscal_owner_exists'] } })
  if (/\/fiscal-automations\/9\/(trigger|materialize)$/.test(path)) {
   if (!applied.has(key!)) { document ||= structuredClone(canonical); Object.assign(project, { status: 'issued', fiscal_document_id: 19, revision: project.revision + 1, result: project.result || { kind: 'mock_automation_result', is_fiscal_document: false }, allowed_actions: ['view_document'] }); applied.set(key!, structuredClone(project)) }
   if (path.endsWith('/materialize') && options.abortMaterialize && mutations.filter(item => item.path.endsWith('/materialize')).length === 1) return route.abort('failed')
   return route.fulfill({ json: applied.get(key!) })
  }
  if (path.endsWith('/fiscal-documents/19')) return options.corrupt ? route.fulfill({ status: 409, json: { detail: { code: 'automation_receipt_mismatch', message: 'Canonical automation provenance mismatch' } } }) : route.fulfill({ json: document })
  if (path.endsWith('/fiscal-documents/19/print')) return route.fulfill({ contentType: 'text/html', body: '<h1>MOCK чек ЕТТН #19 — до ДПС не надсилалось</h1>' })
  if (path.endsWith('/fiscal-documents/19/share') || path.endsWith('/fiscal-documents/19/revoke-share')) return route.fulfill({ json: { document_id: 19, generation: 1, url: '/api/v1/public/mock-fiscal-documents/'+'x'.repeat(30), expires_at: '2099-01-01T00:00:00Z', revoked: path.endsWith('/revoke-share') } })
  if (path.endsWith('/fiscal-documents')) return route.fulfill({ json: options.corrupt ? [] : [document, returnDocument].filter(Boolean) })
  if (path.endsWith('/orders/321/returns')) {
   if (body) record ||= { id: 5, order_id: 321, parent_sale_id: body.parent_sale_id, amount_minor: 1000, currency: 'UAH', items: [{ order_item_id: 11, product_id: 8, name: line.name, quantity: 1, total_minor: 1000 }], reason: body.reason, simulation: true, created_at: '2026-10-17', refund: null, receipt: null, fiscal_document_ids: [], allowed_actions: ['refund','receive','fiscal_preview'], blocking_reasons: [] }
   return route.fulfill({ json: body ? record : record ? [record] : [] })
  }
  if (path.endsWith('/returns/5/refunds')) { record.refund ||= { id: 6, amount_minor: 1000, method: body.method, evidence: body.evidence, operator_id: 1, created_at: '2026-10-17' }; return route.fulfill({ json: record }) }
  if (path.endsWith('/returns/5/fiscal-preview') || path.endsWith('/fiscal-previews/7')) return route.fulfill({ json: preview() })
  if (path.endsWith('/fiscal-submissions')) { returnDocument ||= { ...canonical, id: 20, automation_id: null, source: 'manual', kind: 'return', return_id: 5, parent_sale_id: 19, status: 'queued', snapshot: returnSnapshot(), snapshot_hash: 'c'.repeat(64), allowed_actions: ['process'] }; record.fiscal_document_ids = [20]; return route.fulfill({ json: returnDocument }) }
  if (path.endsWith('/fiscal-documents/20/process')) { Object.assign(returnDocument, { status: 'issued', revision: 2, allowed_actions: ['print'] }); return route.fulfill({ json: returnDocument }) }
  if (path.endsWith('/reconciliation')) return route.fulfill({ json: { simulation: true, notice: 'MOCK canonical totals', buckets: buckets(), totals: { sales_minor: document && !options.corrupt ? 2000 : 0, reserved_returns_minor: record ? 1000 : 0, refunds_minor: record?.refund ? 1000 : 0, fiscal_returns_minor: returnDocument?.status === 'issued' ? 1000 : 0 }, acknowledgements: [] } })
  if (path.endsWith('/cash-registers/MOCK-KASA-1/reports')) {
   if (body) { reports.push({ id: reports.length+1, kind: body.kind, cash_register_id: 'MOCK-KASA-1', shift_revision: shiftRevision, totals: { sale_count: document ? 1 : 0, return_count: returnDocument?.status === 'issued' ? 1 : 0, sales_minor: document ? 2000 : 0, returns_minor: returnDocument?.status === 'issued' ? 1000 : 0, net_minor: returnDocument?.status === 'issued' ? 1000 : 2000, document_ids: returnDocument?.status === 'issued' ? [19,20] : [19] }, created_at: '2026-10-17', simulation: true, notice: 'MOCK ONLY' }); if (body.kind === 'z') { opened = false; shiftRevision++ } }
   return route.fulfill({ json: body ? reports.at(-1) : reports })
  }
  if (path.endsWith('/orders/321')) return route.fulfill({ json: { id: 321, status: 'confirmed', channel: 'backoffice_pos', fulfillment_method: 'nova_poshta', revision: 2, total_amount: '20.00', subtotal_amount: '20.00', discount_amount: '0.00', simulation: true, items: [], payments: [], shipments: [{ id: 4, tracking_number: 'MOCK-TTN-321', active: true, simulation: true, status: 'delivered', events: [] }] } })
  return route.fulfill({ json: { items: [], total: 0 } })
 })
 return { mutations }
}
const ettn = (page: Page) => page.getByRole('region', { name: 'Checkbox ЕТТН MOCK', exact: true })
const salePanel = (page: Page) => page.getByRole('region', { name: 'Checkbox фіскалізація MOCK', exact: true })
const receipt = (page: Page) => salePanel(page).getByRole('article', { name: 'MOCK фіскальний документ #19', exact: true })
test('one canonical ETTN receipt feeds existing print share partial return and X/Z without a manual sale submission', async ({ page }) => {
 const data = await fixture(page)
 await page.goto('/orders/321'); await openOrderPanels(page)
 await ettn(page).getByRole('button', { name: 'Виконати синтетичну умову ЕТТН MOCK', exact: true }).click()
 await expect(ettn(page).getByRole('link', { name: 'Перейти до пов’язаного MOCK чека #19', exact: true })).toHaveAttribute('href', '#mock-fiscal-document-19')
 await expect(receipt(page)).toBeVisible()
 await expect(receipt(page).getByRole('button', { name: 'Звірити / обробити поточний MOCK', exact: true })).toHaveCount(0)
 await expect(salePanel(page).getByRole('button', { name: 'Створити новий MOCK preview', exact: true })).toHaveCount(0)
 await ettn(page).screenshot({ path: '/tmp/ettn-link-desktop.png' })
 await page.setViewportSize({ width: 390, height: 844 })
 expect(await ettn(page).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
 await ettn(page).screenshot({ path: '/tmp/ettn-link-mobile.png' })
 const popup = page.waitForEvent('popup'); await receipt(page).getByRole('button', { name: 'Відкрити MOCK чек / друк', exact: true }).click()
 await expect((await popup).getByRole('heading', { name: 'MOCK чек ЕТТН #19 — до ДПС не надсилалось', exact: true })).toBeVisible()
 const share = receipt(page).getByLabel('Локальне MOCK посилання #19', { exact: true })
 await share.getByRole('checkbox').check(); await share.getByRole('button', { name: 'Створити локальне тестове посилання MOCK', exact: true }).click()
 await expect(share.getByRole('link')).toHaveAttribute('href', 'http://127.0.0.1:6083/mock-fiscal-documents/'+'x'.repeat(30))
 const returns = page.getByRole('region', { name: 'Повернення товарів MOCK', exact: true })
 await returns.getByLabel('Вихідний виданий MOCK чек').selectOption('19')
 await returns.getByLabel('Кількість повернення Fixture shampoo').fill('1'); await returns.getByLabel('Причина MOCK повернення').fill('Canonical ETTN partial return')
 await returns.getByRole('checkbox', { name: /Фіксую незмінний MOCK/ }).check(); await returns.getByRole('button', { name: 'Створити незмінне MOCK повернення', exact: true }).click()
 const fact = returns.getByRole('article', { name: 'MOCK повернення #5', exact: true })
 await expect(fact.getByRole('heading', { name: /продаж #19/ })).toBeVisible()
 await fact.getByLabel('Доказ MOCK повернення грошей').fill('Local simulated refund')
 await fact.getByRole('checkbox', { name: /саме 10.00 грн/ }).check(); await fact.getByRole('button', { name: 'Підтвердити повернення грошей MOCK', exact: true }).click()
 await expect(fact.getByText(/Гроші: MOCK підтверджено 10.00 грн/)).toBeVisible()
 const fiscal = fact.getByRole('region', { name: 'Checkbox фіскальне повернення MOCK #5', exact: true })
 await fiscal.getByRole('button', { name: 'Створити новий MOCK preview', exact: true }).click()
 await fiscal.getByRole('checkbox', { name: /MOCK preview #7/ }).check(); await fiscal.getByRole('button', { name: 'Погодити та поставити MOCK у чергу', exact: true }).click()
 await fiscal.getByRole('button', { name: 'Звірити / обробити поточний MOCK', exact: true }).click()
 await expect(fiscal.getByText('Видано MOCK чек — не надсилалось до ДПС', { exact: true })).toBeVisible()
 const reports = page.getByRole('region', { name: 'Звірка та X Z звіти MOCK', exact: true })
 await expect(reports.getByText(/MOCK canonical totals · продажі 20.00 грн.*фіскальні повернення 10.00 грн/)).toBeVisible()
 await reports.getByRole('checkbox', { name: /Підтверджую X звіт MOCK/ }).check(); await reports.getByRole('button', { name: 'Створити X/Z звіт MOCK', exact: true }).click()
 await expect(reports.getByText('Продажі 1 / 20.00 грн · повернення 1 / 10.00 грн · підсумок 10.00 грн', { exact: true })).toBeVisible()
 await reports.getByLabel('Тип звіту MOCK').selectOption('z'); await reports.getByRole('checkbox', { name: /Підтверджую Z звіт MOCK/ }).check(); await reports.getByRole('button', { name: 'Створити X/Z звіт MOCK', exact: true }).click()
 await expect(reports.getByRole('heading', { name: /Z MOCK #2/ })).toBeVisible()
 expect(data.mutations.filter(item => item.path.endsWith('/trigger'))).toHaveLength(1)
 expect(data.mutations.filter(item => item.path.endsWith('/fiscal-submissions'))).toHaveLength(1)
 expect(data.mutations.some(item => item.path.endsWith('/orders/321/fiscal-preview') || item.path.endsWith('/fiscal-documents/19/process'))).toBe(false)
 expect(data.mutations.find(item => item.path.endsWith('/returns'))!.body.parent_sale_id).toBe(19)
 expect(data.mutations.every(item => !!item.key)).toBe(true)
})
test('historical issued result materializes locally with flags off and exact timeout retry after reload', async ({ page }) => {
 const data = await fixture(page, { historical: true, abortMaterialize: true })
 await page.goto('/orders/321'); await openOrderPanels(page)
 await expect(page.getByRole('heading', { name: 'ЕТТН без канонічного MOCK чека · #9 · 20.00 грн', exact: true })).toBeVisible()
 await expect(ettn(page).getByRole('link')).toHaveCount(0); expect(data.mutations).toHaveLength(0)
 await ettn(page).getByRole('button', { name: 'Відновити канонічний MOCK чек без нового подання', exact: true }).click()
 await expect(ettn(page).getByRole('alert')).toBeVisible(); await page.reload(); await openOrderPanels(page)
 await ettn(page).getByRole('button', { name: 'Повторити ту саму команду ЕТТН MOCK #9', exact: true }).click()
 await expect(ettn(page).getByRole('link', { name: 'Перейти до пов’язаного MOCK чека #19', exact: true })).toBeVisible()
 await expect(receipt(page)).toBeVisible()
 const sent = data.mutations.filter(item => item.path.endsWith('/materialize')); expect(sent).toHaveLength(2); expect(sent[0]).toEqual(sent[1]); expect(sent[0].body).toEqual({ expected_revision: 2 })
 expect(data.mutations.some(item => /trigger|process|fiscal-submissions/.test(item.path))).toBe(false)
 await expect(page.getByRole('heading', { name: 'ЕТТН без канонічного MOCK чека · #9 · 20.00 грн', exact: true })).toHaveCount(0)
})
test('mismatched canonical truth never exposes a linked receipt or automatic recovery mutation', async ({ page }) => {
 const data = await fixture(page, { corrupt: true })
 await page.goto('/orders/321'); await openOrderPanels(page)
 await expect(ettn(page).getByRole('alert')).toHaveText('Не вдалося підтвердити зв’язок MOCK чека з цим ЕТТН проектом. Повторіть читання; ручний обхід заборонено.')
 await expect(ettn(page).getByRole('link')).toHaveCount(0)
 await expect(ettn(page).getByRole('button', { name: /Відновити канонічний/ })).toHaveCount(0)
 expect(data.mutations).toHaveLength(0)
})
