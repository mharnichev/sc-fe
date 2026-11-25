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

test('page description SSR renders the full text before client measurement', async () => {
  const logic = page.slice(page.indexOf('const descriptionElement ='), page.indexOf('const plainProductDescription ='))
  const template = page.match(/<div v-if="productDescriptionHtml" class="product-description">[\s\S]*?<\/BaseButton>\s*<\/div>/)[0]
  const Description = await serverComponent(`<script setup lang="ts">const productDescriptionHtml = ref('<p>Text</p>'); const productDetailsId = 'product'; ${logic}</script><template>${template}</template>`)
  const app = Vue.createSSRApp(Description)
  app.component('BaseButton', { render: () => Vue.h('button') })
  app.component('BaseIcon', { render: () => null })
  const html = await renderToString(app)
  assert.doesNotMatch(html, /inert|max-height|<button/)
  assert.match(html, /<p>Text<\/p>/)
})
