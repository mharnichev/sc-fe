/** Synthetic API fixtures only. No carrier calls, backend orders or inventory writes. */
import { expect, test, type Page, type Route } from '@playwright/test'
const artifacts = decodeURIComponent(new URL('../../../output/shop-order-tracking-audit/', import.meta.url).pathname)
const item = { id: 42, product_id: 5, product_name: 'Історичний товар / Historical product', product_sku: 'HIST-1', quantity: 3, price: '100.00', total_price: '300.00', discount_amount: '0' }
const parcel = { id: 71, tracking_number: '20450000000001', status: 'delivered', simulation: false, carrier: 'nova_poshta', last_checked_at: '2026-10-17T12:00:00Z', last_successful_check_at: '2026-10-17T12:00:00Z', delivery_status: 'in_transit', stale: false, last_attempt_status: 'success', items: [{ order_item_id: 42, quantity: 1 }], events: [{ raw_status: 'INTERNAL-CODE', normalized_status: 'in_transit', event_at: '2026-10-17T11:00:00Z', observed_at: '2026-10-17T12:00:00Z' }] }
const order = { id: 321, status: 'completed', created_at: '2026-10-17T12:00:00Z', subtotal_amount: '300.00', total_amount: '300.00', discount_amount: '0', item_count: 3, items: [item], payment_status: 'unpaid', payment_method: 'cashOnDelivery', delivery_address: 'Fixture address / Історична адреса', shipments: [parcel], delivery_summary: { in_transit: 1 } }
async function setup(page: Page, detail: () => Record<string, unknown> = () => order, extra?: (route: Route) => Promise<boolean>) {
  await page.addInitScript(() => localStorage.setItem('shop-customer-auth', JSON.stringify({ accessToken: 'fixture-first', tokenType: 'Bearer', customer: { id: 42, phone: '+380990000001' } })))
  await page.route('**/api/v1/**', async route => {
    if (extra && await extra(route)) return
    const path = new URL(route.request().url()).pathname
    const second = route.request().headers().authorization === 'Bearer fixture-second'
    const json = path.endsWith('/public/orders/me/321') ? detail() : path.endsWith('/public/orders/me') ? { items: [detail()], total: 1, page: 1, page_size: 10 } : path.endsWith('/public/customers/me') ? { id: second ? 43 : 42, phone: '+380990000001' } : { items: [], total: 0 }
    await route.fulfill({ json })
  })
}
const states = [
  ['preparing', 'Готуємо'], ['handed_over', 'Передано пошті'],
  ['in_transit', 'У дорозі'], ['ready_for_pickup', 'У відділенні'],
  ['delivered', 'Отримано'], ['refused', 'Відмова'],
  ['returning', 'Повертається'], ['returned', 'Повернено'],
  ['cancelled', 'Скасовано'], ['requires_review', 'Потрібне уточнення'],
  ['unrecognized-provider-secret', 'Потрібне уточнення'],
] as const
for (const [status, label] of states) test(`real delivery state ${status} keeps payment separate`, async ({ page }) => {
  await setup(page, () => ({ ...order, shipments: [{ ...parcel, delivery_status: status, events: [{ ...parcel.events[0], normalized_status: status }] }] }))
  await page.goto('/cabinet/orders/321')
  const region = page.getByRole('region', { name: 'Відправлення', exact: true })
  await expect(region.locator('.base-badge')).toHaveText(label)
  await expect(region.locator('.base-badge .base-icon svg')).toHaveCount(1)
  await expect(page.locator('.order-detail__head .order-detail__status')).toHaveCount(0)
  await expect(page.getByText(/^(Оплачено|оплачено|Paid)$/)).toHaveCount(0)
  await expect(region.locator('ol li')).toHaveCount(1)
  await expect(region.locator('ol li')).toContainText(label)
  await expect(page.getByText('Не оплачено', { exact: true })).toHaveCount(0)
  await expect(page.getByText('INTERNAL-CODE', { exact: false })).toHaveCount(0)
  await expect(page.getByText('unrecognized-provider-secret', { exact: true })).toHaveCount(0)
})

