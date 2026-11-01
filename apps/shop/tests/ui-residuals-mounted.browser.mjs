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
].map(async ([name, path]) => [name, await readFile(new URL(path, root), 'utf8')])))
const styles = [await readFile(new URL('assets/css/main.css', root), 'utf8')]
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
import Button from 'Button'; import Tile from 'Tile';
Object.assign(globalThis, Vue);
const { h, reactive, createApp, defineComponent } = Vue;
window.calls = []; window.navigations = [];
const Link = defineComponent({ inheritAttrs: false, props: ['to', 'href'], setup(props, { attrs, slots }) {
  return () => h('a', Vue.mergeProps(attrs, { href: props.to, onClick: e => { e.preventDefault(); window.navigations.push(props.to) } }), slots.default?.());
}});
window.NuxtLink = Link;
window.useProductDisplay = () => ({ productDisplayName: p => p.name, productDisplayType: () => 'Type' });
window.useShopLocale = () => ({ locale: Vue.ref('en'), terms: { product: { saveFavorite: 'Save', removeFavorite: 'Unsave', addToCart: 'Add', removeFromCart: 'Remove' }, catalog: { currencyShort: 'UAH' } } });
window.useShopPriceFormatter = () => ({ formatPrice: value => String(value) });
window.useCartStore = () => ({ items: [], toggle: () => window.calls.push('cart') });
window.useFavoritesStore = () => ({ has: () => false, toggle: () => window.calls.push('favorite') });
window.state = reactive({ loading: false, disabled: false, kind: 'button', override: false,
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
] }});
app.component('NuxtLink', Link); app.component('BaseButton', Button);
for (const name of ['BaseIcon', 'BaseBadge', 'BaseHoverUnderlineText', 'ProductStatusBadges']) app.component(name, { setup(_, { slots }) { return () => h('span', slots.default?.()) } });
app.mount('#app');
`
const bundle = await build({ stdin: { contents: entry, resolveDir: dirname(runtime.resolve('vue/package.json')) }, bundle: true, write: false, format: 'iife', plugins: [{
  name: 'mounted-fixtures', setup(builder) {
    builder.onResolve({ filter: /^(Button|Tile|#components|~\/utils\/)/ }, args => ({ path: args.path, namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({
      contents: modules[args.path] || (args.path === '#components' ? `import { h } from 'vue'; export const NuxtLink = (props, { slots }) => h(window.NuxtLink, props, slots)` : `export const localizedPackageSize = v => v; export const getProductDiscount = () => null; export const isProductHidden = p => p.hidden; export const isProductUnavailable = p => p.unavailable;`),
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
      assert.ok(box.width >= 44 && box.height >= 44)
    }
    assert.equal(await dots.first().locator('.catalog-product-tile__dot').evaluate(el => getComputedStyle(el).width), '6px')
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
    assert.deepEqual(errors, [])

    const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
    await touch.route('**/*', mockRequests)
    const mobile = await touch.newPage()
    await mobile.setContent(fixture)
    await mobile.addStyleTag({ content: styles.join('\n') })
    await mobile.addScriptTag({ content: bundle.outputFiles[0].text })
    const mobileDots = mobile.locator('.catalog-product-tile__dot-target')
    assert.equal(await mobile.locator('.catalog-product-tile__dots').evaluate(el => getComputedStyle(el).opacity), '1')
    await mobileDots.nth(1).tap()
    assert.equal(await mobileDots.nth(1).getAttribute('aria-pressed'), 'true')
    await mobileDots.nth(2).tap()
    assert.equal(await mobileDots.nth(2).getAttribute('aria-pressed'), 'true')
    assert.equal(await mobile.evaluate(() => navigations.length), 0)
    await mobile.setViewportSize({ width: 320, height: 700 })
    await mobile.locator('#tile-fixture').evaluate(el => { el.style.width = '144px' })
    await mobile.evaluate(() => { state.product = { ...state.product, images: Array.from({ length: 12 }, (_, i) => ({ image: '/many-' + i + '.png' })) } })
    const tileBefore = await mobile.locator('.catalog-product-tile').boundingBox()
    await mobileDots.nth(11).tap()
    assert.equal(await mobileDots.nth(11).getAttribute('aria-pressed'), 'true')
    const lastTarget = await mobileDots.nth(11).boundingBox()
    // Translated DOMRects may round just below their exact CSS pixel dimensions.
    assert.ok(Math.round(lastTarget.width * 1000) >= 44000 && Math.round(lastTarget.height * 1000) >= 44000, JSON.stringify(lastTarget))
    assert.ok(lastTarget.x >= tileBefore.x && lastTarget.x + lastTarget.width <= tileBefore.x + tileBefore.width, JSON.stringify({ lastTarget, tileBefore }))
    const tileAfter = await mobile.locator('.catalog-product-tile').boundingBox()
    assert.equal(tileAfter.width, tileBefore.width)
    assert.equal(tileAfter.height, tileBefore.height)
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  })
}
