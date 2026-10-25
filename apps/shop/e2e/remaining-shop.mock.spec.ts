import { expect, test } from '@playwright/test'

const product = { id: 123, name: 'Synthetic product', slug: 'synthetic-product', price: '100.00', images: [], brand: { id: 1, name: 'Fixture', slug: 'fixture' }, is_available_for_purchase: true, is_effectively_visible: true }
const customer = { id: 10, name: 'Synthetic', surname: 'Buyer', email: 'fixture@example.test', phone: '+380990001234' }

for (const width of [390, 1440]) {
  test(`pilot checkpoints and terms remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const mutations: Array<{ path: string, revision?: string, body: unknown }> = []
    await page.route('https://**', route => route.abort())
    await page.addInitScript(({ product, customer }) => {
      localStorage.setItem('shop-cart', JSON.stringify({ ownerScope: 'customer:10', items: [{ product, quantity: 1 }] }))
      localStorage.setItem('shop-customer-auth', JSON.stringify({ accessToken: 'synthetic-pilot', tokenType: 'Bearer', customer }))
    }, { product, customer })
    await page.route('**/api/v1/**', async route => {
      const request = route.request(), path = new URL(request.url()).pathname
      if (request.method() === 'POST') {
        expect(['/api/v1/public/checkout-reminders/checkpoint', '/api/v1/public/checkout-reminders/cancel']).toContain(path)
        mutations.push({ path, revision: request.headers()['x-checkout-revision'], body: request.postDataJSON() })
        await route.fulfill({ json: {} }); return
      }
      expect(request.method()).toBe('GET')
      if (path.endsWith('/checkout-reminders/capabilities')) {
        expect(request.headers().authorization).toBe('Bearer synthetic-pilot')
        await route.fulfill({ json: { enabled: true, dry_run: true } }); return
      }
      if (path.endsWith('/customers/me')) { await route.fulfill({ json: customer }); return }
      if (path.endsWith('/customers/cart')) { await route.fulfill({ json: { items: [{ id: 1, product_id: 123, product, quantity: 1 }], total: 1 } }); return }
      await route.fulfill({ json: { items: [], total: 0, enabled: false } })
    })
    await page.goto('checkout/purchase')
    await expect(page.getByText('Тестовий режим нагадування: лист не буде надіслано.')).toBeVisible()
    const email = page.getByLabel('Email', { exact: true })
    await email.fill('synthetic@example.test')
    await email.press('Enter')
    await expect.poll(() => mutations.filter(item => item.path.endsWith('/checkpoint')).length).toBe(1)
    expect(mutations[0]?.revision).toBe('1')
    await email.fill('changed@example.test')
    await expect.poll(() => mutations.filter(item => item.path.endsWith('/cancel')).length).toBe(1)
    expect(mutations.at(-1)?.revision).toBe('2')
    await page.getByRole('button', { name: 'Умови доставки та оплати', exact: true }).filter({ visible: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect.poll(async () => {
      const box = await page.locator('.base-modal__container').boundingBox()
      return Boolean(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= 901)
    }).toBe(true)
    await expect(page.locator('.base-modal-enter-active')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `../../output/remaining-shop/terms-${width}.png` })
  })
}

test('deployed recovery strips capability before hydration, no automatic recovery POST, logo is served as PNG', async ({ page, request }) => {
  const posts: string[] = []
  await page.route('https://**', route => route.abort())
  await page.route('**/api/v1/**', async route => {
    if (route.request().method() !== 'GET') posts.push(route.request().url())
    await route.fulfill({ json: { items: [], total: 0, enabled: false } })
  })
  await page.goto(`checkout/recover#token=${'A'.repeat(43)}`)
  await expect(page).toHaveURL('http://127.0.0.1:6087/shop/checkout/recover')
  expect(await page.evaluate(() => '__scCheckoutRecoveryToken' in window)).toBe(false)
  expect(posts).toEqual([])
  const logo = await request.get('soulcuts/sc-logo-email.png')
  expect(logo.headers()['content-type']).toContain('image/png')
  expect((await logo.body()).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
})

for (const owner of ['customer:10', 'customer:11', 'malformed']) {
  test(`recovery refuses an unresolved ${owner} intent without changing the original cart or intent`, async ({ page }) => {
    const saved = owner === 'malformed' ? '{broken' : JSON.stringify({ key: 'a'.repeat(36), scope: owner, body: { items: [{ product_id: product.id, quantity: 1 }] } })
    const posts: string[] = []
    await page.route('https://**', route => route.abort())
    await page.addInitScript(({ product, customer, saved }) => {
      localStorage.setItem('shop-cart', JSON.stringify({ ownerScope: 'customer:10', items: [{ product, quantity: 1 }] }))
      localStorage.setItem('shop-customer-auth', JSON.stringify({ accessToken: 'synthetic-pilot', tokenType: 'Bearer', customer }))
      sessionStorage.setItem('shop-checkout-intent-v1', saved)
    }, { product, customer, saved })
    await page.route('**/api/v1/**', async route => {
      const req = route.request(), path = new URL(req.url()).pathname
      if (req.method() === 'POST') {
        posts.push(path)
        expect(path).toBe('/api/v1/public/checkout-reminders/recover')
        await route.fulfill({ json: { checkout_key: 'b'.repeat(64), locale: 'en', changes: [], items: [{ product_id: 124, quantity: 2, product: { ...product, id: 124, slug: 'recovered-product', name: 'Recovered product' } }] } }); return
      }
      expect(req.method()).toBe('GET')
      if (path.endsWith('/customers/me')) { await route.fulfill({ json: customer }); return }
      if (path.endsWith('/customers/cart')) { await route.fulfill({ json: { items: [{ id: 1, product_id: product.id, product, quantity: 1 }], total: 1 } }); return }
      await route.fulfill({ json: { items: [], total: 0, enabled: false } })
    })
    await page.goto(`checkout/recover#token=${'A'.repeat(43)}`)
    await page.getByRole('button', { name: 'Переглянути збережені товари', exact: true }).click()
    await expect(page.getByText('Recovered product', { exact: true })).toBeVisible()
    await page.locator('label[for="confirm-recovered-checkout"]').click()
    await page.getByRole('button', { name: 'Use these items for checkout', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('previous checkout request')
    await expect(page).toHaveURL('http://127.0.0.1:6087/shop/checkout/recover')
    expect(await page.evaluate(() => sessionStorage.getItem('shop-checkout-intent-v1'))).toBe(saved)
    expect(await page.evaluate(() => sessionStorage.getItem('shop-checkout-reminder-order-v1:customer:10'))).toBeNull()
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shop-cart') || '{}').items.map((item: { product: { id: number } }) => item.product.id))).toEqual([123])
    expect(posts).toEqual(['/api/v1/public/checkout-reminders/recover'])
  })
}
