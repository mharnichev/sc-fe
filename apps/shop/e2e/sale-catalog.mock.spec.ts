import { expect, test, type Page } from '@playwright/test'

const category = { id: 2, name: 'Fixture category', name_en: 'Fixture category', slug: 'fixture-category', children: [], description: null }
const tree = [{ id: 1, name: 'Fixture root', slug: 'fixture-root', children: [category], description: null }]
const brand = { id: 1, name: 'Fixture brand', slug: 'fixture-brand', description: null }
const products = Array.from({ length: 6 }, (_, index) => ({
  id: 100 + index, name: `Sale fixture ${index + 1}`, slug: `sale-fixture-${index + 1}`,
  price: '100.00', compare_at_price: '150.00', stock: 10, category_id: 2, brand_id: 1, category, brand,
  images: [{ image: '/sale-fixture.svg', alt: 'Fixture bottle' }],
  is_effectively_visible: true, is_available_for_purchase: true, status: 'active',
  package_size: '100 ml', reviews_count: 3, average_rating: 0,
}))

type CatalogCall = { path: string, query: Record<string, string> }
type NuxtRoot = HTMLElement & { __vue_app__?: { config: { globalProperties: {
  $nuxt?: { isHydrating: boolean }, $router: { push: (path: string) => Promise<unknown> },
} } } }

async function navigate(page: Page, path: string) {
  await page.evaluate(async path => {
    const app = (document.querySelector('#__nuxt') as NuxtRoot | null)?.__vue_app__
    if (!app) throw new Error('Nuxt app is not mounted')
    await app.config.globalProperties.$router.push(path)
  }, path)
}

async function fixture(page: Page, locale: 'uk' | 'en') {
  const calls: CatalogCall[] = [], writes: string[] = []
  await page.context().addCookies([{ name: 'shop-locale', value: locale, url: 'http://127.0.0.1' }])
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.abort()
  })
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    if (request.method() !== 'GET') {
      writes.push(`${request.method()} ${path}`)
      return route.fulfill({ status: 403, json: { detail: 'Fixture forbids all writes' } })
    }
    if (path.endsWith('/categories/tree')) return route.fulfill({ json: tree })
    if (path.endsWith('/brands')) return route.fulfill({ json: { items: [brand], total: 1, page: 1, page_size: 100 } })
    if (path.endsWith('/categories')) return route.fulfill({ json: { items: tree, total: 1, page: 1, page_size: 100 } })
    if (path.endsWith('/products/search')) return route.fulfill({ json: { suggestions: ['Fixture pomade'], categories: [category], products } })
    if (path.endsWith('/filters')) {
      calls.push({ path, query: Object.fromEntries(url.searchParams) })
      return route.fulfill({ json: { price: { min: 50, max: 500 }, filters: {
        finish: { slug: 'finish', name: 'Fixture finish', values: [{ slug: 'matte', name: 'Matte', count: 6 }] },
      } } })
    }
    if (path.endsWith('/products')) {
      calls.push({ path, query: Object.fromEntries(url.searchParams) })
      const limit = Number(url.searchParams.get('page_size') || url.searchParams.get('limit') || 20)
      const offset = Number(url.searchParams.get('offset') || 0)
      const items = url.searchParams.get('has_discount') === 'true' ? products : [{ ...products[0], name: 'Full-price fixture', compare_at_price: null }]
      return route.fulfill({ json: { items: items.slice(offset, offset + limit), total: items.length, page: Math.floor(offset / limit) + 1, page_size: limit } })
    }
    return route.fulfill({ json: { items: [], total: 0, page: 1, page_size: 100 } })
  })
  await page.route('**/sale-fixture.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="#eee"/><rect x="85" y="40" width="70" height="160" fill="#246"/></svg>' }))
  // Hydrate on a page with no product SSR data, then use the actual Nuxt router.
  await page.goto('/shop/contacts')
  await page.waitForFunction(() => (document.querySelector('#__nuxt') as NuxtRoot | null)?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false)
  return { calls, writes }
}

