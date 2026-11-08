import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })
const product = { id: 42, name: 'Quick Pomade', sku: 'QUICK-100', barcode: '5901234123457', price: '250.00', on_hand: 10, reserved: 2, available: 8, stock_quantity: 10, reserved_quantity: 2, available_quantity: 8, is_active: true, images: [], attributes_json: {}, allow_backorder: false }
const user = { id: 5, email: 'quick@example.test', role: 'admin', is_superuser: true, is_active: true, can_post_inventory: true }
const paged = (items: unknown[]) => ({ total: items.length, page: 1, page_size: 20, items })

async function setup(page: Page, options: { denied?: boolean, delayed?: boolean } = {}) {
  const requests: { method: string, path: string, query: string }[] = []
  let release: (() => void) | undefined
  await page.addInitScript(({ user, denied, code }) => {
    localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'quick-test', user }))
    const state = { started: 0, stopped: 0, detect: false }
    ;(window as unknown as { quickCamera: typeof state }).quickCamera = state
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => {
      if (denied) throw new DOMException('Denied', 'NotAllowedError')
      state.started++
      return { getTracks: () => [{ stop: () => { state.stopped++ } }] }
    } } })
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', { configurable: true, writable: true, value: null })
    HTMLMediaElement.prototype.play = async () => {}
    Object.defineProperties(HTMLVideoElement.prototype, {
      videoWidth: { configurable: true, get: () => 1280 },
      videoHeight: { configurable: true, get: () => 720 },
      readyState: { configurable: true, get: () => 4 },
    })
    CanvasRenderingContext2D.prototype.drawImage = () => {}
    // Lifecycle tests mock the worker boundary; actual WASM pixels are tested separately.
    ;(window as unknown as { Worker: unknown }).Worker = class {
      onmessage?: (event: { data: unknown }) => void
      constructor() { setTimeout(() => this.onmessage?.({ data: { type: 'ready' } }), 0) }
      postMessage() { setTimeout(() => this.onmessage?.({ data: { type: 'result', barcode: state.detect ? code : null } }), 0) }
      terminate() {}
    }
  }, { user, denied: options.denied || false, code: product.barcode })
  await page.route('**/*', async route => {
    if (!['fetch', 'xhr'].includes(route.request().resourceType())) return route.continue()
    const url = new URL(route.request().url())
    if (!url.pathname.includes('/backoffice/')) return route.continue()
    requests.push({ method: route.request().method(), path: url.pathname, query: url.search })
    let body: unknown = paged([])
    if (url.pathname.endsWith('/auth/me')) body = user
    else if (url.pathname.includes('/products/barcode/')) {
      if (options.delayed) await new Promise<void>(resolve => { release = resolve })
      if (!url.pathname.endsWith(product.barcode)) return route.fulfill({ status: 404, json: { detail: 'Not found' } })
      body = product
    }
    else if (url.pathname.endsWith('/stock') || url.pathname.endsWith('/products')) body = paged([product])
    else if (url.pathname.endsWith('/products/42')) body = product
    else if (url.pathname.endsWith('/procurement')) body = []
    await route.fulfill({ json: body })
  })
  return { requests, release: () => release?.() }
}
const modal = (page: Page) => page.getByRole('dialog', { name: 'Швидкий пошук товару', exact: true })
async function open(page: Page, path = '/products') {
  await page.goto(path)
  await page.getByRole('button', { name: 'Швидкий пошук товару', exact: true }).click()
  await expect(modal(page)).toBeVisible()
}

test('warehouse uses one search with camera and stock filter above the results', async ({ page }) => {
  const { requests } = await setup(page)
  await page.goto('/inventory?page=2')
  const search = page.getByRole('searchbox', { name: 'Пошук на складі', exact: true })
  await expect(search).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'Знайти товар', exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Назва або артикул', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Сканувати штрихкод', exact: true })).toBeVisible()
  await search.fill(product.sku)
  await expect(page.getByRole('button', { name: 'Застосувати', exact: true })).toHaveCount(0)
  await expect(page).toHaveURL(/search=QUICK-100/)
  expect(new URL(page.url()).searchParams.has('page')).toBe(false)
  await expect.poll(() => requests.some(request => request.path.endsWith('/stock') && new URLSearchParams(request.query).get('search') === product.sku)).toBe(true)
  await expect(page.getByRole('link', { name: 'Прийняти товар', exact: true })).toHaveAttribute('href', '/inventory/receiving?product_id=42')
  await page.screenshot({ path: '/tmp/inventory-unified-search-mobile.png' })
  expect(requests.every(request => request.method === 'GET')).toBe(true)
})

