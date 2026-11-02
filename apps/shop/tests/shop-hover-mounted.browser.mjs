import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'

const require = createRequire(import.meta.url)
const runtime = createRequire(require.resolve('nuxt/package.json'))
const { parse, compileScript, compileStyle } = runtime('@vue/compiler-sfc')
const { build } = runtime('esbuild')
const { chromium, webkit, expect } = require('@playwright/test')
const root = new URL('../', import.meta.url)
const modules = {}, styles = []
const sources = {}
for (const [name, path] of Object.entries({ Tile: 'components/catalog/CatalogProductTile.vue', Button: 'components/ui/BaseButton.vue', Badge: 'components/ui/BaseBadge.vue', Underline: 'components/ui/BaseHoverUnderlineText.vue' })) {
  const source = sources[name] = await readFile(new URL(path, root), 'utf8')
  const { descriptor } = parse(source)
  const id = `data-v-hover-${name.toLowerCase()}`
  const script = compileScript(descriptor, { id, inlineTemplate: true, genDefaultAs: 'component' })
  modules[name] = `${script.content}\ncomponent.__scopeId = '${id}'; export default component`
  for (const style of descriptor.styles) styles.push(compileStyle({ source: style.content, id, scoped: !!style.scoped }).code)
}
const shared = await runtime('postcss')([runtime('tailwindcss')({ content: [{ raw: Object.values(sources).join('\n'), extension: 'vue' }] })])
  .process(await readFile(new URL('assets/css/main.css', root), 'utf8'), { from: new URL('assets/css/main.css', root).pathname })
styles.unshift(shared.css, await readFile(new URL('assets/css/typography.css', root), 'utf8'))
const entry = `
import * as Vue from 'vue'; import Tile from 'Tile'; import Button from 'Button'; import Badge from 'Badge'; import Underline from 'Underline';
Object.assign(globalThis, Vue);
const { h, reactive, ref, createApp, defineComponent } = Vue;
window.locale = ref('en'); window.calls = [];
window.VueNextFrame = async () => { await Vue.nextTick(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))) };
window.state = reactive({ width: 300, product: { id: 1, slug: 'sample', name: 'Short name', sku: 'SKU-42', price: '125', package_size: '500 ml', images: [{ image: '/mock.png' }] } });
window.useProductDisplay = () => ({ productDisplayName: p => locale.value === 'uk' && p.name_uk ? p.name_uk : p.name, productDisplayType: () => 'Shampoo' });
window.useShopLocale = () => ({ locale, terms: { product: { saveFavorite: 'Save', removeFavorite: 'Unsave', addToCart: 'Add', removeFromCart: 'Remove' }, catalog: { currencyShort: 'UAH', badges: { top: 'TOP' } } } });
window.useShopPriceFormatter = () => ({ formatPrice: v => String(v) });
window.useCartStore = () => ({ items: [], toggle: () => calls.push('cart') });
window.useFavoritesStore = () => ({ has: () => false, toggle: () => calls.push('favorite') });
const Link = defineComponent({ inheritAttrs: false, props: ['to'], setup: (props, { attrs, slots }) => () => h('a', { ...attrs, href: props.to, onClick: e => e.preventDefault() }, slots.default?.()) });
window.NuxtLink = Link;
const app = createApp({ render: () => h('div', { id: 'tile-frame', style: { width: state.width + 'px', height: '440px', margin: '40px' } }, [h(Tile, { product: state.product, style: 'width:100%' })]) });
app.component('NuxtLink', Link); app.component('BaseButton', Button); app.component('BaseBadge', Badge); app.component('BaseHoverUnderlineText', Underline);
for (const name of ['BaseIcon', 'ProductStatusBadges']) app.component(name, { setup: (_, { slots }) => () => h('span', { class: name === 'BaseIcon' ? 'base-icon' : '' }, slots.default?.()) });
app.mount('#app'); window.unmountFixture = () => app.unmount();
`
const bundle = await build({ stdin: { contents: entry, resolveDir: dirname(runtime.resolve('vue/package.json')) }, bundle: true, write: false, format: 'iife', define: { 'import.meta.client': 'true' }, plugins: [{ name: 'hover-fixture', setup(builder) {
  builder.onResolve({ filter: /^(Tile|Button|Badge|Underline|#components|~\/utils\/)/ }, args => ({ path: args.path, namespace: 'fixture' }))
  builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: modules[args.path] || (args.path === '#components' ? `import { h } from 'vue'; export const NuxtLink = (props, { slots }) => h(window.NuxtLink, props, slots)` : 'export const localizedPackageSize = v => v; export const getProductDiscount = () => null; export const getProductStatusFlags = () => ({ isTop: false }); export const isProductHidden = () => false; export const isProductUnavailable = () => false;'), loader: 'ts', resolveDir: dirname(runtime.resolve('vue/package.json')) }))
} }] })
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1kAAAAASUVORK5CYII=', 'base64')
const longName = 'Professional nourishing shampoo for daily salon care and exceptionally soft healthy shiny hair with botanical extracts and a lasting fresh fragrance '.repeat(3)

