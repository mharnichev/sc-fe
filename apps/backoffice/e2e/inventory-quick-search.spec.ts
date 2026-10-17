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
    ;(window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class {
      static async getSupportedFormats() { return ['ean_13', 'ean_8'] }
      async detect() { return state.detect ? [{ rawValue: code }] : [] }
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
  await page.getByRole('button', { name: 'Сканувати штрихкод', exact: true }).click()
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
  await page.getByRole('button', { name: 'Сканувати штрихкод', exact: true }).click()
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
