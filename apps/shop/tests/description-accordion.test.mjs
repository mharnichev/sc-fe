import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'

const require = createRequire(import.meta.url)
const runtime = createRequire(require.resolve('nuxt/package.json'))
const Vue = runtime('vue')
const { renderToString } = runtime('@vue/server-renderer')
const { parse, compileScript } = runtime('@vue/compiler-sfc')
const { transform } = runtime('esbuild')
const base = await readFile(new URL('../components/ui/BaseAccordion.vue', import.meta.url), 'utf8')
const page = await readFile(new URL('../pages/products/[slug].vue', import.meta.url), 'utf8')

async function serverComponent(source) {
  const { descriptor } = parse(source)
  const compiled = compileScript(descriptor, { id: 'description-ssr', inlineTemplate: true, templateOptions: { ssr: true } })
  const { code } = await transform(compiled.content, { loader: 'ts', format: 'cjs' })
  const module = { exports: {} }
  runInNewContext(code, { ...Vue, module, exports: module.exports, require: runtime })
  return module.exports.default
}

const Accordion = await serverComponent(base)
test('base defaults SSR closed; explicit open and preview SSR expose content without browser globals', async () => {
  for (const [props, open] of [[{}, false], [{ modelValue: true }, true], [{ previewHeight: 200 }, true]]) {
    const html = await renderToString(Vue.createSSRApp({ render: () => Vue.h(Accordion, props, { summary: () => 'Summary', default: () => 'Body' }) }))
    assert.equal(/<details[^>]*\sopen(?:[\s>])/.test(html), open)
    assert.match(html, /Body/)
    assert.match(html, new RegExp(`aria-expanded="${!!props.modelValue}"`))
    assert.doesNotMatch(html, /height:|aria-disabled="true"/)
  }
})

test('page description SSR is expanded and inert until client measurement', async () => {
  const logic = page.slice(page.indexOf('const descriptionElement ='), page.indexOf('const plainProductDescription ='))
  const template = page.match(/<BaseAccordion\s+v-if="productDescriptionHtml"[\s\S]*?<\/BaseAccordion>/)[0]
  const Description = await serverComponent(`<script setup lang="ts">const productDescriptionHtml = ref('<p>Text</p>'); const productText = {description: 'Description'}; ${logic}</script><template>${template}</template>`)
  const app = Vue.createSSRApp(Description)
  app.component('BaseAccordion', Accordion)
  const html = await renderToString(app)
  assert.match(html, /<details[^>]* open/)
  assert.match(html, /aria-disabled="true"/)
  assert.match(html, /aria-expanded="true"/)
  assert.match(html, /<p>Text<\/p>/)
})
