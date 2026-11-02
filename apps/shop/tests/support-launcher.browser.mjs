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
const modules = {}, sources = {}, styles = []
for (const [name, path] of Object.entries({ Launcher: 'components/ShopSupportLauncher.vue', Button: 'components/ui/BaseButton.vue' })) {
  const source = sources[name] = await readFile(new URL(path, root), 'utf8')
  const { descriptor } = parse(source)
  const id = `data-v-support-${name.toLowerCase()}`
  modules[name] = `${compileScript(descriptor, { id, inlineTemplate: true, genDefaultAs: 'component' }).content}\ncomponent.__scopeId = '${id}'; export default component`
  for (const style of descriptor.styles) styles.push(compileStyle({ source: style.content, id, scoped: !!style.scoped }).code)
}
const helper = await readFile(new URL('utils/dobrodesk.ts', root), 'utf8')
const postcss = runtime('postcss')
const sheet = postcss.parse(await readFile(new URL('assets/css/main.css', root), 'utf8'))
// Keep production button/layout CSS, but do not request font assets in this offline fixture.
sheet.walkAtRules('font-face', rule => rule.remove())
styles.unshift((await postcss([runtime('tailwindcss')({ content: [{ raw: Object.values(sources).join('\n'), extension: 'vue' }] })])
  .process(sheet, { from: new URL('assets/css/main.css', root).pathname })).css)
const bundle = await build({
  stdin: { contents: `
import * as Vue from 'vue';
import { createRouter, createMemoryHistory, RouterLink } from 'vue-router';
import Launcher from 'Launcher'; import Button from 'Button';
Object.assign(globalThis, Vue);
window.fixture = Vue.reactive({
  config: { public: { dobrodeskEnabled: true, dobrodeskIntegrationId: 'fixture-public-id' }, app: { baseURL: '/shop/' } },
  route: { name: 'index', path: '/shop/', query: {}, hash: '' },
  modal: { activeModal: null }, calls: 0,
});
window.supportStatus = Vue.ref('idle'); window.supportLocale = Vue.ref('uk');
window.useRuntimeConfig = () => fixture.config;
window.useRoute = () => fixture.route;
window.useModalStore = () => fixture.modal;
window.useShopLocale = () => ({ locale: supportLocale });
window.useNuxtApp = () => ({ $shopSupport: { status: supportStatus, open() { fixture.calls++; supportStatus.value = 'loading' } } });
const router = createRouter({ history: createMemoryHistory('/shop/'), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] });
const app = Vue.createApp({ render: () => Vue.h(Launcher) });
app.use(router); app.component('NuxtLink', RouterLink); app.component('BaseButton', Button);
app.component('BaseIcon', { render: () => Vue.h('span', { 'aria-hidden': 'true', style: 'display:inline-block;width:12px;height:12px' }) });
router.push('/').then(() => { app.mount('#app'); window.fixtureReady = true });
window.unmountFixture = () => app.unmount();
`, resolveDir: dirname(runtime.resolve('vue/package.json')) },
  bundle: true, write: false, format: 'iife',
  define: { __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'true', 'import.meta.dev': 'false' },
  plugins: [{ name: 'support-fixture', setup(builder) {
    builder.onResolve({ filter: /^(Launcher|Button|~\/utils\/dobrodesk)$/ }, args => ({ path: args.path, namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: modules[args.path] || helper, loader: 'ts', resolveDir: dirname(runtime.resolve('vue/package.json')) }))
  } }],
})

