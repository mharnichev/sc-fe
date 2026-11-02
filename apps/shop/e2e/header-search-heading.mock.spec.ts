import { expect, test, type Locator, type Page } from '@playwright/test'

const category = { id: 2, name: 'Fixture category', name_en: 'Fixture category', slug: 'fixture-category', children: [], description: null }
const brand = { id: 1, name: 'Fixture brand', slug: 'fixture-brand', description: null }
const product = {
  id: 101, name: 'Fixture pomade', slug: 'fixture-pomade', price: '100.00', stock: 10,
  category_id: 2, brand_id: 1, category, brand, images: [],
  is_effectively_visible: true, is_available_for_purchase: true, status: 'active',
}
const headingText = /Можливо, ви шукаєте|You might be looking for/

type NuxtRoot = HTMLElement & { __vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } } }

async function prepare(page: Page, baseURL: string, width: number) {
  const origin = new URL(baseURL).origin
  const writes: string[] = []
  let releaseLoading: (() => void) | undefined
  let loadingRequested = false
  const loadingGate = new Promise<void>(resolve => { releaseLoading = resolve })
  await page.setViewportSize({ width, height: 900 })
  await page.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname.includes('/api/v1/')) {
      if (request.method() !== 'GET') {
        writes.push(`${request.method()} ${url.pathname}`)
        await route.fulfill({ status: 403, json: {} })
      } else if (url.pathname.endsWith('/products/search')) {
        const query = url.searchParams.get('q') || url.searchParams.get('query') || ''
        if (query.includes('loading')) {
          loadingRequested = true
          await loadingGate
        }
        await route.fulfill({ json: query.includes('fixture')
          ? { suggestions: ['Fixture pomade'], categories: [category], products: Array.from({ length: 6 }, (_, index) => ({ ...product, id: product.id + index, slug: `${product.slug}-${index}` })) }
          : { suggestions: [], categories: [], products: [] } })
      } else if (url.pathname.endsWith('/categories/tree')) {
        await route.fulfill({ json: [category] })
      } else await route.fulfill({ json: { items: [], total: 0, page: 1, page_size: 10 } })
    } else if (url.origin !== origin) await route.abort()
    else await route.continue()
  })
  await page.goto('contacts')
  await page.waitForFunction(() => (document.querySelector('#__nuxt') as NuxtRoot | null)?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false)
  return { writes, releaseLoading: () => releaseLoading?.(), loadingRequested: () => loadingRequested }
}

async function expectHeadingRow(panel: Locator) {
  const heading = panel.getByRole('heading', { level: 6, name: headingText })
  await expect(heading).toHaveCount(1)
  const row = heading.locator('..')
  const close = row.locator('button')
  await expect(close).toHaveCount(1)
  await expect(close).toBeVisible()
  const headingBox = await heading.boundingBox()
  const closeBox = await close.boundingBox()
  expect(headingBox).not.toBeNull()
  expect(closeBox).not.toBeNull()
  expect(Math.abs((headingBox!.y + headingBox!.height / 2) - (closeBox!.y + closeBox!.height / 2))).toBeLessThanOrEqual(2)
  return close
}

test('desktop heading shares its row with a usable close control in every result state', async ({ page, baseURL }) => {
  const fixture = await prepare(page, baseURL!, 1440)
  const input = page.locator('.shop-header__desktop').getByRole('searchbox')
  const panel = page.locator('.header-search__panel--desktop')
  try {
    await input.fill('loading fixture')
    await expect.poll(fixture.loadingRequested).toBe(true)
    await expect(panel.locator('[role=status]')).toBeVisible()
    const loadingClose = await expectHeadingRow(panel)
    await loadingClose.click()
    await expect(panel).not.toBeVisible()
    await expect(input).toBeFocused()
    fixture.releaseLoading()

    await input.fill('empty query')
    await expect(panel.locator('.header-search-results--empty')).toBeVisible()
    const emptyClose = await expectHeadingRow(panel)
    await emptyClose.focus()
    await page.keyboard.press('Escape')
    await expect(panel).not.toBeVisible()
    await expect(input).toBeFocused()
    await input.fill('empty second')
    await expect(panel.locator('.header-search-results--empty')).toBeVisible()
    await (await expectHeadingRow(panel)).click()
    await expect(panel).not.toBeVisible()
    await expect(input).toBeFocused()

    await input.fill('fixture result')
    await expect(panel.locator('.catalog-product-tile')).toHaveCount(6)
    await expect(panel.getByRole('link', { name: 'Fixture category', exact: true })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Fixture pomade' })).toBeVisible()
    await expectHeadingRow(panel)
    await input.focus()
    await input.press('ArrowDown')
    await expect(panel.locator('.header-search-results__content a[href]').first()).toBeFocused()
    await expect(panel.locator('.header-search__close')).not.toBeFocused()
    const submit = page.locator('.shop-header__desktop .header-search__submit')
    await submit.focus()
    await submit.press('Tab')
    await expect(panel.locator('.header-search-results__content a[href]').first()).toBeFocused()
    await panel.evaluate(element => { element.scrollTop = element.scrollHeight })
    await expect.poll(() => panel.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
    const pinnedClose = await expectHeadingRow(panel)
    const closeBox = await pinnedClose.boundingBox()
    const panelBox = await panel.boundingBox()
    expect(closeBox!.y).toBeGreaterThanOrEqual(panelBox!.y)
    expect(closeBox!.y + closeBox!.height).toBeLessThanOrEqual(panelBox!.y + 80)
    expect(fixture.writes).toEqual([])
  } finally {
    fixture.releaseLoading()
  }
})

test('mobile keeps one close control and contains focus @mobile', async ({ page, baseURL }) => {
  const fixture = await prepare(page, baseURL!, 390)
  const trigger = page.locator('.shop-header__mobile-btn').first()
  await trigger.click()
  const panel = page.locator('#shop-mobile-search')
  const input = panel.getByRole('searchbox')
  await expect(input).toBeFocused()
  await input.fill('fixture result')
  await expect(panel.locator('.catalog-product-tile')).toHaveCount(6)
  const close = panel.locator('.shop-header__search-panel-heading button')
  await expect(close).toHaveCount(1)
  await expect(panel.getByRole('heading', { level: 6, name: headingText })).toHaveCount(1)
  await page.locator('.shop-header__mobile-logo').focus()
  await expect(input).toBeFocused()
  await close.click()
  await expect(panel).not.toBeVisible()
  await expect(trigger).toBeFocused()
  expect(fixture.writes).toEqual([])
})
