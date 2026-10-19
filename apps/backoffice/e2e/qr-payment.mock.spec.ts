import { BinaryBitmap, HybridBinarizer, QRCodeReader, RGBLuminanceSource } from '@zxing/library'
import { expect, test, type Page } from '@playwright/test'
const user = { id: 1, email: 'qr-fixture@example.test', is_active: true, is_superuser: false, can_record_sales: true, can_accept_qr_payments: true, can_post_inventory: true }
const product = { id: 8, name: 'QR fixture shampoo', sku: 'QR-8', available: 2 }
const orderFixture = () => ({ id: 321, status: 'pending', channel: 'backoffice_pos', fulfillment_method: 'pickup', total_amount: '123.45', subtotal_amount: '123.45', discount_amount: '0.00', revision: 1, simulation: true, payment_status: 'unpaid', fulfillment_status: 'reserved', fiscal_status: 'not_requested', items: [{ id: 11, product_id: 8, product_name: product.name, quantity: 1, price: '123.45', total_price: '123.45', quantity_from_stock: 1, quantity_to_order: 0, quantity_received_for_order: 0 }], sales_actions: { can_record_payment: true, can_handover: false, blocking_reasons: [] }, payments: [], handovers: [] })
const setup = async (page: Page, options: { lostCreate?: boolean, lostPrepare?: boolean, available?: boolean, rights?: boolean, salesRights?: boolean, master?: boolean } = {}) => {
  let order: any = orderFixture(), attempt: any = null, handovers = 0, simulationEvents = 0
  const preparations: unknown[] = []
  const preparationKeys: (string | undefined)[] = []
  const created: Array<{ body: unknown, key?: string }> = [], commands: Array<{ body: any, key?: string }> = []
  const actor = { ...user, can_record_sales: options.salesRights !== false, can_accept_qr_payments: options.rights !== false, ...(options.master ? { role: 'barber', master_id: 11, can_post_inventory: false } : {}) }
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', refreshToken: '', user })), actor)
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    const ready = { mode: 'mock_only', available: options.available !== false, blocking_reasons: [], cash_registers: [{ id: 'MOCK-KASA-1', label: 'Mock register', credential_kind: 'mock', shift_status: 'open', shift_revision: 1 }] }
    if (path.endsWith('/auth/me')) return route.fulfill({ json: actor })
    if (path.endsWith('/readiness')) return route.fulfill({ json: ready })
    if (path.endsWith('/pos-capabilities')) return route.fulfill({ json: { mode: 'local_only', can_prepare: true, simulation_available: true, blocking_reasons: [] } })
    if (path.endsWith('/inventory/stock')) return route.fulfill({ json: { items: [product], total: 1 } })
    if (path.endsWith('/backoffice/orders') && req.method() === 'POST') {
      preparations.push(req.postDataJSON()); preparationKeys.push(req.headers()['idempotency-key'])
      if (options.lostPrepare && preparations.length === 1) return route.abort('failed')
      return route.fulfill({ json: order })
    }
    if (path.endsWith('/orders/321/qr-payment-attempts')) {
      if (req.method() === 'GET') return route.fulfill({ json: attempt ? [attempt] : [] })
      created.push({ body: req.postDataJSON(), key: req.headers()['idempotency-key'] })
      attempt ||= { id: 7, order_id: 321, revision: 1, provider_invoice_id: '00000000-0000-4000-8000-000000000007', payment_status: 'waiting', receipt_status: 'pending', amount_minor: 12345, currency: 'UAH', expires_at: '2026-10-18T12:15:00Z', snapshot: { items: [{ order_item_id: 11, product_id: 8, name: product.name, quantity: 1, total_minor: 12345 }] }, local_payment_path: '/orders/qr-simulator/7', payment_id: null, fiscal_document_id: null, mode: 'mock_only', simulation: true, allowed_actions: ['refresh', 'cancel', 'simulate'], blocking_reasons: [] }
      if (options.lostCreate && created.length === 1) return route.abort('failed')
      return route.fulfill({ json: attempt })
    }
    if (path.endsWith('/qr-payment-attempts/7')) return route.fulfill({ json: attempt })
    if (/\/qr-payment-attempts\/7\/(simulate|refresh|cancel)$/.test(path)) {
      const body = req.postDataJSON(); commands.push({ body, key: req.headers()['idempotency-key'] })
      if (path.endsWith('/simulate')) {
        simulationEvents++
        const outcome = body.outcome
        if (['success', 'success_receipt_error', 'success_receipt_pending', 'receipt_issued'].includes(outcome)) {
          attempt.payment_status = 'paid'; attempt.receipt_status = outcome === 'success_receipt_error' ? 'error' : outcome === 'success_receipt_pending' ? 'pending' : 'issued'; attempt.payment_id = 9
          if (attempt.receipt_status === 'issued') attempt.fiscal_document_id = 10
          order = { ...order, revision: order.revision + 1, payment_status: 'simulated_paid', fiscal_status: attempt.receipt_status === 'issued' ? 'simulated_issued' : 'pending', payments: [{ id: 9, amount_minor: 12345, method: 'monobank_qr', source: 'provider_confirmation', simulation: true, evidence: attempt.provider_invoice_id, created_at: '2026-10-18T12:00:00Z' }], sales_actions: { can_record_payment: false, can_handover: attempt.receipt_status === 'issued', blocking_reasons: [] } }
        } else attempt.payment_status = { decline: 'declined', expiry: 'expired', processing: 'processing', hold: 'processing', timeout_after_acceptance: 'unknown' }[outcome as string]
      } else if (path.endsWith('/cancel')) attempt.payment_status = 'cancelled'
      attempt.revision++; attempt.allowed_actions = ['refresh', ...(attempt.payment_status === 'paid' ? ['simulate'] : ['declined', 'expired', 'cancelled'].includes(attempt.payment_status) ? [] : ['cancel', 'simulate'])]
      return route.fulfill({ json: attempt })
    }
    if (path.endsWith('/orders/321/handover')) {
      handovers++; order = { ...order, revision: order.revision + 1, status: 'completed', fulfillment_status: 'simulated_handed_over', handovers: [{ id: 12, evidence: req.postDataJSON().evidence, simulation: true, created_at: '2026-10-18T12:01:00Z' }], sales_actions: { can_record_payment: false, can_handover: false, blocking_reasons: [] } }
      return route.fulfill({ json: order })
    }
    if (path.endsWith('/orders/321')) return route.fulfill({ json: order })
    if (path.endsWith('/321/fulfillment')) return route.fulfill({ json: { items: order.items } })
    if (path.endsWith('/returns') || path.endsWith('/fiscal-documents')) return route.fulfill({ json: [] })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  return { preparations, preparationKeys, created, commands, state: () => ({ order, attempt, handovers, simulationEvents }) }
}
const createQr = async (page: Page) => {
  await page.getByRole('checkbox', { name: 'Погоджую QR для серверної суми замовлення 123.45 грн' }).check()
  await page.getByRole('button', { name: 'Створити QR (MOCK)', exact: true }).click()
}

