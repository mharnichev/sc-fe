import { expect, test } from '@playwright/test'
test.beforeEach(async ({ context }) => {
  await context.route(url => !['127.0.0.1', 'localhost'].includes(url.hostname), route => route.abort('blockedbyclient'))
})
const customer = { id: 42, name: 'Synthetic', surname: 'Customer', phone: '+380990001234' }
const product = { id: 123, name: 'Mock pomade', slug: 'mock-pomade', price: '100.00', images: [], brand: { id: 1, name: 'Mock', slug: 'mock' }, stock: 10, is_available_for_purchase: true, is_effectively_visible: true, hidden_reason: null }
const city = { ref: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', city_ref: null, name: 'Київ', label: 'Київ, тестова область', area: 'Тестова', region: '', delivery_available: true }
const branch = { ref: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', settlement_ref: city.ref, city_ref: null, number: '1', label: 'Тестове відділення №1', name: 'Тестове відділення №1', address: 'Тестова, 1', type: 'warehouse', status: 'Working' }

for (const locale of ['uk', 'en'] as const) {
 for (const status of [409, 422]) {
 test(`method conflict ${status} stays localized inside modal and requires refresh (${locale})`, async ({ page, context }) => {
  const english = locale === 'en'
  const copy = {
    change: english ? 'Choose another payment method' : 'Обрати інший спосіб оплати',
    confirm: english ? 'Confirm payment method' : 'Підтвердити спосіб оплати',
    refresh: english ? 'Refresh payment status' : 'Оновити статус оплати',
    conflict: english ? 'The order has changed. Refresh its status before your next action. Your order is saved.' : 'Стан замовлення змінився. Оновіть статус перед наступною дією. Замовлення збережено.',
    connection: english ? 'Could not update the payment. Please try again.' : 'Не вдалося оновити оплату. Спробуйте ще раз.',
    access: english ? 'Payment could not be opened' : 'Не вдалося відкрити оплату',
  }
  let posts = 0, failure = 0
  await context.addCookies([{ name: 'shop-locale', value: locale, url: 'http://127.0.0.1' }])
  await page.route(/^https:\/\//, route => route.abort())
  await page.addInitScript(() => sessionStorage.setItem('shop-order-payment-token:987', 'mock-payment-capability'))
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (path.includes('/987/online-payment')) {
      if (path.endsWith('/change-method')) {
        posts++
        await route.fulfill({ status, json: { detail: 'Synthetic conflict' } }); return
      }
      expect(req.method()).toBe('GET')
      if (failure) { await route.fulfill({ status: failure, json: {} }); return }
      await route.fulfill({ json: { order_id: 987, enabled: true, status: 'not_started', paid: false,
        receipt_accepted: false, page_url: null, receipt_url: null, amount_minor: 20000, currency: 'UAH', revision: 3, attempt_id: null,
        actions: { start: true, change_method: true, refresh: true }, available_payment_methods: ['cashOnDelivery'] } }); return
    }
    expect(req.method()).toBe('GET')
    await route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/shop/payment/987')
  await page.getByRole('button', { name: copy.change, exact: true }).click()
  const modal = page.getByRole('dialog')
  await modal.getByRole('button', { name: copy.confirm, exact: true }).click()
  await expect(modal.getByRole('alert')).toHaveText(copy.conflict)
  await expect(modal.getByRole('button', { name: copy.confirm, exact: true })).toBeDisabled()
  expect(posts).toBe(1)
  failure = 503
  await modal.getByRole('button', { name: copy.refresh, exact: true }).click()
  await expect(modal.getByRole('alert')).toHaveText(copy.connection)
  failure = 0
  await modal.getByRole('button', { name: copy.refresh, exact: true }).click()
  await expect(modal.getByRole('alert')).toHaveCount(0)
  await expect(modal.getByRole('button', { name: copy.confirm, exact: true })).toBeEnabled()
  expect(posts).toBe(1)
  await modal.getByRole('button', { name: copy.confirm, exact: true }).click()
  await expect(modal.getByRole('alert')).toHaveText(copy.conflict)
  expect(posts).toBe(2)
  failure = 403
  await modal.getByRole('button', { name: copy.refresh, exact: true }).click()
  await expect(modal).toHaveCount(0)
  await expect(page.getByRole('heading', { name: copy.access, exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /receipt|чек/i })).toHaveCount(0)
  expect(posts).toBe(2)
 })
 }
}

for (const mobile of [false, true]) {
 for (const lostResponse of [false, true]) {
 test(`predispatch method change is explicit and preserves one order (${mobile ? 'mobile' : 'desktop'}, ${lostResponse ? 'lost response' : 'success'})`, async ({ page }) => {
  if (mobile) await page.setViewportSize({ width: 390, height: 844 })
  let changes = 0
  await page.route(/^https:\/\//, route => route.abort())
  await page.addInitScript(() => sessionStorage.setItem('shop-order-payment-token:987', 'mock-payment-capability'))
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (path.includes('/987/online-payment')) {
      expect(req.headers()['x-order-payment-token']).toBe('mock-payment-capability')
      if (path.endsWith('/change-method')) {
        expect(req.method()).toBe('POST')
        expect(req.headers()['idempotency-key']).toMatch(/^[a-f0-9-]{36}$/i)
        expect(req.postDataJSON()).toEqual({ payment_method: 'cashOnDelivery', expected_revision: 3, expected_attempt_id: null })
        changes++
        if (lostResponse) { await route.abort('failed'); return }
      } else expect(req.method()).toBe('GET')
      await route.fulfill({ json: { order_id: 987, enabled: !changes, status: 'not_started', paid: false,
        receipt_accepted: false, amount_minor: 20000, currency: 'UAH', retry_after_seconds: 30,
        page_url: null, receipt_url: null, revision: changes ? 4 : 3, attempt_id: null,
        reason: changes ? 'offline_payment_selected' : 'ready',
        actions: { start: !changes, change_method: !changes, refresh: true },
        available_payment_methods: changes ? [] : ['cashOnDelivery'],
        order: { id: 987, number: '987', status: 'pending', fulfillment_method: 'nova_post', item_count: 2, payment_method: changes ? 'cashOnDelivery' : 'onlineCard' } } })
      return
    }
    expect(req.method(), `Unexpected write ${path}`).toBe('GET')
    await route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/shop/payment/987')
  await page.getByRole('button', { name: 'Обрати інший спосіб оплати' }).click()
  await expect(page.getByRole('button', { name: 'Підтвердити спосіб оплати' })).toBeVisible()
  expect(changes).toBe(0)
  await page.getByRole('button', { name: 'Підтвердити спосіб оплати' }).click()
  if (lostResponse) {
    await expect(page.getByText('Не вдалося оновити оплату. Спробуйте ще раз.', { exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Оновити статус оплати', exact: true }).last().click()
    await expect(page.getByRole('button', { name: 'Підтвердити спосіб оплати' })).toHaveCount(0)
  }
  await expect(page.getByRole('heading', { name: 'Оплата при отриманні', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Перейти до оплати', exact: true })).toHaveCount(0)
  expect(changes).toBe(1)
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', await page.locator('body').evaluate(el => el.clientWidth))
 })
 }
}


for (const authenticated of [false, true]) {
 for (const priceChanged of [false, true]) {
 test(`${authenticated ? 'customer' : 'guest'} ${priceChanged ? 'price drift requires manual payment' : 'fresh checkout auto-pays once'} and keeps payment and receipt evidence separate`, async ({ page }) => {
  let ordered = false, created = false, phase = 'not_started', posts = 0, orders = 0
  const orderTotal = priceChanged ? '201.00' : '180.00'
  let paymentChannel: string | null = 'online_monobank'
  const external: string[] = []
  await page.route(/^https:\/\//, route => {
    // Count navigation attempts, not image/font requests that are always blocked.
    if (route.request().isNavigationRequest()) external.push(route.request().url())
    if (route.request().isNavigationRequest() && route.request().url() === 'https://pay.mbnk.biz/mock-invoice') return route.fulfill({ contentType: 'text/html', body: '<h1>Mock payment provider</h1>' })
    return route.abort()
  })
  await page.addInitScript(({ product, customer, authenticated }) => {
    localStorage.setItem('shop-cart', JSON.stringify({ items: [{ product, quantity: 2 }] }))
    if (authenticated) localStorage.setItem('shop-customer-auth', JSON.stringify({ accessToken: 'mock-only', tokenType: 'Bearer', customer }))
  }, { product, customer, authenticated })
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (path.endsWith('/online-payment-capabilities')) { await route.fulfill({ json: { enabled: true } }); return }
    if (path.endsWith('/shop-promotions/quote')) {
      expect(req.method()).toBe('POST')
      const body = req.postDataJSON()
      expect({ ...body, customerPhone: body.customerPhone.replace(/[ ()-]/g, '') }).toEqual({ items: [{ productId: 123, quantity: 2 }], promoCode: 'SAVE10', customerPhone: customer.phone })
      await route.fulfill({ json: { subtotal_amount: '200.00', discount_amount: '20.00', total_amount: '180.00', applied_code: 'SAVE10' } }); return
    }
    if (path.endsWith('/public/orders') && req.method() === 'POST') {
      expect(req.postDataJSON().paymentMethod).toBe('onlineCard')
      expect(req.postDataJSON().promoCode).toBe(priceChanged ? undefined : 'SAVE10')
      ordered = true; orders++
      await route.fulfill({ status: 201, json: { id: 987, payment_method: 'onlineCard', guest_payment_token: authenticated ? null : 'signed-fixture-capability', status: 'pending', payment_status: 'unpaid', fulfillment_status: 'reserved', fiscal_status: 'not_requested', total_amount: orderTotal, items: [{ id: 1, product_id: 123, product_name: product.name, quantity: 2, price: priceChanged ? '100.50' : '90.00' }] } }); return
    }
    if (path.endsWith('/987/online-payment')) {
      expect(req.headers().authorization).toBe(authenticated ? 'Bearer mock-only' : undefined)
      expect(req.headers()['x-order-payment-token']).toBe(authenticated ? undefined : 'signed-fixture-capability')
      if (req.method() === 'POST') {
        expect(req.headers()['idempotency-key']).toMatch(/^[a-f0-9-]{36}$/i)
        expect(req.postDataJSON()).toEqual({}); posts++; created = true; phase = 'waiting'
      } else expect(req.method()).toBe('GET')
      await route.fulfill({ json: { order_id: 987, enabled: true, status: phase, paid: ['paid_receipt_pending', 'accepted'].includes(phase), receipt_accepted: phase === 'accepted', page_url: created ? 'https://pay.mbnk.biz/mock-invoice' : null, receipt_url: phase === 'accepted' ? 'https://cabinet.tax.gov.ua/cashregs/check?id=fixture' : null, amount_minor: priceChanged ? 20100 : 18000, currency: 'UAH', retry_after_seconds: 30 } }); return
    }
    expect(req.method(), `Unexpected mutation ${path}`).toBe('GET')
    if (path.endsWith('/customers/me')) { await route.fulfill({ json: customer }); return }
    if (path.endsWith('/public/orders/me/987')) {
      await route.fulfill({ json: { id: 987, created_at: '2026-10-20T10:00:00Z', status: 'pending', payment_method: 'card', payment_channel: paymentChannel, payment_status: 'paid', fiscal_status: phase === 'accepted' ? 'accepted' : 'pending', total_amount: orderTotal, items: [], shipments: [] } }); return
    }
    if (path.endsWith('/customers/cart')) { await route.fulfill({ json: { items: ordered ? [] : [{ id: 1, product_id: 123, product, quantity: 2 }], total: ordered ? 0 : 1 } }); return }
    if (path.endsWith('/np/settlements')) { await route.fulfill({ json: { items: [city], cached: true } }); return }
    if (path.endsWith('/np/branches')) { await route.fulfill({ json: { items: [branch], cached: true } }); return }
    await route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/shop/checkout/purchase')
  await page.getByLabel('ІМʼЯ').fill('Synthetic'); await page.getByLabel('ПРІЗВИЩЕ').fill('Customer'); await page.getByLabel('ТЕЛЕФОН').fill(customer.phone)
  await page.getByRole('button', { name: 'Київ', exact: true }).click()
  await expect(page.getByRole('combobox', { name: /^Місто$/i })).toHaveValue(city.label)
  await page.getByRole('combobox', { name: /^Відділення або поштомат$/i }).focus()
  await page.getByRole('option', { name: branch.label }).click()
  await page.locator('label[for=payment-method-onlineCard]').click()
  if (!priceChanged) {
    const promo = page.getByLabel('Промокод', { exact: true }).last()
    await promo.fill('save10')
    await promo.press('Enter')
    await expect(page.getByRole('button', { name: 'Видалити', exact: true }).last()).toBeVisible()
    expect(orders).toBe(0)
    expect(posts).toBe(0)
  }
  await page.getByRole('button', { name: 'Перейти до оплати', exact: true }).last().click()
  if (priceChanged) {
    await expect(page.getByTestId('order-confirmation')).toBeVisible()
    await expect(page.getByTestId('confirmed-order-total')).toContainText('201')
    const create = page.getByRole('button', { name: 'Перейти до оплати', exact: true })
    await expect(create).toBeEnabled()
    expect(posts).toBe(0)
    expect(external).toEqual([])
    await create.click()
  }
  await expect(page).toHaveURL('https://pay.mbnk.biz/mock-invoice')
  await expect.poll(() => external).toEqual(['https://pay.mbnk.biz/mock-invoice'])
  expect(posts).toBe(1)
  expect(orders).toBe(1)
  await expect(page.getByRole('heading', { name: 'Mock payment provider', exact: true })).toBeVisible()
  // Return from the entirely mocked provider; no external network is permitted.
  await page.goto('/shop/checkout/purchase?confirmation=987')
  await expect(page.getByTestId('order-confirmation')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Перейти до оплати', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/shop\/checkout\/purchase\?confirmation=987$/)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Перейти до оплати', exact: true })).toBeVisible()
  expect(posts).toBe(1)
  expect(orders).toBe(1)
  expect(external).toEqual(['https://pay.mbnk.biz/mock-invoice'])
  await page.goto('/shop/payment/987')
  await expect(page).toHaveURL(/\/payment\/987$/)
  const bank = page.getByRole('button', { name: 'Перейти до оплати' })
  await expect(bank).toBeEnabled(); await expect(bank).not.toHaveAttribute('href', /.+/)
  expect(posts).toBe(1)
  await expect(page).toHaveURL(/\/payment\/987$/)
  await expect(bank).toBeVisible()
  await page.reload(); await expect(bank).toBeVisible()
  phase = 'paid_receipt_pending'
  await page.getByRole('button', { name: 'Оновити статус оплати' }).click()
  await expect(page.getByText('Оплату отримано. Готуємо чек.', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Переглянути фіскальний чек' })).toHaveCount(0)
  await expect(bank).toHaveCount(0)
  phase = 'accepted'
  await page.getByRole('button', { name: 'Оновити статус оплати' }).click()
  await expect(page.getByRole('link', { name: 'Переглянути фіскальний чек' })).toHaveAttribute('href', 'https://cabinet.tax.gov.ua/cashregs/check?id=fixture')
  if (authenticated) {
    phase = 'paid_receipt_pending'
    await page.goto('/shop/cabinet/orders/987')
    await expect(page.getByText('Оплату отримано. Готуємо чек.', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByText('Оплату отримано. Готуємо чек.', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Переглянути фіскальний чек' })).toHaveCount(0)
    phase = 'accepted'
    await page.reload()
    await expect(page.getByRole('link', { name: 'Переглянути фіскальний чек' })).toHaveAttribute('href', 'https://cabinet.tax.gov.ua/cashregs/check?id=fixture')
    paymentChannel = null
    await page.reload()
    await expect(page.locator('.order-detail__head')).toContainText('#987')
    await expect(page.getByRole('button', { name: 'Оновити статус оплати' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Переглянути фіскальний чек' })).toHaveCount(0)
    expect(posts).toBe(1)
  }
  expect(external.filter(url => url !== 'https://pay.mbnk.biz/mock-invoice')).toEqual([])
  expect(external.length).toBe(1)
  expect(orders).toBe(1)
 })
 }
}
for (const unavailable of ['disabled', 'error']) {
 test(`online checkout fails closed when capability ${unavailable}`, async ({ page }) => {
  await page.route(/^https:\/\//, route => route.abort())
  await page.route('**/api/v1/**', route => {
    expect(route.request().method()).toBe('GET')
    return route.fulfill(new URL(route.request().url()).pathname.endsWith('/online-payment-capabilities') ? unavailable === 'error' ? { status: 503, json: {} } : { json: { enabled: false } } : { json: { items: [], total: 0 } })
  })
  await page.goto('/shop/checkout/purchase')
  await expect(page.locator('label[for=payment-method-cashOnDelivery]')).toBeVisible()
  await expect(page.locator('label[for=payment-method-onlineCard]')).toBeVisible()
  await expect(page.locator('#payment-method-onlineCard')).toBeDisabled()
 })
}

const widgetCaps = { enabled: true, presentation_modes: ['redirect', 'iframe'], iframe_min_width: 576, iframe_min_height: 576 }
const widgetEmbed = 'https://pay.mbnk.biz/widget/opaque-synthetic?invoice=mock-invoice&mode=frame'
const widgetState = (phase = 'waiting', mode = 'iframe', id = 987) => ({ order_id: id, enabled: true, status: phase,
  paid: ['paid_receipt_pending', 'accepted'].includes(phase), receipt_accepted: phase === 'accepted',
  page_url: phase === 'waiting' ? 'https://pay.mbnk.biz/mock-invoice' : null,
  redirect_url: phase === 'waiting' ? 'https://pay.mbnk.biz/mock-invoice' : null,
  embed_url: phase === 'waiting' && mode === 'iframe' ? widgetEmbed : null, presentation_mode: mode,
  receipt_url: phase === 'accepted' ? 'https://cabinet.tax.gov.ua/cashregs/check?id=fixture' : null,
  amount_minor: 20000, currency: 'UAH', retry_after_seconds: 120, revision: phase === 'not_started' ? 1 : 2,
  attempt_id: phase === 'not_started' ? null : 1,
  actions: { start: phase === 'not_started', continue_payment: phase === 'waiting', refresh: true, change_method: false } })

for (const viewport of [{ width: 1440, height: 1000 }, { width: 608, height: 900 }, { width: 576, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 780 }, { width: 1440, height: 700 }]) {
 test(`widget selects first presentation from real available geometry ${viewport.width}x${viewport.height}`, async ({ page }) => {
  await page.setViewportSize(viewport)
  await page.clock.install()
  let phase = 'not_started', mode = 'redirect', posts = 0
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' || /hydration/i.test(m.text())) errors.push(m.text()) })
  await page.addInitScript(() => sessionStorage.setItem('shop-order-payment-token:987', 'mock-payment-capability'))
  await page.route('https://pay.mbnk.biz/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Synthetic provider only</h1>' }))
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (path.endsWith('online-payment-capabilities')) return route.fulfill({ json: widgetCaps })
    if (path.endsWith('/987/online-payment')) {
      if (req.method() === 'POST') { posts++; mode = req.postDataJSON().presentation || 'redirect'; phase = 'waiting' }
      return route.fulfill({ json: widgetState(phase, mode) })
    }
    expect(req.method()).toBe('GET')
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/shop/payment/987')
  await page.getByRole('button', { name: 'Перейти до оплати', exact: true }).click()
  if (viewport.width >= 608 && viewport.height >= 800) {
    const frame = page.locator('.mono-payment-modal__frame')
    await expect(frame).toBeVisible()
    await expect(frame).toHaveAttribute('src', widgetEmbed)
    await expect(frame).toHaveAttribute('allow', 'payment *')
    await expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer')
    const entering = await frame.boundingBox()
    expect(entering!.width).toBeCloseTo(576, 3); expect(entering!.height).toBeCloseTo(576, 3)
    await page.waitForTimeout(750)
    const box = await frame.boundingBox()
    expect(box!.width).toBe(576); expect(box!.height).toBe(576)
    console.log('Widget geometry', JSON.stringify({ viewport, iframe: box }))
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
    const modal = page.locator('.mono-payment-modal .base-modal__container')
    const rect = await modal.boundingBox()
    expect(rect!.y).toBe(0)
    expect(rect!.x + rect!.width).toBeCloseTo(viewport.width, 0)
    expect(rect!.height).toBe(viewport.height)
    expect(rect!.width).toBe(608)
    await page.screenshot({ path: `/tmp/sc-pos-20261106/widget-fe-evidence/widget-${viewport.width}x${viewport.height}.png` })
    await page.keyboard.press('Escape')
    await expect(frame).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Перейти до оплати', exact: true })).toBeFocused()
    await page.getByRole('button', { name: 'Перейти до оплати', exact: true }).click()
    await expect(frame).toBeVisible()
    expect(posts).toBe(1)
    await page.reload()
    await expect(frame).toHaveCount(0)
    await page.getByRole('button', { name: 'Перейти до оплати', exact: true }).click()
    await expect(frame).toBeVisible(); expect(posts).toBe(1)
    phase = 'paid_receipt_pending'
    // Authenticated GET is the only settlement authority, even while the frame is open.
    await page.clock.fastForward(121000)
    await expect(frame).toHaveCount(0)
    await expect(page.getByText('Оплату отримано. Готуємо чек.', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Перейти до оплати', exact: true })).toHaveCount(0)
  } else {
    await expect(page).toHaveURL('https://pay.mbnk.biz/mock-invoice')
    await expect(page.getByRole('heading', { name: 'Synthetic provider only' })).toBeVisible()
    expect(mode).toBe('redirect')
  }
  expect(posts).toBe(1); expect(errors).toEqual([])
 })
}

for (const width of [1440, 390]) {
 test(`saved payment resumes in a fresh authenticated browser without creating another invoice at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 })
  let phase = 'waiting', reads = 0, providerOpens = 0
  await page.addInitScript(customer => {
    localStorage.setItem('shop-customer-auth', JSON.stringify({ accessToken: 'mock-only', tokenType: 'Bearer', customer }))
  }, customer)
  await page.route('https://pay.mbnk.biz/**', route => {
    providerOpens++
    return route.fulfill({ contentType: 'text/html', body: '<h1>Synthetic provider only</h1>' })
  })
  await page.route('**/api/v1/**', route => {
    const req = route.request(), path = new URL(req.url()).pathname
    expect(req.method(), `No invoice or order creation on resume: ${path}`).toBe('GET')
    if (path.endsWith('/customers/me')) return route.fulfill({ json: customer })
    if (path.endsWith('/987/online-payment')) {
      expect(req.headers().authorization).toBe('Bearer mock-only')
      reads++
      return route.fulfill({ json: widgetState(phase, 'iframe') })
    }
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/shop/payment/987')
  const continueButton = page.getByRole('button', { name: 'Перейти до оплати', exact: true })
  await expect(continueButton).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('shop-order-payment-intent:987'))).toBeNull()
  const before = reads
  await continueButton.click()
  if (width === 1440) {
    await expect(page.locator('.mono-payment-modal__frame')).toHaveAttribute('src', widgetEmbed)
    await expect(page.frameLocator('.mono-payment-modal__frame').getByRole('heading', { name: 'Synthetic provider only' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.mono-payment-modal__frame')).toHaveCount(0)
  } else await expect(page).toHaveURL('https://pay.mbnk.biz/mock-invoice')
  expect(reads).toBeGreaterThan(before)
  expect(providerOpens).toBe(1)
  await page.goto('/shop/payment/987')
  await expect(continueButton).toBeVisible()
  phase = 'accepted'
  await continueButton.click()
  await expect(page.getByRole('link', { name: 'Переглянути фіскальний чек' })).toBeVisible()
  await expect(continueButton).toHaveCount(0)
  expect(providerOpens).toBe(1)
 })
}

for (const [allowed, signedIn] of [[true, false], [true, true], [false, false]]) {
 test(`guest email payment link cleans its capability and ${allowed ? 'resumes only its existing invoice' : 'denies an invalid capability'} (${signedIn ? 'account signed in' : 'guest browser'})`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const token = 'signed.fixture.capability'
  const previous = 'signed.previous.capability'
  await page.addInitScript(({ allowed, previous, signedIn, customer }) => {
    if (signedIn) localStorage.setItem('shop-customer-auth', JSON.stringify({ accessToken: 'mock-only', tokenType: 'Bearer', customer }))
    if (!allowed && location.hash) sessionStorage.setItem('shop-order-payment-token:987', previous)
  }, { allowed, previous, signedIn, customer })
  let reads = 0, providerOpens = 0
  await page.route('https://pay.mbnk.biz/**', route => {
    providerOpens++
    return route.fulfill({ contentType: 'text/html', body: '<h1>Synthetic provider only</h1>' })
  })
  await page.route('**/api/v1/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    expect(request.method()).toBe('GET')
    if (path.endsWith('/customers/me')) return route.fulfill({ json: customer })
    if (path.endsWith('/987/online-payment')) {
      reads++
      const supplied = request.headers()['x-order-payment-token']
      expect(supplied).toBe(!allowed && reads > 1 ? previous : token)
      expect(request.headers().authorization).toBeUndefined()
      expect(request.url()).not.toContain(token)
      if (!allowed && reads === 1) return route.fulfill({ status: 404, json: { detail: 'Payment not found' } })
      return route.fulfill({ json: widgetState('waiting', 'iframe') })
    }
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  const response = await page.goto(`/shop/payment/987#token=${token}`)
  expect(response?.headers()['cache-control']).toContain('no-store')
  expect(response?.headers()['referrer-policy']).toBe('no-referrer')
  await expect(page).toHaveURL(/\/shop\/payment\/987$/)
  const pay = page.getByRole('button', { name: 'Перейти до оплати', exact: true })
  if (!allowed) {
    await expect(page.getByRole('heading', { name: 'Не вдалося відкрити оплату' })).toBeVisible()
    await expect(pay).toHaveCount(0)
    expect(providerOpens).toBe(0)
    expect(await page.evaluate(() => sessionStorage.getItem('shop-order-payment-token:987'))).toBe(previous)
    await page.reload()
    await expect(pay).toBeEnabled()
    return
  }
  await expect(pay).toBeEnabled()
  expect(await page.evaluate(() => Object.values(localStorage).join(' '))).not.toContain(token)
  await page.reload()
  await expect(pay).toBeEnabled()
  await pay.click()
  await expect(page).toHaveURL('https://pay.mbnk.biz/mock-invoice')
  expect(reads).toBeGreaterThanOrEqual(3)
  expect(providerOpens).toBe(1)
 })
}

test('widget messages are bound to the current frame; close, fallback and resize preserve one invoice', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.clock.install()
  let phase = 'not_started', posts = 0, holdRead = false, releaseRead = () => {}
  const readGate = new Promise<void>(resolve => { releaseRead = resolve })
  await page.addInitScript(() => sessionStorage.setItem('shop-order-payment-token:987', 'mock-payment-capability'))
  await page.route('https://pay.mbnk.biz/**', route => route.fulfill({ contentType: 'text/html', body: '<button id="send">Synthetic frame</button><script>window.synthetic=true</script>' }))
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (path.endsWith('online-payment-capabilities')) return route.fulfill({ json: widgetCaps })
    if (path.endsWith('/987/online-payment')) {
      if (req.method() === 'POST') { posts++; phase = 'waiting' }
      else if (holdRead) await readGate
      return route.fulfill({ json: widgetState(phase) })
    }
    expect(req.method()).toBe('GET'); return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/shop/payment/987')
  const pay = page.getByRole('button', { name: 'Перейти до оплати', exact: true })
  await pay.click()
  const frame = page.locator('.mono-payment-modal__frame')
  await expect(frame).toBeVisible(); await page.waitForTimeout(750)
  const send = async (data: string, origin = 'https://pay.mbnk.biz', currentSource = true) => page.evaluate(({ data, origin, currentSource }) => {
    const source = currentSource ? document.querySelector<HTMLIFrameElement>('.mono-payment-modal__frame')!.contentWindow : window
    window.dispatchEvent(new MessageEvent('message', { data, origin, source }))
  }, { data, origin, currentSource })
  for (const [data, origin, source] of [
    ['{"message":"close-button"}', 'https://evil.test', true], ['{"message":"close-button"}', 'https://pay.mbnk.biz', false],
    ['{bad', 'https://pay.mbnk.biz', true], ['x'.repeat(5000), 'https://pay.mbnk.biz', true], ['{"message":"paid"}', 'https://pay.mbnk.biz', true],
  ] as const) { await send(data, origin, source); await expect(frame).toBeVisible() }
  await expect(page.getByText('Очікуємо оплату', { exact: true })).toBeVisible()
  const oldFrame = await frame.elementHandle()
  await send('{"message":"close-button"}')
  await expect(frame).toHaveCount(0)
  await pay.click(); await expect(frame).toBeVisible()
  // A detached frame must never be a valid source for the reopened modal.
  await page.evaluate(old => window.dispatchEvent(new MessageEvent('message', { origin: 'https://pay.mbnk.biz', source: (old as HTMLIFrameElement).contentWindow, data: '{"message":"close-button"}' })), oldFrame)
  await expect(frame).toBeVisible()
  await send('{"message":"monopay-link","value":"javascript:alert(1)"}')
  await expect(page.getByText('Якщо оплата не відкрилась, продовжте на захищеній сторінці цього ж платежу.', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/shop\/payment\/987$/)
  const fallback = page.getByRole('button', { name: 'Відкрити сторінку оплати', exact: true })
  holdRead = true
  const poll = page.waitForRequest(req => req.method() === 'GET' && req.url().endsWith('/987/online-payment'))
  await page.clock.fastForward(121000); await poll
  await expect(fallback).toBeDisabled()
  await expect(frame).toBeVisible()
  releaseRead()
  await expect(fallback).toBeEnabled()
  await fallback.click()
  await expect(page).toHaveURL('https://pay.mbnk.biz/mock-invoice'); expect(posts).toBe(1)
  await page.goto('/shop/payment/987'); await pay.click(); await expect(frame).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(frame).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Перейти до оплати', exact: true })).toBeEnabled()
  expect(posts).toBe(1)
})

for (const invalidate of ['close', 'resize', 'reload', 'order', 'user', 'unmount', 'lost-response']) {
 test(`widget late create cannot reopen or replace a payment after ${invalidate}`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  let phase = 'not_started', posts = 0, release = () => {}, currentUser = false
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.addInitScript(() => sessionStorage.setItem('shop-order-payment-token:987', 'mock-payment-capability'))
  await page.route('https://pay.mbnk.biz/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Synthetic provider only</h1>' }))
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (path.endsWith('online-payment-capabilities')) return route.fulfill({ json: widgetCaps })
    if (path.endsWith('/987/online-payment') || path.endsWith('/988/online-payment')) {
      const id = path.includes('/988/') ? 988 : 987
      if (req.method() === 'POST') {
        posts++; expect(req.postDataJSON()).toEqual({ presentation: 'iframe' })
        phase = invalidate === 'lost-response' ? 'creation_unknown' : 'waiting'
        await gate
        if (invalidate === 'lost-response') return route.abort('failed')
      }
      return route.fulfill({ json: widgetState(currentUser || id === 988 ? 'not_started' : phase, 'iframe', id) })
    }
    expect(req.method()).toBe('GET')
    if (path.endsWith('/customers/me')) return route.fulfill({ json: customer })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/shop/payment/987')
  const post = page.waitForRequest(req => req.method() === 'POST' && req.url().includes('/987/online-payment'))
  await page.getByRole('button', { name: 'Перейти до оплати', exact: true }).click(); await post
  await expect(page.getByRole('dialog', { name: 'Захищена оплата карткою' })).toBeVisible()
  if (invalidate === 'resize') await page.setViewportSize({ width: 390, height: 844 })
  else if (invalidate === 'reload') await page.reload()
  else if (invalidate === 'order' || invalidate === 'unmount') await page.evaluate(path => {
    const app = (document.querySelector('#__nuxt') as HTMLElement & { __vue_app__: { config: { globalProperties: { $router: { push: (path: string) => Promise<unknown> } } } } }).__vue_app__
    return app.config.globalProperties.$router.push(path)
  }, invalidate === 'order' ? '/payment/988' : '/contacts')
  else if (invalidate === 'user') {
    currentUser = true
    await page.evaluate(() => {
      const app = (document.querySelector('#__nuxt') as HTMLElement & { __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, { $patch: (state: Record<string, unknown>) => void }> } } } } }).__vue_app__
      app.config.globalProperties.$pinia._s.get('customer-auth')!.$patch({ accessToken: 'other-synthetic', customer: { id: 99 }, sessionRevision: 7 })
    })
  } else if (invalidate !== 'lost-response') await page.keyboard.press('Escape')
  release()
  if (invalidate === 'lost-response') {
    await expect(page.getByRole('alert')).toBeVisible()
    await page.getByRole('button', { name: 'Оновити статус оплати', exact: true }).click()
    await expect(page.getByText('Уточнюємо стан оплати', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Перейти до оплати', exact: true })).toHaveCount(0)
    phase = 'waiting'
    await page.getByRole('button', { name: 'Оновити статус оплати', exact: true }).click()
  }
  await expect(page.locator('.mono-payment-modal')).toHaveCount(0)
  await page.waitForTimeout(200)
  await expect(page.locator('.mono-payment-modal')).toHaveCount(0)
  expect(new URL(page.url()).hostname).toBe('127.0.0.1'); expect(posts).toBe(1)
  if (invalidate === 'close' || invalidate === 'reload' || invalidate === 'lost-response') {
    await page.getByRole('button', { name: 'Перейти до оплати', exact: true }).click()
    await expect(page.locator('.mono-payment-modal__frame')).toBeVisible(); expect(posts).toBe(1)
  }
 })
}

for (const mobile of [false, true]) {
 test(`widget integrates with the actual checkout confirmation (${mobile ? 'mobile redirect' : 'desktop iframe'})`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 })
  let phase = 'not_started', mode = 'redirect', posts = 0, orders = 0
  await page.addInitScript(product => localStorage.setItem('shop-cart', JSON.stringify({ items: [{ product, quantity: 2 }] })), product)
  await page.route('https://pay.mbnk.biz/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Synthetic provider only</h1>' }))
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (path.endsWith('online-payment-capabilities')) return route.fulfill({ json: widgetCaps })
    if (path.endsWith('/public/orders') && req.method() === 'POST') {
      orders++; expect(req.postDataJSON().paymentMethod).toBe('onlineCard')
      return route.fulfill({ status: 201, json: { id: 987, payment_method: 'onlineCard', guest_payment_token: 'signed-fixture-capability', status: 'pending', total_amount: '200.00', items: [{ id: 1, product_id: 123, product_name: product.name, quantity: 2, price: '100.00' }] } })
    }
    if (path.endsWith('/987/online-payment')) {
      expect(req.headers()['x-order-payment-token']).toBe('signed-fixture-capability')
      if (req.method() === 'POST') { posts++; mode = req.postDataJSON().presentation || 'redirect'; phase = 'waiting' }
      return route.fulfill({ json: widgetState(phase, mode) })
    }
    expect(req.method(), `Unexpected mutation ${path}`).toBe('GET')
    if (path.endsWith('/np/settlements')) return route.fulfill({ json: { items: [city], cached: true } })
    if (path.endsWith('/np/branches')) return route.fulfill({ json: { items: [branch], cached: true } })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/shop/checkout/purchase')
  await page.getByLabel('ІМʼЯ').fill('Synthetic'); await page.getByLabel('ПРІЗВИЩЕ').fill('Customer'); await page.getByLabel('ТЕЛЕФОН').fill(customer.phone)
  await page.getByRole('button', { name: 'Київ', exact: true }).click()
  await expect(page.getByRole('combobox', { name: /^Місто$/i })).toHaveValue(city.label)
  await page.getByRole('combobox', { name: /^Відділення або поштомат$/i }).focus()
  await page.getByRole('option', { name: branch.label }).click()
  await page.locator('label[for=payment-method-onlineCard]').click()
  expect(posts).toBe(0); expect(orders).toBe(0)
  await page.getByRole('button', { name: 'Перейти до оплати', exact: true }).last().click()
  if (mobile) { await expect(page).toHaveURL('https://pay.mbnk.biz/mock-invoice'); expect(mode).toBe('redirect') }
  else {
    await expect(page.getByTestId('order-confirmation')).toBeVisible()
    await expect(page.locator('.mono-payment-modal__frame')).toBeVisible()
    await expect(page).toHaveURL(/\/shop\/checkout\/purchase\?confirmation=987$/)
    expect(mode).toBe('iframe')
    await page.keyboard.press('Escape'); await page.reload()
    await expect(page.getByTestId('order-confirmation')).toBeVisible()
    await expect(page.locator('.mono-payment-modal__frame')).toHaveCount(0)
    await page.getByRole('button', { name: 'Перейти до оплати', exact: true }).click()
    await expect(page.locator('.mono-payment-modal__frame')).toBeVisible()
  }
  expect(posts).toBe(1); expect(orders).toBe(1)
 })
}

test('widget English copy, keyboard boundaries, header and overlay close restore the payment action', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await context.addCookies([{ name: 'shop-locale', value: 'en', url: 'http://127.0.0.1' }])
  let posts = 0
  await page.addInitScript(() => sessionStorage.setItem('shop-order-payment-token:987', 'mock-payment-capability'))
  await page.route('https://pay.mbnk.biz/**', route => route.fulfill({ contentType: 'text/html', body: '<button>Bank fixture control</button>' }))
  await page.route('**/api/v1/**', route => {
    if (route.request().method() === 'POST') posts++
    expect(route.request().method()).toBe('GET')
    return route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/987/online-payment') ? widgetState() : { items: [], total: 0 } })
  })
  await page.goto('/shop/payment/987')
  const pay = page.getByRole('button', { name: 'Proceed to payment', exact: true })
  await pay.click()
  const dialog = page.getByRole('dialog', { name: 'Secure card payment', exact: true })
  const close = dialog.locator('.base-modal__close')
  await expect(close).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('button', { name: 'Return to order', exact: true })).toBeFocused()
  await page.keyboard.press('Tab'); await expect(close).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.frameLocator('.mono-payment-modal__frame').getByRole('button', { name: 'Bank fixture control' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: 'Open payment page', exact: true })).toBeFocused()
  await close.click(); await expect(dialog).toHaveCount(0); await expect(pay).toBeFocused()
  await pay.click(); await expect(dialog).toBeVisible()
  await dialog.locator('.base-modal__overlay').click({ position: { x: 2, y: 2 } })
  await expect(dialog).toHaveCount(0); await expect(pay).toBeFocused()
  expect(posts).toBe(0)
})

test('widget retires a capabilities response after guest capability rotation before any invoice POST', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  let posts = 0, release = () => {}, phase = 'not_started'
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.addInitScript(() => sessionStorage.setItem('shop-order-payment-token:987', 'original-capability'))
  await page.route('https://pay.mbnk.biz/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Synthetic frame</h1>' }))
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (path.endsWith('online-payment-capabilities')) { await gate; return route.fulfill({ json: widgetCaps }) }
    if (path.endsWith('/987/online-payment')) {
      if (req.method() === 'POST') { posts++; expect(req.headers()['x-order-payment-token']).toBe('replacement-capability'); phase = 'waiting' }
      return route.fulfill({ json: widgetState(phase) })
    }
    expect(req.method()).toBe('GET'); return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/shop/payment/987')
  const pay = page.getByRole('button', { name: 'Перейти до оплати', exact: true })
  const caps = page.waitForRequest(req => req.url().endsWith('/online-payment-capabilities'))
  await pay.click(); await caps
  await page.evaluate(() => sessionStorage.setItem('shop-order-payment-token:987', 'replacement-capability'))
  release()
  await expect(pay).toBeEnabled(); expect(posts).toBe(0)
  await expect(page.locator('.mono-payment-modal')).toHaveCount(0)
  await pay.click(); await expect(page.locator('.mono-payment-modal__frame')).toBeVisible(); expect(posts).toBe(1)
})

