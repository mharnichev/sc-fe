import { BinaryBitmap, HybridBinarizer, QRCodeReader, RGBLuminanceSource } from '@zxing/library'
import { expect, test, type Page } from '@playwright/test'
const providerUrl = 'https://pay.mbnk.biz/testInvoiceSandbox123'
const setup = async (page: Page, options: { available?: boolean, lostCreate?: boolean, unknown?: boolean, badUrl?: boolean, master?: boolean } = {}) => {
  const user = { id: 1, email: 'sandbox-fixture@example.test', is_active: true, is_superuser: false, can_record_sales: true, can_accept_qr_payments: true, ...(options.master ? { role: 'barber', master_id: 11 } : {}) }
  const order: any = { id: 321, status: 'pending', channel: 'backoffice_pos', fulfillment_method: 'pickup', total_amount: '123.45', subtotal_amount: '123.45', discount_amount: '0.00', revision: 1, simulation: true, payment_status: 'unpaid', fulfillment_status: 'reserved', fiscal_status: 'not_requested', items: [{ id: 11, product_id: 8, product_name: 'Sandbox shampoo', quantity: 1, price: '123.45', total_price: '123.45', quantity_from_stock: 1, quantity_to_order: 0 }], sales_actions: { can_record_payment: true, can_handover: false, blocking_reasons: [] }, payments: [], handovers: [] }
  let attempt: any = null
  const created: any[] = [], refreshes: any[] = [], forbidden: string[] = []
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', refreshToken: '', user })), user)
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
    if (path.endsWith('/provider-sandbox/readiness')) return route.fulfill({ json: { mode: 'provider_sandbox', available: options.available !== false, blocking_reasons: options.available === false ? ['sandbox_credentials_required'] : [], checkbox_cash_register_id: 'test-register', checkbox_cashier_id: 'test-cashier', checkbox_organization_id: 'test-organization', verification: { monobank_provider_confirmed: false, monobank_policy: 'operator_attested_test_token_with_pinned_sha256', checkbox_provider_confirmed: true } } })
    if (path.endsWith('/readiness')) return route.fulfill({ json: { mode: 'mock_only', available: true, blocking_reasons: [], cash_registers: [{ id: 'MOCK-KASA-1', credential_kind: 'mock', shift_status: 'open', shift_revision: 1 }] } })
    if (path.endsWith('/orders/321/sandbox-qr-payment-attempts')) {
      created.push({ body: req.postDataJSON(), key: req.headers()['idempotency-key'] })
      attempt ||= { id: 7, order_id: 321, revision: 1, provider_invoice_id: '00000000-0000-4000-8000-000000000007', payment_status: options.unknown ? 'unknown' : 'waiting', receipt_status: 'pending', amount_minor: 12345, currency: 'UAH', expires_at: '2026-10-18T12:15:00Z', snapshot: { items: [{ order_item_id: 11, product_id: 8, name: 'Sandbox shampoo', quantity: 1, total_minor: 12345 }] }, local_payment_path: '', payment_url: options.unknown ? null : options.badUrl ? 'https://pay.mbnk.biz.evil.test/invoice' : providerUrl, payment_id: null, fiscal_document_id: null, checkbox_receipt_id: '00000000-0000-4000-8000-000000000008', mode: 'provider_sandbox', simulation: true, allowed_actions: ['refresh'], blocking_reasons: options.unknown ? ['invoice_create_unknown'] : [] }
      if (options.lostCreate && created.length === 1) return route.abort('failed')
      return route.fulfill({ json: attempt })
    }
    if (path.endsWith('/orders/321/qr-payment-attempts')) {
      if (req.method() === 'POST') forbidden.push(path)
      return route.fulfill({ json: attempt ? [attempt] : [] })
    }
    if (path.endsWith('/qr-payment-attempts/7/sandbox-refresh')) { refreshes.push({ body: req.postDataJSON(), key: req.headers()['idempotency-key'] }); attempt.revision++; return route.fulfill({ json: attempt }) }
    if (/\/qr-payment-attempts\/7\/(simulate|cancel|refresh)$/.test(path)) { forbidden.push(path); return route.fulfill({ status: 409, json: { detail: 'forbidden local mutation' } }) }
    if (path.endsWith('/qr-payment-attempts/7')) return route.fulfill({ json: attempt })
    if (path.endsWith('/orders/321/handover')) { order.revision++; order.status = 'completed'; order.handovers.push({ id: 12, simulation: true }); order.sales_actions.can_handover = false; return route.fulfill({ json: order }) }
    if (path.endsWith('/orders/321')) return route.fulfill({ json: order })
    if (path.endsWith('/321/fulfillment')) return route.fulfill({ json: { items: order.items } })
    if (path.endsWith('/returns') || path.endsWith('/fiscal-documents')) return route.fulfill({ json: [] })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  return { created, refreshes, forbidden, order, attempt: () => attempt }
}
const create = async (page: Page) => {
  await page.getByLabel('Середовище QR').selectOption('provider_sandbox')
  await page.getByRole('checkbox', { name: 'Погоджую QR для серверної суми замовлення 123.45 грн' }).check()
  await page.getByRole('button', { name: 'Створити QR (SANDBOX)', exact: true }).click()
}
for (const theme of ['dark', 'light']) for (const mobile of [true, false]) test(`sandbox remote QR screenshot decodes ${theme} ${mobile ? 'mobile' : 'desktop'}`, async ({ page }, testInfo) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 })
  const fixture = await setup(page, { master: true })
  await page.addInitScript(theme => localStorage.setItem('soulcuts-backoffice-theme', theme), theme)
  await page.goto('/orders/321'); await create(page)
  const qr = page.getByRole('img', { name: 'QR тестового середовища mono' }); await expect(qr).toBeVisible()
  await expect(page.getByRole('link', { name: 'Відкрити локальний симулятор' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Скасувати очікування QR' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Виконати локальний сценарій' })).toHaveCount(0)
  await expect(page.getByText('Тестовий токен mono засвідчує оператор;', { exact: false })).toBeVisible()
  const screenshot = await qr.screenshot({ path: testInfo.outputPath('provider-qr.png') })
  await page.screenshot({ path: testInfo.outputPath('provider-page.png'), fullPage: true })
  const rendered = await page.evaluate(async bytes => {
    const image = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' })), canvas = document.createElement('canvas')
    canvas.width = image.width; canvas.height = image.height
    const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0)
    return { width: canvas.width, height: canvas.height, pixels: Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data) }
  }, Array.from(screenshot) as number[])
  const pixels = new Int32Array(rendered.width * rendered.height)
  for (let i = 0; i < pixels.length; i++) pixels[i] = (rendered.pixels[i * 4]! << 16) | (rendered.pixels[i * 4 + 1]! << 8) | rendered.pixels[i * 4 + 2]!
  expect(new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels, rendered.width, rendered.height)))).getText()).toBe(providerUrl)
  const box = await qr.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(mobile ? 390 : 1280)
  await page.getByRole('button', { name: 'Перевірити статус QR' }).click()
  expect(fixture.refreshes[0].body).toEqual({ expected_revision: 1 }); expect(fixture.refreshes[0].key).toBeTruthy()
  expect(fixture.created).toHaveLength(1); expect(fixture.forbidden).toEqual([])
})
test('unconfigured sandbox does not block local mock or offer sandbox creation', async ({ page }) => {
  const fixture = await setup(page, { available: false }); await page.goto('/orders/321')
  await expect(page.getByLabel('Середовище QR').locator('option[value="provider_sandbox"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Створити QR (MOCK)', exact: true })).toBeVisible()
  expect(fixture.created).toHaveLength(0)
})
for (const unknown of [false, true]) test(`lost sandbox response recovers only via GET; unknown=${unknown}`, async ({ page }) => {
  const fixture = await setup(page, { lostCreate: true, unknown }); await page.goto('/orders/321'); await create(page)
  await expect(page.getByRole('button', { name: 'Перевірити створення sandbox QR' })).toBeVisible()
  await page.reload(); await page.getByRole('button', { name: 'Перевірити створення sandbox QR' }).click()
  await expect(page.getByRole('button', { name: 'Перевірити створення sandbox QR' })).toHaveCount(0)
  expect(fixture.created).toHaveLength(1); expect(fixture.forbidden).toEqual([])
  if (unknown) { await expect(page.getByText('Результат створення або оплати невідомий.', { exact: false })).toBeVisible(); await expect(page.getByRole('img', { name: 'QR тестового середовища mono' })).toHaveCount(0); await expect(page.getByRole('button', { name: 'Створити QR (SANDBOX)', exact: true })).toHaveCount(0) }
})
test('unapproved remote URL is not encoded', async ({ page }) => {
  const fixture = await setup(page, { badUrl: true }); await page.goto('/orders/321'); await create(page)
  await expect(page.getByText('Платіжне посилання не пройшло перевірку.', { exact: false })).toBeVisible()
  await expect(page.getByRole('img', { name: 'QR тестового середовища mono' })).toHaveCount(0)
  expect(fixture.forbidden).toEqual([])
})
test('provider paid receipt pending blocks handover until a separate test receipt is issued', async ({ page }) => {
  const fixture = await setup(page, { master: true }); await page.goto('/orders/321'); await create(page)
  await expect(page.getByRole('img', { name: 'QR тестового середовища mono', exact: true })).toBeVisible()
  Object.assign(fixture.attempt(), { payment_status: 'paid', receipt_status: 'pending', revision: 2 })
  Object.assign(fixture.order, { payment_status: 'simulated_paid', revision: 2, sales_actions: { can_record_payment: false, can_handover: false, blocking_reasons: [] } })
  await page.reload(); await expect(page.getByText('Оплачено, чек ще не видано.', { exact: false })).toBeVisible()
  await expect(page.getByLabel('Підстава тестової видачі')).toHaveCount(0)
  Object.assign(fixture.attempt(), { receipt_status: 'issued', revision: 3 })
  Object.assign(fixture.order, { revision: 3, sales_actions: { can_record_payment: false, can_handover: true, blocking_reasons: [] } })
  await page.reload(); await expect(page.getByText('Тестова оплата і тестовий чек Checkbox підтверджені.', { exact: false })).toBeVisible()
  await page.getByLabel('Підстава тестової видачі').fill('Тестова видача sandbox'); await page.getByRole('button', { name: 'Підтвердити тестову видачу', exact: true }).click()
  await expect(page.getByText('Видачу підтверджено. Продаж завершено.', { exact: true })).toBeVisible()
  expect(fixture.created).toHaveLength(1); expect(fixture.forbidden).toEqual([])
})