for (const width of [320, 360, 390, 430, 1440]) test(`fixture history/details fit width ${width} and produce screenshots`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 })
  const long = 'ДовгаІсторичнаНазва'.repeat(8)
  const fixture = { ...order, item_count: 4, items: [{ ...item, product_name: long }, { ...item, id: 43, product_id: 6, quantity: 1, product_name: 'Другий товар', total_price: '100' }], shipments: [
    { ...parcel, delivery_status: 'delivered', events: [{ ...parcel.events[0], normalized_status: 'delivered' }] },
    { ...parcel, id: 72, tracking_number: '20450000000002', delivery_status: 'ready_for_pickup', items: null, events: [] },
    { ...parcel, id: 73, tracking_number: 'MOCK-' + 'A'.repeat(32), carrier: 'mock_nova_poshta', simulation: true, status: 'delivered', items: null, events: [] },
  ], delivery_summary: { delivered: 2, ready_for_pickup: 1 }, total_amount: '400', subtotal_amount: '400' }
  await setup(page, () => fixture)
  await page.goto('/cabinet/purchase-history')
  const card = page.locator('.purchase-history__card')
  await expect(card.locator('.purchase-history__total')).toHaveCSS('background-color', 'rgb(10, 10, 10)')
  await expect(card.locator('.purchase-history__total')).toHaveCSS('color', 'rgb(255, 255, 255)')
  const totalBox = await card.locator('.purchase-history__total').boundingBox()
  const headerBox = await card.locator('.purchase-history__identity').boundingBox()
  expect(Math.abs(totalBox!.x + totalBox!.width - headerBox!.x - headerBox!.width)).toBeLessThan(2)
  if (width === 1440) {
    const paymentBox = await card.locator('.purchase-history__delivery').boundingBox()
    const detailsBox = await card.locator('.purchase-history__details').boundingBox()
    expect(Math.abs(paymentBox!.y + paymentBox!.height / 2 - detailsBox!.y - detailsBox!.height / 2)).toBeLessThan(2)
  }
  await expect(card).toContainText(long)
  await expect(card.locator('.base-quantity-stepper__input').first()).toHaveValue('3')
  const nameBox = await card.locator('.purchase-history__product-name').first().boundingBox()
  const quantityBox = await card.locator('.purchase-history__quantity').first().boundingBox()
  expect(quantityBox!.x - (nameBox!.x + nameBox!.width)).toBeLessThanOrEqual(12)
  await expect(card).not.toContainText('Не оплачено')
  const summary = page.getByLabel('Зведення доставки')
  await expect(summary).toContainText('Отримано 1 з 2 посилок')
  await expect(card.locator('.purchase-history__status')).toHaveCount(1)
  await expect(summary.locator('.base-icon svg')).toHaveCount(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await card.screenshot({ path: `${artifacts}/fixture-history-card-${width}.png` })
  await page.screenshot({ path: `${artifacts}/fixture-history-${width}.png`, fullPage: true })
  await card.locator('.purchase-history__details').click()
  await expect(page.getByRole('region', { name: 'Відправлення', exact: true }).locator('article')).toHaveCount(3)
  await expect(page.getByText('Fixture address / Історична адреса', { exact: true })).toBeVisible()
  for (const disclosure of await page.locator('.shipments__card summary').all()) await disclosure.click()
  await expect(page.getByText('Склад відправлення не уточнено.', { exact: false })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('region', { name: 'Відправлення', exact: true }).locator('article').first().screenshot({ path: `${artifacts}/fixture-parcel-${width}.png` })
  await page.screenshot({ path: `${artifacts}/fixture-details-${width}.png`, fullPage: true })
})

