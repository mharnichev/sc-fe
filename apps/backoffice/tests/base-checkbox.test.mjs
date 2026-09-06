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
const source = (await readFile(new URL('../components/BaseCheckbox.vue', import.meta.url), 'utf8'))
  .replace('<script setup lang="ts">', '<script setup lang="ts">\nimport { computed, useAttrs } from "vue"')
const { descriptor } = parse(source)
const script = compileScript(descriptor, { id: 'checkbox-regression', inlineTemplate: true })
const compiled = ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const exports = {}
vm.compileFunction(compiled, ['require', 'exports'])(nuxtRequire, exports)
const render = props => renderToString(createSSRApp(exports.default, props))

test('checkbox reflects boolean and array models when checked override is omitted', async () => {
  assert.match(await render({ modelValue: true, label: 'Exclude upcoming' }), / checked(?:[ =>])/)
  assert.doesNotMatch(await render({ modelValue: false }), / checked(?:[ =>])/)
  assert.match(await render({ modelValue: [12], value: 12 }), / checked(?:[ =>])/)
  assert.doesNotMatch(await render({ modelValue: [12], value: 13 }), / checked(?:[ =>])/)
})

test('explicit checked override retains compatibility', async () => {
  assert.match(await render({ checked: true, modelValue: false }), / checked(?:[ =>])/)
  assert.doesNotMatch(await render({ checked: false, modelValue: true }), / checked(?:[ =>])/)
})