test('warehouse camera filters the same result list and releases camera', async ({ page }) => {
  const { requests } = await setup(page)
  await page.goto('/inventory?page=2')
  await page.getByRole('button', { name: 'Сканувати штрихкод', exact: true }).click()
  const state = () => page.evaluate(() => (window as unknown as { quickCamera: { started: number, stopped: number, detect: boolean } }).quickCamera)
  await expect.poll(async () => (await state()).started).toBe(1)
  await page.evaluate(() => { (window as unknown as { quickCamera: { detect: boolean } }).quickCamera.detect = true })
  await expect(page.getByRole('dialog', { name: 'Сканування штрихкоду', exact: true })).toBeHidden()
  await expect(page).toHaveURL(new RegExp(`search=${product.barcode}`))
  await expect(page.getByRole('searchbox', { name: 'Пошук на складі', exact: true })).toHaveValue(product.barcode)
  await expect.poll(async () => (await state()).stopped).toBe(1)
  await expect.poll(() => requests.some(request => request.path.endsWith('/stock') && new URLSearchParams(request.query).get('search') === product.barcode)).toBe(true)
  expect(new URL(page.url()).searchParams.has('page')).toBe(false)
  expect(requests.every(request => request.method === 'GET')).toBe(true)
})

test('unknown code offers name/SKU lookup, without binding or creation', async ({ page }) => {
  const { requests } = await setup(page)
  await open(page, '/products')
  await modal(page).getByLabel('Штрихкод', { exact: true }).fill('UNKNOWN')
  await modal(page).getByRole('button', { name: 'Знайти', exact: true }).click()
  await expect(modal(page).getByRole('status')).toContainText('Штрихкод не знайдено')
  await modal(page).getByLabel('Назва або SKU').fill(product.sku)
  await modal(page).getByRole('button', { name: 'Пошук', exact: true }).click()
  await expect(modal(page).getByText('Артикул: QUICK-100')).toBeVisible()
  await expect(modal(page).getByRole('button', { name: /Створити|Прив’язати/ })).toHaveCount(0)
  await modal(page).getByRole('button', { name: 'Вибрати товар', exact: true }).click()
  await expect(page).toHaveURL(/\/products\/42$/)
  expect(requests.every(request => request.method === 'GET')).toBe(true)
})

test('camera starts explicitly, scans once and stops on recognition and navigation', async ({ page }) => {
  const { requests } = await setup(page)
  await open(page)
  const state = () => page.evaluate(() => (window as unknown as { quickCamera: { started: number, stopped: number, detect: boolean } }).quickCamera)
  expect((await state()).started).toBe(0)
  await modal(page).getByRole('button', { name: 'Сканувати', exact: true }).click()
  await expect.poll(async () => (await state()).started).toBe(1)
  await page.evaluate(() => { (window as unknown as { quickCamera: { detect: boolean } }).quickCamera.detect = true })
  await expect(page.getByRole('dialog', { name: 'Сканування штрихкоду', exact: true })).toBeHidden()
  await expect(modal(page).getByRole('button', { name: 'Вибрати товар' })).toBeVisible()
  expect((await state()).stopped).toBe(1)
  expect(requests.filter(request => request.path.includes('/products/barcode/'))).toHaveLength(1)
  await page.evaluate(() => { (window as unknown as { quickCamera: { detect: boolean } }).quickCamera.detect = false })
  await modal(page).getByRole('button', { name: 'Сканувати', exact: true }).click()
  await expect.poll(async () => (await state()).started).toBe(2)
  await page.getByRole('dialog', { name: 'Сканування штрихкоду', exact: true }).getByRole('button', { name: 'Закрити', exact: true }).click()
  expect((await state()).stopped).toBe(2)
  await expect(modal(page).getByLabel('Штрихкод', { exact: true })).toBeFocused()
  await modal(page).getByRole('button', { name: 'Сканувати', exact: true }).click()
  await expect.poll(async () => (await state()).started).toBe(3)
  await page.evaluate(() => { document.querySelector<HTMLAnchorElement>('a[href="/inventory"]')?.click() })
  await expect(page).toHaveURL(/\/inventory$/)
  await expect.poll(async () => (await state()).stopped).toBe(3)
})