for (const [engineName, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  test(`${engineName}: real tile hover, name measurement, keyboard, touch and teardown`, { timeout: 90000 }, async t => {
    const browser = await engine.launch({ headless: true, timeout: 30000 })
    t.after(() => browser.close())
    const mount = async touch => {
      const context = await browser.newContext({ viewport: { width: touch ? 390 : 1280, height: 900 }, hasTouch: touch, isMobile: touch })
      await context.route('**/*', route => route.request().url() === 'http://shop.test/mock.png'
        ? route.fulfill({ contentType: 'image/png', body: image }) : route.abort())
      const page = await context.newPage()
      page.setDefaultTimeout(5000)
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><base href="http://shop.test/"><div id="app"></div>')
      await page.addStyleTag({ content: styles.join('\n') })
      await page.addScriptTag({ content: bundle.outputFiles[0].text })
      await page.evaluate(() => document.fonts.ready)
      return { context, page, errors }
    }
    const { context, page, errors } = await mount(false)
    const tile = page.locator('.catalog-product-tile')
    const body = tile.locator('.catalog-product-tile__body')
    const name = tile.locator('.catalog-product-tile__name')
    const sku = tile.locator('.catalog-product-tile__sku')
    const metrics = () => page.evaluate(() => {
      const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }
      return { tile: rect('.catalog-product-tile'), body: rect('.catalog-product-tile__body'), name: rect('.catalog-product-tile__name'), price: rect('.catalog-product-tile__prices'), line: parseFloat(getComputedStyle(document.querySelector('.catalog-product-tile__name')).lineHeight) }
    })
    await page.mouse.move(1000, 10)
    await expect(tile).not.toHaveClass(/--long-name/)
    const short = await metrics()
    assert.equal(await sku.evaluate(el => getComputedStyle(el).visibility), 'hidden')
    const detailsRow = tile.locator('.catalog-product-tile__desktop-layout .catalog-product-tile__details-row')
    const assertZeroRowPadding = async () => {
      assert.deepEqual(await detailsRow.evaluate(el => {
        const style = getComputedStyle(el)
        return [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft]
      }), ['0px', '0px', '0px', '0px'])
      assert.ok(!await detailsRow.evaluate(el => getComputedStyle(el).transitionProperty.includes('padding')), 'details row never transitions padding')
    }
    await assertZeroRowPadding()
    assert.equal(await sku.evaluate(el => el.getBoundingClientRect().height), 0, 'idle SKU reserves no height')
    await tile.hover()
    assert.equal(await sku.evaluate(el => getComputedStyle(el).transitionDuration), '0.24s, 0s, 0.24s')
    assert.equal(await sku.evaluate(el => getComputedStyle(el).transitionDelay), '0.08s, 0s, 0s')
    assert.equal(await sku.locator('.catalog-product-tile__sku-text').evaluate(el => getComputedStyle(el).transitionDelay), '0.08s')
    await expect(sku).toHaveCSS('opacity', '1')
    await page.waitForTimeout(350)
    await assertZeroRowPadding()
    const skuHeight = await sku.evaluate(el => el.getBoundingClientRect().height)
    assert.equal(skuHeight, 12, 'visible SKU owns exactly one line in normal flow')
    assert.equal(await sku.evaluate(el => getComputedStyle(el).position), 'static')
    assert.ok(Math.abs((await metrics()).body.height - short.body.height - skuHeight) < 1, 'only the normal-flow SKU line expands the body')
    assert.equal(await sku.textContent(), 'Product code: SKU-42')
    assert.equal(await tile.locator('h3[itemprop="name"]').evaluate(el => el.textContent.trim()), 'Short name')
    assert.equal(await tile.locator('h3[itemprop="name"] .catalog-product-tile__name-measure').count(), 0, 'measurement mirror stays outside semantic name')
    const assertNoSkuOverlap = async () => {
      const overlap = await tile.evaluate(el => {
      const sku = el.querySelector('.catalog-product-tile__sku').getBoundingClientRect()
      return ['.catalog-product-tile__type', '.catalog-product-tile__desktop-layout .catalog-product-tile__volume', '.catalog-product-tile__desktop-layout .catalog-product-tile__cart'].map(selector => {
        const other = el.querySelector(selector)
        if (!other) throw new Error(`missing overlap fixture: ${selector}`)
        const rect = other.getBoundingClientRect()
        return { selector, area: Math.max(0, Math.min(sku.right, rect.right) - Math.max(sku.left, rect.left)) * Math.max(0, Math.min(sku.bottom, rect.bottom) - Math.max(sku.top, rect.top)) }
      })
      })
      for (const result of overlap) assert.equal(result.area, 0, `visible SKU must not overlap ${result.selector}`)
      assert.ok(await sku.evaluate(el => {
        const sku = el.getBoundingClientRect()
        const body = el.closest('.catalog-product-tile__body').getBoundingClientRect()
        return sku.left >= body.left && sku.right <= body.right && sku.top >= body.top && sku.bottom <= body.bottom
      }), 'SKU remains inside the body')
    }
    await assertNoSkuOverlap()
    await page.mouse.move(1000, 10)
    await page.waitForTimeout(350)
    await tile.hover()
    await page.waitForTimeout(120)
    await assertNoSkuOverlap()
    assert.equal(await sku.evaluate(el => getComputedStyle(el).overflow), 'hidden', 'slide animation is clipped inside the normal-flow SKU row')
    for (const width of [220, 450]) {
      await page.evaluate(width => { state.width = width; state.product.sku = 'SKU-42-' + 'EXTENDED'.repeat(15) }, width)
      await tile.hover()
      await page.waitForTimeout(350)
      await assertZeroRowPadding()
      await assertNoSkuOverlap()
    }
    await page.evaluate(() => { state.width = 300; state.product.sku = 'SKU-42' })
    await page.mouse.move(1000, 10)
    await page.waitForTimeout(350)
    assert.ok(Math.abs((await metrics()).body.height - short.body.height) < 1, 'idle restores the compact height')
    await assertZeroRowPadding()
    assert.equal(await sku.evaluate(el => el.getBoundingClientRect().height), 0)
    await page.evaluate(() => { state.product.sku = '  ' })
    await expect(sku).toHaveCount(0)
    const noSku = await metrics()
    assert.ok(Math.abs(noSku.body.height - short.body.height) < 1, 'empty SKU has the same compact idle geometry')
    await tile.hover()
    await page.waitForTimeout(350)
    assert.ok(Math.abs((await metrics()).body.height - noSku.body.height) < 1, 'short titles without SKU do not expand')
    await assertZeroRowPadding()
    for (const missing of [null, 42]) {
      await page.evaluate(value => { state.product.sku = value }, missing)
      await expect(sku).toHaveCount(0)
      assert.ok(Math.abs((await metrics()).body.height - noSku.body.height) < 1, 'non-string SKU reserves no space')
    }
    await page.evaluate(() => { state.product.sku = 'SKU-42'; state.product.name = 'Professional nourishing shampoo for daily salon care' })
    // Select a real measured three-line name rather than depending on platform font widths.
    await page.evaluate(async () => {
      for (let n = 25; n < 150; n += 3) {
        state.product.name = 'Professional nourishing shampoo for salon care '.repeat(4).slice(0, n)
        await VueNextFrame()
        const el = document.querySelector('.catalog-product-tile__name-measure')
        const line = parseFloat(getComputedStyle(document.querySelector('.catalog-product-tile__name')).lineHeight)
        if (el.getBoundingClientRect().height > line * 2 + 1 && el.getBoundingClientRect().height <= line * 3 + 1) return
      }
      throw new Error('three-line name fixture not found')
    })
    await expect(tile).toHaveClass(/--long-name/)
    await expect(tile).not.toHaveClass(/--scroll-name/)
    await page.mouse.move(1000, 10)
    await page.waitForTimeout(350)
    const collapsed = await metrics()
    await tile.hover()
    await page.waitForTimeout(350)
    const expanded = await metrics()
    assert.ok(expanded.name.height > collapsed.name.height + 5)
    assert.ok(expanded.name.height <= expanded.line * 3 + 1)
    assert.ok(expanded.body.height > collapsed.body.height)
    assert.deepEqual(expanded.tile, collapsed.tile, 'only the inner body expands')
    assert.ok(expanded.price.x > expanded.name.x && Math.abs(expanded.price.y - expanded.name.y) < 2, 'desktop price stays top-right')
    await page.mouse.move(1000, 10)
    await page.waitForTimeout(350)
    await tile.locator('.catalog-product-tile__name-link').focus()
    await page.waitForTimeout(350)
    assert.ok((await metrics()).name.height > collapsed.name.height + 5)
    assert.equal(await sku.evaluate(el => getComputedStyle(el).visibility), 'hidden', 'keyboard expansion must not reveal hover-only SKU')
    await page.evaluate(value => { state.product.name = value }, longName)
    await expect(tile).toHaveClass(/--scroll-name/)
    await tile.hover()
    const text = tile.locator('.catalog-product-tile__name-text')
    assert.equal(await text.evaluate(el => getComputedStyle(el).animationDelay), '0.9s')
    const duration = await text.evaluate(el => parseFloat(getComputedStyle(el).animationDuration))
    const distance = await tile.evaluate(el => parseFloat(el.style.getPropertyValue('--name-scroll-distance')))
    assert.ok(Math.abs(duration - Math.max(4, distance / 12)) < 0.01)
    // Seek the actual running CSS animation past its delay; do not wait an entire long-name cycle.
    await text.evaluate(el => { const animation = el.getAnimations().find(a => a.animationName?.startsWith('catalog-product-name-scroll')); if (!animation) throw new Error('name scroll animation absent'); animation.pause(); animation.currentTime = 800 })
    assert.ok(await text.evaluate(el => getComputedStyle(el).transform === 'none' || Math.abs(new DOMMatrix(getComputedStyle(el).transform).m42) < 0.1), 'name stays still before the 900ms delay')
    await text.evaluate(el => { const animation = el.getAnimations().find(a => a.animationName?.startsWith('catalog-product-name-scroll')); if (!animation) throw new Error('name scroll animation absent'); animation.pause(); animation.currentTime = 900 + animation.effect.getTiming().duration * 0.9 })
    assert.ok(await text.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42 < -1), 'overflow name really translates')
    await page.evaluate(() => { state.width = 450 })
    await expect.poll(() => tile.evaluate(el => parseFloat(el.style.getPropertyValue('--name-scroll-distance')))).toBeLessThan(distance)
    const resizedDistance = await tile.evaluate(el => parseFloat(el.style.getPropertyValue('--name-scroll-distance')))
    await name.evaluate(el => { el.style.fontSize = '20px'; document.fonts.dispatchEvent(new Event('loadingdone')) })
    await expect.poll(() => tile.evaluate(el => parseFloat(el.style.getPropertyValue('--name-scroll-distance')))).toBeGreaterThan(resizedDistance)
    await name.evaluate(el => { el.style.fontSize = ''; document.fonts.dispatchEvent(new Event('loadingdone')) })
    await page.evaluate(() => { state.width = 300 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    assert.equal(await text.evaluate(el => getComputedStyle(el).animationName), 'none')
    assert.equal(await text.evaluate(el => getComputedStyle(el).transform), 'none')
    assert.equal(await sku.evaluate(el => getComputedStyle(el).transitionDuration), '0s')
    await assertZeroRowPadding()
    await assertNoSkuOverlap()
    await page.mouse.move(1000, 10)
    assert.equal(await sku.evaluate(el => el.getBoundingClientRect().height), 0, 'reduced motion restores compact idle immediately')
    await tile.hover()
    assert.equal(await sku.evaluate(el => el.getBoundingClientRect().height), 12)
    await assertNoSkuOverlap()
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.evaluate(() => { state.product.name = 'Short'; state.product.name_uk = 'Коротка назва'; locale.value = 'uk'; document.fonts.dispatchEvent(new Event('loadingdone')) })
    await expect(tile).not.toHaveClass(/--long-name/)
    await expect(name).toContainText('Коротка назва')
    assert.equal(await name.evaluate(el => el.textContent.trim()), 'Коротка назва', 'localized semantic name occurs once, without its measurement mirror')
    await page.setViewportSize({ width: 500, height: 900 })
    await page.evaluate(value => { state.product.name_uk = value }, longName)
    await expect(tile).not.toHaveClass(/--long-name/)
    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(tile).toHaveClass(/--long-name/)
    await page.evaluate(() => { state.product.name_uk = 'Short'; state.product.images = [{ image: '/mock.png' }, { image: '/mock.png' }] })
    await expect(tile).not.toHaveClass(/--long-name/)
    await tile.hover()
    await tile.locator('.catalog-product-tile__favorite').click()
    await tile.locator('.catalog-product-tile__desktop-layout .catalog-product-tile__cart').click()
    assert.deepEqual(await page.evaluate(() => calls), ['favorite', 'cart'], 'layout changes preserve independent favorite/cart actions')
    const dots = tile.locator('.catalog-product-tile__dot-target')
    await dots.nth(1).click()
    await expect(dots.nth(1)).toHaveAttribute('aria-pressed', 'true')
    await tile.locator('.catalog-product-tile__link').focus()
    await page.keyboard.press('ArrowLeft')
    await expect(dots.nth(0)).toHaveAttribute('aria-pressed', 'true')
    await page.evaluate(() => { state.product.name_uk = 'Short'; unmountFixture(); window.dispatchEvent(new Event('resize')); document.fonts.dispatchEvent(new Event('loadingdone')) })
    await page.waitForTimeout(100)
    assert.deepEqual(errors, [])
    await context.close()
    const mobile = await mount(true)
    await mobile.page.evaluate(value => { state.product.name = value }, longName)
    const mobileTile = mobile.page.locator('.catalog-product-tile')
    const before = await mobileTile.boundingBox()
    const mobileBody = mobileTile.locator('.catalog-product-tile__body')
    const mobileBodyBefore = await mobileBody.boundingBox()
    await mobileTile.tap()
    await mobile.page.waitForTimeout(350)
    assert.deepEqual(await mobileTile.boundingBox(), before)
    assert.deepEqual(await mobileBody.boundingBox(), mobileBodyBefore, 'touch must not expand the body')
    await expect(mobileTile).not.toHaveClass(/--long-name|--scroll-name/)
    assert.equal(await mobile.page.locator('.catalog-product-tile__sku').evaluate(el => getComputedStyle(el).display), 'none')
    assert.equal(await mobile.page.locator('.catalog-product-tile__details-row').evaluate(el => getComputedStyle(el).paddingTop), '0px')
    await mobile.page.evaluate(() => { unmountFixture(); window.dispatchEvent(new Event('resize')) })
    assert.deepEqual(mobile.errors, [])
    await mobile.context.close()
  })
}
