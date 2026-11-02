import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'

const require = createRequire(import.meta.url)
const runtime = createRequire(require.resolve('nuxt/package.json'))
const { parse, compileScript, compileStyle } = runtime('@vue/compiler-sfc')
const { build } = runtime('esbuild')
const { chromium, webkit } = require('@playwright/test')
const root = new URL('../', import.meta.url)
const navbar = await readFile(new URL('components/base/BaseBottomBar.vue', root), 'utf8')
const badges = await readFile(new URL('components/catalog/ProductStatusBadges.vue', root), 'utf8')
const detail = await readFile(new URL('pages/products/[slug].vue', root), 'utf8')
const modules = {}, styles = []
for (const [name, source] of Object.entries({ Navbar: navbar, Badges: badges })) {
  const { descriptor } = parse(source)
  const id = `data-v-test-${name.toLowerCase()}`
  const script = compileScript(descriptor, { id, inlineTemplate: true, genDefaultAs: 'component' })
  modules[name] = `${script.content}\ncomponent.__scopeId = '${id}'; export default component`
  for (const style of descriptor.styles) styles.push(compileStyle({ source: style.content, id, scoped: true }).code)
}
// Compile the actual page's scoped CSS without executing its checkout/product logic.
const pageStyle = detail.match(/<style scoped>([\s\S]*?)<\/style>/)[1]
styles.push(compileStyle({ source: pageStyle, id: 'data-v-test-detail', scoped: true }).code)
const status = await readFile(new URL('utils/product-status.ts', root), 'utf8')
const entry = `
import * as Vue from 'vue'; import Navbar from 'Navbar'; import Badges from 'Badges';
Object.assign(globalThis, Vue);
const { h, reactive, ref, createApp } = Vue;
window.state = reactive({ route: { path: '/sale', fullPath: '/sale', name: 'sale' }, authenticated: true, name: 'Ada Lovelace' });
window.calls = [];
window.useRoute = () => state.route;
window.useCartStore = () => ({ count: 2 });
window.useFavoritesStore = () => ({ count: 1 });
window.useCustomerAuthStore = () => ({ get isAuthenticated() { return state.authenticated }, get displayName() { return state.name } });
window.useModalStore = () => ({ openModal: name => calls.push(name) });
const terms = { cabinet: { myOrders: 'Orders', settings: 'Settings' }, common: { main: 'Home', cabinet: 'Cabinet', catalog: 'Catalog', cart: 'Cart', favorites: 'Favorites', account: 'Account' }, header: { shopActions: 'Shop actions' }, catalog: { badges: { top: 'TOP', new: 'New', label: 'Product badges' } } };
window.useShopLocale = () => ({ locale: ref('en'), terms: ref(terms) });
const app = createApp({ render: () => [h(Navbar), h('div', { 'data-v-test-detail': '', class: 'product-buy__header-badges', id: 'detail-top' }, [h(Badges, { product: { price: '100', is_top: true } })]), h('div', { id: 'unscoped-top' }, [h(Badges, { product: { price: '100', is_top: true } })])] });
app.component('NuxtLink', { props: ['to'], setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()) });
app.component('BaseIcon', { props: ['name'], setup: props => () => h('span', { class: 'base-icon', 'data-icon': props.name }, props.name === 'star' ? '★' : '') });
app.component('FeedbackFace', { render: () => h('span', 'Guest') });
app.component('NavCartCounter', { props: ['count'], setup: props => () => h('span', String(props.count)) });
app.mount('#app');
`
const bundle = await build({ stdin: { contents: entry, resolveDir: dirname(runtime.resolve('vue/package.json')) }, bundle: true, write: false, format: 'iife', define: { 'import.meta.client': 'true' }, plugins: [{ name: 'scoped-ui', setup(builder) {
  builder.onResolve({ filter: /^(Navbar|Badges|~\/utils\/product-status)$/ }, args => ({ path: args.path, namespace: 'fixture' }))
  builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: modules[args.path] || status, loader: 'ts', resolveDir: dirname(runtime.resolve('vue/package.json')) }))
} }] })