test('English locale, keyboard copy and live locale changes preserve tracking semantics', async ({ page, context }) => {
  await context.addCookies([{ name: 'shop-locale', value: 'en', domain: '127.0.0.1', path: '/' }])
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { Reflect.set(window, '__fixtureCopied', value) } } }))
  await setup(page, () => ({ ...order, shipments: [{ ...parcel, delivery_status: 'delivered' }] }))
  await page.goto('/cabinet/orders/321')
  const region = page.getByRole('region', { name: 'Shipments', exact: true })
  await expect(region.locator('.base-badge')).toHaveText('Received')
  await expect(page.getByText('Unpaid', { exact: true })).toHaveCount(0)
  const copy = region.getByRole('button', { name: 'Copy tracking number', exact: true })
  await copy.focus()
  await expect(copy).toBeFocused()
  await copy.press('Enter')
  await expect(region.getByRole('status')).toContainText('Tracking number copied')
  expect(await page.evaluate(() => Reflect.get(window, '__fixtureCopied'))).toBe(parcel.tracking_number)
  const viewport = page.viewportSize()!
  // Locale controls are in the desktop header; retain the mobile view for assertions.
  if (viewport.width < 1024) await page.setViewportSize({ width: 1280, height: viewport.height })
  await page.getByRole('button', { name: /Укр/ }).click()
  await page.setViewportSize(viewport)
  await expect(page.getByRole('region', { name: 'Відправлення', exact: true }).locator('.base-badge')).toHaveText('Отримано')
  await expect(page.getByRole('button', { name: 'Копіювати ТТН', exact: true })).toBeVisible()
  await expect(page.getByText('Не оплачено', { exact: true })).toHaveCount(0)
})

test('clipboard failure is accessible and never exposes its internal message', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('INTERNAL_CLIPBOARD_SECRET') } } }))
  await setup(page)
  await page.goto('/cabinet/orders/321')
  await page.getByRole('button', { name: 'Копіювати ТТН', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Відправлення', exact: true }).getByRole('status')).toContainText('Не вдалося скопіювати')
  await expect(page.getByText('INTERNAL_CLIPBOARD_SECRET')).toHaveCount(0)
})

test('received, cancelled and legacy orders remain in history with independent payment', async ({ page }) => {
  await setup(page, () => order, async route => {
    if (!new URL(route.request().url()).pathname.endsWith('/public/orders/me')) return false
    await route.fulfill({ json: { items: [
      { ...order, shipments: [{ ...parcel, delivery_status: 'delivered' }], delivery_summary: { delivered: 1 } },
      { ...order, id: 322, status: 'cancelled', payment_status: 'INTERNAL_PAYMENT_SECRET', shipments: [], delivery_summary: {} },
    ], total: 2, page: 1, page_size: 10 } }); return true
  })
  await page.goto('/cabinet/purchase-history')
  await expect(page.locator('.purchase-history__card')).toHaveCount(2)
  await expect(page.locator('.purchase-history__card').first()).toContainText('Посилку отримано')
  await expect(page.locator('.purchase-history__card').last()).toContainText('Скасовано')
  await expect(page.locator('.purchase-history__card').last().locator('.purchase-history__status .base-icon svg')).toHaveCount(1)
  await expect(page.getByText('INTERNAL_PAYMENT_SECRET')).toHaveCount(0)
})

for (const mode of ['empty', 'error', 'missing'] as const) test(`preserves ${mode} cabinet state`, async ({ page }) => {
  await setup(page, () => order, async route => {
    const path = new URL(route.request().url()).pathname
    if (mode === 'missing' && path.endsWith('/public/orders/me/321')) { await route.fulfill({ status: 404, json: { detail: 'INTERNAL_ORDER_SECRET' } }); return true }
    if (path.endsWith('/public/orders/me')) { await route.fulfill(mode === 'error' ? { status: 503, json: { detail: 'INTERNAL_ORDER_SECRET' } } : { json: { items: [], total: 0, page: 1, page_size: 10 } }); return true }
    return false
  })
  await page.goto(mode === 'missing' ? '/cabinet/orders/321' : '/cabinet/purchase-history')
  await expect(page.getByRole('heading', { name: mode === 'empty' ? 'Поки порожньо' : mode === 'error' ? 'Не вдалося завантажити замовлення' : 'Замовлення не знайдено', exact: true })).toBeVisible()
  await expect(page.getByText('INTERNAL_ORDER_SECRET')).toHaveCount(0)
})

