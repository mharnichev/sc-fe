import { expect, test, type Page } from '@playwright/test'
const openOrderPanels = async (page: Page) => {
  for (const title of ['Документи та чеки', 'Повернення', 'Автоматизація ЕТТН', 'Звіти каси']) {
    await page.getByText(title, { exact: true }).click()
  }
}
const admin = { id: 1, email: 'fixture@example.test', is_active: true, is_superuser: true, role: 'admin' }
const item = { order_item_id: 11, product_id: 8, name: 'Fixture shampoo', sku: 'SKU8', quantity: 3, base_price_minor: 1000, price_minor: 1000, discount_minor: 0, total_minor: 3000 }
const snapshot = { document_kind: 'mock_fiscal_receipt', simulation: true, notice: 'MOCK ONLY', is_sent_dps: false, currency: 'UAH', order_id: 321, order_revision: 2, cash_register_id: 'MOCK-KASA-1', credential_kind: 'mock', shift_revision: 1, items: [item], subtotal_minor: 3000, discount_minor: 0, additional_discount_minor: 0, amount_minor: 3000, payment: { id: 1, amount_minor: 3000, method: 'cash', source: 'operator_confirmation', simulation: true }, taxes: [], tax_mapping: 'mock_only_no_legal_tax_claim', delivery_channel: 'local_display_print' }
const sale = { id: 9, kind: 'sale', order_id: 321, status: 'issued', revision: 2, simulation: true, document_kind: 'mock_fiscal_receipt', provider_uuid: 'fixture-sale', is_sent_dps: false, cash_register_id: 'MOCK-KASA-1', shift_revision: 1, snapshot_hash: 'a'.repeat(64), snapshot, delivery: { status: 'delivered', channel: 'local_display_print', attempts: 1, last_error: null }, allowed_actions: ['print','share','revoke_share'], blocking_reasons: [], print_url: null }
const row = () => ({ id: 5, order_id: 321, parent_sale_id: 9, amount_minor: 1000, currency: 'UAH', items: [{ order_item_id: 11, product_id: 8, name: 'Fixture shampoo', quantity: 1, total_minor: 1000 }], reason: 'Local test', simulation: true, created_at: '2026-10-17', refund: null as any, receipt: null as any, fiscal_document_ids: [] as number[], allowed_actions: ['refund','receive','fiscal_preview'], blocking_reasons: [] })
async function fixture(page: Page, options: { actor?: Record<string, unknown>, existing?: boolean, refunded?: boolean, timeoutRefund?: boolean, timeoutReceipt?: boolean } = {}) {
 const actor = options.actor || admin, mutations: Array<{ path: string, body: any, key?: string }> = []
 let record: ReturnType<typeof row> | null = options.existing ? row() : null, returnDoc: any = null, revision = 1, opened = true, stockPosts = 0
 if (record && options.refunded) record.refund = { id: 6, amount_minor: 1000, method: 'cash', evidence: 'Local refund', operator_id: 1, created_at: '2026-10-17' }
 const reports: any[] = [], acks: any[] = []
 const readiness = () => ({ mode: 'mock_only', available: true, blocking_reasons: [], cash_registers: [{ id: 'MOCK-KASA-1', label: 'Тестова каса', credential_kind: 'mock', shift_status: opened ? 'open' : 'closed', shift_revision: revision }] })
 const returnSnapshot = () => ({ document_kind: 'mock_fiscal_receipt', kind: 'return', simulation: true, notice: 'MOCK ONLY', is_sent_dps: false, currency: 'UAH', order_id: 321, return_id: 5, parent_sale_id: 9, parent_sale_hash: 'a'.repeat(64), refund_id: 6, cash_register_id: 'MOCK-KASA-1', credential_kind: 'mock', shift_revision: revision, items: record!.items, amount_minor: 1000, payment: { id: 6, amount_minor: 1000, method: 'cash', simulation: true }, delivery_channel: 'local_display_print' })
 const preview = () => ({ id: 7, kind: 'return', return_id: 5, parent_sale_id: 9, order_id: 321, revision: 1, snapshot_hash: 'b'.repeat(64), cash_register_id: 'MOCK-KASA-1', shift_revision: revision, expires_at: '2099-01-01T00:00:00Z', snapshot: returnSnapshot(), allowed_actions: returnDoc ? [] : ['submit'], blocking_reasons: [] })
 await page.addInitScript(actor => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', user: actor })), actor)
 await page.route('**/api/v1/**', async route => {
  const req = route.request(), path = new URL(req.url()).pathname, body = req.method() !== 'GET' ? req.postDataJSON() : null
  if (req.method() === 'GET' && path.endsWith('/qr-payment-attempts')) return route.fulfill({ json: [] })
  if (body) mutations.push({ path, body, key: req.headers()['idempotency-key'] })
  if (path.endsWith('/auth/me')) return route.fulfill({ json: actor })
  if (path.endsWith('/integrations/readiness')) return route.fulfill({ json: readiness() })
  if (path.endsWith('/open-shift') || path.endsWith('/close-shift')) { opened = path.endsWith('/open-shift'); revision++; return route.fulfill({ json: readiness() }) }
  if (path.endsWith('/orders/321/returns')) { if (body) record ||= row(); return route.fulfill({ json: body ? record : record ? [record] : [] }) }
  if (path.endsWith('/returns/5/refunds')) { record!.refund ||= { id: 6, amount_minor: 1000, method: body.method, evidence: body.evidence, operator_id: 1, created_at: '2026-10-17' }; if (options.timeoutRefund && mutations.filter(x => x.path.endsWith('/refunds')).length === 1) return route.abort('failed'); return route.fulfill({ json: record }) }
  if (path.endsWith('/returns/5/receipts')) { if (!record!.receipt) { record!.receipt = { id: 8, items: body.items, evidence: body.evidence, operator_id: 1, created_at: '2026-10-17' }; stockPosts++ } if (options.timeoutReceipt && mutations.filter(x => x.path.endsWith('/receipts')).length === 1) return route.abort('failed'); return route.fulfill({ json: record }) }
  if (path.endsWith('/returns/5/fiscal-preview') || /fiscal-previews\/7$/.test(path)) return route.fulfill({ json: preview() })
  if (path.endsWith('/fiscal-submissions')) { returnDoc ||= { ...sale, id: 10, kind: 'return', return_id: 5, parent_sale_id: 9, status: 'unknown', revision: 1, snapshot: returnSnapshot(), snapshot_hash: 'b'.repeat(64), allowed_actions: ['process'] }; record!.fiscal_document_ids = [10]; return route.fulfill({ json: returnDoc }) }
  if (path.endsWith('/fiscal-documents/10/process')) { const acknowledgement = { ...returnDoc }; returnDoc = { ...returnDoc, status: 'issued', revision: 2, allowed_actions: ['print','share','revoke_share'] }; return route.fulfill({ status: 202, json: acknowledgement }) }
  if (path.endsWith('/fiscal-documents')) return route.fulfill({ json: returnDoc ? [sale, returnDoc] : [sale] })
  if (path.endsWith('/reconciliation/acknowledgements')) { const ack = { ...body, id: acks.length+1, actor_id: 1, created_at: '2026-10-17' }; acks.push(ack); return route.fulfill({ json: ack }) }
  if (path.endsWith('/reconciliation')) return route.fulfill({ json: { simulation: true, notice: 'MOCK current discrepancies', buckets: { payments_without_receipts: [], receipts_without_basis: [], unknown: [], refund_pending: [{ resource_id: '5', order_id: 321, amount_minor: 1000, acknowledgements: acks }], fiscal_return_pending: [], receipt_pending: [], open_shifts: [] }, totals: { sales_minor: 3000, reserved_returns_minor: 1000, refunds_minor: 0, fiscal_returns_minor: 0 }, acknowledgements: acks } })
  if (path.endsWith('/reports')) { if (body) { reports.push({ id: reports.length+1, kind: body.kind, cash_register_id: 'MOCK-KASA-1', shift_revision: revision, simulation: true, notice: 'MOCK report', created_at: '2026-10-17', totals: { sale_count: 1, return_count: 0, sales_minor: 3000, returns_minor: 0, net_minor: 3000, document_ids: [9] } }); if (body.kind === 'z') { opened = false; revision++ } } return route.fulfill({ json: body ? reports.at(-1) : reports }) }
  if (path.endsWith('/share') || path.endsWith('/revoke-share')) return route.fulfill({ json: { document_id: 9, generation: 1, url: path.endsWith('/revoke-share') ? null : '/api/v1/public/mock-fiscal-documents/'+'x'.repeat(30), expires_at: '2099-01-01', revoked: path.endsWith('/revoke-share') } })
  if (path.endsWith('/orders/321')) return route.fulfill({ json: { id: 321, status: 'confirmed', channel: 'backoffice_pos', fulfillment_method: 'pickup', total_amount: '30.00', subtotal_amount: '30.00', discount_amount: '0.00', revision: 3, items: [], payment_status: 'simulated_paid', fiscal_status: 'issued', simulation: true, payments: [] } })
  return route.fulfill({ json: { items: [], total: 0 } })
 })
 return { mutations, stockPosts: () => stockPosts }
}
const returns = (page: Page) => page.getByRole('region', { name: 'Повернення товарів MOCK', exact: true })
const fact = (page: Page) => returns(page).getByRole('article', { name: 'MOCK повернення #5', exact: true })
test('partial return double-click, unknown refund reload and physical restock use separate durable facts once', async ({ page }) => {
 const data = await fixture(page, { timeoutRefund: true, timeoutReceipt: true })
 await page.goto('/orders/321'); await openOrderPanels(page)
 await returns(page).getByLabel('Вихідний виданий MOCK чек').selectOption('9')
 await returns(page).getByLabel('Кількість повернення Fixture shampoo').fill('1')
 await returns(page).getByLabel('Причина MOCK повернення').fill('Local test')
 await returns(page).getByRole('checkbox', { name: /Фіксую незмінний MOCK/ }).check()
 await returns(page).getByRole('button', { name: 'Створити незмінне MOCK повернення', exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
 await expect(fact(page)).toBeVisible(); expect(data.mutations.filter(x => x.path.endsWith('/returns'))).toHaveLength(1)
 await fact(page).getByLabel('Доказ MOCK повернення грошей').fill('Local refund proof')
 await fact(page).getByRole('checkbox', { name: /саме 10.00 грн/ }).check()
 await fact(page).getByRole('button', { name: 'Підтвердити повернення грошей MOCK', exact: true }).click()
 await expect(fact(page).getByRole('alert')).toBeVisible(); await page.reload(); await openOrderPanels(page)
 await fact(page).getByRole('button', { name: 'Повторити те саме підтвердження грошей MOCK', exact: true }).click()
 await expect.poll(() => data.mutations.filter(x => x.path.endsWith('/refunds')).length).toBe(2)
 const refunds = data.mutations.filter(x => x.path.endsWith('/refunds')); expect(refunds).toHaveLength(2); expect(refunds[0]).toEqual(refunds[1]); expect(refunds[0].body).toEqual({ method: 'cash', evidence: 'Local refund proof' })
 await fact(page).getByRole('combobox', { name: 'Fixture shampoo · 1', exact: true }).selectOption('restock')
 await fact(page).getByLabel('Доказ фізичного приймання MOCK').fill('Inspected goods')
 await expect(fact(page).getByRole('button', { name: 'Зафіксувати фізичне приймання MOCK', exact: true })).toBeDisabled()
 await fact(page).getByRole('checkbox', { name: /Перевірено стан товару/ }).check()
 await fact(page).getByRole('checkbox', { name: /Підтверджую фізичне приймання/ }).check()
 await fact(page).getByRole('button', { name: 'Зафіксувати фізичне приймання MOCK', exact: true }).click(); await page.reload(); await openOrderPanels(page)
 await fact(page).getByRole('button', { name: 'Повторити те саме фізичне приймання MOCK', exact: true }).click()
 await expect(fact(page).getByText(/оприбутковано в тестову БД/)).toBeVisible()
 const receipts = data.mutations.filter(x => x.path.endsWith('/receipts')); expect(receipts).toHaveLength(2); expect(receipts[0]).toEqual(receipts[1]); expect(data.stockPosts()).toBe(1)
 expect(data.mutations.filter(x => x.path.endsWith('/fiscal-submissions'))).toHaveLength(0)
 expect(data.mutations.every(x => !!x.key)).toBe(true)
})
test('return fiscal approval uses return snapshot and current GET after 202, never a second sale', async ({ page }) => {
 const data = await fixture(page, { existing: true, refunded: true })
 await page.goto('/orders/321'); await openOrderPanels(page)
 const fiscal = page.getByRole('region', { name: 'Checkbox фіскальне повернення MOCK #5', exact: true })
 await fiscal.getByRole('button', { name: 'Створити новий MOCK preview', exact: true }).click()
 await expect(fiscal.getByText(/Окреме MOCK повернення грошей #6: 10.00 грн/)).toBeVisible()
 await expect(fiscal.getByText(/Підсумок позицій/)).toHaveCount(0)
 await fiscal.getByRole('checkbox', { name: /MOCK preview #7/ }).check()
 await fiscal.getByRole('button', { name: 'Погодити та поставити MOCK у чергу', exact: true }).click()
 await fiscal.getByRole('button', { name: 'Звірити / обробити поточний MOCK', exact: true }).click()
 await expect(fiscal.getByText('Видано MOCK чек — не надсилалось до ДПС', { exact: true })).toBeVisible()
 expect(data.mutations.filter(x => x.path.endsWith('/fiscal-submissions'))).toHaveLength(1)
 expect(data.mutations.some(x => x.path.endsWith('/orders/321/fiscal-preview'))).toBe(false)
})
test('reconciliation audit preserves discrepancy, X and Z are explicit, local share is revocable', async ({ page }) => {
 const data = await fixture(page)
 await page.goto('/orders/321'); await openOrderPanels(page)
 const report = page.getByRole('region', { name: 'Звірка та X Z звіти MOCK' })
 await report.getByLabel('Поточна розбіжність MOCK').selectOption('refund_pending:5')
 await report.getByLabel('Доказ перевірки розбіжності MOCK').fill('Checked local facts')
 await report.getByRole('button', { name: 'Зафіксувати перевірку розбіжності MOCK', exact: true }).click()
 await expect(report.getByText(/Незмінний аудит #1/)).toBeVisible(); await expect(report.getByRole('heading', { name: /Очікує грошей · #5/ })).toBeVisible()
 await report.getByRole('checkbox', { name: /Підтверджую X звіт MOCK/ }).check(); await report.getByRole('button', { name: 'Створити X/Z звіт MOCK', exact: true }).click()
 await expect(report.getByRole('heading', { name: /X MOCK #1/ })).toBeVisible()
 await report.getByLabel('Тип звіту MOCK').selectOption('z'); await report.getByRole('checkbox', { name: /Підтверджую Z звіт MOCK/ }).check(); await report.getByRole('button', { name: 'Створити X/Z звіт MOCK', exact: true }).click()
 await expect(report.getByRole('heading', { name: /Z MOCK #2/ })).toBeVisible(); await expect(report.getByRole('button', { name: 'Створити X/Z звіт MOCK', exact: true })).toBeDisabled()
 const share = page.getByLabel('Локальне MOCK посилання #9', { exact: true })
 await share.getByRole('checkbox').check(); await share.getByRole('button', { name: 'Створити локальне тестове посилання MOCK', exact: true }).click()
 await expect(share.getByRole('link')).toHaveAttribute('href', 'http://127.0.0.1:6083/mock-fiscal-documents/'+'x'.repeat(30))
 await share.getByRole('checkbox').check(); await share.getByRole('button', { name: 'Відкликати локальне тестове посилання MOCK', exact: true }).click(); await expect(share.getByRole('link')).toHaveCount(0)
 expect(data.mutations.every(x => !!x.key)).toBe(true)
})
for (const role of ['can_record_sales','can_post_inventory','can_fiscalize_returns','can_manage_fiscal_settings']) test(`separate role ${role} exposes only its own mutation controls`, async ({ page }) => {
 const data = await fixture(page, { existing: true, actor: { ...admin, is_superuser: false, [role]: true } })
 await page.goto('/orders/321'); await openOrderPanels(page)
 await expect(fact(page)).toBeVisible()
 await expect(returns(page).getByRole('button', { name: 'Створити незмінне MOCK повернення', exact: true })).toHaveCount(role === 'can_record_sales' ? 1 : 0)
 await expect(fact(page).getByRole('button', { name: 'Підтвердити повернення грошей MOCK', exact: true })).toHaveCount(role === 'can_record_sales' ? 1 : 0)
 await expect(fact(page).getByRole('button', { name: 'Зафіксувати фізичне приймання MOCK', exact: true })).toHaveCount(role === 'can_post_inventory' ? 1 : 0)
 const fiscal = fact(page).getByRole('region', { name: 'Checkbox фіскальне повернення MOCK #5', exact: true })
 await expect(fiscal.getByRole('button', { name: 'Створити новий MOCK preview', exact: true })).toHaveCount(role === 'can_fiscalize_returns' ? 1 : 0)
 await expect(page.getByLabel('Тип звіту MOCK')).toHaveCount(role === 'can_manage_fiscal_settings' ? 1 : 0)
 expect(data.mutations).toHaveLength(0)
})
