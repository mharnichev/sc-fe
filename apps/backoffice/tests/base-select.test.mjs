import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const nuxtRequire = createRequire(require.resolve('nuxt/package.json'))
const { parse, compileScript } = nuxtRequire('@vue/compiler-sfc')
const { createSSRApp } = nuxtRequire('vue')
const { renderToString } = nuxtRequire('vue/server-renderer')
const source = (await readFile(new URL('../components/BaseSelect.vue', import.meta.url), 'utf8'))
  .replace('<script setup lang="ts">', '<script setup lang="ts">\nimport { computed, useAttrs, ref, watch, nextTick, onMounted, onBeforeUnmount } from "vue"')
const { descriptor } = parse(source)
const script = compileScript(descriptor, { id: 'select-regression', inlineTemplate: true })
const compiled = ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const exports = {}
vm.compileFunction(compiled, ['require', 'exports'])(nuxtRequire, exports)
const render = props => {
  const app = createSSRApp(exports.default, props)
  // The native branch has no BaseField/BaseButton descendants; register the
  // unused components because compiled render functions resolve them eagerly.
  app.component('BaseField', { render: () => null })
  app.component('BaseButton', { render: () => null })
  return renderToString(app)
}

test('native select uses legacy value when modelValue is absent', async () => {
  assert.match(await render({ native: true, value: 12 }), / value="12"/)
  assert.match(await render({ native: true, value: 'telegram' }), / value="telegram"/)
  assert.match(await render({ native: true }), / value(?:="")?(?=[ >])/)
})

test('select preserves explicit false and model precedence', async () => {
  assert.match(await render({ native: true, modelValue: false, value: 'fallback' }), / value="false"/)
  assert.match(await render({ native: true, modelValue: 12, value: 13 }), / value="12"/)
})
