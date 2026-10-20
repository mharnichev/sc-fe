import { expect, test, type Page } from '@playwright/test'

const pdfFixture = (() => {
  const stream = 'BT /F1 12 Tf 24 60 Td (LOCAL MOCK RECEIPT - NO PAYMENT) Tj ET\n'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 360 100] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let content = '%PDF-1.4\n% local mock fixture\n'
  const offsets = [0]
  objects.forEach((object, index) => { offsets.push(content.length); content += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = content.length
  content += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  content += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  content += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return content
})()

const actorFixture = (master: boolean) => ({ id: 1, email: 'master-mono@example.test', is_active: true, is_superuser: !master, role: master ? 'barber' : 'admin', master_id: master ? 11 : null, can_record_sales: true, can_accept_qr_payments: true, can_post_inventory: !master })
const orderFixture = () => ({ id: 321, status: 'pending', channel: 'backoffice_pos', fulfillment_method: 'pickup', total_amount: '123.45', subtotal_amount: '123.45', discount_amount: '0.00', revision: 1, simulation: false, payment_status: 'unpaid', fulfillment_status: 'reserved', fiscal_status: 'not_requested', items: [{ id: 11, product_id: 8, product_name: 'Master mono fixture shampoo', quantity: 1, price: '123.45', total_price: '123.45', quantity_from_stock: 1, quantity_to_order: 0, quantity_received_for_order: 0 }], sales_actions: { can_record_payment: true, can_handover: false, blocking_reasons: [] as string[] }, payments: [] as unknown[], handovers: [] as unknown[] })
const setup = async (page: Page, master = true, options: { unknown?: boolean, unsafeUrl?: boolean, historical?: boolean, lostHandoverReply?: boolean } = {}) => {
  const actor = actorFixture(master)
  let order = { ...orderFixture(), simulation: !master || !!options.historical }, truth = '', handovers = 0, stateReads = 0
  let state = { order_id: 321, revision: 1, mode: 'mono_checkbox', enabled: true, paid: false, receipt_accepted: false, status: 'not_started', amount_minor: 12345, invoice_id: null as string | null, payment_url: null as string | null, receipt_pdf_path: null as string | null, can_handover: false, blocking_reasons: [] as string[] }
  const handoverCommands: Array<{ body: unknown, key?: string }> = []
  const commands: Array<{ operation: string, body: any, key?: string }> = [], pdfHeaders: Array<Record<string, string>> = []
  const project = () => {
    if (!truth) return
    const accepted = truth === 'paid' || truth === 'receipt_issued'
    state = { ...state, paid: true, receipt_accepted: accepted, can_handover: accepted && !handovers, status: accepted ? 'accepted' : 'pending', receipt_pdf_path: accepted ? '/api/v1/backoffice/master-mono/orders/321/receipt/pdf' : null, blocking_reasons: accepted ? [] : ['pending'] }
    order = { ...order, revision: state.revision, payment_status: 'paid', fiscal_status: accepted ? 'master_mono_receipt_accepted' : 'pending', sales_actions: { can_record_payment: false, can_handover: accepted && !handovers, blocking_reasons: accepted ? [] : ['pending'] }, payments: [{ id: 9, amount_minor: 12345, method: 'monobank_qr', source: 'provider_confirmation', simulation: false, evidence: state.invoice_id, created_at: '2026-10-20T12:00:00Z' }] }
  }
  await page.addInitScript(() => {
    const artifacts: Array<{ type: string, bytes: number[] }> = []
    ;(window as any).__masterMonoPdfArtifacts = artifacts
    const createObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (blob: Blob | MediaSource) => {
      if (blob instanceof Blob && blob.type === 'application/pdf') {
        void blob.arrayBuffer().then(bytes => artifacts.push({ type: blob.type, bytes: Array.from(new Uint8Array(bytes)) }))
      }
      return createObjectURL(blob)
    }
  })
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', refreshToken: '', user })), actor)
  // Keep every browser request local; API calls below are fully intercepted fixtures.
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    return ['blob:', 'data:'].includes(url.protocol) || ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ? route.continue() : route.abort()
  })
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (path.endsWith('/auth/me')) return route.fulfill({ json: actor })
    if (path === '/api/v1/backoffice/master-mono/orders/321/receipt/pdf') {
      pdfHeaders.push(request.headers())
      return route.fulfill({ contentType: 'application/pdf', body: pdfFixture })
    }
    if (path.endsWith('/master-mono/orders/321')) { stateReads++; project(); return route.fulfill({ json: state }) }
    const operation = path.match(/\/master-mono\/orders\/321\/(start|refresh)$/)?.[1]
    if (operation) {
      const body = request.postDataJSON(); commands.push({ operation, body, key: request.headers()['idempotency-key'] })
      if (body.expected_revision !== state.revision) return route.fulfill({ status: 409, json: { detail: { code: 'revision_conflict', message: 'Reload state' } } })
      if (operation === 'start') state = { ...state, revision: state.revision + 1, invoice_id: options.unknown ? null : 'fixture-invoice-321', payment_url: options.unknown ? null : options.unsafeUrl ? 'https://evil.test/fixture-invoice-321' : 'https://pay.mbnk.biz/fixture-invoice-321', status: options.unknown ? 'creation_unknown' : 'waiting', blocking_reasons: [options.unknown ? 'creation_unknown' : 'waiting'] }
      if (operation === 'refresh') project()
      order.revision = state.revision
      return route.fulfill({ json: state })
    }
    if (path.endsWith('/orders/321/handover')) {
      const command = { body: request.postDataJSON(), key: request.headers()['idempotency-key'] }
      handoverCommands.push(command)
      if (handovers) {
        if (JSON.stringify(command) !== JSON.stringify(handoverCommands[0])) return route.fulfill({ status: 409, json: { detail: { code: 'idempotency_conflict' } } })
      } else {
        handovers++
        order = { ...order, revision: order.revision + 1, status: 'completed', fulfillment_status: 'handed_over', handovers: [{ id: 12, evidence: request.postDataJSON().evidence, simulation: false, created_at: '2026-10-20T12:01:00Z' }], sales_actions: { can_record_payment: false, can_handover: false, blocking_reasons: [] } }
        state = { ...state, revision: order.revision, can_handover: false }
      }
      if (options.lostHandoverReply && handoverCommands.length === 1) return route.abort('connectionreset')
      return route.fulfill({ json: order })
    }
    if (path.endsWith('/orders/321')) return route.fulfill({ json: order })
    if (path.endsWith('/321/fulfillment')) return route.fulfill({ json: { items: order.items } })
    if (path.endsWith('/readiness')) return route.fulfill({ json: { mode: 'mock_only', available: true, blocking_reasons: [], cash_registers: [{ id: 'MOCK-KASA-1', label: 'Mock register', credential_kind: 'mock', shift_status: 'open', shift_revision: 1 }] } })
    if (path.endsWith('/returns') || path.endsWith('/fiscal-documents') || path.endsWith('/qr-payment-attempts')) return route.fulfill({ json: [] })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  return { commands, handoverCommands, pdfHeaders, setTruth: (value: string) => { truth = value; state = { ...state, revision: state.revision + 1 } }, snapshot: () => ({ order, state, handovers, stateReads }) }
}

