import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { runInNewContext } from 'node:vm'

const require = createRequire(import.meta.url)
const runtime = createRequire(require.resolve('nuxt/package.json'))
const { parse, compileScript, compileStyle } = runtime('@vue/compiler-sfc')
const { build, transform } = runtime('esbuild')
const { chromium, webkit, expect } = require('@playwright/test')
const root = new URL('../', import.meta.url)
const pageSource = await readFile(new URL('pages/products/[slug].vue', root), 'utf8')
const logic = pageSource.slice(pageSource.indexOf('const descriptionElement ='), pageSource.indexOf('const plainProductDescription ='))
const template = pageSource.match(/<BaseAccordion\s+v-if="productDescriptionHtml"[\s\S]*?<\/BaseAccordion>/)[0]
const css = pageSource.slice(pageSource.indexOf(':deep(.product-description__summary)'), pageSource.indexOf('.product-characteristics__list {'))
const sources = {
  Accordion: await readFile(new URL('components/ui/BaseAccordion.vue', root), 'utf8'),
  Description: `<script setup lang="ts">const productDescriptionHtml = window.descriptionHtml; const productText = { description: 'Description' }; ${logic}</script><template>${template}</template><style scoped>${css}</style>`,
}
const modules = {}, styles = []
const serverModules = {}
for (const [name, source] of Object.entries(sources)) {
  const { descriptor } = parse(source)
  const id = `data-v-description-${name}`
  modules[name] = `${compileScript(descriptor, { id, inlineTemplate: true, genDefaultAs: 'component' }).content}\ncomponent.__scopeId = '${id}'; export default component`
  for (const style of descriptor.styles) styles.push(compileStyle({ source: style.content, id, scoped: true }).code)
  const serverDescriptor = parse(source.replace('window.descriptionHtml', "ref('<p>Short</p>')")).descriptor
  const serverScript = compileScript(serverDescriptor, { id, inlineTemplate: true, templateOptions: { ssr: true } })
  const serverCode = await transform(serverScript.content, { loader: 'ts', format: 'cjs' })
  const module = { exports: {} }
  runInNewContext(serverCode.code, { ...runtime('vue'), module, exports: module.exports, require: runtime })
  module.exports.default.__scopeId = id
  serverModules[name] = module.exports.default
}
const { createSSRApp, h } = runtime('vue')
const serverApp = createSSRApp({ render: () => h('main', [h('button', { id: 'before-preview' }, 'Before preview'), h(serverModules.Description), h('button', { id: 'after-preview' }, 'After preview'), h(serverModules.Accordion, { id: 'default', modelValue: false }, { summary: () => 'Default', default: () => 'Default body' })]) })
serverApp.component('BaseAccordion', serverModules.Accordion)
const serverHtml = await runtime('@vue/server-renderer').renderToString(serverApp)
const bundle = await build({ stdin: { contents: `
import * as Vue from 'vue'; import Accordion from 'Accordion'; import Description from 'Description';
Object.assign(globalThis, Vue);
window.descriptionHtml = Vue.ref('<p>Short</p>'); window.baseOpen = Vue.ref(false);
const app = Vue.createSSRApp({ render: () => Vue.h('main', [Vue.h('button', { id: 'before-preview' }, 'Before preview'), Vue.h(Description), Vue.h('button', { id: 'after-preview' }, 'After preview'), Vue.h(Accordion, { id: 'default', modelValue: baseOpen.value, 'onUpdate:modelValue': v => baseOpen.value = v }, { summary: () => 'Default', default: () => 'Default body' })]) });
app.component('BaseAccordion', Accordion); app.mount('#app'); window.unmountFixture = () => app.unmount();
`, resolveDir: dirname(runtime.resolve('vue/package.json')) }, bundle: true, write: false, format: 'iife', define: { __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'true' }, plugins: [{ name: 'fixture', setup(builder) {
  builder.onResolve({ filter: /^(Accordion|Description)$/ }, args => ({ path: args.path, namespace: 'fixture' }))
  builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: modules[args.path], loader: 'ts', resolveDir: dirname(runtime.resolve('vue/package.json')) }))
} }] })

