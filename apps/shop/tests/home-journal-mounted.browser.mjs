import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const require = createRequire(import.meta.url)
const runtime = createRequire(require.resolve('nuxt/package.json'))
const { parse, compileScript, compileStyle } = runtime('@vue/compiler-sfc')
const { build } = runtime('esbuild')
const { chromium } = require('@playwright/test')
const root = fileURLToPath(new URL('../', import.meta.url))
const styles = [], templates = [], modules = {}
for (const [name, path] of Object.entries({
  Journal: 'components/HomeJournalSection.vue', Layout: 'layouts/default.vue',
  AppSection: 'components/ui/AppSection.vue', BaseButton: 'components/ui/BaseButton.vue',
  BaseHoverUnderlineText: 'components/ui/BaseHoverUnderlineText.vue',
  BaseIcon: 'components/base/BaseIcon.vue', BaseScribbleOutline: 'components/base/BaseScribbleOutline.vue',
})) {
  const { descriptor } = parse(await readFile(join(root, path), 'utf8'))
  templates.push(descriptor.template.content)
  const id = `data-v-journal-${name.toLowerCase()}`
  modules[name] = `${compileScript(descriptor, { id, inlineTemplate: true, genDefaultAs: 'component' }).content}\ncomponent.__scopeId = '${id}'; export default component`
  for (const style of descriptor.styles) styles.push(compileStyle({ source: style.content, id, scoped: !!style.scoped }).code)
}
// Process the actual app's default Tailwind/shared CSS without a Nuxt build.
const sharedCss = await runtime('postcss')([runtime('tailwindcss')({ content: [{ raw: templates.join('\n'), extension: 'html' }] })])
  .process(await readFile(join(root, 'assets/css/main.css'), 'utf8'), { from: join(root, 'assets/css/main.css') })