test('switching accounts discards a late successful response from the previous owner', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let pending = false
  await setup(page, () => order, async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/public/orders/me/322')) { await route.fulfill({ json: { ...order, id: 322, items: [{ ...item, product_name: 'CURRENT_CUSTOMER_PRODUCT' }], shipments: [], delivery_summary: {} } }); return true }
    if (!path.endsWith('/public/orders/me/321')) return false
    if (route.request().headers().authorization === 'Bearer fixture-second') { await route.fulfill({ status: 404, json: { detail: 'not found' } }); return true }
    pending = true
    await gate
    await route.fulfill({ json: { ...order, items: [{ ...item, product_name: 'PRIVATE_OLD_CUSTOMER_PRODUCT' }] } }); return true
  })
  await page.goto('/cabinet/purchase-history')
  await expect(page.locator('.purchase-history__card')).toBeVisible()
  await page.locator('.purchase-history__details').click()
  await expect.poll(() => pending).toBe(true)
  await page.evaluate(() => {
    type Store = { setSession: (session: { access_token: string, token_type: string, customer: { id: number, phone: string } }) => void }
    const app = (document.querySelector('#__nuxt') as HTMLElement & { __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, Store> }, $router: { push: (path: string) => Promise<unknown> } } } } }).__vue_app__
    app.config.globalProperties.$pinia._s.get('customer-auth')!.setSession({ access_token: 'fixture-second', token_type: 'Bearer', customer: { id: 43, phone: '+380990000002' } })
    return app.config.globalProperties.$router.push('/cabinet/orders/322')
  })
  await expect(page.getByText('CURRENT_CUSTOMER_PRODUCT', { exact: true })).toBeVisible()
  const late = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/public/orders/me/321') && response.request().headers().authorization === 'Bearer fixture-first')
  release()
  await (await late).finished()
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await expect(page.getByText('CURRENT_CUSTOMER_PRODUCT', { exact: true })).toBeVisible()
  await expect(page.getByText('PRIVATE_OLD_CUSTOMER_PRODUCT')).toHaveCount(0)
  await expect(page.getByRole('button', { name: parcel.tracking_number, exact: true })).toHaveCount(0)
})

for (const width of [320, 360, 390, 430]) test(`mobile confirmation visibility and focus regression ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 })
  const body = { firstName: 'Fixture', lastName: 'Customer', phoneNumber: '+380990000001', shippingCompany: 'novaPost', shippingMethod: 'warehouse', shippingCity: 'Fixture', shippingWarehouseNumber: '1', paymentMethod: 'cashOnDelivery', items: [{ product_id: 5, quantity: 3 }] }
  await page.addInitScript(({ body }) => sessionStorage.setItem('shop-checkout-intent-v1', JSON.stringify({ key: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', body, scope: 'guest' })), { body })
  await page.route('**/api/v1/**', route => route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/public/orders') && route.request().method() === 'POST' ? { ...order, id: 987, status: 'pending', fulfillment_status: 'reserved', fiscal_status: 'not_requested' } : { items: [], total: 0 } }))
  await page.goto('/checkout/purchase')
  const retry = page.getByRole('button', { name: 'Перевірити / повторити попереднє замовлення', exact: true })
  await expect(retry).toBeVisible()
  await retry.click()
  const number = page.getByTestId('order-number')
  await expect(number).toContainText('987')
  await expect(number).toBeInViewport({ ratio: 1 })
  await expect(number).toBeFocused()
  await expect(page.locator('.checkout-page__success')).toBeInViewport({ ratio: 1 })
  await expect(page.getByText('Не оплачено', { exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => scrollY)).toBe(0)
  await page.screenshot({ path: `${artifacts}/fixture-confirmation-${width}.png`, fullPage: true })
})

test('historical unit price stays distinct from the total for several units', async ({ page }) => {
  await setup(page)
  await page.goto('/cabinet/orders/321')
  const metadata = page.locator('.order-detail__item-meta').first()
  await expect(page.locator('.order-detail__product').first().getByRole('spinbutton')).toHaveValue('3')
  await expect(metadata.locator('dd').nth(0)).toContainText('100,00')
  await expect(metadata.locator('dd').nth(1)).toContainText('300,00')
})

for (const detail of [false, true]) for (const width of [320, 1440]) test(`base skeleton loads ${detail ? 'details' : 'history'} at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  let release!: () => void
  const wait = new Promise<void>(resolve => { release = resolve })
  await setup(page, () => order, async route => {
    const path = new URL(route.request().url()).pathname
    if (!path.endsWith(detail ? '/public/orders/me/321' : '/public/orders/me')) return false
    await wait
    await route.fulfill({ json: detail ? order : { items: [order], total: 1, page: 1, page_size: 10 } }); return true
  })
  await page.goto(detail ? '/cabinet/orders/321' : '/cabinet/purchase-history')
  const skeleton = page.locator('.order-loading')
  await expect(skeleton).toBeVisible()
  await expect(skeleton).toHaveAttribute('role', 'status')
  await expect(skeleton).toHaveAttribute('aria-label', /Завантаж/)
  expect(await skeleton.locator('.base-skeleton').count()).toBeGreaterThan(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `/tmp/sc-shop-skeleton/${detail ? 'details' : 'history'}-loading-${width}.png`, fullPage: true })
  release()
  await expect(skeleton).toHaveCount(0)
  await expect(page.locator(detail ? '.order-detail__head' : '.purchase-history__card')).toBeVisible()
})


