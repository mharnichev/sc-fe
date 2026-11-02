import { expect, test } from '@playwright/test'

for (const width of [390, 1440]) {
  test(`loader waits for the rendered page and recovers reused routes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    let holdBrands = false
    let pendingBrands = 0
    let releaseBrands!: () => void
    const gate = new Promise<void>(resolve => { releaseBrands = resolve })
    const writes: string[] = []
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url())
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort()
      if (!url.pathname.includes('/api/v1/')) return route.continue()
      if (request.method() !== 'GET') {
        writes.push(url.pathname)
        return route.fulfill({ status: 405, json: {} })
      }
      if (url.pathname.endsWith('/brands')) {
        if (holdBrands) { pendingBrands++; await gate }
        return route.fulfill({ json: { items: [{ id: 1, name: 'Fixture brand', slug: 'fixture-brand' }], total: 1 } })
      }
      return route.fulfill({ json: { items: [], total: 0 } })
    })
    await page.goto('contacts')
    await page.waitForFunction(() => {
      const app = (document.querySelector('#__nuxt') as HTMLElement & { __vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } } }).__vue_app__
      return app?.config.globalProperties.$nuxt?.isHydrating === false
    })
    const overlay = page.getByTestId('page-transition-overlay')
    await expect(overlay).toHaveAttribute('data-state', 'hidden')
    holdBrands = true
    // Use the rendered header link on desktop; the same real router is used
    // below for mobile, where this link is intentionally absent from the header.
    if (width === 1440) await page.locator('.shop-header').getByRole('link', { name: 'Бренди', exact: true }).click()
    else await page.evaluate(() => {
      const app = (document.querySelector('#__nuxt') as HTMLElement & { __vue_app__?: { config: { globalProperties: { $router: { push: (path: string) => unknown } } } } }).__vue_app__!
      void app.config.globalProperties.$router.push('/brands')
    })
    await expect.poll(() => pendingBrands).toBeGreaterThan(0)
    await page.waitForTimeout(1200)
    await expect(overlay).toHaveAttribute('data-state', 'visible')
    await expect(overlay).toHaveCSS('pointer-events', 'auto')
    const logo = overlay.locator('img')
    await expect.poll(() => logo.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
    await expect(overlay.locator('.page-transition-overlay__logo')).toHaveCSS('opacity', '1')
    await page.evaluate(async () => {
      const app = (document.querySelector('#__nuxt') as HTMLElement & { __vue_app__?: { config: { globalProperties: { $router: { push: (path: string) => Promise<unknown> } } } } }).__vue_app__!
      await app.config.globalProperties.$router.push('/brands')
    })
    await page.waitForTimeout(150)
    await expect(overlay).toHaveAttribute('data-state', 'visible')
    // Vue Router runs these guards after the overlay's guard. A failed or
    // superseded query must not take ownership of the pending brands page.
    await page.evaluate(async () => {
      const app = (document.querySelector('#__nuxt') as HTMLElement & { __vue_app__?: { config: { globalProperties: { $router: { beforeEach: (guard: (to: { query: Record<string, unknown> }) => unknown) => () => void, push: (path: string) => Promise<unknown> } } } } }).__vue_app__!
      const router = app.config.globalProperties.$router
      const remove = router.beforeEach(to => to.query.abort ? false : undefined)
      await router.push('/brands?abort=1')
      remove()
    })
    await expect(overlay).toHaveAttribute('data-state', 'visible')
    await page.evaluate(() => {
      const app = (document.querySelector('#__nuxt') as HTMLElement & { __vue_app__?: { config: { globalProperties: { $router: { beforeEach: (guard: (to: { query: Record<string, unknown> }) => unknown) => () => void, push: (path: string) => Promise<unknown> } } } } }).__vue_app__!
      const router = app.config.globalProperties.$router
      const state = window as typeof window & { transitionGuardReady?: boolean, releaseTransitionGuard?: () => void, transitionGuardDone?: Promise<unknown> }
      const gate = new Promise<void>(resolve => { state.releaseTransitionGuard = resolve })
      const remove = router.beforeEach(async to => {
        if (to.query.cancel) { state.transitionGuardReady = true; await gate }
      })
      state.transitionGuardDone = router.push('/brands?cancel=1').finally(remove)
    })
    await page.waitForFunction(() => (window as typeof window & { transitionGuardReady?: boolean }).transitionGuardReady)
    await page.evaluate(async () => {
      const app = (document.querySelector('#__nuxt') as HTMLElement & { __vue_app__?: { config: { globalProperties: { $router: { push: (path: string) => Promise<unknown> } } } } }).__vue_app__!
      const state = window as typeof window & { releaseTransitionGuard?: () => void, transitionGuardDone?: Promise<unknown> }
      await app.config.globalProperties.$router.push('/brands')
      state.releaseTransitionGuard!()
      await state.transitionGuardDone
    })
    await expect(overlay).toHaveAttribute('data-state', 'visible')
    releaseBrands()
    await expect(page.locator('.brands-page')).toBeVisible()
    await expect(overlay).toHaveAttribute('data-state', 'hidden')
    for (const path of ['/brands?probe=1', '/brands?probe=1#brand-F', '/contacts']) {
      await page.evaluate(path => {
        const app = (document.querySelector('#__nuxt') as HTMLElement & { __vue_app__?: { config: { globalProperties: { $router: { push: (path: string) => unknown } } } } }).__vue_app__!
        void app.config.globalProperties.$router.push(path)
      }, path)
      await expect(page).toHaveURL(new RegExp(path.replace(/[?]/g, '\\?') + '$'))
      await expect(overlay).toHaveAttribute('data-state', 'hidden')
      await expect(overlay).toHaveCSS('pointer-events', 'none')
    }
    await page.goBack()
    await expect(page).toHaveURL(/\/brands\?probe=1#brand-F$/)
    await expect(overlay).toHaveAttribute('data-state', 'hidden')
    await page.goForward()
    await expect(page).toHaveURL(/\/contacts$/)
    await expect(overlay).toHaveAttribute('data-state', 'hidden')
    expect(writes).toEqual([])
  })
}

test('a synchronous replacement releases the overlay while the previous page is still pending', async ({ page }) => {
  let releaseBrands!: () => void
  const gate = new Promise<void>(resolve => { releaseBrands = resolve })
  let brandsPending = false
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort()
    if (!url.pathname.includes('/api/v1/')) return route.continue()
    if (request.method() !== 'GET') return route.fulfill({ status: 405, json: {} })
    if (url.pathname.endsWith('/brands')) { brandsPending = true; await gate }
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('contacts')
  await page.waitForFunction(() => {
    const app = (document.querySelector('#__nuxt') as HTMLElement & { __vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } } }).__vue_app__
    return app?.config.globalProperties.$nuxt?.isHydrating === false
  })
  const push = (path: string) => page.evaluate(path => {
    const app = (document.querySelector('#__nuxt') as HTMLElement & { __vue_app__?: { config: { globalProperties: { $router: { push: (path: string) => unknown } } } } }).__vue_app__!
    void app.config.globalProperties.$router.push(path)
  }, path)
  await push('/brands')
  await expect.poll(() => brandsPending).toBe(true)
  const overlay = page.getByTestId('page-transition-overlay')
  await expect(overlay).toHaveAttribute('data-state', 'visible')
  await push('/contacts')
  await expect(page).toHaveURL(/\/contacts$/)
  await expect(overlay).toHaveAttribute('data-state', 'hidden')
  releaseBrands()
  await expect(overlay).toHaveAttribute('data-state', 'hidden')
})
