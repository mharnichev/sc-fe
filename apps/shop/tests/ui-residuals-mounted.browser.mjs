import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import test from 'node:test'

const require = createRequire(import.meta.url)
const runtime = createRequire(require.resolve('nuxt/package.json'))
const { parse, compileScript, compileStyle } = runtime('@vue/compiler-sfc')
const { build } = runtime('esbuild')
const { chromium, webkit } = require('@playwright/test')
const mockImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1kAAAAASUVORK5CYII=', 'base64')
const fixture = '<meta name="viewport" content="width=device-width, initial-scale=1"><base href="http://shop.test/"><div id="app"></div>'
const mockRequests = route => route.request().url().startsWith('http://shop.test/') && route.request().resourceType() === 'image'
  ? route.fulfill({ contentType: 'image/png', body: mockImage })
  : route.abort()
const root = new URL('../', import.meta.url)
const sources = Object.fromEntries(await Promise.all([
  ['Button', 'components/ui/BaseButton.vue'], ['Tile', 'components/catalog/CatalogProductTile.vue'],
  ['Counter', 'components/base/header/NavCartCounter.vue'],
].map(async ([name, path]) => [name, await readFile(new URL(path, root), 'utf8')])))
const sharedCss = await runtime('postcss')([runtime('tailwindcss')({ content: [{ raw: Object.values(sources).join('\n'), extension: 'vue' }] })])
  .process(await readFile(new URL('assets/css/main.css', root), 'utf8'), { from: new URL('assets/css/main.css', root).pathname })
const styles = [sharedCss.css, await readFile(new URL('assets/css/typography.css', root), 'utf8')]
const modules = {}
for (const [name, source] of Object.entries(sources)) {
  const { descriptor } = parse(source)
  const id = `data-v-test-${name.toLowerCase()}`
  const script = compileScript(descriptor, { id, inlineTemplate: true, genDefaultAs: 'component' })
  modules[name] = `${script.content}\ncomponent.__scopeId = '${id}'; export default component`
  for (const style of descriptor.styles) styles.push(compileStyle({ source: style.content, id, scoped: !!style.scoped }).code)
}
const entry = `
import * as Vue from 'vue';
import Button from 'Button'; import Tile from 'Tile'; import Counter from 'Counter';
Object.assign(globalThis, Vue);
const { h, reactive, createApp, defineComponent } = Vue;
window.calls = []; window.navigations = [];
const Link = defineComponent({ inheritAttrs: false, props: ['to', 'href'], setup(props, { attrs, slots }) {
  return () => h('a', Vue.mergeProps(attrs, { href: props.to, onClick: e => { e.preventDefault(); window.navigations.push(props.to) } }), slots.default?.());
}});
window.NuxtLink = Link;
window.useProductDisplay = () => ({ productDisplayName: p => p.name, productDisplayType: () => 'Type' });
window.useShopLocale = () => ({ locale: Vue.ref('en'), terms: { product: { saveFavorite: 'Save', removeFavorite: 'Unsave', addToCart: 'Add', removeFromCart: 'Remove' }, catalog: { currencyShort: 'UAH', badges: { top: 'Top' } } } });
window.useShopPriceFormatter = () => ({ formatPrice: value => String(value) });
window.useCartStore = () => ({ get items() { return state.cartItems }, toggle: () => window.calls.push('cart') });
window.useFavoritesStore = () => ({ has: () => false, toggle: () => window.calls.push('favorite') });
window.state = reactive({ loading: false, disabled: false, kind: 'button', override: false, counter: 9, cartItems: [],
  product: { id: 1, slug: 'sample', name: 'Sample', price: '100', package_size: 500, reviews_count: 3, average_rating: 0,
  images: [1,2,3].map(i => ({ image: '/image-' + i + '.png', alt: 'Photo ' + i })) } });
const app = createApp({ setup() { return () => [
  h('div', { id: 'button-fixture' }, [h(Button, {
    loading: state.loading, disabled: state.disabled, to: state.kind === 'to' ? '/shop/products/sample' : undefined,
    href: state.kind === 'href' ? 'https://example.com/product' : undefined, target: '_blank',
    ...(state.override ? { tabindex: 0, 'aria-disabled': 'false', 'aria-busy': 'false', onClickCapture: () => calls.push('capture'), onKeydownCapture: () => calls.push('keycapture') } : {}),
    onClick: () => calls.push('click'), onAuxclick: () => calls.push('aux'), onKeyup: () => calls.push('keyup'),
  }, () => 'Continue')]),
  h('div', { id: 'tile-fixture', style: 'width:100%;max-width:280px;height:400px' }, [h(Tile, { product: state.product })]),
  h('div', { id: 'counter-fixture' }, [h(Counter, { count: state.counter })]),
] }});
app.component('NuxtLink', Link); app.component('BaseButton', Button);
for (const name of ['BaseIcon', 'BaseBadge', 'BaseHoverUnderlineText', 'ProductStatusBadges']) app.component(name, { setup(_, { slots }) { return () => h('span', { class: name === 'BaseIcon' ? 'base-icon' : name === 'BaseBadge' ? 'base-badge' : '' }, slots.default?.()) } });
app.mount('#app');
`
const bundle = await build({ stdin: { contents: entry, resolveDir: dirname(runtime.resolve('vue/package.json')) }, bundle: true, write: false, format: 'iife', define: { 'import.meta.client': 'true' }, plugins: [{
  name: 'mounted-fixtures', setup(builder) {
    builder.onResolve({ filter: /^(Button|Tile|Counter|#components|~\/utils\/)/ }, args => ({ path: args.path, namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({
      contents: modules[args.path] || (args.path === '#components' ? `import { h } from 'vue'; export const NuxtLink = (props, { slots }) => h(window.NuxtLink, props, slots)` : `export const localizedPackageSize = v => v; export const getProductDiscount = () => null; export const getProductStatusFlags = p => ({ isTop: !!p.is_top }); export const isProductHidden = p => p.hidden; export const isProductUnavailable = p => p.unavailable;`),
      loader: 'ts', resolveDir: dirname(runtime.resolve('vue/package.json')),
    }))
  },
}] })