test('POS search/cart → exact local QR recovery → paid receipt → explicit existing handover', async ({ page }) => {
  const fixture = await setup(page, { lostCreate: true })
  await page.goto('/orders/pos')
  await page.getByLabel('Тестовий режим (без реальної оплати)').check()
  await page.getByRole('button', { name: 'Знайти / сканувати товар' }).click()
  await page.getByLabel('Назва або SKU').fill('QR-8')
  await page.getByRole('button', { name: 'Пошук', exact: true }).click()
  await page.getByRole('button', { name: 'Вибрати товар' }).click()
  await page.getByRole('button', { name: 'Перевірити суму', exact: true }).click()
  await expect(page).toHaveURL(/orders\/321$/)
  await createQr(page)
  await expect(page.getByRole('button', { name: 'Відновити той самий QR-запит' })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Відновити той самий QR-запит' }).click()
  await expect(page.getByRole('img', { name: 'QR локального симулятора' })).toBeVisible()
  await expect.poll(() => fixture.created.length).toBe(2); expect(fixture.created[1]).toEqual(fixture.created[0])
  expect(fixture.created[0].body).toEqual({ expected_revision: 1, confirm: true, cash_register_id: 'MOCK-KASA-1' })
  await expect(page.getByText('Точна серверна сума QR: 123.45 грн · UAH')).toBeVisible()
  await expect(page.getByLabel('Підстава тестової оплати')).toHaveCount(0)
  await page.getByText('Як перевірити локальний QR', { exact: true }).click()
  await expect(page.getByRole('link', { name: 'Відкрити локальний симулятор' })).toHaveAttribute('href', `${new URL(page.url()).origin}/orders/qr-simulator/7`)
  await page.goto('/orders/qr-simulator/7')
  expect(fixture.state().simulationEvents).toBe(0)
  await page.getByRole('button', { name: 'Виконати локальний сценарій' }).click()
  await expect(page.getByText('Оплата і MOCK чек підтверджені.', { exact: false })).toBeVisible()
  expect(fixture.state().handovers).toBe(0)
  await page.goto('/orders/321')
  await page.getByLabel('Підстава тестової видачі').fill('synthetic handover')
  await page.getByRole('button', { name: 'Підтвердити тестову видачу' }).click()
  await expect(page.getByText('Видачу підтверджено. Продаж завершено.', { exact: true })).toBeVisible()
  expect(fixture.state().handovers).toBe(1)
})
for (const outcome of ['decline', 'expiry', 'processing', 'hold', 'timeout_after_acceptance', 'success_receipt_error', 'success_receipt_pending']) test(`explicit simulator ${outcome} does not grant handover or confirm a second payment`, async ({ page }) => {
  const fixture = await setup(page)
  await page.goto('/orders/321'); await createQr(page)
  await expect(page.getByRole('img', { name: 'QR локального симулятора' })).toBeVisible()
  await page.goto('/orders/qr-simulator/7')
  await page.getByLabel('Локальний сценарій QR').selectOption(outcome)
  await page.getByRole('button', { name: 'Виконати локальний сценарій' }).click()
  await expect.poll(() => fixture.state().simulationEvents).toBe(1)
  if (outcome.startsWith('success_receipt')) {
    await expect(page.getByText('Оплачено, чек ще не видано.', { exact: false })).toBeVisible()
    await page.getByLabel('Локальний сценарій QR').selectOption('receipt_issued')
    await page.getByRole('button', { name: 'Виконати локальний сценарій' }).click()
    await expect(page.getByText('Оплата і MOCK чек підтверджені.', { exact: false })).toBeVisible()
    expect(fixture.state().order.payments).toHaveLength(1)
  } else {
    await page.goto('/orders/321')
    await expect(page.getByLabel('Підстава тестової видачі')).toHaveCount(0)
    if (!['decline', 'expiry'].includes(outcome)) await expect(page.getByRole('button', { name: 'Створити QR (MOCK)', exact: true })).toHaveCount(0)
  }
  expect(fixture.state().handovers).toBe(0)
  expect(fixture.created).toHaveLength(1)
})
test('QR unavailable and revoked permission expose no invoice or simulator mutation controls', async ({ page }) => {
  const fixture = await setup(page, { available: false, rights: false })
  await page.goto('/orders/321')
  await expect(page.getByText('Потрібні права на продажі та приймання QR-оплати.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Створити QR (MOCK)', exact: true })).toHaveCount(0)
  await page.goto('/orders/qr-simulator/7')
  await expect(page.getByRole('button', { name: 'Виконати локальний сценарій' })).toHaveCount(0)
  expect(fixture.created).toHaveLength(0); expect(fixture.commands).toHaveLength(0)
})