test('live master transport fixture: validated QR → pending receipt → authenticated PDF → explicit handover', async ({ page }) => {
  const fixture = await setup(page)
  await page.goto('/orders/321')
  const panel = page.getByRole('region', { name: 'mono → Checkbox', exact: true })
  await expect(panel).toBeVisible()
  await expect(page.getByRole('region', { name: 'monobank QR MOCK', exact: true })).toHaveCount(0)
  await panel.getByRole('button', { name: 'Створити QR для оплати', exact: true }).click()
  await expect(panel.getByRole('img', { name: 'QR для оплати mono' })).toBeVisible()
  await expect(panel.getByRole('link')).toHaveAttribute('href', 'https://pay.mbnk.biz/fixture-invoice-321')
  await expect(panel.getByRole('combobox')).toHaveCount(0)
  await expect(panel.getByText(/MOCK|Змоделювати/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Підтвердити видачу', exact: true })).toHaveCount(0)
  fixture.setTruth('paid_receipt_pending')
  await expect(panel.getByText('Оплату підтверджено. Очікуємо чек;', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Підтвердити видачу', exact: true })).toHaveCount(0)
  await panel.getByRole('button', { name: 'Перевірити статус', exact: true }).click()
  await expect(panel.getByRole('button', { name: 'Перевірити статус', exact: true })).toBeEnabled()
  fixture.setTruth('receipt_issued')
  await expect(panel.getByText('Оплату та чек підтверджено.', { exact: false })).toBeVisible()
  await expect(page.getByLabel('Підстава видачі')).toBeVisible()
  expect(fixture.snapshot().handovers).toBe(0)
  const popup = page.waitForEvent('popup')
  await panel.getByRole('button', { name: 'Відкрити PDF-чек', exact: true }).click()
  const preview = await popup
  await expect.poll(() => fixture.pdfHeaders.length).toBe(1)
  expect(fixture.pdfHeaders[0].authorization).toBe('Bearer fixture-only')
  await expect.poll(() => page.evaluate(() => (window as any).__masterMonoPdfArtifacts)).toEqual([{ type: 'application/pdf', bytes: Array.from(new TextEncoder().encode(pdfFixture)) }])
  await preview.close()
  await page.getByLabel('Підстава видачі').fill('fixture explicit handover')
  await expect(page.getByRole('button', { name: 'Підтвердити видачу', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Підтвердити видачу', exact: true }).click()
  await expect(page.getByText('Видачу підтверджено. Продаж завершено.', { exact: true })).toBeVisible()
  expect(fixture.snapshot().handovers).toBe(1)
  expect(fixture.commands.map(item => item.operation)).toEqual(['start', 'refresh'])
  for (const command of fixture.commands) { expect(command.key).toBeTruthy(); expect(command.body.expected_revision).toBeGreaterThan(0) }
})

test('administrator retains legacy POS QR without querying master-only endpoint', async ({ page }) => {
  const fixture = await setup(page, false)
  await page.goto('/orders/321')
  await expect(page.getByRole('region', { name: 'monobank QR MOCK', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'mono → Checkbox', exact: true })).toHaveCount(0)
  expect(fixture.snapshot().stateReads).toBe(0)
})


test('unknown creation blocks another start, QR, and handover while polling GET', async ({ page }) => {
  const fixture = await setup(page, true, { unknown: true })
  await page.goto('/orders/321')
  const panel = page.getByRole('region', { name: 'mono → Checkbox', exact: true })
  await panel.getByRole('button', { name: 'Створити QR для оплати', exact: true }).click()
  await expect(panel.getByText('Перевіряємо створення рахунку. Не створюйте повторну оплату; зверніться до адміністратора.', { exact: true })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Створити QR для оплати', exact: true })).toHaveCount(0)
  await expect(panel.getByRole('img')).toHaveCount(0)
  await expect(panel.getByRole('link')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Підтвердити видачу', exact: true })).toHaveCount(0)
  const reads = fixture.snapshot().stateReads
  await expect.poll(() => fixture.snapshot().stateReads).toBeGreaterThan(reads)
  expect(fixture.commands.map(item => item.operation)).toEqual(['start'])
})

test('unsafe provider URL is never shown or encoded', async ({ page }) => {
  await setup(page, true, { unsafeUrl: true })
  await page.goto('/orders/321')
  const panel = page.getByRole('region', { name: 'mono → Checkbox', exact: true })
  await panel.getByRole('button', { name: 'Створити QR для оплати', exact: true }).click()
  await expect(panel.getByText('Очікуємо підтвердження оплати.', { exact: true })).toBeVisible()
  await expect(panel.getByRole('img')).toHaveCount(0)
  await expect(panel.getByRole('link')).toHaveCount(0)
})

test('historical simulated master sale is read-only without either simulator panel', async ({ page }) => {
  const fixture = await setup(page, true, { historical: true })
  await page.goto('/orders/321')
  await expect(page.getByRole('region', { name: 'Історичний тестовий продаж', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'mono → Checkbox', exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'monobank QR MOCK', exact: true })).toHaveCount(0)
  expect(fixture.snapshot().stateReads).toBe(0)
  expect(fixture.commands).toEqual([])
})


test('committed handover with lost reply retries the exact saved command after GET reports completed', async ({ page }) => {
  const fixture = await setup(page, true, { lostHandoverReply: true })
  await page.goto('/orders/321')
  const panel = page.getByRole('region', { name: 'mono → Checkbox', exact: true })
  await panel.getByRole('button', { name: 'Створити QR для оплати', exact: true }).click()
  fixture.setTruth('receipt_issued')
  await expect(page.getByLabel('Підстава видачі')).toBeVisible()
  await page.getByLabel('Підстава видачі').fill('explicit handover before lost reply')
  await page.getByRole('button', { name: 'Підтвердити видачу', exact: true }).click()
  await expect(page.getByText('Видачу підтверджено. Продаж завершено.', { exact: true })).toBeVisible()
  expect(fixture.snapshot().handovers).toBe(1)
  const retry = page.getByRole('button', { name: 'Повторити підтвердження видачі', exact: true })
  await expect(retry).toBeEnabled()
  await expect(page.getByLabel('Підстава видачі')).toBeDisabled()
  await retry.click()
  await expect(retry).toHaveCount(0)
  expect(fixture.handoverCommands).toHaveLength(2)
  expect(fixture.handoverCommands[1]).toEqual(fixture.handoverCommands[0])
  expect(fixture.handoverCommands[0].key).toBeTruthy()
  expect(fixture.snapshot().handovers).toBe(1)
  expect(fixture.snapshot().order.handovers).toHaveLength(1)
})