test('camera denial preserves manual search', async ({ page }) => {
  await setup(page, { denied: true })
  await open(page)
  await modal(page).getByRole('button', { name: 'Сканувати', exact: true }).click()
  const scanner = page.getByRole('dialog', { name: 'Сканування штрихкоду', exact: true })
  await expect(scanner.getByRole('alert')).toContainText('Дозвольте доступ')
  await scanner.getByRole('button', { name: 'Ввести вручну', exact: true }).click()
  await expect(modal(page).getByLabel('Штрихкод', { exact: true })).toBeFocused()
  await modal(page).getByLabel('Штрихкод', { exact: true }).fill(product.barcode)
  await modal(page).getByRole('button', { name: 'Знайти', exact: true }).click()
  await expect(modal(page).getByRole('button', { name: 'Вибрати товар' })).toBeVisible()
})

test('Escape closes only the scanner and restores focus inside quick search', async ({ page }) => {
  await setup(page)
  await open(page)
  await modal(page).getByRole('button', { name: 'Сканувати', exact: true }).click()
  const scanner = page.getByRole('dialog', { name: 'Сканування штрихкоду', exact: true })
  await expect(scanner).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(scanner).toBeHidden()
  await expect(modal(page)).toBeVisible()
  await expect(modal(page).getByLabel('Штрихкод', { exact: true })).toBeFocused()
})

test('closing and reopening ignores a late lookup response', async ({ page }) => {
  const { requests, release } = await setup(page, { delayed: true })
  await open(page)
  await modal(page).getByLabel('Штрихкод', { exact: true }).fill(product.barcode)
  await modal(page).getByRole('button', { name: 'Знайти', exact: true }).click()
  await expect.poll(() => requests.some(request => request.path.includes('/products/barcode/'))).toBe(true)
  await modal(page).getByRole('button', { name: 'Закрити пошук', exact: true }).click()
  await page.getByRole('button', { name: 'Швидкий пошук товару', exact: true }).click()
  const response = page.waitForResponse(response => response.url().includes('/products/barcode/'))
  release()
  await (await response).finished()
  await expect(modal(page).getByRole('button', { name: 'Вибрати товар' })).toHaveCount(0)
  await expect(modal(page).getByLabel('Штрихкод', { exact: true })).toHaveValue('')
})

 test('failed new search clears previous selectable results', async ({ page }) => {
  await setup(page)
  await open(page)
  await modal(page).getByLabel('Назва або SKU').fill(product.sku)
  await modal(page).getByRole('button', { name: 'Пошук', exact: true }).click()
  await expect(modal(page).getByRole('button', { name: 'Вибрати товар' })).toBeVisible()
  await page.route('**/backoffice/inventory/stock**', route => route.fulfill({ status: 503, json: { detail: 'Unavailable' } }))
  await modal(page).getByLabel('Назва або SKU').fill('different')
  await modal(page).getByRole('button', { name: 'Пошук', exact: true }).click()
  await expect(modal(page).getByRole('alert')).toBeVisible()
  await expect(modal(page).getByRole('button', { name: 'Вибрати товар' })).toHaveCount(0)
})


test('warehouse filter applies immediately and flushes pending search', async ({ page }) => {
  const { requests } = await setup(page)
  await page.goto('/inventory?page=2')
  const search = page.getByRole('searchbox', { name: 'Пошук на складі', exact: true })
  await search.fill('Quick')
  await page.getByRole('button', { name: /^Залишок/ }).click()
  await page.getByRole('option', { name: 'Немає в наявності', exact: true }).click()
  await expect(page).toHaveURL(/stock=out-of-stock/)
  expect(new URL(page.url()).searchParams.get('search')).toBe('Quick')
  expect(new URL(page.url()).searchParams.has('page')).toBe(false)
  await expect(page.getByText('Товарів не знайдено', { exact: true })).toBeVisible()
  await expect.poll(() => requests.some(request => request.path.endsWith('/stock') && new URLSearchParams(request.query).get('search') === 'Quick')).toBe(true)
})

test('warehouse search debounces typing, clears search, and cancels pending input on leave', async ({ page }) => {
  const { requests } = await setup(page)
  await page.goto('/inventory')
  const search = page.getByRole('searchbox', { name: 'Пошук на складі', exact: true })
  await search.pressSequentially('QUICK-100', { delay: 15 })
  await expect(page).toHaveURL(/search=QUICK-100/)
  await expect.poll(() => requests.filter(request => request.path.endsWith('/stock') && new URLSearchParams(request.query).has('search')).length).toBe(1)
  await search.fill('')
  await expect(page).toHaveURL(/\/inventory$/)
  await search.fill('Do not apply after leaving')
  await page.getByRole('navigation', { name: 'Розділи складу' }).getByRole('link', { name: /^Рух товарів/ }).click()
  await expect(page).toHaveURL(/\/inventory\/movements$/)
  await expect(page.getByRole('heading', { name: 'Рух товару', exact: true })).toBeVisible()
  expect(requests.some(request => new URLSearchParams(request.query).get('search') === 'Do not apply after leaving')).toBe(false)
})

