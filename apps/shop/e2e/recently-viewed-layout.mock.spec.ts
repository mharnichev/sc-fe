import { expect, test, type Page } from '@playwright/test'

const products = Array.from({ length: 8 }, (_, index) => ({
  id: index + 9100, category_id: 1, brand_id: 1,
  name: index === 0 ? 'The BlueBeards Revenge Professional Shampoo Long Product Name For Daily Hair Care' : `Fixture grooming product ${index + 1}`,
  name_en: `Fixture grooming product ${index + 1}`, product_type: 'Шампунь для щоденного догляду', product_type_en: 'Daily shampoo',
  package_size: '500 мл', slug: `recent-fixture-${index + 1}`, sku: `RECENT-${index + 1}`,
  short_description: null, description: 'Mocked product', price: '12345.00', shop_price: '12345.00', compare_at_price: '15000.00', stock: 10,
  status: 'active', seo_title: null, seo_description: null, meta_keywords: null,
  category: { id: 1, name: 'Шампуні', name_en: 'Shampoo', slug: 'shampoo', parent_id: null },
  brand: { id: 1, name: 'Fixture', slug: 'fixture' },
  images: [{ id: index + 1, image: '/recent-fixture.svg', image_url: '/recent-fixture.svg', alt: 'Fixture bottle', sort_order: 0 }],
  category_tree: [], average_rating: '4.8', reviews_count: 12, parameters: {}, is_effectively_visible: true, is_available_for_purchase: true,
}))

async function fixture(page: Page) {
  const writes: string[] = []
  await page.addInitScript(products => {
    localStorage.setItem('shop-recently-viewed', JSON.stringify({ version: 1, products }))
  }, products)
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    return ['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort()
  })
  await page.route('**/api/v1/**', route => {
    const request = route.request(), url = new URL(request.url())
    if (request.method() !== 'GET') {
      writes.push(`${request.method()} ${url.pathname}`)
      return route.fulfill({ status: 403, json: { detail: 'Mock fixture blocks mutations' } })
    }
    if (url.pathname.endsWith('/products')) return route.fulfill({ json: { items: url.searchParams.get('is_top') === 'true' ? [] : products, total: products.length, limit: 12, offset: 0 } })
    if (url.pathname.includes('/products/by-slug/')) return route.fulfill({ json: products[0] })
    if (url.pathname.endsWith('/brands') || url.pathname.endsWith('/categories')) return route.fulfill({ json: [] })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.route('**/recent-fixture.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#f3f3f3"/><rect x="110" y="55" width="80" height="190" rx="12" fill="#203f4f"/><text x="150" y="145" fill="white" text-anchor="middle">FIXTURE</text></svg>' }))
  // Start on a page without product SSR data; navigate through Nuxt so all catalog requests use the browser mocks.
  await page.goto('contacts')
  await page.waitForFunction(() => {
    const app = (document.querySelector('#__nuxt') as HTMLElement & { __vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } } } | null)?.__vue_app__
    return app?.config.globalProperties.$nuxt?.isHydrating === false
  })
  await page.locator('a[href="/shop/"]:visible').first().click()
  await expect(page).toHaveURL(/\/shop\/$/)
  return writes
}

for (const width of [320, 390, 768, 1440]) {
  test(`recently viewed tiles match catalog and remain locally scrollable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 568 ? 844 : 1000 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const writes = await fixture(page)
    const grid = page.locator('.catalog-product-grid').first()
    const recent = page.locator('.recently-viewed-products')
    const viewport = recent.locator('.recently-viewed-products__viewport')
    await expect(grid.locator('.catalog-product-tile')).toHaveCount(products.length)
    await expect(recent.locator('.catalog-product-tile')).toHaveCount(products.length)
    await recent.scrollIntoViewIfNeeded()
    await expect.poll(async () => {
      const [a, b] = await Promise.all([grid.locator('.catalog-product-tile').first().boundingBox(), recent.locator('.catalog-product-tile').first().boundingBox()])
      return Math.abs(a!.width - b!.width)
    }).toBeLessThanOrEqual(1)
    const [catalogBox, recentBox] = await Promise.all([grid.locator('.catalog-product-tile').first().boundingBox(), recent.locator('.catalog-product-tile').first().boundingBox()])
    console.info(`${width}px: catalog ${catalogBox!.width.toFixed(2)}×${catalogBox!.height.toFixed(2)}, recently viewed ${recentBox!.width.toFixed(2)}×${recentBox!.height.toFixed(2)}`)
    expect(Math.abs(catalogBox!.height - recentBox!.height)).toBeLessThanOrEqual(1)
    if (width < 568) {
      const name = await recent.locator('.catalog-product-tile__mobile-name').first().boundingBox()
      expect(name!.width).toBeGreaterThanOrEqual(recentBox!.width - 40)
      const purchase = recent.locator('.catalog-product-tile__mobile-purchase-row').first()
      const badge = purchase.locator('.catalog-product-tile__volume')
      expect(await badge.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
      expect(await badge.evaluate(element => {
        const style = getComputedStyle(element)
        return element.getBoundingClientRect().height <= Number.parseFloat(style.lineHeight) + Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom) + 3
      })).toBe(true)
      const [badgeBox, buttonBox] = await Promise.all([badge.boundingBox(), purchase.locator('.catalog-product-tile__cart').boundingBox()])
      expect(badgeBox!.x + badgeBox!.width <= buttonBox!.x + 1 || badgeBox!.y + badgeBox!.height <= buttonBox!.y + 1).toBe(true)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    const fitted = await recent.locator('.catalog-product-tile').first().evaluate(tile => {
      const box = tile.getBoundingClientRect()
      return [...tile.querySelectorAll<HTMLElement>('.catalog-product-tile__price, .catalog-product-tile__cart')]
        .filter(element => element.getBoundingClientRect().width > 0)
        .every(element => { const rect = element.getBoundingClientRect(); return rect.left >= box.left - 1 && rect.right <= box.right + 1 })
    })
    expect(fitted).toBe(true)
    await page.screenshot({ path: `output/recently-viewed-preview/${width}-start.png`, animations: 'disabled' })
    await expect(page.locator('vite-error-overlay')).toHaveCount(0)
    await expect(page.locator('vite-plugin-checker-error-overlay')).toHaveCount(0)
    await recent.screenshot({ path: `output/recently-viewed-preview/${width}-block.png`, animations: 'disabled' })
    expect(await viewport.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
    await viewport.evaluate(element => { element.scrollLeft = element.scrollWidth })
    await expect.poll(() => viewport.evaluate(element => element.scrollWidth - element.clientWidth - element.scrollLeft)).toBeLessThanOrEqual(2)
    const [last, view] = await Promise.all([recent.locator('.recently-viewed-products__item').last().boundingBox(), viewport.boundingBox()])
    expect(last!.x + last!.width).toBeLessThanOrEqual(view!.x + view!.width + 2)
    if (width >= 568) await expect(recent.getByRole('button', { name: 'Наступні переглянуті товари', exact: true })).toBeDisabled()
    await page.screenshot({ path: `output/recently-viewed-preview/${width}-end.png`, animations: 'disabled' })
    expect(writes).toEqual([])
  })
}