test('widget waits for persisted identity before reading or reopening the restored invoice', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  let reads = 0, posts = 0
  await page.addInitScript(() => {
    sessionStorage.setItem('shop-order-payment-token:987', 'mock-payment-capability')
    localStorage.setItem('shop-customer-auth', JSON.stringify({ accessToken: '', tokenType: 'Bearer', customer: null }))
    const callbacks: IdleRequestCallback[] = []
    window.requestIdleCallback = callback => { callbacks.push(callback); return callbacks.length }
    const fixture = window as Window & { releasePersistedIdentity?: () => void }
    fixture.releasePersistedIdentity = () => {
      for (const callback of callbacks.splice(0)) callback({ didTimeout: false, timeRemaining: () => 50 })
    }
  })
  await page.route('https://pay.mbnk.biz/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Synthetic provider only</h1>' }))
  await page.route('**/api/v1/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (request.method() === 'POST') posts++
    expect(request.method()).toBe('GET')
    if (path.endsWith('/987/online-payment')) { reads++; return route.fulfill({ json: widgetState() }) }
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/shop/payment/987')
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as HTMLElement & { __vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } } }
    return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
  })
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  console.log('Bootstrap native navigator.onLine:', await page.evaluate(() => navigator.onLine))
  expect(reads).toBe(0); expect(posts).toBe(0)
  await expect(page.getByRole('button', { name: 'Перейти до оплати', exact: true })).toHaveCount(0)
  await page.evaluate(() => (window as Window & { releasePersistedIdentity?: () => void }).releasePersistedIdentity?.())
  const pay = page.getByRole('button', { name: 'Перейти до оплати', exact: true })
  await expect(pay).toBeEnabled()
  expect(reads).toBe(1)
  await pay.click(); await expect(page.locator('.mono-payment-modal__frame')).toBeVisible()
  expect(reads).toBe(2); expect(posts).toBe(0)
})
