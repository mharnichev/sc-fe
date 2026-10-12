import { expect, test as base, type Page } from '@playwright/test'

const code = '0012345678905'
const product = { id: 42, name: 'Mobile shampoo', sku: 'MOBILE', barcode: code, price: '100.00', on_hand: 0, reserved: 0, available: 0, allow_backorder: false, is_active: false }
const draft = { id: 12, reason: 'Mobile receipt', status: 'draft', items: [], created_at: '2026-10-11T00:00:00Z', posted_at: null }

async function setup(page: Page, options: { permissionDenied?: boolean, unknown?: boolean, canPost?: boolean, bindConflict?: boolean, posting?: boolean, stock?: boolean, holdDraftBalance?: boolean } = {}) {
  const lookups: string[] = []
  const additions: { key: string | undefined, body: unknown }[] = []
  const bindings: unknown[] = []
  const creations: unknown[] = []
  let posted = false
  const posts: unknown[] = []
  const balances: number[] = []
  let releaseDraftBalance: (() => void) | undefined
  const receiptItem = { id: 1, product_id: 42, barcode: code, quantity: 1, purchase_unit_cost: '10.00', allocations: [] }
  const currentDraft = { ...draft, items: options.posting ? [receiptItem] : [] }
  const user = { id: 5, email: 'warehouse@example.test', full_name: 'Warehouse', role: 'barber', is_active: true, is_superuser: false, can_post_inventory: options.canPost ?? false }
  await page.addInitScript(({ user, permissionDenied, code }) => {
    localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'mobile-test', refreshToken: 'unused', user }))
    const state = { acquired: 0, stopped: 0, recognize: false }
    ;(window as unknown as { cameraTest: typeof state }).cameraTest = state
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => {
      if (permissionDenied) throw new DOMException('Denied', 'NotAllowedError')
      state.acquired++
      return { getTracks: () => [{ stop: () => { state.stopped++ } }] }
    } } })
    // Fake streams avoid depending on physical camera hardware. Playback and
    // detection are mocked, while the component lifecycle is exercised intact.
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', { configurable: true, writable: true, value: null })
    HTMLMediaElement.prototype.play = async () => {}
    ;(window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class {
      static async getSupportedFormats() { return ['ean_13', 'ean_8'] }
      async detect() { return state.recognize ? [{ rawValue: code }] : [] }
    }
  }, { user, permissionDenied: options.permissionDenied || false, code })
  await page.route('**/*', async route => {
    const request = route.request()
    if (!['fetch', 'xhr'].includes(request.resourceType())) return route.continue()
    const path = new URL(request.url()).pathname
    let body: unknown = {}
    let status = 200
    if (!path.includes('/backoffice/')) return route.continue()
    if (path.endsWith('/auth/me')) body = user
    else if (path.endsWith('/receipts/12/post')) {
      posts.push(request.postDataJSON())
      posted = posts.length > 1
      body = posted ? { ...currentDraft, status: 'posted', posted_at: '2026-10-11T01:00:00Z' } : currentDraft
    } else if (path.endsWith('/products/42')) {
      const balance = posted ? 1 : 0
      balances.push(balance)
      body = { ...product, stock_quantity: balance, reserved_quantity: 0, available_quantity: balance }
      if (options.holdDraftBalance && balances.length === 1) await new Promise<void>(resolve => { releaseDraftBalance = resolve })
    }
    else if (path.endsWith('/receipts/12/items')) {
      additions.push({ key: request.headers()['idempotency-key'], body: request.postDataJSON() })
      if (additions.length === 1) return route.abort('failed')
      body = { ...draft, items: [{ id: 1, product_id: 42, barcode: code, quantity: 1, purchase_unit_cost: '10.00', allocations: [] }] }
    } else if (path.endsWith('/receipts/12')) body = currentDraft
    else if (path.includes('/products/barcode/')) {
      lookups.push(decodeURIComponent(path.split('/products/barcode/')[1]!))
      if (options.unknown) { status = 404; body = { detail: 'Product not found' } } else body = product
    } else if (path.endsWith('/products/42/barcode')) {
      bindings.push(request.postDataJSON()); body = { ...product, barcode: (request.postDataJSON() as { barcode: string }).barcode }
      if (options.bindConflict) { status = 409; body = { detail: 'Selected product already has a different barcode' } }
    } else if (path.endsWith('/inventory/products') && request.method() === 'POST') {
      creations.push(request.postDataJSON()); body = { ...product, ...request.postDataJSON() }
    } else if (path.endsWith('/stock')) body = { total: options.unknown || options.stock ? 1 : 0, items: options.unknown || options.stock ? [{ ...product, barcode: options.unknown ? (options.bindConflict && bindings.length ? 'OTHER-CODE' : null) : code }] : [] }
    await route.fulfill({ status, json: body })
  })
  await page.goto('/inventory/receiving?id=12')
  await expect(page.getByRole('button', { name: 'Сканувати', exact: true })).toBeVisible()
  return { lookups, additions, bindings, creations, posts, balances, releaseDraftBalance: () => releaseDraftBalance?.() }
}

