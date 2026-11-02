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
      if (url.pathname.endsWith('/public/orders/me')) { await route.fulfill({ json: { items: [order], total: 1, page: 1, page_size: 10 } }); return }
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
      // Exercise router/shell persistence independently of the desktop sidebar.
      await page.evaluate(async path => {
        const app = (document.querySelector('#__nuxt') as HTMLElement & { __vue_app__?: { config: { globalProperties: { $router: { push: (path: string) => Promise<unknown> } } } } }).__vue_app__
        if (!app) throw new Error('Nuxt app is not mounted')
        await app.config.globalProperties.$router.push(path)
      }, path)
      await expect(page.locator(selector)).toBeVisible()
      await expect(page.locator('.cabinet-shell')).toHaveCount(1)
      expect(await shell!.evaluate(node => node.isConnected)).toBe(true)
      expect(await sidebar!.evaluate(node => node.isConnected)).toBe(true)
      await expect(page.locator('[data-testid="page-transition-overlay"]')).toHaveCSS('pointer-events', 'none')
      expect(await page.evaluate(() => (window as typeof window & { cabinetOverlayShown?: boolean }).cabinetOverlayShown)).toBe(false)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    expect(mutations).toEqual([])
    expect(external).toEqual([])
  })
}