test('mobile QR fits viewport and only confirmed cancellation permits a fresh QR', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const fixture = await setup(page)
  await page.goto('/orders/321'); await createQr(page)
  const qr = page.getByRole('img', { name: 'QR локального симулятора' })
  await expect(qr).toBeVisible()
  const box = await qr.boundingBox()
  expect(box).not.toBeNull(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(390)
  expect(fixture.state().attempt.payment_status).toBe('waiting')
  await page.getByRole('button', { name: 'Скасувати очікування QR' }).click()
  await expect(page.getByRole('button', { name: 'Створити QR (MOCK)', exact: true })).toBeVisible()
  await expect(qr).toHaveCount(0)
  expect(fixture.state().attempt.payment_status).toBe('cancelled'); expect(fixture.created).toHaveLength(1)
})

test('simulator requires authentication before exposing a QR attempt', async ({ page }) => {
  await page.route('**/api/v1/**', route => route.fulfill({ status: 401, json: { detail: 'fixture unauthenticated' } }))
  await page.goto('/orders/qr-simulator/7')
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await expect(page.getByRole('button', { name: 'Виконати локальний сценарій' })).toHaveCount(0)
})

for (const theme of ['dark', 'light']) for (const mobile of [false, true]) test(`rendered QR screenshot decodes in ${theme} ${mobile ? 'mobile' : 'desktop'} theme`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 })
  await setup(page)
  await page.addInitScript(theme => localStorage.setItem('soulcuts-backoffice-theme', theme), theme)
  await page.goto('/orders/321'); await createQr(page)
  const qr = page.getByRole('img', { name: 'QR локального симулятора' })
  await expect(page.getByRole('button', { name: 'Оновити QR MOCK', exact: true })).toBeEnabled()
  const screenshot = await qr.screenshot()
  const rendered = await page.evaluate(async bytes => {
    const image = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }))
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height
    const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0)
    return { width: canvas.width, height: canvas.height, pixels: Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data) }
  }, Array.from(screenshot) as number[])
  const pixels = new Int32Array(rendered.width * rendered.height)
  for (let i = 0; i < pixels.length; i++) pixels[i] = (rendered.pixels[i * 4]! << 16) | (rendered.pixels[i * 4 + 1]! << 8) | rendered.pixels[i * 4 + 2]!
  expect(Math.min(...pixels)).toBe(0); expect(Math.max(...pixels)).toBe(0xffffff)
  const decoded = new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels, rendered.width, rendered.height)))).getText()
  expect(decoded).toBe(`${new URL(page.url()).origin}/orders/qr-simulator/7`)
  const box = await qr.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(mobile ? 390 : 1280)
})