for (const browserName of ['chromium', 'webkit'] as const) {
  const test = base.extend({
    page: async ({ playwright, baseURL }, use) => {
      const browser = await playwright[browserName].launch()
      const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
      await use(await context.newPage())
      await context.close()
      await browser.close()
    },
  })
  test.describe(`mobile inventory ${browserName}`, () => {

    test('camera is explicit, one-shot, stops tracks, and allows deliberate repeat', async ({ page }) => {
      const { lookups } = await setup(page)
      const state = () => page.evaluate(() => (window as unknown as { cameraTest: { acquired: number, stopped: number } }).cameraTest)
      expect((await state()).acquired).toBe(0)
      await page.getByRole('button', { name: 'Сканувати', exact: true }).click()
      await expect.poll(async () => (await state()).acquired).toBe(1)
      await page.evaluate(() => { (window as unknown as { cameraTest: { recognize: boolean } }).cameraTest.recognize = true })
      await expect(page.getByRole('dialog')).toBeHidden()
      await expect.poll(() => lookups.length).toBe(1)
      expect(lookups).toEqual([code])
      expect((await state()).stopped).toBe(1)
      await page.getByRole('button', { name: 'Сканувати', exact: true }).click()
      await expect.poll(() => lookups.length).toBe(2)
      expect((await state()).stopped).toBe(2)
      await expect(page.getByRole('spinbutton', { name: 'Кількість', exact: true })).toHaveValue('2')
      await expect(page.getByRole('button', { name: 'Прийняти товари', exact: true })).toHaveCount(0)
      await page.screenshot({ path: `/tmp/mobile-inventory-${browserName}.png`, fullPage: true })
    })

    test('close stops camera and permission denial leaves manual lookup usable', async ({ page }) => {
      await setup(page)
      await page.getByRole('button', { name: 'Сканувати', exact: true }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.getByRole('button', { name: 'Ввести вручну', exact: true }).click()
      await expect.poll(() => page.evaluate(() => (window as unknown as { cameraTest: { stopped: number } }).cameraTest.stopped)).toBe(1)
      await page.reload()
      // Replace the permission method for this explicit reopening.
      await page.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError') } })
      await page.getByRole('button', { name: 'Сканувати', exact: true }).click()
      await expect(page.getByRole('alert')).toContainText('Дозвольте доступ')
      await page.getByRole('button', { name: 'Ввести вручну', exact: true }).click()
      await page.getByLabel('Штрихкод', { exact: true }).fill(code)
      await page.getByRole('button', { name: 'Знайти', exact: true }).click()
      await expect(page.getByText('Знайдено:', { exact: false })).toBeVisible()
    })

    test('manual unknown code binds only after confirmation and preserves exact string', async ({ page }) => {
      const { bindings, lookups } = await setup(page, { unknown: true })
      const raw = ' 00-AbC  '
      await page.getByLabel('Штрихкод', { exact: true }).fill(raw)
      await page.getByRole('button', { name: 'Знайти', exact: true }).click()
      await expect(page.getByText('Штрихкод не знайдено.', { exact: false })).toBeVisible()
      expect(lookups).toEqual([raw])
      await page.getByLabel('Назва або артикул').fill('Mobile')
      await page.getByRole('button', { name: 'Пошук', exact: true }).click()
      await page.getByRole('button', { name: 'Прив’язати цей товар', exact: true }).click()
      expect(bindings).toHaveLength(0)
      await page.getByRole('button', { name: 'Підтвердити прив’язку / повторити', exact: true }).click()
      await expect.poll(() => bindings.length).toBe(1)
      expect(bindings[0]).toEqual({ barcode: raw })
    })

    test('manual reselection preserves quantity without counting another scan', async ({ page }) => {
      await setup(page, { stock: true })
      await page.getByLabel('Штрихкод', { exact: true }).fill(code)
      await page.getByRole('button', { name: 'Знайти', exact: true }).click()
      await expect(page.getByText('Знайдено:', { exact: false })).toBeVisible()
      const quantity = page.getByRole('spinbutton', { name: 'Кількість', exact: true })
      await quantity.fill('10')
      await page.getByLabel('Назва або артикул').fill('Mobile')
      await page.getByRole('button', { name: 'Пошук', exact: true }).click()
      await page.getByRole('button', { name: 'Вибрати', exact: true }).click()
      await expect(quantity).toHaveValue('10')
    })

    test('unknown barcode can be reset before selecting an existing product', async ({ page }) => {
      const { bindings } = await setup(page, { unknown: true })
      await page.getByLabel('Штрихкод', { exact: true }).fill('UNKNOWN')
      await page.getByRole('button', { name: 'Знайти', exact: true }).click()
      await expect(page.getByText('Штрихкод не знайдено.', { exact: false })).toBeVisible()
      await expect(page.getByLabel('Штрихкод', { exact: true })).toHaveValue('')
      await page.getByRole('button', { name: 'Скинути', exact: true }).click()
      await expect(page.getByText('Штрихкод не знайдено.', { exact: false })).toHaveCount(0)
      await page.getByLabel('Назва або артикул').fill('Mobile')
      await page.getByRole('button', { name: 'Пошук', exact: true }).click()
      await page.getByRole('button', { name: 'Вибрати', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Додати до приймання', exact: true })).toBeEnabled()
      expect(bindings).toHaveLength(0)
    })

    test('desktop table wrappers are hidden on mobile and visible on desktop', async ({ page }) => {
      await setup(page, { stock: true, posting: true })
      for (const [path, caption] of [['/inventory/receiving?id=12', 'Позиції приймання'], ['/inventory', 'Поточні залишки']] as const) {
        await page.goto(path)
        const wrapper = page.getByRole('region', { name: caption, exact: true, includeHidden: true }).locator('..')
        await expect(wrapper).toBeHidden()
        await page.setViewportSize({ width: 1024, height: 844 })
        await expect(wrapper).toBeVisible()
        await page.setViewportSize({ width: 390, height: 844 })
        await expect(wrapper).toBeHidden()
      }
    })

    test('unknown code can create a hidden zero-stock card after searching', async ({ page }) => {
      const { creations } = await setup(page, { unknown: true })
      await page.getByLabel('Штрихкод', { exact: true }).fill(code)
      await page.getByRole('button', { name: 'Знайти', exact: true }).click()
      await page.getByLabel('Назва або артикул').fill('Missing')
      await page.getByRole('button', { name: 'Пошук', exact: true }).click()
      await page.getByRole('button', { name: 'Немає відповідного товару — створити картку', exact: true }).click()
      await page.getByLabel('Коротка назва').fill('Created shampoo')
      await page.getByLabel('Ціна продажу, грн').fill('120')
      await page.getByRole('button', { name: 'Створити товар', exact: true }).click()
      await expect.poll(() => creations.length).toBe(1)
      expect(creations[0]).toMatchObject({ name: 'Created shampoo', barcode: code, price: '120' })
      await expect(page.getByRole('button', { name: 'Додати до приймання', exact: true })).toBeEnabled()
    })

    test('barcode binding conflict refreshes the card and blocks replacement', async ({ page }) => {
      const { bindings } = await setup(page, { unknown: true, bindConflict: true })
      await page.getByLabel('Штрихкод', { exact: true }).fill(code)
      await page.getByRole('button', { name: 'Знайти', exact: true }).click()
      await page.getByLabel('Назва або артикул').fill('Mobile')
      await page.getByRole('button', { name: 'Пошук', exact: true }).click()
      await page.getByRole('button', { name: 'Прив’язати цей товар', exact: true }).click()
      await page.getByRole('button', { name: 'Підтвердити прив’язку / повторити', exact: true }).click()
      await expect.poll(() => bindings.length).toBe(1)
      await expect(page.getByRole('button', { name: 'Підтвердити прив’язку / повторити', exact: true })).toBeDisabled()
      await expect(page.getByText('Цей товар уже має інший штрихкод.', { exact: false }).first()).toBeVisible()
    })

    test('authorized posting requires server confirmation before displaying stock', async ({ page }) => {
      const { posts, balances } = await setup(page, { canPost: true, posting: true })
      expect(balances.every(balance => balance === 0)).toBe(true)
      await page.getByRole('button', { name: 'Прийняти товари', exact: true }).click()
      await page.getByRole('button', { name: 'Провести', exact: true }).click()
      await expect.poll(() => posts.length).toBe(1)
      await expect(page.getByRole('status').filter({ hasText: 'Чернетка #12' })).toBeVisible()
      expect(balances.every(balance => balance === 0)).toBe(true)
      await page.getByRole('button', { name: 'Провести', exact: true }).click()
      await expect.poll(() => posts.length).toBe(2)
      await expect(page.getByText('Підсумок проведення', { exact: true })).toBeVisible()
      await expect.poll(() => balances.at(-1)).toBe(1)
      await expect(page.getByRole('button', { name: 'Сканувати', exact: true })).toBeDisabled()
    })

    test('late draft response cannot replace balances after confirmed posting', async ({ page }) => {
      const { balances, releaseDraftBalance } = await setup(page, { canPost: true, posting: true, holdDraftBalance: true })
      await expect.poll(() => balances.length).toBe(1)
      await page.getByRole('button', { name: 'Прийняти товари', exact: true }).click()
      await page.getByRole('button', { name: 'Провести', exact: true }).click()
      await expect(page.getByRole('alert').first()).toBeVisible()
      await page.getByRole('button', { name: 'Провести', exact: true }).click()
      const postedBalance = page.getByText('На складі: 1 · Резерв: 0 · Доступно: 1', { exact: true })
      await expect(postedBalance).toBeVisible()
      const [lateResponse] = await Promise.all([
        page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/products/42')),
        Promise.resolve().then(releaseDraftBalance),
      ])
      await lateResponse.finished()
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
      await expect(postedBalance).toBeVisible()
    })

    test('uncertain receipt addition locks new scans and retries the same request', async ({ page }) => {
      const { additions } = await setup(page)
      await page.getByLabel('Штрихкод', { exact: true }).fill(code)
      await page.getByRole('button', { name: 'Знайти', exact: true }).click()
      await page.getByLabel('Закупівельна вартість за одиницю, грн').fill('10')
      await page.getByRole('button', { name: 'Додати до приймання', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Повторити додавання', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Сканувати', exact: true })).toBeDisabled()
      await page.getByRole('button', { name: 'Повторити додавання', exact: true }).click()
      await expect.poll(() => additions.length).toBe(2)
      expect(additions[0]!.key).toBeTruthy()
      expect(additions[1]).toEqual(additions[0])
    })
  })
}