test('refresh during a pending clipboard write does not leave copying disabled', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => new Promise<void>(resolve => Reflect.set(window, '__finishCopy', resolve)) } }))
  await setup(page, () => order, async route => {
    if (!route.request().url().endsWith('/shipments/refresh')) return false
    await route.fulfill({ json: { status: 'queued', retry_after_seconds: 60 } })
    return true
  })
  await page.goto('/cabinet/orders/321')
  const copy = page.getByRole('button', { name: 'Копіювати ТТН' })
  await copy.click()
  await expect(copy).toBeDisabled()
  await page.getByRole('button', { name: 'Оновити статус', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, '__finishCopy')())
  await expect(copy).toBeEnabled()
  await expect(page.getByRole('status').filter({ hasText: 'ТТН скопійовано' })).toBeVisible()
})


test('completed does not imply receipt; both TTN and adjacent icon copy', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { Reflect.set(window, '__fixtureCopied', value) } } }))
  await setup(page)
  await page.goto('/cabinet/purchase-history')
  await expect(page.locator('.purchase-history__status')).toHaveText('У дорозі')
  await page.goto('/cabinet/orders/321')
  await expect(page.locator('.shipments__card .order-status-badge')).toHaveText('У дорозі')
  const number = page.getByRole('button', { name: parcel.tracking_number, exact: true })
  await number.focus()
  await number.press('Enter')
  expect(await page.evaluate(() => Reflect.get(window, '__fixtureCopied'))).toBe(parcel.tracking_number)
  await page.evaluate(() => Reflect.set(window, '__fixtureCopied', ''))
  await page.getByRole('button', { name: 'Копіювати ТТН', exact: true }).click()
  expect(await page.evaluate(() => Reflect.get(window, '__fixtureCopied'))).toBe(parcel.tracking_number)
  await expect(page.getByText('Не оплачено', { exact: true })).toHaveCount(0)
})


test('history and detail show catalog photo with a safe fallback for missing/broken images', async ({ page }) => {
  await page.route('**/fixture-product-photo.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="tan"/></svg>' }))
  await page.route('**/fixture-broken-photo.jpg', route => route.fulfill({ status: 404, body: '' }))
  await setup(page, () => ({ ...order, items: [
    { ...item, product_image_url: '/fixture-product-photo.svg' },
    { ...item, id: 43, product_name: 'Без фото', product_image_url: null },
    { ...item, id: 44, product_name: 'Недоступне фото', product_image_url: '/fixture-broken-photo.jpg' },
  ] }))
  for (const url of ['/cabinet/purchase-history', '/cabinet/orders/321']) {
    await page.goto(url)
    const photo = page.locator('.order-item-image img')
    await expect(photo).toHaveCount(1)
    await expect(photo).toHaveAttribute('src', '/fixture-product-photo.svg')
    await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(64)
    await expect(page.locator('.order-item-image > svg')).toHaveCount(2)
    await expect(page.getByText('Не оплачено', { exact: true })).toHaveCount(0)
  }
})


test('backend media photos use the API origin when shop runs on another port', async ({ page }) => {
  await page.route('http://127.0.0.1:9/media/demo-photo.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="tan"/></svg>' }))
  await setup(page, () => ({ ...order, items: [{ ...item, product_image_url: '/media/demo-photo.svg' }] }))
  await page.goto('/cabinet/purchase-history')
  await expect(page.locator('.order-item-image img')).toHaveAttribute('src', 'http://127.0.0.1:9/media/demo-photo.svg')
})