styles.unshift(sharedCss.css, await readFile(join(root, 'assets/css/typography.css'), 'utf8'))
const entry = `
import * as Vue from 'vue'; import Journal from 'Journal'; import Layout from 'Layout';
import AppSection from 'AppSection'; import BaseButton from 'BaseButton';
import BaseHoverUnderlineText from 'BaseHoverUnderlineText'; import BaseIcon from 'BaseIcon';
import BaseScribbleOutline from 'BaseScribbleOutline';
Object.assign(globalThis, Vue);
window.fixture = Vue.reactive({ path: '/', locale: 'uk' });
window.useRoute = () => fixture;
window.useShopLocale = () => ({ locale: Vue.computed(() => fixture.locale) });
window.usePageTransitionOverlay = () => Vue.ref(false);
window.useHead = () => {};
window.useShopAsset = () => path => '/shop/' + path.replace(/^\\//, '');
const app = Vue.createApp({ setup: () => () => Vue.h(Layout, {}, () => Vue.h('div', { class: 'home-fixture' }, 'Catalog fixture')) });
for (const [name, component] of Object.entries({ HomeJournalSection: Journal, AppSection, BaseButton, BaseHoverUnderlineText, BaseIcon, BaseScribbleOutline })) app.component(name, component);
for (const name of ['BaseHeader', 'BaseFooter', 'BaseBottomBar']) app.component(name, { render: () => Vue.h('div') });
app.component('NuxtLink', { props: ['to'], setup: (p, { slots }) => () => Vue.h('a', { href: p.to }, slots.default?.()) });
app.mount('#app');
`
const bundle = await build({ stdin: { contents: entry, resolveDir: dirname(runtime.resolve('vue/package.json')) },
  bundle: true, write: false, format: 'iife', define: { 'import.meta.client': 'true' },
  loader: { '.webp': 'dataurl', '.png': 'dataurl' }, plugins: [{ name: 'journal-fixture', setup(builder) {
    builder.onResolve({ filter: new RegExp(`^(${Object.keys(modules).join('|')})$`) }, args => ({ path: args.path, namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: modules[args.path], loader: 'ts', resolveDir: dirname(runtime.resolve('vue/package.json')) }))
    builder.onResolve({ filter: /^~\// }, args => ({ path: join(root, args.path.slice(2)) }))
  } }],
})
const icon = await readFile(join(root, 'public/lehko/icons/default/product-buy-arrow.svg'))
const fontDir = join(root, 'public/fonts/cy-grotesk')
const fontFiles = await readdir(fontDir)

test('journal mounted layout renders snapshot images and localized root-blog links on desktop/mobile only at home', { timeout: 60000 }, async t => {
  const browser = await chromium.launch({ headless: true })
  t.after(() => browser.close())
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = [], unexpected = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', async route => {
    const path = new URL(route.request().url()).pathname
    const headers = { 'access-control-allow-origin': '*' }
    if (path.endsWith('/product-buy-arrow.svg')) return route.fulfill({ contentType: 'image/svg+xml', body: icon, headers })
    const weight = path.match(/cy-grotesk-key-(\d+)/)?.[1]
    const font = weight && fontFiles.find(name => name.startsWith(`cy-grotesk-key-${weight}.`))
    if (font) return route.fulfill({ contentType: 'font/woff2', body: await readFile(join(fontDir, font)), headers })
    unexpected.push(route.request().url())
    return route.abort()
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><base href="http://shop.test/"><div id="app"></div>')
  await page.addStyleTag({ content: styles.join('\n') })
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
  const journal = page.locator('.home-journal')
  await journal.scrollIntoViewIfNeeded()
  await page.waitForFunction(() => [...document.querySelectorAll('.home-journal__image')].every(image => image.complete && image.naturalWidth > 0))
  assert.equal(await journal.locator('article').count(), 2)
  assert.equal(await journal.locator('h2').textContent().then(v => v.trim()), 'Наш світ. Наша культура.')
  const hrefs = await journal.locator('a').evaluateAll(links => links.map(link => link.getAttribute('href')))
  assert.equal(hrefs.length, 6)
  assert.ok(hrefs.every(href => /^\/blog\/posts\/[a-z-]+\/$/.test(href)))
  assert.equal(await journal.evaluate(el => getComputedStyle(el).backgroundImage.startsWith('url("data:image/png;')), true)
  assert.equal(Math.round((await journal.boundingBox()).width), 1440)
  const desktopCards = await journal.locator('article').all()
  const first = await desktopCards[0].boundingBox(), second = await desktopCards[1].boundingBox()
  assert.ok(first.x + first.width <= second.x)
  await page.screenshot({ path: '/tmp/sc-fe-sale-ui-journal-1440-20261101.png', animations: 'disabled', fullPage: true })
  await page.evaluate(() => { fixture.locale = 'en' })
  assert.equal(await journal.locator('h2').textContent().then(v => v.trim()), 'Our world. Our culture.')
  assert.equal(await journal.locator('.home-journal__read').first().textContent().then(v => v.trim()), 'Read the story')
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    const grid = journal.locator('.home-journal__grid')
    assert.ok(await grid.evaluate(el => el.scrollWidth > el.clientWidth))
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    for (const heading of await journal.locator('h3').all()) assert.equal(await heading.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true)
    await grid.evaluate(el => { el.scrollLeft = el.scrollWidth })
    const last = await journal.locator('article').last().boundingBox(), track = await grid.boundingBox()
    assert.ok(last.x + last.width <= track.x + track.width + 1)
    await journal.locator('.home-journal__read').last().focus()
    assert.equal(await journal.locator('.home-journal__read').last().evaluate(el => el === document.activeElement), true)
    assert.equal(await journal.locator('img').first().evaluate(el => getComputedStyle(el).transitionDuration), '0s')
    await page.screenshot({ path: `/tmp/sc-fe-sale-ui-journal-${width}-20261101.png`, animations: 'disabled', fullPage: true })
  }
  await page.evaluate(() => { fixture.path = '/sale' })
  assert.equal(await journal.count(), 0)
  assert.deepEqual(errors, [])
  assert.deepEqual(unexpected, [])
})