for (const [engineName, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  for (const width of [390, 1440]) {
    test(`${engineName} ${width}: real support launcher visibility, activation, fallback and geometry`, { timeout: 60000 }, async t => {
      const browser = await engine.launch({ headless: true, timeout: 15000 })
      t.after(() => browser.close())
      const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width === 390, isMobile: width === 390 })
      const requests = [], errors = []
      await context.route('**/*', route => { requests.push(route.request().url()); return route.abort() })
      const page = await context.newPage()
      page.setDefaultTimeout(5000)
      page.on('pageerror', error => errors.push(error.message))
      await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="app"></div><nav id="bottom-nav" aria-label="Fixture navigation"></nav>')
      await page.addStyleTag({ content: `${styles.join('\n')} #bottom-nav { position:fixed;bottom:0;left:0;right:0;height:44px;background:#eee } @media(min-width:768px) { #bottom-nav {display:none} }` })
      await page.addScriptTag({ content: bundle.outputFiles[0].text })
      await page.waitForFunction(() => window.fixtureReady)
      const launcher = page.locator('.shop-support')
      const button = launcher.getByRole('button')
      await expect(launcher).toBeVisible()
      await expect(launcher).toHaveAttribute('aria-label', 'Допомога')
      await expect(button).toHaveAccessibleName('Допомога')
      assert.equal(await page.evaluate(() => fixture.calls), 0)

      for (const enabled of [false, 'false', '', null]) {
        await page.evaluate(value => { fixture.config.public.dobrodeskEnabled = value }, enabled)
        await expect(launcher).toHaveCount(0)
      }
      for (const enabled of [true, 'true']) {
        await page.evaluate(value => { fixture.config.public.dobrodeskEnabled = value }, enabled)
        await expect(launcher).toBeVisible()
      }
      await page.evaluate(() => { fixture.config.public.dobrodeskIntegrationId = '' })
      await expect(launcher).toHaveCount(0)
      await page.evaluate(() => { fixture.config.public.dobrodeskIntegrationId = 'fixture-public-id' })
      await expect(launcher).toBeVisible()
      await page.evaluate(() => { fixture.route.query = { order: 'private' } })
      await expect(launcher).toHaveCount(0)
      await page.evaluate(() => { fixture.route.query = {}; fixture.route.hash = '#private' })
      await expect(launcher).toHaveCount(0)
      await page.evaluate(() => { fixture.route.hash = '' })
      for (const path of ['/shop/orders/123', '/shop/cabinet/orders/123', '/shop/checkout', '/shop/account']) {
        await page.evaluate(path => { fixture.route.path = path }, path)
        await expect(launcher).toHaveCount(0)
      }
      await page.evaluate(() => { fixture.route.name = 'cabinet-contact'; fixture.route.path = '/shop/cabinet/contact' })
      await expect(launcher).toHaveCount(0)
      for (const path of ['/shop/cabinet/contact', '/shop/cabinet/contact/']) {
        await page.evaluate(path => { fixture.route.name = undefined; fixture.route.path = path }, path)
        await expect(launcher).toHaveCount(0)
      }
      await page.evaluate(() => { fixture.route.name = 'products-slug'; fixture.route.path = '/shop/products/shampoo' })
      await expect(launcher).toBeVisible()
      await page.evaluate(() => { fixture.modal.activeModal = 'UserBasketModal' })
      await expect(launcher).toHaveCount(0)
      await page.evaluate(() => { fixture.modal.activeModal = null })
      await expect(launcher).toBeVisible()

      const geometry = async () => {
        const rect = await launcher.boundingBox()
        const target = await button.boundingBox()
        assert.ok(rect && target)
        assert.ok(rect.x >= 0 && rect.x + rect.width <= width + 1, 'launcher stays inside viewport')
        assert.ok(target.height >= 44, 'launcher touch target is at least 44px high')
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal page overflow')
        if (width === 390) {
          const nav = await page.locator('#bottom-nav').boundingBox()
          assert.ok(rect.y + rect.height <= nav.y - 19, 'launcher clears 44px navigation by 20px')
          assert.equal(await launcher.evaluate(el => getComputedStyle(el).bottom), '64px')
        }
      }
      await geometry()
      if (width === 390) await button.tap()
      else await button.click()
      assert.equal(await page.evaluate(() => fixture.calls), 1, 'one pointer/touch activation calls open exactly once')
      await expect(button).toBeDisabled()
      await expect(button).toHaveAttribute('aria-busy', 'true')
      await expect(button).toHaveAccessibleName('Завантаження чату')
      await button.evaluate(el => { el.click(); el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })) })
      assert.equal(await page.evaluate(() => fixture.calls), 1, 'loading blocks native and synthetic duplicate clicks')
      await page.evaluate(() => { supportLocale.value = 'en' })
      await expect(button).toHaveAccessibleName('Loading chat')
      await page.evaluate(() => { supportStatus.value = 'ready' })
      await expect(button).toBeEnabled()
      await expect(button).toHaveAccessibleName('Support')
      await expect(launcher).toHaveAttribute('aria-label', 'Support')
      await button.focus()
      await page.keyboard.press('Enter')
      assert.equal(await page.evaluate(() => fixture.calls), 2, 'Enter activates once')
      await page.keyboard.press('Enter')
      assert.equal(await page.evaluate(() => fixture.calls), 2, 'loading also blocks repeated keyboard activation')
      await page.evaluate(() => { supportStatus.value = 'ready' })
      await button.focus()
      await page.keyboard.press('Space')
      assert.equal(await page.evaluate(() => fixture.calls), 3, 'Space activates once')

      await page.evaluate(() => { supportStatus.value = 'error' })
      await expect(button).toBeDisabled()
      await expect(launcher.getByRole('status')).toContainText('Chat is temporarily unavailable.')
      const contacts = launcher.getByRole('link', { name: 'Other ways to contact us' })
      await expect(contacts).toHaveAttribute('href', '/shop/contacts')
      await contacts.focus()
      await expect(contacts).toBeFocused()
      await geometry()
      await button.evaluate(el => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
      assert.equal(await page.evaluate(() => fixture.calls), 3, 'error state cannot reopen support')
      await page.evaluate(() => { supportLocale.value = 'uk' })
      await expect(button).toHaveAccessibleName('Допомога')
      await expect(launcher.getByRole('status')).toContainText('Чат тимчасово недоступний.')
      await expect(launcher.getByRole('link', { name: 'Інші способи зв’язку' })).toHaveAttribute('href', '/shop/contacts')
      await geometry()
      await page.evaluate(() => { unmountFixture() })
      await expect(launcher).toHaveCount(0)
      assert.deepEqual(errors, [])
      assert.deepEqual(requests, [], 'fixture never loads SDK, fonts or other network resources')
      await context.close()
    })
  }
}
