import { expect, test } from '@playwright/test'

const customer = { id: 10, name: 'Synthetic', surname: 'Buyer', email: 'fixture@example.test', phone: '+380990001234' }
const order = { id: 321, status: 'pending', created_at: '2026-10-17T12:00:00Z', subtotal_amount: '100', total_amount: '100', discount_amount: '0', item_count: 1, items: [], payment_status: 'unpaid', payment_method: 'cashOnDelivery', shipments: [] }

for (const width of [390, 1440]) {
  test(`cabinet keeps one shell across all child pages at ${width}px`, async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin
    const mutations: string[] = []
    const external: string[] = []
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(customer => {
      localStorage.setItem('shop-customer-auth', JSON.stringify({ accessToken: 'synthetic-cabinet', tokenType: 'Bearer', customer }))
    }, customer)
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url())
      const mockApi = ['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname.includes('/api/v1/')
      if (!mockApi) {
        if (url.origin !== origin) { external.push(url.origin); await route.abort(); return }
        await route.continue(); return
      }
      if (request.method() !== 'GET') {
        mutations.push(url.pathname)
        await route.fulfill({ status: 405, json: {} }); return
      }
      if (url.pathname.endsWith('/public/customers/me')) { await route.fulfill({ json: customer }); return }
      if (url.pathname.endsWith('/public/orders/me/321')) { await route.fulfill({ json: order }); return }
      if (url.pathname.endsWith('/public/orders/me')) { await route.fulfill({ json: { items: [order], total: 11, page: Number(url.searchParams.get('page')) || 1, page_size: 10 } }); return }
      await route.fulfill({ json: { items: [], total: 0, enabled: false } })
    })
    await page.goto('cabinet')
    await expect(page.locator('.cabinet-overview')).toBeVisible()
    const shell = await page.locator('.cabinet-shell').elementHandle()
    const sidebar = await page.locator('.cabinet-shell__sidebar').elementHandle()
    expect(shell).not.toBeNull()
    expect(sidebar).not.toBeNull()
    await expect(page.locator('[data-testid="page-transition-overlay"]')).toHaveCSS('pointer-events', 'none')
    const transitionLogo = page.locator('.page-transition-overlay__logo img')
    await expect(transitionLogo).toHaveAttribute('src', '/shop/soulcuts/sc-logo-name-dark.webp')
    await expect.poll(() => transitionLogo.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
    await page.evaluate(() => {
      const state = window as typeof window & { cabinetOverlayShown?: boolean }
      state.cabinetOverlayShown = false
      const overlay = document.querySelector('[data-testid="page-transition-overlay"]')!
      new MutationObserver(() => {
        if (getComputedStyle(overlay).pointerEvents === 'auto') state.cabinetOverlayShown = true
      }).observe(overlay, { attributes: true })
    })
    const steps = [
      ['/cabinet/settings', '.cabinet-settings'],
      ['/cabinet', '.cabinet-overview'],
      ['/cabinet/purchase-history', '.purchase-history'],
      ['/cabinet/orders/321', '.order-detail'],
      ['/cabinet/favorites', '.cabinet-favorites'],
      ['/cabinet/contact', '.account-contact'],
      ['/cabinet/shop-rules', '.account-rules'],
      ['/cabinet', '.cabinet-overview'],
    ]
    for (const [path, selector] of steps) {
      if (path === '/cabinet/orders/321') {
        await page.locator(`.purchase-history a[href$="${path}"]`).first().click()
      } else if (width >= 768) {
        await page.locator(`.cabinet-shell__nav a[href$="${path}"]`).click()
      } else {
        await page.locator('.base-bottom-bar__btn--account').click()
        await page.locator(`.cabinet-sidebar a[href$="${path}"]`).click()
        await expect(page.getByRole('dialog')).toHaveCount(0)
      }
      await expect(page.locator(selector)).toBeVisible()
      await expect(page.locator('.cabinet-shell')).toHaveCount(1)
      expect(await shell!.evaluate(node => node.isConnected)).toBe(true)
      expect(await sidebar!.evaluate(node => node.isConnected)).toBe(true)
      await expect(page.locator('[data-testid="page-transition-overlay"]')).toHaveCSS('pointer-events', 'none')
      expect(await page.evaluate(() => (window as typeof window & { cabinetOverlayShown?: boolean }).cabinetOverlayShown)).toBe(false)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await page.goBack()
    await expect(page.locator('.account-rules')).toBeVisible()
    await page.goForward()
    await expect(page.locator('.cabinet-overview')).toBeVisible()
    if (width >= 768) await page.locator('.cabinet-shell__nav a[href$="/cabinet/purchase-history"]').click()
    else {
      await page.locator('.base-bottom-bar__btn--account').click()
      await page.locator('.cabinet-sidebar a[href$="/cabinet/purchase-history"]').click()
    }
    await expect(page.locator('.purchase-history')).toBeVisible()
    await page.locator('.purchase-history').getByRole('button', { name: 'Далі', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Сторінка 2', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(page).toHaveURL(/\/cabinet\/purchase-history\?page=2$/)
    await page.goBack()
    await expect(page.getByRole('button', { name: 'Сторінка 1', exact: true })).toHaveAttribute('aria-current', 'page')
    await page.goForward()
    await expect(page.getByRole('button', { name: 'Сторінка 2', exact: true })).toHaveAttribute('aria-current', 'page')
    expect(await shell!.evaluate(node => node.isConnected)).toBe(true)
    expect(await sidebar!.evaluate(node => node.isConnected)).toBe(true)
    expect(await page.evaluate(() => (window as typeof window & { cabinetOverlayShown?: boolean }).cabinetOverlayShown)).toBe(false)
    expect(mutations).toEqual([])
    expect(external).toEqual([])
  })
}

test('unauthenticated cabinet entry redirects safely without private requests', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin
  const privateRequests: string[] = []
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.pathname.includes('/api/v1/')) {
      if (request.method() !== 'GET' || /\/orders\/me|\/customers\/(me|cart|favorites)/.test(url.pathname)) privateRequests.push(url.pathname)
      await route.fulfill({ json: { items: [], total: 0, enabled: false } }); return
    }
    if (url.origin !== origin) { await route.abort(); return }
    await route.continue()
  })
  await page.goto('cabinet/purchase-history')
  await expect(page).toHaveURL(new URL('./', baseURL!).href)
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.locator('.cabinet-shell')).toHaveCount(0)
  expect(privateRequests).toEqual([])
})
