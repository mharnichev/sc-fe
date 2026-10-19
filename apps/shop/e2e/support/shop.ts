import { expect, type APIRequestContext, type Page, type Request, request } from '@playwright/test'

export const TEST_PRODUCT = {
  id: 1153,
  slug: 'konditsioner-the-bluebeards-revenge-conditioner-300-ml-5060297002984',
  name: 'The BlueBeards Revenge Conditioner',
  unitPrice: 350,
}

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env || {}
const API_BASE = env.SHOP_API_BASE_URL || 'http://127.0.0.1:8000/api/v1/'
const ADMIN_EMAIL = env.SHOP_E2E_ADMIN_EMAIL || 'admin@barbershop.local'
const ADMIN_PASSWORD = env.SHOP_E2E_ADMIN_PASSWORD || 'admin123'

export const waitForNuxtHydration = async (page: Page) => {
  await page.waitForFunction(() => Boolean(
    (document.querySelector('#__nuxt') as HTMLElement & { __vue_app__?: unknown } | null)?.__vue_app__,
  ))
}

export const clearShopStorage = async (page: Page) => {
  await page.goto('/')
  await waitForNuxtHydration(page)
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.reload()
  await waitForNuxtHydration(page)
}

export const createInventoryFixture = async (ids = [TEST_PRODUCT.id]) => {
  expect(['127.0.0.1', 'localhost']).toContain(new URL(API_BASE).hostname)
  const loginContext = await request.newContext({ baseURL: API_BASE })
  const login = await loginContext.post('backoffice/auth/login', { form: { username: ADMIN_EMAIL, password: ADMIN_PASSWORD } })
  expect(login.ok(), `Local admin login failed: ${login.status()}`).toBeTruthy()
  const { access_token } = await login.json()
  const api = await request.newContext({ baseURL: API_BASE, extraHTTPHeaders: { Authorization: `Bearer ${access_token}` } })
  await loginContext.dispose()
  const originals = new Map<number, number>()
  const backorderSettings = new Map<number, { allow_backorder: boolean, barcode: string | null }>()
  const orderIds: number[] = []
  const available = async (id: number) => {
    const response = await api.get(`backoffice/products/${id}`)
    expect(response.ok(), await response.text()).toBeTruthy()
    const product = await response.json()
    expect(Number.isInteger(product.available_quantity)).toBeTruthy()
    return product.available_quantity as number
  }
  const setAvailable = async (id: number, quantity: number) => {
    const current = await available(id)
    const difference = quantity - current
    if (difference) {
      const response = await api.post(`backoffice/inventory/operations/${difference > 0 ? 'receipt' : 'write-off'}`, {
        headers: { 'Idempotency-Key': `shop-e2e-${id}-${Date.now()}-${Math.random()}` },
        data: { product_id: id, quantity: Math.abs(difference), reason: 'Local shop E2E inventory fixture' },
      })
      expect(response.ok(), await response.text()).toBeTruthy()
    }
    expect(await available(id)).toBe(quantity)
  }
  const setBackorder = async (id: number, value: boolean) => {
    if (!backorderSettings.has(id)) {
      const response = await api.get(`backoffice/products/${id}`)
      expect(response.ok(), await response.text()).toBeTruthy()
      const product = await response.json()
      backorderSettings.set(id, { allow_backorder: product.allow_backorder, barcode: product.barcode })
    }
    const response = await api.patch(`backoffice/inventory/products/${id}/settings`, { data: { allow_backorder: value, barcode: backorderSettings.get(id)!.barcode } })
    expect(response.ok(), await response.text()).toBeTruthy()
  }
  for (const id of ids) originals.set(id, await available(id))
  return {
    api, orderIds, setAvailable, setBackorder,
    restore: async () => {
      try {
        for (const id of orderIds) {
          const response = await api.patch(`backoffice/orders/${id}/status`, { data: { status: 'cancelled' } })
          expect(response.ok(), await response.text()).toBeTruthy()
        }
        for (const [id, quantity] of originals) await setAvailable(id, quantity)
        for (const [id, value] of backorderSettings) await setBackorder(id, value.allow_backorder)
      }
      finally { await api.dispose() }
    },
  }
}

// Legacy callers can still request an explicit local stock level; the inventory API
// verifies the resulting quantity instead of silently ignoring a product DTO field.
export const setTestProductStock = async (stock: number): Promise<APIRequestContext> => {
  const fixture = await createInventoryFixture()
  await fixture.setAvailable(TEST_PRODUCT.id, stock)
  return fixture.api
}

// Mobile has both a header action and a bottom bar: exercise its touch navigation.
export const cartButton = (page: Page) => (page.viewportSize()?.width || 1280) < 768
  ? page.locator('.base-bottom-bar').getByRole('button', { name: 'Кошик', exact: true })
  : page.getByRole('button', { name: 'Кошик', exact: true }).first()