test('warehouse clear button immediately resets results, retains stock filter and focuses search', async ({ page }) => {
  const { requests } = await setup(page)
  await page.goto('/inventory?search=QUICK-100&stock=available&page=2')
  const search = page.getByRole('searchbox', { name: 'Пошук на складі', exact: true })
  await expect(page.getByRole('button', { name: 'Очистити пошук', exact: true })).toBeVisible()
  await search.fill('Pending new text')
  await page.getByRole('button', { name: 'Очистити пошук', exact: true }).click()
  await expect(search).toHaveValue('')
  await expect(search).toBeFocused()
  await expect(page.getByRole('button', { name: 'Очистити пошук', exact: true })).toHaveCount(0)
  await expect(page).toHaveURL(/\/inventory\?stock=available$/)
  await expect.poll(() => requests.some(request => request.path.endsWith('/stock') && !new URLSearchParams(request.query).has('search') && new URLSearchParams(request.query).get('page') === '1')).toBe(true)
  await expect(page.getByRole('link', { name: 'Прийняти товар', exact: true })).toBeVisible()
})

test('compact product finder opens the phone camera in one tap', async ({ page }) => {
  const seller = { id: 17, email: 'pos-camera@example.test', role: 'barber', is_superuser: false, is_active: true, can_record_sales: true, can_accept_qr_payments: true }
  const offer = { id: 42, name: 'POS Pomade', brand_name: 'Synthetic brand', sku: 'POS-100', barcode: '5901234123457', image_url: null, variant_label: '100 мл', amount_minor: 25000, currency: 'UAH', available_quantity: 8, can_sell: true, blocking_reasons: [] }
  const requests: { method: string, path: string, query: URLSearchParams }[] = [], inventoryRequests: string[] = [], external: string[] = []
  const creates: { intent_id: string, items: { product_id: number, quantity: number }[], quote_revision: string, currency: string }[] = []
  await page.addInitScript(({ seller, barcode }) => {
    localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'synthetic-pos-camera', user: seller }))
    const state = { started: 0, stopped: 0, detect: false }
    ;(window as unknown as { quickCamera: typeof state }).quickCamera = state
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => {
      state.started++
      return { getTracks: () => [{ stop: () => { state.stopped++ } }] }
    } } })
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', { configurable: true, writable: true, value: null })
    HTMLMediaElement.prototype.play = async () => {}
    Object.defineProperties(HTMLVideoElement.prototype, {
      videoWidth: { configurable: true, get: () => 1280 },
      videoHeight: { configurable: true, get: () => 720 },
      readyState: { configurable: true, get: () => 4 },
    })
    CanvasRenderingContext2D.prototype.drawImage = () => {}
    ;(window as unknown as { Worker: unknown }).Worker = class {
      onmessage?: (event: { data: unknown }) => void
      constructor() { setTimeout(() => this.onmessage?.({ data: { type: 'ready' } }), 0) }
      postMessage() { setTimeout(() => this.onmessage?.({ data: { type: 'result', barcode: state.detect ? barcode : null } }), 0) }
      terminate() {}
    }
  }, { seller, barcode: offer.barcode })
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) { external.push(url.origin); return route.abort() }
    if (!url.pathname.includes('/api/v1/')) return route.continue()
    if (url.pathname.includes('/inventory/')) { inventoryRequests.push(url.pathname); return route.fulfill({ status: 403, json: { detail: 'POS cannot use inventory DTOs' } }) }
    if (url.pathname.endsWith('/auth/me')) return route.fulfill({ json: seller })
    if (!url.pathname.includes('/backoffice/pos/')) return route.fulfill({ json: [] })
    const path = url.pathname.split('/backoffice/pos')[1]!
    requests.push({ method: request.method(), path, query: url.searchParams })
    if (path === '/capabilities') return route.fulfill({ json: { mode: 'mono_checkbox', currency: 'UAH', max_quantity: 1, cart_limits: { max_items: 100, max_quantity: 100 }, can_search: true, can_start: true, can_view_admin_sales: false, automatic_reconciliation_enabled: false, poll_after_ms: 30000, blocking_reasons: [] } })
    if (path === '/checkouts/active') return route.fulfill({ json: { items: [], total: 0, page: 1, page_size: 20 } })
    if (path === '/products') return route.fulfill({ json: { items: [offer], total: 1, page: 1, page_size: 20 } })
    if (path === '/cart/quote') return route.fulfill({ json: {
      items: [{ product_id: offer.id, quantity: 1, base_unit_minor: offer.amount_minor, unit_minor: offer.amount_minor, subtotal_minor: offer.amount_minor, discount_minor: 0, amount_minor: offer.amount_minor, promotion_id: null, promotion_name: null, promotion_code: null, discount_source: null }],
      currency: 'UAH', subtotal_minor: offer.amount_minor, discount_minor: 0, amount_minor: offer.amount_minor, applied_promo_code: null, promotion_id: null, available_promotions: [], quote_revision: 'a'.repeat(64),
    } })
    if (path === '/checkouts' && request.method() === 'POST') {
      const body = request.postDataJSON(); creates.push(body)
      return route.fulfill({ status: 201, json: {
        checkout_id: '22222222-2222-4222-8222-222222222222', intent_id: body.intent_id, order_id: 9001, revision: 1, created_at: '2026-11-06T10:00:00Z', employee: { user_id: seller.id, master_id: null, display_name: 'Synthetic seller' },
        items: [{ product_id: offer.id, name: offer.name, sku: offer.sku, barcode: offer.barcode, image_url: null, variant_label: offer.variant_label, quantity: 1, unit_minor: offer.amount_minor, total_minor: offer.amount_minor }], order_status: 'pending', amount_minor: offer.amount_minor, currency: 'UAH', status: 'awaiting_payment',
        payment: { provider: 'monobank', status: 'pending', invoice_id: 'SYNTHETIC_POS_CAMERA', confirmed_at: null, qr_payload: 'https://pay.mbnk.biz/SYNTHETIC_POS_CAMERA' }, receipt: { issuer: 'checkbox', status: 'not_requested', recorded_at: null, pdf_url: null }, handover: { status: 'not_ready', actor_user_id: null, handed_over_at: null },
        actions: { can_resume: false, can_refresh: true, can_handover: false, can_recover_invoice: false, can_start_new: false }, poll_after_ms: 30000, blocking_reasons: [],
      } })
    }
    return route.fulfill({ status: 404, json: { detail: 'Unexpected POS request' } })
  })
  await page.goto('/orders/pos')
  const cameraButton = page.getByRole('button', { name: 'Сканувати штрихкод', exact: true })
  await expect(cameraButton).toBeVisible()
  expect(creates).toHaveLength(0)
  await cameraButton.click()
  await expect(page.getByRole('dialog', { name: 'Сканування штрихкоду', exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as unknown as { quickCamera: { started: number } }).quickCamera.started)).toBe(1)
  await page.screenshot({ path: '/tmp/sc-pos-compact-20261108/screens/direct-pos-camera-mobile.png', fullPage: true })
  await page.evaluate(() => { (window as unknown as { quickCamera: { detect: boolean } }).quickCamera.detect = true })
  await expect(page.getByRole('dialog', { name: 'Сканування штрихкоду', exact: true })).toBeHidden()
  await expect(page.getByLabel('Знайти товар', { exact: true })).toHaveValue(offer.barcode)
  const candidate = page.getByRole('button', { name: /Додати: POS Pomade/ })
  await expect(candidate).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as unknown as { quickCamera: { stopped: number } }).quickCamera.stopped)).toBe(1)
  expect(requests.filter(request => request.path === '/products').map(request => request.query.get('q'))).toEqual([offer.barcode])
  expect(requests.every(request => request.method === 'GET')).toBe(true)
  expect(creates).toHaveLength(0)
  expect(inventoryRequests).toEqual([])
  await candidate.click()
  await expect(page.getByRole('region', { name: 'Панель кошика' })).toContainText('250,00')
  expect(creates).toHaveLength(0)
  await page.getByRole('button', { name: 'Перейти до оплати' }).click()
  await expect(page.getByRole('img', { name: 'QR для оплати mono' })).toBeVisible()
  expect(creates).toHaveLength(1)
  expect(Object.keys(creates[0]!).sort()).toEqual(['currency', 'intent_id', 'items', 'promo_code', 'promotion_id', 'quote_revision'])
  expect(creates[0]).toMatchObject({ items: [{ product_id: offer.id, quantity: 1 }], quote_revision: 'a'.repeat(64), currency: 'UAH' })
  expect(inventoryRequests).toEqual([])
  expect(external).toEqual([])
})