for (const locale of ['uk', 'en'] as const) {
  test(`Sale fences every listing/facet through URL, pagination, sorting and filters (${locale})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    const { calls, writes } = await fixture(page, locale)
    await navigate(page, '/sale?has_discount=false&limit=2')
    const title = locale === 'uk' ? 'Розпродаж' : 'Sale'
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible()
    await expect(page).toHaveTitle(new RegExp(title))
    const tiles = page.locator('.catalog-route__content .catalog-product-tile')
    await expect(tiles).toHaveCount(2)
    await expect(tiles.first()).toContainText('Sale fixture 1')
    const saleLink = page.locator('.shop-header__popular-btn').last()
    await expect(saleLink).toHaveAttribute('href', '/shop/sale')
    await expect(saleLink).toHaveCSS('color', 'rgb(194, 65, 12)')
    await saleLink.hover()
    const saleHover = saleLink.locator('.base-animated-menu-text__hover')
    await expect(saleHover).toHaveCSS('color', 'rgb(255, 255, 255)')
    const plaque = await saleHover.evaluate(element => {
      const style = getComputedStyle(element, '::before')
      return { background: style.backgroundColor, top: parseFloat(style.top), bottom: parseFloat(style.bottom), transform: style.transform }
    })
    expect(plaque.background).toBe('rgb(194, 65, 12)')
    expect(plaque.top).toBeLessThan(0)
    expect(plaque.bottom).toBeLessThan(0)
    expect(plaque.transform).not.toBe('none')
    await page.locator('.catalog-pagination .base-pagination__page').filter({ hasText: /^2$/ }).click()
    await expect.poll(() => calls.at(-1)?.query.offset).toBe('2')
    await expect(tiles.first()).toContainText('Sale fixture 3')
    await page.getByRole('tab').first().click()
    await expect.poll(() => calls.at(-1)?.query.ordering).toBe('price')
    await expect.poll(() => calls.at(-1)?.query.offset).toBe('0')
    await page.locator('.catalog-route__left-side-bar').getByText('Fixture category', { exact: true }).click()
    await expect(page.locator('.catalog-route__left-side-bar').getByRole('checkbox', { name: 'Fixture category', exact: true })).toBeChecked()
    await expect.poll(() => calls.some(call => call.path.endsWith('/fixture-category/filters'))).toBe(true)
    await expect.poll(() => calls.some(call => call.path.endsWith('/fixture-category/products'))).toBe(true)
    await page.locator('.catalog-route__left-side-bar').getByText('Matte', { exact: true }).click()
    await expect(page.locator('.catalog-route__left-side-bar').getByRole('checkbox', { name: /Matte/ })).toBeChecked()
    await expect.poll(() => calls.at(-1)?.query.finish).toBe('matte')
    await page.locator('.catalog-filter-panel__clear:visible').first().click()
    await expect.poll(() => calls.at(-1)?.path.endsWith('/public/products')).toBe(true)
    expect(calls.length).toBeGreaterThan(5)
    for (const call of calls) expect(call.query.has_discount, JSON.stringify(call)).toBe('true')
    expect(writes).toEqual([])
    await page.screenshot({ path: `/tmp/sc-fe-sale-ui-${locale}-1440-20261101.png`, animations: 'disabled' })
  })

  test(`mobile catalog ends with the red Sale entry (${locale})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const { calls, writes } = await fixture(page, locale)
    await page.locator('.base-bottom-bar').getByRole('button', { name: locale === 'uk' ? 'Каталог' : 'Catalog', exact: true }).click()
    const lastEntry = page.locator('.catalog-sidebar__navigation .catalog-sidebar__list > li').last().getByRole('link')
    await expect(lastEntry).toHaveText(locale === 'uk' ? 'Розпродаж' : 'Sale')
    await expect(lastEntry).toHaveAttribute('href', '/shop/sale')
    await expect(lastEntry).toHaveCSS('color', 'rgb(194, 65, 12)')
    await page.screenshot({ path: `/tmp/sc-fe-sale-ui-${locale}-390-menu-20261101.png`, animations: 'disabled' })
    await lastEntry.click()
    await expect(page).toHaveURL(/\/shop\/sale$/)
    await expect(page.getByRole('heading', { level: 1, name: locale === 'uk' ? 'Розпродаж' : 'Sale', exact: true })).toBeVisible()
    await expect(page.locator('.base-bottom-bar').getByRole('button', { name: locale === 'uk' ? 'Каталог' : 'Catalog', exact: true })).toHaveAttribute('aria-current', 'page')
    for (const call of calls) expect(call.query.has_discount).toBe('true')
    expect(writes).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('desktop search panel supports keyboard entry, escape, reopening and base-prefixed product selection', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const { writes } = await fixture(page, 'en')
  const input = page.locator('.header-search--desktop .header-search__field')
  await input.fill('fixture pomade')
  const panel = page.locator('.header-search__panel--desktop')
  const firstResult = panel.locator('.header-search-results__item--category').first()
  await expect(firstResult).toBeVisible()
  await input.press('ArrowDown')
  await expect(firstResult).toBeFocused()
  // Verify the input's delayed blur handler does not dismiss a focused result.
  await page.waitForTimeout(200)
  await expect(firstResult).toBeVisible()
  await page.screenshot({ path: '/tmp/sc-fe-sale-ui-search-1440-20261101.png', animations: 'disabled' })
  await firstResult.press('Escape')
  await expect(panel).toHaveCount(0)
  await expect(input).toBeFocused()
  await input.fill('fixture second search')
  const productLink = panel.locator('.catalog-product-tile__link').first()
  await expect(productLink).toHaveAttribute('href', '/shop/products/sale-fixture-1')
  // Exercise the actual link's bubbling selection handler without navigating to
  // a product detail page, which intentionally records product views.
  await productLink.evaluate(link => link.addEventListener('click', event => event.preventDefault(), { capture: true, once: true }))
  await productLink.click()
  await expect(panel).toHaveCount(0)
  await expect(page).toHaveURL(/\/shop\/contacts$/)
  expect(writes).toEqual([])
})

test('mobile search retains the existing focus-trapped modal and escape close', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const { writes } = await fixture(page, 'en')
  await page.locator('.shop-header__mobile').getByRole('button', { name: 'Search', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const input = dialog.locator('.header-search__field')
  await expect(input).toBeFocused()
  await input.fill('fixture pomade')
  await expect(dialog.locator('.catalog-product-tile')).toHaveCount(6)
  await page.screenshot({ path: '/tmp/sc-fe-sale-ui-search-390-20261101.png', animations: 'disabled' })
  await input.press('Escape')
  await expect(dialog).toHaveCount(0)
  expect(writes).toEqual([])
})

test('focused desktop results close and release scroll lock when resized below 768px', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const { writes } = await fixture(page, 'en')
  const input = page.locator('.header-search--desktop .header-search__field')
  await input.fill('fixture pomade')
  const panel = page.locator('.header-search__panel--desktop')
  const firstResult = panel.locator('.header-search-results__item--category').first()
  await expect(firstResult).toBeVisible()
  await input.press('ArrowDown')
  await expect(firstResult).toBeFocused()
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(panel).toHaveCount(0)
  await expect(page.locator('.shop-header')).not.toHaveClass(/shop-header--active/)
  await expect(page.locator('.full-page-dim-background')).not.toHaveClass(/is-active/)
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
  await page.locator('.shop-header__mobile').getByRole('button', { name: 'Search', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('.header-search__field')).toBeFocused()
  await dialog.locator('.header-search__field').fill('fixture pomade')
  await expect(dialog.locator('.catalog-product-tile')).toHaveCount(6)
  await page.setViewportSize({ width: 375, height: 812 })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.catalog-product-tile')).toHaveCount(6)
  await dialog.locator('.header-search__field').press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
  expect(writes).toEqual([])
})