export const cartBadge = (page: Page) => cartButton(page).locator('.shop-header__badge, .base-bottom-bar__count')

export const addTestProductFromPdp = async (page: Page) => {
  await page.goto(`/products/${TEST_PRODUCT.slug}`)
  await waitForNuxtHydration(page)
  await expect(page.getByRole('heading', { name: TEST_PRODUCT.name.toUpperCase() })).toBeVisible()
  await expect(page.getByRole('img', { name: /BlueBeards Revenge Conditioner/i })).toBeVisible()
  await expect(page.getByText('350,00 грн', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'ДОДАТИ В КОШИК' }).click()
  await expect(page.getByRole('button', { name: 'ПРИБРАТИ З КОШИКА' })).toBeVisible()
  await expect(cartBadge(page)).toHaveText('1')
}

export const openCart = async (page: Page) => {
  await cartButton(page).click()
  await expect(page.getByRole('tab', { name: 'КОШИК' })).toBeVisible()
}

export const goToCheckout = async (page: Page) => {
  await openCart(page)
  await page.getByRole('link', { name: 'ОФОРМЛЕННЯ' }).click()
  await expect(page).toHaveURL(/\/checkout\/purchase$/)
}

export const fillCheckout = async (page: Page) => {
  await page.getByLabel('ІМʼЯ').fill('E2E')
  await page.getByLabel('ПРІЗВИЩЕ').fill('Customer')
  await page.getByLabel('EMAIL').fill('e2e@example.com')
  await page.getByLabel('ТЕЛЕФОН').fill('+380990001234')
  return selectRealNovaPoshta(page)
}

export const selectRealNovaPoshta = async (page: Page) => {
  const citiesResponse = page.waitForResponse(r => r.url().includes('/delivery/np/settlements?') && r.request().method() === 'GET')
  await page.getByRole('combobox', { name: /^Місто$/i }).fill('Одеса')
  const cities = await citiesResponse
  expect(cities.status()).toBe(200)
  const city = (await cities.json()).items.find((item: { name: string }) => item.name === 'Одеса')
  expect(city?.ref).toBeTruthy()
  const branchesResponse = page.waitForResponse(r => r.url().includes('/delivery/np/branches?') && r.request().method() === 'GET')
  await page.getByRole('option', { name: city.label, exact: true }).click()
  const branches = await branchesResponse
  expect(branches.status()).toBe(200)
  const branch = (await branches.json()).items.find((item: { type: string, status: string }) => item.type === 'warehouse' && item.status === 'Working')
  expect(branch?.ref).toBeTruthy()
  await page.getByRole('combobox', { name: /^Відділення$/i }).click()
  await page.getByRole('option', { name: branch.label, exact: true }).click()
  return { city, branch }
}

export const installRuntimeDiagnostics = (page: Page) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const failedRequests: string[] = []
  const completedNoContentDeletes = new WeakSet<Request>()
  const completedNoContentAborts: string[] = []
  const failedResponses: string[] = []

  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('requestfailed', request => {
    const entry = `${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`
    // Chromium can abort the unread body AFTER fetch has resolved a valid 204.
    // Match the very same response-backed cart DELETE, never a pre-response abort.
    if (completedNoContentDeletes.has(request) && request.failure()?.errorText === 'net::ERR_ABORTED') {
      completedNoContentAborts.push(entry)
      return
    }
    failedRequests.push(entry)
  })
  page.on('response', response => {
    const request = response.request()
    if (response.status() === 204 && request.method() === 'DELETE'
      && /^\/api\/v1\/public\/customers\/cart\/\d+$/.test(new URL(request.url()).pathname)) {
      completedNoContentDeletes.add(request)
    }
    if (response.status() >= 400 && response.request().resourceType() !== 'image') {
      failedResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`)
    }
  })

  return {
    completedNoContentAborts,
    assertClean: (allowedResponsePatterns: RegExp[] = [], allowedConsolePatterns: RegExp[] = []) => {
      const unexpectedResponses = failedResponses.filter(entry => !allowedResponsePatterns.some(pattern => pattern.test(entry)))
      const unexpectedConsoleErrors = consoleErrors.filter(entry => !allowedConsolePatterns.some(pattern => pattern.test(entry)))
      if (completedNoContentAborts.length) console.info('Completed cart DELETE 204 body aborts:', completedNoContentAborts.length)
      expect(pageErrors, 'Uncaught browser errors').toEqual([])
      expect(failedRequests, 'Failed browser requests').toEqual([])
      expect(unexpectedResponses, 'Unexpected HTTP error responses').toEqual([])
      expect(unexpectedConsoleErrors, 'Unexpected browser console errors').toEqual([])
    },
  }
}
