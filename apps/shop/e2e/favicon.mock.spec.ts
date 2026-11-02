import { expect, test } from '@playwright/test'

test('Shop head exposes prepared favicon assets under its mounted base with correct MIME', async ({ page, baseURL, request }) => {
  const origin = new URL(baseURL!).origin
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.includes('/api/v1/')) return route.fulfill({ json: { items: [], total: 0 } })
    if (url.origin !== origin) return route.abort()
    return route.continue()
  })
  await page.goto('contacts')
  for (const [name, rel, mime] of [
    ['favicon.ico', 'icon', /image\/(?:x-icon|vnd\.microsoft\.icon)/],
    ['favicon-96x96.png', 'icon', /image\/png/],
    ['favicon.svg', 'icon', /image\/svg\+xml/],
    ['apple-touch-icon.png', 'apple-touch-icon', /image\/png/],
  ] as const) {
    const url = new URL(name, baseURL!)
    await expect(page.locator(`head link[rel="${rel}"][href="${url.pathname}"]`)).toHaveCount(1)
    const response = await request.get(url.href)
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toMatch(mime)
    expect((await response.body()).length).toBeGreaterThan(100)
  }
})