for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  test(`${name}: scoped TOP material and account states preserve navbar behavior`, { timeout: 60000 }, async t => {
    const browser = await engine.launch({ headless: true })
    t.after(() => browser.close())
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
    await context.route('**/*', route => route.abort())
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;background:white}</style><div id="app"></div>')
    await page.addStyleTag({ content: styles.join('\n') })
    await page.addScriptTag({ content: bundle.outputFiles[0].text })
    const account = page.getByRole('button', { name: 'Account', exact: true })
    const appearance = locator => locator.evaluate(el => {
      const s = getComputedStyle(el)
      return { background: s.backgroundColor, shadow: s.boxShadow, outline: s.outlineStyle, width: s.outlineWidth }
    })
    for (const dark of [false, true]) {
      await page.evaluate(dark => {
        document.body.dataset.headerTheme = dark ? 'dark' : 'light'
        document.querySelector('nav').classList.toggle('base-bottom-bar--on-dark', dark)
      }, dark)
      for (const action of ['default', 'hover', 'focus', 'tap']) {
        if (action === 'hover') await account.hover()
        if (action === 'focus') { await page.mouse.move(0, 0); await page.keyboard.press('Tab'); await account.focus() }
        if (action === 'tap') await account.tap()
        await page.waitForTimeout(200)
        const s = await appearance(account)
        assert.equal(s.background, 'rgba(0, 0, 0, 0)', `${dark}/${action}`)
        assert.equal(s.shadow, 'none')
        if (action === 'focus') { assert.equal(s.outline, 'solid'); assert.equal(s.width, '1px') }
      }
      await account.hover()
      await page.mouse.down()
      assert.equal((await appearance(account)).background, 'rgba(0, 0, 0, 0)', 'held pointer must not fill the account button')
      await page.mouse.up()
      const avatar = await account.locator('.base-bottom-bar__avatar').evaluate(el => {
        const s = getComputedStyle(el)
        return [el.textContent, s.backgroundColor, s.boxSizing, s.minWidth, s.height, s.paddingLeft, s.borderRadius, s.alignItems, s.justifyContent]
      })
      assert.deepEqual(avatar.slice(0, 3), ['AL', 'rgb(10, 10, 10)', 'content-box'])
      assert.ok(Math.abs(parseFloat(avatar[3]) - 21.6) < 0.1)
      assert.ok(Math.abs(parseFloat(avatar[4]) - 21.6) < 0.1)
      assert.deepEqual(avatar.slice(5), ['4px', '4px', 'center', 'center'])
    }
    assert.equal(await page.getByRole('button', { name: 'Catalog', exact: true }).getAttribute('aria-current'), 'page')
    await page.getByRole('button', { name: 'Catalog', exact: true }).click()
    assert.ok((await page.evaluate(() => calls)).includes('CatalogModal'))
    await page.evaluate(() => { state.route.path = '/cabinet/settings'; state.route.fullPath = '/cabinet/settings' })
    assert.equal(await account.getAttribute('aria-current'), 'page')
    assert.equal((await appearance(account)).background, 'rgba(0, 0, 0, 0)', 'current account stays unfilled')
    assert.equal(await page.getByRole('link', { name: 'Settings', exact: true }).getAttribute('aria-current'), 'page')
    assert.notEqual((await appearance(page.getByRole('link', { name: 'Settings', exact: true }))).background, 'rgba(0, 0, 0, 0)')
    await account.click()
    assert.equal(await page.evaluate(() => calls.at(-1)), 'CabinetModal')
    await page.evaluate(() => { state.authenticated = false })
    await account.click()
    assert.equal(await page.evaluate(() => calls.at(-1)), 'UserAuthModal')
    assert.equal(await account.locator('.base-bottom-bar__avatar').count(), 0)
    const top = page.locator('#detail-top .product-status-badges__item--top')
    assert.equal(await top.locator('[data-icon="star"]').count(), 1)
    assert.ok((await top.textContent()).includes('TOP'))
    assert.ok((await top.evaluate(el => getComputedStyle(el).backgroundImage)).includes('linear-gradient'))
    assert.equal(await page.locator('#unscoped-top .product-status-badges__item--top').evaluate(el => getComputedStyle(el).backgroundImage), 'none')
    await page.emulateMedia({ contrast: 'more' })
    assert.equal(await top.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 248, 214)')
    assert.equal(await top.evaluate(el => getComputedStyle(el).backdropFilter || getComputedStyle(el).webkitBackdropFilter), 'none')
    await page.emulateMedia({ forcedColors: 'active' })
    assert.equal(await top.evaluate(el => getComputedStyle(el).boxShadow), 'none')
    assert.match(pageStyle, /@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\)/)
    assert.ok(pageStyle.includes('(prefers-reduced-transparency: reduce)'))
    assert.deepEqual(errors, [])
  })
}