test('master sees only the simple sale, cannot synthesize payment and explicitly hands over after paid receipt', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const fixture = await setup(page, { master: true })
  const requests: string[] = []
  page.on('request', request => { if (request.url().includes('/api/v1/')) requests.push(new URL(request.url()).pathname) })
  await page.goto('/orders/pos')
  await expect(page.getByRole('heading', { name: 'Продати товар', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Склад', exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Тестовий режим (без реальної оплати)')).not.toBeChecked()
  await expect(page.getByLabel('Ім’я клієнта (необов’язково)')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Перевірити суму', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Знайти / сканувати товар' }).click()
  await page.getByLabel('Назва або SKU').fill('QR-8')
  await page.getByRole('button', { name: 'Пошук', exact: true }).click()
  await page.getByRole('button', { name: `Додати: ${product.name}`, exact: true }).click()
  await expect(page.getByRole('button', { name: 'Перевірити суму', exact: true })).toBeDisabled()
  expect(fixture.preparations).toHaveLength(0)
  await page.getByLabel('Тестовий режим (без реальної оплати)').check()
  await expect(page.getByRole('button', { name: 'Перевірити суму', exact: true })).toBeEnabled()
  await page.screenshot({ path: testInfo.outputPath('master-cart-mobile.png'), fullPage: true })
  await page.getByRole('button', { name: 'Перевірити суму', exact: true }).click()
  await expect(page).toHaveURL(/orders\/321$/)
  expect(fixture.preparations).toHaveLength(1)
  await expect(page.getByRole('region', { name: 'Стан замовлення', exact: true })).toContainText('123,45')
  await expect(page.getByRole('button', { name: 'Створити QR (MOCK)', exact: true })).toBeDisabled()
  await createQr(page)
  await expect(page.getByRole('img', { name: 'QR локального симулятора' })).toBeVisible()
  await expect(page.getByText('Інший тестовий спосіб оплати', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Технічні деталі QR', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Статус і деталі замовлення', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Відкрити локальний симулятор' })).toHaveCount(0)
  await expect(page.getByLabel('Підстава тестової видачі')).toHaveCount(0)
  for (const name of ['Checkbox фіскалізація MOCK', 'Повернення товарів MOCK', 'Звіти та звірка MOCK', 'Попередні документи SC']) await expect(page.getByRole('heading', { name, exact: true })).toHaveCount(0)
  expect(requests.filter(path => /fiscal|returns|ettn|reconciliation/.test(path))).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('master-qr-mobile.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.goto('/orders/qr-simulator/7')
  await expect(page.getByRole('button', { name: 'Виконати локальний сценарій' })).toHaveCount(0)
  expect(fixture.state().simulationEvents).toBe(0)
  // A separate authorized test operator confirms the mock provider event.
  Object.assign(fixture.state().attempt, { payment_status: 'paid', receipt_status: 'issued', revision: 2, allowed_actions: ['refresh'] })
  Object.assign(fixture.state().order, { payment_status: 'simulated_paid', fiscal_status: 'simulated_issued', revision: 2, sales_actions: { can_record_payment: false, can_handover: true, blocking_reasons: [] } })
  await page.goto('/orders/321')
  await expect(page.getByText('Оплата і MOCK чек підтверджені.', { exact: false })).toBeVisible()
  expect(fixture.state().handovers).toBe(0)
  const handover = page.getByRole('button', { name: 'Підтвердити тестову видачу', exact: true })
  await expect(handover).toBeDisabled()
  await page.getByLabel('Підстава тестової видачі').fill('Передано клієнту · локальний тест')
  await handover.click()
  await expect(page.getByText('Видачу підтверджено. Продаж завершено.', { exact: true })).toBeVisible()
  expect(fixture.state().handovers).toBe(1)
  expect(fixture.created).toHaveLength(1)
})

for (const missing of ['sales', 'qr']) test(`master needs both permissions: missing ${missing} cannot create QR`, async ({ page }) => {
  const fixture = await setup(page, { master: true, salesRights: missing !== 'sales', rights: missing !== 'qr' })
  await page.goto('/orders/321')
  await expect(page.getByText('Потрібні права на продажі та приймання QR-оплати.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Створити QR (MOCK)', exact: true })).toHaveCount(0)
  expect(fixture.created).toHaveLength(0)
})


test('master recovers accepted POS preparation after lost response and reload with the same key and body', async ({ page }) => {
  const fixture = await setup(page, { master: true, lostPrepare: true })
  await page.goto('/orders/pos')
  await page.getByLabel('Тестовий режим (без реальної оплати)').check()
  await page.getByRole('button', { name: 'Знайти / сканувати товар' }).click()
  await page.getByLabel('Назва або SKU').fill('QR-8')
  await page.getByRole('button', { name: 'Пошук', exact: true }).click()
  await page.getByRole('button', { name: 'Вибрати товар' }).click()
  await page.getByRole('button', { name: 'Перевірити суму', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Відновити підготовку', exact: true })).toBeEnabled()
  await page.reload()
  const mode = page.getByLabel('Тестовий режим (без реальної оплати)')
  await expect(mode).toBeChecked()
  await expect(mode).toBeDisabled()
  await page.getByRole('button', { name: 'Відновити підготовку', exact: true }).click()
  await expect(page).toHaveURL(/orders\/321$/)
  expect(fixture.preparations).toHaveLength(2)
  expect(fixture.preparations[1]).toEqual(fixture.preparations[0])
  expect(fixture.preparationKeys[0]).toBeTruthy()
  expect(fixture.preparationKeys[1]).toBe(fixture.preparationKeys[0])
  expect(fixture.created).toHaveLength(0)
})


for (const fault of ['declined', 'expired', 'processing', 'unknown', 'receipt_pending', 'receipt_error']) test(`master handles ${fault} without duplicate QR or premature handover`, async ({ page }) => {
  const fixture = await setup(page, { master: true, lostCreate: true })
  await page.goto('/orders/321')
  await createQr(page)
  await expect(page.getByRole('button', { name: 'Відновити той самий QR-запит' })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Відновити той самий QR-запит' }).click()
  await expect(page.getByRole('img', { name: 'QR локального симулятора' })).toBeVisible()
  await expect.poll(() => fixture.created.length).toBe(2)
  expect(fixture.created[1]).toEqual(fixture.created[0])
  const paid = fault.startsWith('receipt_')
  Object.assign(fixture.state().attempt, { payment_status: paid ? 'paid' : fault,
    receipt_status: fault === 'receipt_error' ? 'error' : 'pending', revision: 2, allowed_actions: ['refresh'] })
  Object.assign(fixture.state().order, { payment_status: paid ? 'simulated_paid' : 'unpaid', revision: 2,
    payments: paid ? [{ id: 9, amount_minor: 12345, method: 'monobank_qr', source: 'provider_confirmation', simulation: true, evidence: 'fixture', created_at: '2026-10-18T12:00:00Z' }] : [],
    sales_actions: { can_record_payment: false, can_handover: false, blocking_reasons: [] } })
  await page.getByRole('button', { name: 'Перевірити статус QR', exact: true }).click()
  await expect(page.getByLabel('Підстава тестової видачі')).toHaveCount(0)
  expect(fixture.state().handovers).toBe(0)
  expect(fixture.state().simulationEvents).toBe(0)
  if (paid) {
    await expect(page.getByText('Оплачено, чек ще не видано.', { exact: false })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Створити QR (MOCK)', exact: true })).toHaveCount(0)
    Object.assign(fixture.state().attempt, { receipt_status: 'issued', fiscal_document_id: 10, revision: 3 })
    Object.assign(fixture.state().order, { fiscal_status: 'simulated_issued', revision: 3,
      sales_actions: { can_record_payment: false, can_handover: true, blocking_reasons: [] } })
    await page.getByRole('button', { name: 'Перевірити статус QR', exact: true }).click()
    await expect(page.getByText('Оплата і MOCK чек підтверджені.', { exact: false })).toBeVisible()
    await page.reload()
    const handover = page.getByRole('button', { name: 'Підтвердити тестову видачу', exact: true })
    await expect(handover).toBeDisabled()
    await page.getByLabel('Підстава тестової видачі').fill('Isolated master receipt recovery')
    await handover.dblclick()
    await expect(page.getByText('Видачу підтверджено. Продаж завершено.', { exact: true })).toBeVisible()
    expect(fixture.state().handovers).toBe(1)
    expect(fixture.state().order.payments).toHaveLength(1)
  }
  await expect.poll(() => fixture.created.length).toBe(2)
})