for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  test(`${name}: rendered description lines, resize, fonts, toggles and teardown`, { timeout: 60000 }, async t => {
    const browser = await engine.launch({ headless: true, timeout: 15000 })
    t.after(() => browser.close())
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
    page.setDefaultTimeout(5000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (/hydration/i.test(message.text())) errors.push(message.text()) })
    await page.setContent(`<meta name="viewport" content="width=device-width,initial-scale=1"><div id="app">${serverHtml}</div>`)
    await page.addStyleTag({ content: `body { margin: 0 } main { width: 100%; max-width: 650px } h2 { margin:0; font-size:18px } ${styles.join('\n')}` })
    await page.addScriptTag({ content: bundle.outputFiles[0].text })
    const accordion = page.locator('.product-description')
    const summary = accordion.locator('summary')
    const setLines = async n => page.evaluate(n => { descriptionHtml.value = `<p>${Array.from({ length: n }, (_, i) => `Line ${i} <strong>emphasis</strong>`).join('<br>')}</p>` }, n)
    await expect(summary).toHaveAttribute('aria-disabled', 'true')
    await setLines(10)
    await expect(summary).toHaveAttribute('aria-disabled', 'true')
    await setLines(11)
    await expect(summary).not.toHaveAttribute('aria-disabled', 'true')
    await expect(summary).toHaveAttribute('aria-expanded', 'false')
    await expect.poll(() => accordion.evaluate(el => el.style.height)).not.toBe('')
    const preview = await accordion.evaluate(el => {
      const text = el.querySelector('.product-description__html')
      const range = document.createRange(); range.selectNodeContents(text.lastChild)
      const rects = [...range.getClientRects()].filter(r => r.width && r.height)
      const tops = [...new Set(rects.map(r => Math.round(r.top)))].sort((a,b) => a-b)
      return { bottom: el.getBoundingClientRect().bottom, tenth: tops[9], eleventh: tops[10] }
    })
    assert.ok(preview.bottom > preview.tenth && preview.bottom <= preview.eleventh, JSON.stringify(preview))
    await summary.click()
    await expect(summary).toHaveAttribute('aria-expanded', 'true')
    await page.waitForTimeout(650)
    assert.equal(await accordion.evaluate(el => el.style.height), '')
    await summary.focus(); await page.keyboard.press('Enter')
    await expect(summary).toHaveAttribute('aria-expanded', 'false')
    await summary.click(); await page.waitForTimeout(40); await summary.click(); await page.waitForTimeout(650)
    await expect(summary).toHaveAttribute('aria-expanded', 'false')
    assert.equal(await accordion.locator('.product-description__html').evaluate(el => getComputedStyle(el.parentElement).opacity), '1')
    await page.evaluate(() => { descriptionHtml.value = '<p>' + Array.from({ length: 12 }, (_, i) => `Line ${i}`).join('<br>') + '<br><a id="preview-link" href="#preview-link">Hidden link</a></p>' })
    await expect(summary).toHaveAttribute('aria-expanded', 'false')
    await expect.poll(() => accordion.locator('.product-description__html').evaluate(el => el.parentElement.inert)).toBe(true)
    await page.locator('#preview-link').evaluate(el => el.focus())
    assert.notEqual(await page.evaluate(() => document.activeElement?.id), 'preview-link', 'collapsed preview rejects even explicit hidden-link focus')
    await page.locator('#before-preview').focus()
    await page.keyboard.press('Tab')
    await expect(summary).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.locator('#after-preview')).toBeFocused()
    assert.equal(await accordion.evaluate(el => el.scrollTop), 0, 'clipped content must not scroll to hidden focus targets')
    await summary.click(); await page.waitForTimeout(650)
    assert.equal(await accordion.locator('.product-description__html').evaluate(el => el.parentElement.inert), false)
    await page.locator('#preview-link').focus()
    await expect(page.locator('#preview-link')).toBeFocused()
    await summary.click(); await page.waitForTimeout(650)
    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(summary).toHaveAttribute('aria-disabled', 'true')
    await expect(summary).toHaveAttribute('aria-expanded', 'true')
    await page.setViewportSize({ width: 1279, height: 900 })
    await expect(summary).toHaveAttribute('aria-expanded', 'false')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await summary.click(); await summary.click()
    await expect(summary).toHaveAttribute('aria-expanded', 'false')
    await page.evaluate(() => { descriptionHtml.value = '<p>' + 'localized wrapping words '.repeat(18) + '</p>' })
    await page.setViewportSize({ width: 390, height: 900 })
    await page.evaluate(() => { document.querySelector('.product-description__html').style.fontSize = '30px'; document.fonts.dispatchEvent(new Event('loadingdone')) })
    await expect(summary).not.toHaveAttribute('aria-disabled', 'true')
    await page.evaluate(() => { descriptionHtml.value = '<p>Localized short text</p>' })
    await expect(summary).toHaveAttribute('aria-disabled', 'true')
    const base = page.locator('#default')
    assert.equal(await base.evaluate(el => el.open), false)
    await base.locator('summary').click()
    await expect(base.locator('summary')).toHaveAttribute('aria-expanded', 'true')
    assert.equal(await base.evaluate(el => el.open), true)
    await base.locator('summary').click()
    assert.equal(await base.evaluate(el => el.open), false)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await base.locator('summary').click()
    await page.waitForTimeout(650)
    await base.locator('summary').click()
    assert.equal(await base.evaluate(el => el.open), true, 'default consumers retain content during close animation')
    await page.waitForTimeout(650)
    assert.equal(await base.evaluate(el => el.open), false)
    await setLines(15)
    await expect(summary).not.toHaveAttribute('aria-disabled', 'true')
    await summary.click()
    await page.evaluate(() => { unmountFixture(); window.dispatchEvent(new Event('resize')); document.fonts.dispatchEvent(new Event('loadingdone')) })
    await page.waitForTimeout(650)
    assert.deepEqual(errors, [])
  })
}
