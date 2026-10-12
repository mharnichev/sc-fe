import { expect, test as base, type APIRequestContext, type APIResponse, type Page } from '@playwright/test'

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env || {}
const sandboxURL = env.INVENTORY_SANDBOX_URL || ''
const root = `${sandboxURL}/api/v1/backoffice/inventory`
type Product = { id: number, name: string, barcode: string | null, on_hand: number, reserved: number }
type State = {
  sandbox: boolean, schema: string, access_token: string, user: Record<string, unknown>,
  master_access_token: string, master_user: Record<string, unknown>,
  poster_access_token: string, poster_user: Record<string, unknown>,
  seed: { products: Record<'available' | 'missing_barcode' | 'out_of_stock' | 'backorder', Product> },
}
async function json(response: APIResponse) {
  const body = await response.text()
  expect(response.ok(), `${response.status()} ${response.url()}: ${body}`).toBeTruthy()
  return body ? JSON.parse(body) : null
}
const headers = (token: string) => ({ Authorization: `Bearer ${token}` })
async function login(page: Page, state: State, role: 'master' | 'poster' | 'admin' = 'master') {
  const accessToken = role === 'admin' ? state.access_token : state[`${role}_access_token`]
  const user = role === 'admin' ? state.user : state[`${role}_user`]
  await page.addInitScript(auth => {
    localStorage.setItem('backoffice-auth', JSON.stringify({ ...auth, refreshToken: 'sandbox-unused' }))
    localStorage.setItem('soulcuts-backoffice-theme', 'light')
  }, { accessToken, user })
}
async function scan(page: Page, barcode: string) {
  await page.getByLabel('Штрихкод', { exact: true }).fill(barcode)
  await page.getByRole('button', { name: 'Знайти', exact: true }).click()
}
async function search(page: Page, name: string) {
  await page.getByLabel('Назва або артикул', { exact: true }).fill(name)
  await page.getByRole('button', { name: 'Пошук', exact: true }).click()
}
async function draft(page: Page) {
  await page.getByRole('button', { name: 'Створити чернетку', exact: true }).click()
  await expect(page).toHaveURL(url => /^\d+$/.test(url.searchParams.get('id') || ''))
  return Number(new URL(page.url()).searchParams.get('id'))
}
async function add(page: Page, quantity = '3', cost = '15.50') {
  await page.getByRole('spinbutton', { name: 'Кількість', exact: true }).fill(quantity)
  await page.getByRole('spinbutton', { name: 'Закупівельна вартість за одиницю, грн', exact: true }).fill(cost)
  await page.getByRole('button', { name: 'Додати до приймання', exact: true }).click()
}
async function inspect(request: APIRequestContext) { return json(await request.get(`${sandboxURL}/__sandbox/inspect`)) }
async function receipt(request: APIRequestContext, state: State, id: number) {
  return json(await request.get(`${root}/receipts/${id}`, { headers: headers(state.access_token) }))
}
// Every interception forwards the request to the real API, waits for its commit,
// then drops only the first response. No endpoint response is fabricated.
async function loseFirstResponse(page: Page, endpoint: string) {
  const attempts: { key: string, body: unknown }[] = []
  await page.route(url => url.pathname === new URL(endpoint).pathname, async route => {
    if (route.request().method() !== 'POST') return route.continue()
    attempts.push({ key: route.request().headers()['idempotency-key']!, body: route.request().postDataJSON() })
    expect(attempts.at(-1)!.key).toBeTruthy()
    if (attempts.length === 1) {
      const committed = await route.fetch()
      expect(committed.ok()).toBe(true)
      return route.abort('connectionfailed')
    }
    return route.continue()
  })
  return attempts
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
  test.describe(`real mobile inventory ${browserName}`, () => {
    test.skip(!sandboxURL, 'Requires the isolated real FastAPI/PostgreSQL sandbox.')
    let state: State
    test.beforeEach(async ({ request }) => {
      expect(new URL(sandboxURL).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/)
      expect(new URL(sandboxURL).port).toBe('58002')
      state = await json(await request.post(`${sandboxURL}/__sandbox/reset`))
      expect(state.sandbox).toBe(true)
      expect(state.schema).toMatch(/^inventory_browser_test_/)
    })

    test('linked master finds stock, confirms barcode binding and prepares a receipt without posting rights', async ({ page, request }) => {
      await login(page, state)
      await page.goto('/inventory')
      await scan(page, state.seed.products.available.barcode!)
      await expect(page.getByText(`Знайдено: ${state.seed.products.available.name}`, { exact: false })).toBeVisible()
      const before = await inspect(request)
      const code = '00-MASTER-BIND'
      await scan(page, code)
      await expect(page.getByText('Штрихкод не знайдено.', { exact: false })).toBeVisible()
      await search(page, state.seed.products.missing_barcode.name)
      await page.getByRole('button', { name: 'Прив’язати цей товар', exact: true }).click()
      expect(await inspect(request)).toEqual(before)
      await page.getByRole('button', { name: 'Підтвердити прив’язку / повторити', exact: true }).click()
      await expect(page.getByText(`Знайдено: ${state.seed.products.missing_barcode.name}`, { exact: false })).toBeVisible()
      const bound = await inspect(request)
      expect(bound.movement_count).toBe(before.movement_count)
      expect(bound.products.find((p: Product) => p.id === state.seed.products.missing_barcode.id)).toMatchObject({ barcode: code, on_hand: 4, reserved: 0 })
      await page.getByRole('link', { name: 'Прийняти цей товар', exact: true }).click()
      const id = await draft(page)
      await scan(page, code)
      await expect(page.getByText('Знайдено:', { exact: false })).toBeVisible()
      await add(page)
      await expect.poll(async () => (await receipt(request, state, id)).items.length).toBe(1)
      const saved = await receipt(request, state, id)
      expect(saved).toMatchObject({ status: 'draft', items: [{ product_id: state.seed.products.missing_barcode.id, quantity: 3, purchase_unit_cost: '15.50' }] })
      await expect(page.getByRole('button', { name: 'Прийняти товари', exact: true })).toHaveCount(0)
      expect((await request.post(`${root}/receipts/${id}/post`, { headers: { ...headers(state.master_access_token), 'Idempotency-Key': 'master-forbidden-post' }, data: {} })).status()).toBe(403)
      expect(await inspect(request)).toEqual(bound)
      // The administrator receives the master's existing draft link.
      const adminPage = await page.context().newPage()
      await login(adminPage, state, 'admin')
      await adminPage.goto(`/inventory/receiving?id=${id}`)
      await adminPage.getByRole('button', { name: 'Прийняти товари', exact: true }).click()
      await adminPage.getByRole('button', { name: 'Провести', exact: true }).click()
      await expect(adminPage.getByText('Підсумок проведення', { exact: true })).toBeVisible()
      const posted = await inspect(request)
      expect(posted.products.find((p: Product) => p.id === state.seed.products.missing_barcode.id)).toMatchObject({ barcode: code, on_hand: 7, reserved: 0 })
      expect(posted.movement_count).toBe(bound.movement_count + 1)
      expect((await receipt(request, state, id)).status).toBe('posted')
      await expect(adminPage.getByText('На складі: 7 · Резерв: 0 · Доступно: 7', { exact: true })).toBeVisible()
    })

    test('barcode conflict prevents replacement in browser and server', async ({ page, request }) => {
      await login(page, state)
      await page.goto('/inventory')
      const before = await inspect(request)
      await scan(page, 'UNASSIGNED-CONFLICT')
      await search(page, state.seed.products.available.name)
      await page.getByRole('button', { name: 'Прив’язати цей товар', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Підтвердити прив’язку / повторити', exact: true })).toBeDisabled()
      const rejected = await request.put(`${root}/products/${state.seed.products.available.id}/barcode`, { headers: headers(state.master_access_token), data: { barcode: 'UNASSIGNED-CONFLICT' } })
      expect(rejected.status()).toBe(409)
      expect(await inspect(request)).toEqual(before)
    })

    test('lost product creation response recovers the same hidden zero-stock card after reload', async ({ page, request }) => {
      await login(page, state)
      await page.goto('/inventory')
      const before = await inspect(request)
      const attempts = await loseFirstResponse(page, `${root}/products`)
      await scan(page, '00-REAL-HIDDEN')
      await search(page, 'No matching card')
      await page.getByRole('button', { name: 'Немає відповідного товару — створити картку', exact: true }).click()
      await page.getByRole('textbox', { name: 'Коротка назва', exact: true }).fill('Real mobile hidden card')
      await page.getByRole('textbox', { name: 'Ціна продажу, грн', exact: true }).fill('123.45')
      await page.getByRole('button', { name: 'Створити товар', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Повторити незавершений запит', exact: true })).toBeVisible()
      await page.reload()
      await page.getByRole('button', { name: 'Повторити незавершений запит', exact: true }).click()
      await expect(page.getByText('Знайдено: Real mobile hidden card', { exact: false })).toBeVisible()
      expect(attempts).toHaveLength(2)
      expect(attempts[1]).toEqual(attempts[0])
      const after = await inspect(request)
      expect(after.products).toHaveLength(before.products.length + 1)
      const created = after.products.find((p: Product) => p.barcode === '00-REAL-HIDDEN')
      expect(created).toMatchObject({ on_hand: 0, reserved: 0 })
      const card = await json(await request.get(`${sandboxURL}/api/v1/backoffice/products/${created.id}`, { headers: headers(state.access_token) }))
      expect(card).toMatchObject({ is_active: false, stock_quantity: 0 })
      expect(after.movement_count).toBe(before.movement_count)
      await page.getByRole('link', { name: 'Прийняти цей товар', exact: true }).click()
      const id = await draft(page)
      await scan(page, '00-REAL-HIDDEN')
      await expect(page.getByText('Знайдено: Real mobile hidden card', { exact: false })).toBeVisible()
      await add(page, '2', '10')
      await expect.poll(async () => (await receipt(request, state, id)).items.length).toBe(1)
      expect(await inspect(request)).toEqual(after)
      const adminPage = await page.context().newPage()
      await login(adminPage, state, 'admin')
      await adminPage.goto(`/inventory/receiving?id=${id}`)
      await adminPage.getByRole('button', { name: 'Прийняти товари', exact: true }).click()
      await adminPage.getByRole('button', { name: 'Провести', exact: true }).click()
      await expect(adminPage.getByText('Підсумок проведення', { exact: true })).toBeVisible()
      const received = await inspect(request)
      expect(received.products.find((p: Product) => p.id === created.id)).toMatchObject({ on_hand: 2, reserved: 0 })
      expect(received.movement_count).toBe(after.movement_count + 1)
      await expect(adminPage.getByText('На складі: 2 · Резерв: 0 · Доступно: 2', { exact: true })).toBeVisible()
    })

    for (const role of ['admin', 'poster'] as const) {
      test(`${role} replays lost draft, item and posting responses without duplicate stock`, async ({ page, request }) => {
        test.setTimeout(60_000)
        await login(page, state, role)
        await page.goto('/inventory/receiving')
        const createAttempts = await loseFirstResponse(page, `${root}/receipts`)
        await page.getByRole('button', { name: 'Створити чернетку', exact: true }).click()
        await expect(page.getByRole('button', { name: 'Повторити створення без дублювання', exact: true })).toBeVisible()
        await page.reload()
        await page.getByRole('button', { name: 'Повторити створення без дублювання', exact: true }).click()
        await expect(page).toHaveURL(url => /^\d+$/.test(url.searchParams.get('id') || ''))
        expect(createAttempts).toHaveLength(2)
        expect(createAttempts[1]).toEqual(createAttempts[0])
        const id = Number(new URL(page.url()).searchParams.get('id'))
        const itemAttempts = await loseFirstResponse(page, `${root}/receipts/${id}/items`)
        await scan(page, state.seed.products.available.barcode!)
        await expect(page.getByText('Знайдено:', { exact: false })).toBeVisible()
        await add(page)
        const retry = page.getByRole('button', { name: 'Повторити додавання', exact: true })
        await expect(retry).toBeVisible()
        const tuple = await page.evaluate(id => sessionStorage.getItem(`backoffice:inventory:receipt-item:${id}`), id)
        expect(tuple).toBeTruthy()
        page.once('dialog', dialog => dialog.accept())
        await page.reload()
        await expect(retry).toBeEnabled()
        expect(await page.evaluate(id => sessionStorage.getItem(`backoffice:inventory:receipt-item:${id}`), id)).toBe(tuple)
        await expect(page.getByRole('button', { name: 'Сканувати', exact: true })).toBeDisabled()
        await retry.click()
        await expect(retry).toHaveCount(0)
        expect(itemAttempts).toHaveLength(2)
        expect(itemAttempts[1]).toEqual(itemAttempts[0])
        expect((await receipt(request, state, id)).items).toMatchObject([{ quantity: 3, purchase_unit_cost: '15.50' }])
        expect((await receipt(request, state, id)).items).toHaveLength(1)
        const before = await inspect(request)
        expect(before.products.find((p: Product) => p.id === state.seed.products.available.id)).toMatchObject({ on_hand: 10, reserved: 2 })
        const postAttempts = await loseFirstResponse(page, `${root}/receipts/${id}/post`)
        await page.getByRole('button', { name: 'Прийняти товари', exact: true }).click()
        await page.getByRole('button', { name: 'Провести', exact: true }).click()
        await expect(page.getByRole('alert').first()).toBeVisible()
        await expect(page.getByText('Підсумок проведення', { exact: true })).toHaveCount(0)
        const committed = await inspect(request)
        expect(committed.products.find((p: Product) => p.id === state.seed.products.available.id)).toMatchObject({ on_hand: 13, reserved: 2 })
        expect(committed.movement_count).toBe(before.movement_count + 1)
        await page.getByRole('button', { name: 'Провести', exact: true }).click()
        await expect(page.getByText('Підсумок проведення', { exact: true })).toBeVisible()
        expect(postAttempts).toHaveLength(2)
        expect(postAttempts[1]).toEqual(postAttempts[0])
        expect(await inspect(request)).toEqual(committed)
        expect((await receipt(request, state, id)).status).toBe('posted')
        await expect(page.getByText('На складі: 13 · Резерв: 2 · Доступно: 11', { exact: true })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Сканувати', exact: true })).toBeDisabled()
      })
    }
  })
}