for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  test(`${name}: mounted loading and preview interactions`, { timeout: 60000 }, async t => {
    const browser = await engine.launch({ headless: true })
    t.after(() => browser.close())
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    await context.route('**/*', mockRequests)
    const page = await context.newPage()
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setContent(`<style>body{margin:0}#app{padding:16px}</style>${fixture}`)
    await page.addStyleTag({ content: styles.join('\n') })
    await page.addScriptTag({ content: bundle.outputFiles[0].text })
    const cartMetrics = async locator => locator.evaluate(el => {
      const style = getComputedStyle(el), box = el.getBoundingClientRect()
      const arrow = el.querySelector('.catalog-product-tile__cart-arrow').getBoundingClientRect()
      return { width: box.width, height: box.height, font: style.fontSize, padding: style.paddingLeft,
        arrow: arrow.width, gap: getComputedStyle(el.querySelector('.sc-button__text')).gap,
        label: getComputedStyle(el.querySelector('.catalog-product-tile__cart-label')).paddingLeft }
    })
    const verifyTileControls = async (surface, mobileMode) => {
      await surface.emulateMedia({ reducedMotion: 'reduce' })
      await surface.evaluate(() => {
        calls.length = 0; navigations.length = 0; state.cartItems = []
        state.product = { ...state.product, is_top: true, unavailable: false, hidden: false, price: '12345', package_size: '100 ml',
          name: 'Long product title for daily grooming and professional hair care',
          images: [1, 2, 3].map(i => ({ image: '/coverage-' + i + '.png' })) }
      })
      const tile = surface.locator('.catalog-product-tile'), body = tile.locator('.catalog-product-tile__body')
      const favorite = body.locator('.catalog-product-tile__favorite'), top = body.locator('.catalog-product-tile__top')
      const strip = body.locator('.catalog-product-tile__dots'), dots = strip.locator('button')
      const cart = tile.locator(`.catalog-product-tile__${mobileMode ? 'mobile' : 'desktop'}-layout .catalog-product-tile__cart`)
      if (!mobileMode) {
        await surface.mouse.move(1000, 800)
        assert.equal(await favorite.evaluate(el => getComputedStyle(el).pointerEvents), 'none')
        assert.equal(await top.evaluate(el => getComputedStyle(el).opacity), '1')
        await tile.hover({ position: { x: 5, y: 5 } })
      }
      const hitTarget = locator => locator.evaluate(el => {
        const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
        return el === hit || el.contains(hit)
      })
      assert.equal(await hitTarget(favorite), true)
      if (mobileMode) await favorite.tap()
      else await favorite.click()
      assert.deepEqual(await surface.evaluate(() => calls), ['favorite'])
      const [bodyBox, topBox, favoriteBox, stripBox] = await Promise.all([body.boundingBox(), top.boundingBox(), favorite.boundingBox(), strip.boundingBox()])
      assert.ok(Math.abs(topBox.y - (bodyBox.y - 44)) <= 1.1)
      assert.ok(Math.abs(favoriteBox.y - (bodyBox.y - 44)) <= 1.1)
      assert.ok(Math.abs(topBox.x - bodyBox.x) <= 1.1)
      assert.ok(Math.abs(favoriteBox.x + favoriteBox.width - bodyBox.x - bodyBox.width) <= 1.1)
      assert.ok(topBox.x + topBox.width <= stripBox.x, JSON.stringify({ topBox, stripBox }))
      assert.ok(stripBox.x + stripBox.width <= favoriteBox.x, JSON.stringify({ stripBox, favoriteBox }))
      assert.equal(await tile.evaluate(el => getComputedStyle(el).boxShadow), 'none')
      assert.equal(await body.evaluate(el => getComputedStyle(el).boxShadow), 'none')
      assert.equal(await top.evaluate(el => {
        const r = el.getBoundingClientRect()
        return !!document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('a.catalog-product-tile__link')
      }), true)
      if (mobileMode) await dots.nth(2).tap()
      else await dots.nth(2).click()
      assert.equal(await dots.nth(2).getAttribute('aria-pressed'), 'true')
      const dotBox = await dots.nth(2).boundingBox()
      assert.ok(Math.round(dotBox.width * 1000) >= 24000 && Math.round(dotBox.height * 1000) >= 44000)
      assert.equal(await hitTarget(dots.nth(2)), true)
      assert.equal(await hitTarget(favorite), true)
      // Accepted card layout: full-width name, then type, then price in the former volume slot.
      await surface.evaluate(() => document.fonts.ready)
      await tile.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const layout = await tile.evaluate((el, mobile) => {
        const root = el.querySelector(`.catalog-product-tile__${mobile ? 'mobile' : 'desktop'}-layout`)
        const title = root.querySelector(mobile ? '.catalog-product-tile__mobile-name' : '.catalog-product-tile__name')
        const primary = root.querySelector('.catalog-product-tile__primary')
        const type = root.querySelector(mobile ? '.catalog-product-tile__mobile-type' : '.catalog-product-tile__type')
        const row = root.querySelector(mobile ? '.catalog-product-tile__mobile-purchase-row' : '.catalog-product-tile__details-row')
        const prices = root.querySelector('.catalog-product-tile__prices'), price = prices.querySelector('.catalog-product-tile__price')
        const cart = row.querySelector('.catalog-product-tile__cart')
        const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom } }
        return { title: rect(title), primary: rect(primary), type: rect(type), prices: rect(prices), row: rect(row), cart: rect(cart),
          titleSize: getComputedStyle(title).fontSize, titleWeight: getComputedStyle(title).fontWeight,
          priceWeight: getComputedStyle(price).fontWeight, valueWeight: getComputedStyle(price.querySelector('span')).fontWeight,
          priceInRow: prices.parentElement === row && row.firstElementChild === prices,
          priceInPrimary: primary.contains(prices), volumeCount: el.querySelectorAll('.catalog-product-tile__volume').length,
          measurement: mobile ? null : { font: el.querySelector('.catalog-product-tile__name-measure').style.font, width: el.querySelector('.catalog-product-tile__name-measure').getBoundingClientRect().width },
          lineClamp: getComputedStyle(title).webkitLineClamp }
      }, mobileMode)
      assert.equal(layout.titleSize, '14px')
      assert.equal(layout.titleWeight, '600')
      assert.equal(layout.priceWeight, '600')
      assert.equal(layout.valueWeight, '600')
      assert.ok(Math.abs(layout.title.x - layout.primary.x) <= 1)
      assert.ok(Math.abs(layout.title.width - layout.primary.width) <= 1, 'name occupies the full primary width')
      assert.equal(layout.priceInRow, true, 'price occupies the former volume slot before the purchase action')
      assert.equal(layout.priceInPrimary, false)
      assert.equal(layout.volumeCount, 0, 'package size input must not render a volume badge')
      assert.ok(layout.title.bottom <= layout.type.y + 1, 'name and product type do not overlap')
      assert.ok(layout.type.bottom <= layout.prices.y + 1, 'price follows the product type')
      assert.ok(layout.prices.x >= layout.row.x - 1 && layout.prices.right <= layout.row.right + 1, 'price stays inside its row')
      const overlap = Math.max(0, Math.min(layout.prices.right, layout.cart.right) - Math.max(layout.prices.x, layout.cart.x))
        * Math.max(0, Math.min(layout.prices.bottom, layout.cart.bottom) - Math.max(layout.prices.y, layout.cart.y))
      assert.equal(overlap, 0, 'price and purchase action never overlap, including wrapped mobile rows')
      assert.equal(layout.lineClamp, '2')
      if (!mobileMode) {
        assert.ok(layout.measurement.font, 'Nuxt client name measurement branch actually ran')
        assert.ok(Math.abs(layout.measurement.width - layout.title.width) <= 1)
      }
      console.info('accepted card layout', mobileMode ? 'mobile' : 'desktop', JSON.stringify(layout))

      if (mobileMode) await cart.tap()
      else await cart.click()
      await surface.evaluate(() => { state.product = { ...state.product, unavailable: true }; state.cartItems = [{ product: state.product }] })
      assert.equal(await cart.isDisabled(), false)
      assert.equal(await cart.getAttribute('aria-label'), 'Remove')
      if (mobileMode) await cart.tap()
      else await cart.click()
      assert.deepEqual(await surface.evaluate(() => calls), ['favorite', 'cart', 'cart'])
      await surface.evaluate(() => { state.cartItems = [] })
      assert.equal(await cart.isDisabled(), true)
      await cart.evaluate(el => el.click())
      assert.deepEqual(await surface.evaluate(() => calls), ['favorite', 'cart', 'cart'])
      assert.deepEqual(await surface.evaluate(() => navigations), [])
      await surface.emulateMedia({ contrast: 'more', reducedMotion: 'reduce' })
      assert.equal(await top.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 248, 214)')
      assert.equal(await top.evaluate(el => getComputedStyle(el).backdropFilter), 'none')
      await surface.emulateMedia({ contrast: 'no-preference', reducedMotion: 'reduce' })
      await surface.evaluate(() => { state.product = { ...state.product, unavailable: false }; state.cartItems = [] })
      console.info(`tile controls ${mobileMode ? 'mobile' : 'desktop'}:`, JSON.stringify({ bodyBox, topBox, favoriteBox, stripBox, dotBox }))
    }
    assert.deepEqual(await cartMetrics(page.locator('.catalog-product-tile__desktop-layout .catalog-product-tile__cart--buy')),
      { width: 92, height: 32, font: '12px', padding: '10px', arrow: 16, gap: '4px', label: '4px' })
    assert.equal(await page.locator('.catalog-product-tile__desktop-layout .catalog-product-tile__primary').evaluate(el => getComputedStyle(el).gap), '4px')
    const button = page.locator('#button-fixture > .sc-button')
    for (const kind of ['button', 'href', 'to']) {
      await page.evaluate(kind => { state.kind = kind; state.loading = false; state.disabled = false; state.override = false }, kind)
      const before = await button.boundingBox()
      await button.click()
      assert.equal(await page.evaluate(() => calls.includes('click')), true)
      for (const flag of ['loading', 'disabled']) {
        await page.evaluate(flag => { calls.length = 0; navigations.length = 0; state[flag] = true; state.override = true }, flag)
        assert.equal(await button.getAttribute('aria-disabled'), 'true')
        assert.equal(await button.getAttribute('tabindex'), '-1')
        if (flag === 'loading') assert.equal(await button.getAttribute('aria-busy'), 'true')
        if (kind === 'button') assert.equal(await button.isDisabled(), true)
        else assert.equal(await button.getAttribute('href'), null)
        assert.equal(await button.textContent(), 'Continue')
        assert.equal(await page.getByRole(kind === 'button' ? 'button' : 'link', { name: 'Continue', exact: true }).count(), 1)
        const during = await button.boundingBox()
        assert.equal(during.width, before.width)
        assert.equal(during.height, before.height)
        await page.mouse.click(during.x + during.width / 2, during.y + during.height / 2)
        await button.evaluate(el => {
          el.click()
          for (const type of ['click', 'auxclick', 'dblclick']) el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }))
          for (const type of ['keydown', 'keyup', 'keypress']) for (const key of ['Enter', ' ']) el.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true }))
        })
        assert.deepEqual(await page.evaluate(() => [calls, navigations]), [[], []])
        await page.evaluate(flag => { state[flag] = false; state.override = false }, flag)
      }
      if (kind === 'href') assert.equal(await button.getAttribute('rel'), 'noopener noreferrer')
      if (kind !== 'button') assert.ok(await button.getAttribute('href'))
      await page.evaluate(() => { state.override = true; calls.length = 0 })
      await button.evaluate(el => el.click())
      assert.deepEqual(await page.evaluate(() => calls), ['capture', 'click'])
      await page.evaluate(() => { state.override = false })
    }
    await page.evaluate(() => { state.loading = true })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    assert.equal(await button.locator('.sc-button__spinner').evaluate(el => getComputedStyle(el).animationName), 'none')
    await page.emulateMedia({ reducedMotion: 'no-preference' })

    const counter = page.locator('#counter-fixture .nav-cart-counter')
    await page.evaluate(() => { state.counter = 10 })
    assert.equal(await counter.locator('.sr-only').textContent(), '10')
    assert.equal(await counter.locator('.nav-cart-counter__digit').count(), 2)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.evaluate(() => { state.counter = 8 })
    assert.equal(await counter.locator('.sr-only').textContent(), '8')
    assert.equal(await counter.locator('.nav-cart-counter__value').filter({ hasText: /^8$/ }).evaluate(el => getComputedStyle(el).transitionDuration), '0s')
    await page.emulateMedia({ reducedMotion: 'no-preference' })

    const dots = page.locator('.catalog-product-tile__dot-target')
    const strip = page.locator('.catalog-product-tile__dots')
    await page.mouse.move(1000, 800)
    assert.equal(await strip.evaluate(el => getComputedStyle(el).pointerEvents), 'none')
    assert.equal(await dots.first().evaluate(el => getComputedStyle(el).pointerEvents), 'none')
    assert.equal(await strip.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) }), false)
    // Direct focus models tab entry even when the strip is visually hidden.
    await dots.nth(1).focus()
    assert.equal(await strip.evaluate(el => getComputedStyle(el).pointerEvents), 'auto')
    await page.keyboard.press('Enter')
    assert.equal(await dots.nth(1).getAttribute('aria-pressed'), 'true')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Space')
    assert.equal(await dots.nth(2).getAttribute('aria-pressed'), 'true')
    await page.keyboard.press('Escape')
    assert.equal(await dots.first().getAttribute('aria-pressed'), 'true')
    for (const dot of await dots.all()) {
      const box = await dot.boundingBox()
      assert.ok(box.width >= 24 && box.height >= 44)
    }
    assert.equal(await dots.first().locator('.catalog-product-tile__dot').evaluate(el => getComputedStyle(el).width), '6px')
    const compactStrip = await strip.evaluate(el => {
      const box = el.getBoundingClientRect(), style = getComputedStyle(el), pill = getComputedStyle(el, '::before')
      return { width: box.width, height: box.height, background: style.backgroundColor,
        pillHeight: box.height - parseFloat(pill.top) - parseFloat(pill.bottom), pillBackground: pill.backgroundColor }
    })
    assert.deepEqual(compactStrip, { width: 72, height: 44, background: 'rgba(0, 0, 0, 0)', pillHeight: 22, pillBackground: 'rgb(255, 255, 255)' })
    await dots.nth(2).click()
    await button.focus()
    assert.equal(await dots.first().getAttribute('aria-pressed'), 'true')
    await page.mouse.move(1000, 800)
    await dots.nth(1).focus()
    await page.keyboard.press('Enter')
    await page.evaluate(() => { state.product = { ...state.product, id: 2, images: [{ image: '/new.png' }, { image: '/other.png' }] } })
    assert.equal(await dots.count(), 2)
    assert.equal(await dots.first().getAttribute('aria-pressed'), 'true')
    await dots.nth(1).click()
    const image = page.locator('.catalog-product-tile__slide').nth(1).locator('img')
    await image.evaluate(el => el.dispatchEvent(new Event('error')))
    assert.notEqual(await image.getAttribute('src'), '/other.png')
    assert.equal(await image.getAttribute('src'), '/new.png')
    await image.evaluate(el => el.dispatchEvent(new Event('error')))
    assert.equal(await image.getAttribute('src'), 'https://placehold.co/640x640?text=Product')
    await image.evaluate(el => el.dispatchEvent(new Event('error')))
    assert.equal(await image.getAttribute('src'), 'https://placehold.co/640x640?text=Product')
    await page.evaluate(() => { state.product = { ...state.product, images: [] } })
    assert.equal(await dots.count(), 0)
    assert.equal(await page.locator('.catalog-product-tile__slide img').getAttribute('src'), 'https://placehold.co/640x640?text=Product')
    await page.evaluate(() => { state.product = { ...state.product, images: [{ image: '/single.png' }] } })
    assert.equal(await dots.count(), 0)
    assert.equal(await page.locator('.catalog-product-tile__rating').textContent().then(s => s.trim()), '3')
    await page.evaluate(() => { state.product = { ...state.product, is_top: true } })
    assert.equal(await page.locator('.catalog-product-tile__top').getAttribute('aria-label'), 'Top')
    assert.equal(await page.locator('.catalog-product-tile__rating').textContent().then(s => s.trim()), '3')
    await verifyTileControls(page, false)
    await page.screenshot({ path: `/tmp/shop-photo-dots-${name}-desktop.png` })
    assert.deepEqual(errors, [])

    const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
    await touch.route('**/*', mockRequests)
    const mobile = await touch.newPage()
    await mobile.setContent(fixture)
    await mobile.addStyleTag({ content: styles.join('\n') })
    await mobile.addScriptTag({ content: bundle.outputFiles[0].text })
    const mobileBuy = mobile.locator('.catalog-product-tile__mobile-layout .catalog-product-tile__cart--buy')
    const expectedMobileBuy = { width: 72, height: 24, font: '10px', padding: '8px', arrow: 12, gap: '3px', label: '0px' }
    assert.deepEqual(await cartMetrics(mobileBuy), expectedMobileBuy)
    assert.equal(await mobile.locator('.catalog-product-tile__body').evaluate(el => getComputedStyle(el).paddingInline), '12px')
    const assertMobilePriceSlot = async () => {
      assert.equal(await mobile.locator('.catalog-product-tile__volume').count(), 0)
      assert.equal(await mobile.locator('.catalog-product-tile__mobile-purchase-row > .catalog-product-tile__prices').count(), 1)
      assert.equal(await mobile.locator('.catalog-product-tile__mobile-layout .catalog-product-tile__price').evaluate(el => getComputedStyle(el).fontWeight), '600')
    }
    await mobile.evaluate(() => { state.product = { ...state.product, package_size: '100 ml' } })
    await assertMobilePriceSlot()
    const mobileDots = mobile.locator('.catalog-product-tile__dot-target')
    assert.equal(await mobile.locator('.catalog-product-tile__dots').evaluate(el => getComputedStyle(el).opacity), '1')
    await mobileDots.nth(1).tap()
    assert.equal(await mobileDots.nth(1).getAttribute('aria-pressed'), 'true')
    await mobileDots.nth(2).tap()
    assert.equal(await mobileDots.nth(2).getAttribute('aria-pressed'), 'true')
    assert.equal(await mobile.evaluate(() => navigations.length), 0)
    await verifyTileControls(mobile, true)
    await mobile.screenshot({ path: `/tmp/shop-photo-dots-${name}-mobile.png` })
    await mobile.setViewportSize({ width: 320, height: 700 })
    assert.deepEqual(await cartMetrics(mobileBuy), expectedMobileBuy)
    assert.equal(await mobile.locator('.catalog-product-tile__body').evaluate(el => getComputedStyle(el).paddingInline), '12px')
    await assertMobilePriceSlot()
    await mobile.locator('#tile-fixture').evaluate(el => { el.style.width = '144px' })
    await verifyTileControls(mobile, true)
    await mobile.evaluate(() => { state.product = { ...state.product, images: Array.from({ length: 12 }, (_, i) => ({ image: '/many-' + i + '.png' })) } })
    const tileBefore = await mobile.locator('.catalog-product-tile').boundingBox()
    await mobileDots.nth(11).tap()
    assert.equal(await mobileDots.nth(11).getAttribute('aria-pressed'), 'true')
    assert.deepEqual(await mobile.locator('.catalog-product-tile__dots').evaluate(el => {
      const height = el.getBoundingClientRect().height, pill = getComputedStyle(el, '::before')
      return { height, pillHeight: height - parseFloat(pill.top) - parseFloat(pill.bottom) }
    }), { height: 44, pillHeight: 22 })
    const lastTarget = await mobileDots.nth(11).boundingBox()
    // Translated DOMRects may round just below their exact CSS pixel dimensions.
    assert.ok(Math.round(lastTarget.width * 1000) >= 24000 && Math.round(lastTarget.height * 1000) >= 44000, JSON.stringify(lastTarget))
    assert.ok(lastTarget.x >= tileBefore.x && lastTarget.x + lastTarget.width <= tileBefore.x + tileBefore.width, JSON.stringify({ lastTarget, tileBefore }))
    const tileAfter = await mobile.locator('.catalog-product-tile').boundingBox()
    assert.equal(tileAfter.width, tileBefore.width)
    assert.equal(tileAfter.height, tileBefore.height)
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  })
}
