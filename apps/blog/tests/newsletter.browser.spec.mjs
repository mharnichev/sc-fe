import { expect, test } from '../../shop/node_modules/@playwright/test/index.mjs'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.cookie = 'blog-locale=en; path=/'
    window.__newsletterAnalytics = []
    window.gtag = (...args) => window.__newsletterAnalytics.push(args)
  })
  await page.route('**/public/blog/**', route => route.fulfill({ json: { items: [], total: 0 } }))
})

test('email alone cannot unsubscribe', async ({ page }) => {
  let calls = 0
  await page.route('**/public/blog/unsubscribe', route => { calls++; return route.fulfill({ json: {} }) })
  await page.goto('/newsletter/unsubscribe?email=reader@example.com')
  await expect(page.getByRole('alert')).toContainText('personal unsubscribe link')
  await expect(page.getByRole('button', { name: 'Unsubscribe', exact: true })).toBeDisabled()
  expect(calls).toBe(0)
})

test('letter capability supports unsubscribe then explicit resubscribe without public token', async ({ page }) => {
  const bodies = []
  await page.route('**/public/blog/unsubscribe', route => {
    bodies.push(route.request().postDataJSON())
    return route.fulfill({ json: { email: 'reader@example.com', status: 'unsubscribed', is_subscribed: false } })
  })
  await page.route('**/public/blog/subscribe', route => {
    bodies.push(route.request().postDataJSON())
    return route.fulfill({ json: { email: 'reader@example.com', status: 'subscribed', is_subscribed: true } })
  })
  await page.goto('/newsletter/unsubscribe?token=SECRET123&email=reader@example.com')
  await expect(page).toHaveURL(/\/newsletter\/unsubscribe$/)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow')
  await page.getByRole('button', { name: 'Unsubscribe', exact: true }).click()
  await page.getByRole('button', { name: 'Resubscribe', exact: true }).click()
  await expect.poll(() => bodies.length).toBe(2)
  expect(bodies[0].token).toBe('SECRET123')
  expect(bodies[1].confirmation_token).toBe('SECRET123')
  const { confirmation_token: _proof, ...attribution } = bodies[1]
  expect(JSON.stringify(attribution)).not.toContain('SECRET123')
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer')
  const stored = await page.evaluate(() => ({ history: history.state, local: { ...localStorage }, session: { ...sessionStorage } }))
  expect(JSON.stringify(stored)).not.toContain('SECRET123')
  expect(JSON.stringify(await page.evaluate(() => window.__newsletterAnalytics))).not.toContain('SECRET123')
  await page.waitForTimeout(11000)
  expect(await page.evaluate(() => window.__newsletterAnalytics)).toEqual([])
  await expect(page.locator('#blog-google-analytics-gtag')).toHaveCount(0)
  expect(await page.evaluate(() => window['ga-disable-G-YYYXH2R239'])).toBe(true)
})

test('modal displays useful 403 guidance and sends supplied confirmation proof', async ({ page }) => {
  let body = {}
  await page.route('**/public/blog/subscribe', route => {
    body = route.request().postDataJSON()
    return route.fulfill({ status: 403, json: { detail: 'A valid personal confirmation token is required to resubscribe' } })
  })
  await page.goto('/?confirmation_token=SECRET123')
  await page.locator('#footer-newsletter-email').fill('reader@example.com')
  await page.locator('footer').getByRole('button', { name: 'Subscribe', exact: true }).click()
  await page.locator('#subscribe-modal-email').fill('reader@example.com')
  await page.locator('#subscribe-modal-form').getByRole('button', { name: 'Resubscribe', exact: true }).click()
  await expect(page.locator('#subscribe-modal-message')).toContainText('personal link from a previous newsletter')
  expect(body.confirmation_token).toBe('SECRET123')
  await expect(page).toHaveURL('http://localhost:5050/')
  const stored = await page.evaluate(() => ({ history: history.state, local: { ...localStorage }, session: { ...sessionStorage } }))
  expect(JSON.stringify(stored)).not.toContain('SECRET123')
  expect(await page.evaluate(() => window.__newsletterAnalytics)).toEqual([])
  await expect(page.locator('#blog-google-analytics-gtag')).toHaveCount(0)
})
