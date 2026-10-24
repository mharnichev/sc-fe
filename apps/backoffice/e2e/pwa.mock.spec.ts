import { expect, test, type Page } from '@playwright/test'
const actor = { id: 51, email: 'master@example.test', full_name: 'Fixture Master', role: 'barber', master_id: 7, is_active: true, is_superuser: false }
async function fixture(page: Page, authenticated = false) {
  const mutations: string[] = []
  if (authenticated) await page.addInitScript(user => {
    localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', refreshToken: 'fixture-refresh', user }))
  }, actor)
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    return ['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort()
  })
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    if (route.request().method() !== 'GET') { mutations.push(path); return route.fulfill({ status: 503, json: { detail: 'Fixture connection failure' } }) }
    if (path.endsWith('/auth/me')) return route.fulfill({ json: actor })
    if (path.endsWith('/masters')) return route.fulfill({ json: [{ id: 7, admin_user_id: 51, name: 'Fixture Master', first_name: 'Fixture', last_name: 'Master', is_active: true, services: [] }] })
    if (/\/services|\/time-blocks|\/availability|\/bookings/.test(path)) return route.fulfill({ json: [] })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  return mutations
}
const install = (page: Page) => page.getByRole('button', { name: 'Додати на головний екран', exact: true })

test('manifest, metadata and real square PNG icons; no service worker', async ({ page, request }) => {
  await fixture(page)
  await page.goto('/login')
  const manifest = await request.get('/manifest.webmanifest')
  expect(manifest.ok()).toBeTruthy()
  const data = await manifest.json()
  expect(data).toMatchObject({ id: '/', start_url: '/', scope: '/', display: 'standalone', name: 'Soul Cuts Backoffice' })
  for (const [url, size] of [['/icons/apple-touch-icon.png', 180], ['/icons/icon-192.png', 192], ['/icons/icon-512.png', 512]] as const) {
    const response = await request.get(url), png = await response.body()
    expect(response.headers()['content-type']).toContain('image/png')
    expect(png.readUInt32BE(16)).toBe(size); expect(png.readUInt32BE(20)).toBe(size)
  }
  expect(await page.locator('meta[name="viewport"]').getAttribute('content')).toContain('viewport-fit=cover')
  expect(await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')).toBe('/icons/apple-touch-icon.png')
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0)
})

test('help is manual, localized, repeatable, responsive and hidden on desktop', async ({ page }, info) => {
  await fixture(page)
  await page.goto('/login')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  if (info.project.name === 'desktop') { await expect(install(page)).toHaveCount(0); return }
  for (let i = 0; i < 3; i++) {
    await install(page).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText(/Відкрити як вебпрограму/)).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveJSProperty('scrollWidth', await page.getByRole('dialog').evaluate(el => el.clientWidth))
    if (i === 0) {
      await page.screenshot({ path: `/tmp/backoffice-pwa-help-${info.project.name}-uk.png` })
      await page.getByRole('button', { name: 'English', exact: true }).click()
      await expect(page.getByText(/Enable Open as Web App/)).toBeVisible()
      await page.screenshot({ path: `/tmp/backoffice-pwa-help-${info.project.name}-en.png` })
      await page.getByRole('button', { name: 'Українська', exact: true }).click()
    }
    await page.getByRole('button', { name: 'Закрити', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(await page.evaluate(() => document.body.style.position)).toBe('')
  }
  await page.getByLabel('Email', { exact: true }).fill('fixture@example.test')
  await expect(page.getByLabel('Email', { exact: true })).toBeFocused()
  await page.setViewportSize({ width: 390, height: 420 })
  await install(page).click()
  await page.getByRole('button', { name: 'Закрити', exact: true }).click()
  await page.getByRole('button', { name: /світлу тему/i }).click()
  await install(page).click()
  await page.screenshot({ path: `/tmp/backoffice-pwa-help-${info.project.name}-light.png` })
})

test('installed mode suppresses help; offline banner recovers without mutations', async ({ page, context }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true, configurable: true }))
  const mutations = await fixture(page, true)
  await page.goto('/bookings')
  await expect(install(page)).toHaveCount(0)
  await expect(page.locator('main')).toBeVisible()
  await expect(page.locator('.booking-calendar-grid')).toBeVisible()
  await context.setOffline(true)
  await expect(page.getByRole('alert')).toContainText('Offline')
  await context.setOffline(false)
  await expect(page.getByRole('alert')).toContainText('Back online')
  await page.getByRole('button', { name: 'Закрити / Dismiss' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.goto('/my-services')
  await expect(page.getByRole('heading', { name: 'Мої послуги', exact: true })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/bookings$/)
  await expect(page.locator('.booking-calendar-grid')).toBeVisible()
  await page.goForward()
  await expect(page).toHaveURL(/\/my-services$/)
  expect(mutations).toEqual([])
})


test('calendar help, landscape menu and display-mode detection', async ({ page }, info) => {
  await fixture(page, true)
  await page.goto('/bookings')
  await expect(page.locator('.booking-calendar-grid')).toBeVisible()
  if (info.project.name === 'desktop') return
  await install(page).click()
  await page.getByRole('button', { name: 'Закрити', exact: true }).click()
  await page.setViewportSize({ width: 844, height: 390 })
  await page.getByRole('button', { name: 'Відкрити меню', exact: true }).click()
  await expect(page.locator('#backoffice-mobile-menu')).toBeVisible()
  await page.getByRole('button', { name: 'Закрити меню', exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window)
    window.matchMedia = query => {
      const result = original(query)
      if (query === '(display-mode: standalone)') Object.defineProperty(result, 'matches', { value: true })
      return result
    }
  })
  await page.reload()
  await expect(install(page)).toHaveCount(0)
})