test('received history is compact, hover has no outline and keyboard focus remains visible', async ({ page }) => {
  await setup(page, () => ({ ...order, shipments: [{ ...parcel, delivery_status: 'delivered' }], delivery_summary: { delivered: 1 } }))
  await page.goto('/cabinet/purchase-history')
  const card = page.locator('.purchase-history__card')
  const delivery = card.getByLabel('Зведення доставки')
  await expect(delivery).toContainText('Посилку отримано')
  await expect(delivery).not.toContainText('· 1')
  await expect(delivery.locator('.delivery-summary__note')).toHaveCount(0)
  await expect(card).not.toContainText('Не оплачено')
  await card.locator('.purchase-history__eyebrow').click()
  await expect(page).toHaveURL(/purchase-history$/)
  await expect(card).not.toHaveAttribute('href')
  await card.hover()
  expect(await card.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('none')
  await page.keyboard.press('Tab')
  await card.locator('.purchase-history__details').focus()
  expect(await card.locator('.purchase-history__details').evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid')
})


test('purchased quantities use the disabled base stepper in history and details', async ({ page }) => {
  await setup(page)
  for (const url of ['/cabinet/purchase-history', '/cabinet/orders/321']) {
    await page.goto(url)
    const counter = page.locator('.base-quantity-stepper')
    await expect(counter).toHaveCount(1)
    await expect(counter.getByRole('spinbutton')).toHaveValue('3')
    await expect(counter.getByRole('spinbutton')).toBeDisabled()
    for (const button of await counter.getByRole('button').all()) await expect(button).toBeDisabled()
  }
})


for (const width of [320, 1440]) test(`base order pagination selects pages and blocks concurrent reads at ${width}px`, async ({ page, context }) => {
  const english = width === 320
  if (english) await context.addCookies([{ name: 'shop-locale', value: 'en', domain: '127.0.0.1', path: '/' }])
  await page.setViewportSize({ width, height: 900 })
  let release!: () => void
  const wait = new Promise<void>(resolve => { release = resolve })
  const requested: number[] = []
  await setup(page, () => order, async route => {
    const url = new URL(route.request().url())
    if (!url.pathname.endsWith('/public/orders/me')) return false
    const current = Number(url.searchParams.get('page') || 1)
    requested.push(current)
    if (current === 2 && requested.length === 2) await wait
    await route.fulfill({ json: { items: [{ ...order, id: 320 + current }], total: 30, page: current, page_size: 10 } }); return true
  })
  await page.goto('/cabinet/purchase-history')
  const pagination = page.locator('.base-pagination')
  const pageLabel = english ? 'Page' : 'Сторінка'
  const next = english ? 'Next' : 'Далі'
  const previous = english ? 'Previous' : 'Назад'
  await expect(pagination.getByRole('button', { name: previous, exact: true })).toBeDisabled()
  await expect(pagination.getByRole('button', { name: `${pageLabel} 1`, exact: true })).toHaveAttribute('aria-current', 'page')
  await pagination.getByRole('button', { name: next, exact: true }).click()
  await expect(pagination.locator('button:enabled')).toHaveCount(0)
  release()
  await expect(pagination.getByRole('button', { name: `${pageLabel} 2`, exact: true })).toHaveAttribute('aria-current', 'page')
  await pagination.getByRole('button', { name: `${pageLabel} 3`, exact: true }).click()
  await expect(pagination.getByRole('button', { name: `${pageLabel} 3`, exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(pagination.getByRole('button', { name: next, exact: true })).toBeDisabled()
  await pagination.getByRole('button', { name: previous, exact: true }).click()
  await expect(pagination.getByRole('button', { name: `${pageLabel} 2`, exact: true })).toHaveAttribute('aria-current', 'page')
  expect(requested).toEqual([1, 2, 3, 2])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await pagination.screenshot({ path: `/tmp/sc-shop-pagination/pagination-${width}.png` })
})

test('simulated payment and received parcel do not show online-payment confirmation', async ({ page }) => {
  await setup(page, () => ({ ...order, status: 'paid', payment_status: 'simulated_paid', shipments: [{ ...parcel, delivery_status: 'delivered' }] }))
  for (const path of ['/cabinet/purchase-history', '/cabinet/orders/321']) {
    await page.goto(path)
    await expect(page.locator(path.includes('purchase-history') ? '.purchase-history__card' : '.shipments__card')).toBeVisible()
    await expect(page.getByText(/^(Не оплачено|Оплачено|оплачено|Unpaid|Paid)$/)).toHaveCount(0)
    await expect(page.getByText(/^(Оплачено|оплачено|Paid)$/)).toHaveCount(0)
  }
})

test('compact detail preserves cancellation, prices and one adjacent quantity without empty documents', async ({ page }) => {
  await setup(page, () => ({ ...order, status: 'cancelled', shipments: [{ ...parcel, delivery_status: 'delivered' }] }))
  await page.goto('/cabinet/orders/321')
  await expect(page.locator('.order-detail__status')).toHaveText('Скасовано')
  await expect(page.locator('.order-detail__amount')).toContainText('300')
  await expect(page.locator('.order-detail__product .base-quantity-stepper__input')).toHaveValue('3')
  await expect(page.locator('.order-detail__product img')).toHaveCount(0)
  await expect(page.locator('.order-detail__item-meta')).toContainText('100')
  await expect(page.getByRole('region', { name: 'Документи замовлення' })).toHaveCount(0)
  await expect(page.locator('.shipments__card .order-status-badge .base-icon')).toHaveAttribute('class', /base-icon/)
})

for (const state of ['delivered', 'in_transit']) test(`parcel ${state} starts compact and history toggles by keyboard`, async ({ page }) => {
  await setup(page, () => ({ ...order, shipments: [{ ...parcel, delivery_status: state, events: [{ ...parcel.events[0], normalized_status: state }] }] }))
  await page.goto('/cabinet/orders/321')
  const card = page.locator('.shipments__card')
  const disclosure = card.locator('details')
  await expect(disclosure).not.toHaveAttribute('open')
  await expect(card.locator('ol')).not.toBeVisible()
  await expect(card.locator('.shipments__tracking')).toBeVisible()
  await expect(card.locator('.order-status-badge')).toBeVisible()
  if (state === 'delivered') await expect(card.locator('.shipments__received time')).toHaveAttribute('datetime', parcel.events[0].event_at)
  const summary = disclosure.locator('summary')
  await summary.focus()
  await summary.press('Enter')
  await expect(card.locator('ol')).toBeVisible()
  await summary.press('Space')
  await expect(card.locator('ol')).not.toBeVisible()
})

test('details arrow is small and turns down on hover with reduced-motion support', async ({ page }) => {
  await setup(page)
  await page.goto('/cabinet/purchase-history')
  const link = page.locator('.purchase-history__details')
  const arrow = link.locator('.purchase-history__details-arrow')
  await expect(arrow.locator('svg')).toHaveCount(1)
  await expect(arrow).toHaveCSS('width', '14px')
  const supportsHover = await page.evaluate(() => matchMedia('(hover: hover)').matches)
  await link.hover()
  await expect(arrow).toHaveCSS('transform', supportsHover ? 'matrix(0, 1, -1, 0, 0, 0)' : 'none')
  // Touch devices have no CSS hover; keyboard focus must still reveal the arrow.
  await page.mouse.move(0, 0)
  await link.focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  await expect(link).toBeFocused()
  await expect(arrow).toHaveCSS('transform', 'matrix(0, 1, -1, 0, 0, 0)')
  await expect(page).toHaveURL(/purchase-history$/)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(arrow).toHaveCSS('transition-duration', '0s')
})

test('base accordion animates safely through rapid toggles and reduced motion', async ({ page }) => {
  await setup(page)
  await page.goto('/cabinet/orders/321')
  const accordion = page.locator('.shipments__card .base-accordion')
  const summary = accordion.locator('summary')
  await expect(accordion).not.toHaveAttribute('open')
  await summary.click()
  await expect(summary).toHaveAttribute('aria-expanded', 'true')
  await summary.click()
  await summary.click()
  await expect(summary).toHaveAttribute('aria-expanded', 'true')
  await expect(accordion.locator('ol')).toBeVisible()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await summary.press('Enter')
  await expect(accordion).not.toHaveAttribute('open')
  await summary.press('Space')
  await expect(accordion.locator('ol')).toBeVisible()
  await expect(accordion).toHaveCSS('transition-duration', '0s')
})

test('back arrow loops left by eight pixels only on interaction and respects reduced motion', async ({ page }) => {
  await setup(page)
  await page.goto('/cabinet/orders/321')
  const link = page.locator('.order-detail__back')
  const arrow = link.locator('.order-detail__back-arrow')
  await expect(arrow.locator('svg')).toHaveCount(1)
  await expect(arrow).toHaveCSS('width', '14px')
  await expect(arrow).toHaveCSS('animation-name', 'none')
  const supportsHover = await page.evaluate(() => matchMedia('(hover: hover)').matches)
  await link.hover()
  await expect(arrow).toHaveCSS('animation-iteration-count', supportsHover ? 'infinite' : '1')
  await page.mouse.move(0, 0)
  await link.focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  await expect(link).toBeFocused()
  await expect(arrow).toHaveCSS('animation-iteration-count', 'infinite')
  const maximumOffset = await arrow.evaluate(el => {
    const animation = el.getAnimations()[0]
    return (animation.effect as KeyframeEffect).getKeyframes().find(frame => frame.offset === 0.5)?.transform
  })
  expect(maximumOffset).toMatch(/^translate(?:X)?\(-8px\)$/)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(arrow).toHaveCSS('animation-name', 'none')
  await link.click()
  await expect(page).toHaveURL(/purchase-history$/)
})

test('soft surfaces share pale radial washes without a hover background or border', async ({ page }) => {
  await setup(page)
  await page.goto('/cabinet/purchase-history')
  const card = page.locator('.purchase-history__card')
  await expect(card).toHaveClass(/soft-surface/)
  const background = await card.evaluate(el => getComputedStyle(el).backgroundImage)
  expect(background).toContain('radial-gradient')
  await card.hover()
  await expect(card).toHaveCSS('background-image', background)
  await expect(card).toHaveCSS('border-top-width', '0px')
  await card.locator('.purchase-history__details').click()
  await expect(page.locator('.shipments__card')).toHaveClass(/soft-surface/)
  await expect(page.locator('.shipments__card')).toHaveCSS('background-image', background)
})

test('purchased product image and name link to current catalog URL independently of quantity', async ({ page }) => {
  await setup(page)
  await page.route('**/api/v1/public/products/5', route => route.fulfill({ json: { id: 5, slug: 'historical-product-current-slug' } }))
  await page.route('**/api/v1/public/products/by-slug/historical-product-current-slug', route => route.fulfill({ status: 404, json: { detail: 'Not found' } }))
  for (const path of ['/cabinet/purchase-history', '/cabinet/orders/321']) {
    await page.goto(path)
    const link = page.locator(path.includes('purchase-history') ? '.purchase-history__product-link' : '.order-detail__product-link')
    await expect(link).toHaveAttribute('href', '/products/id/5')
    await expect(link.locator('.base-quantity-stepper')).toHaveCount(0)
    await link.click()
    await expect(page).toHaveURL(/products\/historical-product-current-slug$/)
    await page.goBack()
    await expect(page).toHaveURL(path)
  }
})

for (const width of [390, 1440]) test(`cabinet reuses soft surfaces without layout overflow at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 })
  await setup(page)
  for (const [path, selector] of [
    ['/cabinet', '.cabinet-overview__identity, .cabinet-overview__orders'],
    ['/cabinet/contact', '.account-contact__details, .account-contact__method'],
    ['/cabinet/shop-rules', '.account-rules__card'],
    ['/cabinet/purchase-history', '.purchase-history__card'],
    ['/cabinet/orders/321', '.shipments__card'],
    ['/cabinet/settings', ''], ['/cabinet/favorites', ''],
  ]) {
    await page.goto(path)
    await expect(page.locator('.cabinet-shell__content')).toBeVisible()
    if (selector) await expect(page.locator(selector).first()).toBeVisible()
    if (selector) for (const surface of await page.locator(selector).all()) {
      await expect(surface).toHaveClass(/soft-surface/)
      await expect(surface).toHaveCSS('border-radius', '4px')
      expect(await surface.evaluate(el => getComputedStyle(el).backgroundImage)).toContain('radial-gradient')
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (path === '/cabinet' || path === '/cabinet/contact') await page.screenshot({ path: `${artifacts}/cabinet-surface-${path === '/cabinet' ? 'overview' : 'contact'}-${width}.png`, fullPage: true })
  }
})
