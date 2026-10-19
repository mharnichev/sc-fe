import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
const require = createRequire(import.meta.url)
const vue = await import(pathToFileURL(createRequire(require.resolve('nuxt/package.json')).resolve('vue')).href)
let sequence = 0
const importSource = source => import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64')}#${sequence++}`)
const text = await importSource(await readFile(new URL('../utils/orderTrackingText.ts', import.meta.url), 'utf8'))
const source = (await readFile(new URL('../components/OrderProjections.vue', import.meta.url), 'utf8')).split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '')
const rows = async (order, paymentOnly = false, locale = 'uk') => { Object.assign(globalThis, vue, text, { defineProps: () => ({ order, paymentOnly }), useShopLocale: () => ({ locale: vue.ref(locale) }) }); return (await importSource(source + '\nexport { rows };')).rows.value }
for (const locale of ['uk','en']) test(`${locale}: exact NP return projections preserve test authority without inventing money`, async () => {
 for (const state of text.npReturnProjectionStates) {
  const order = { payment_status: 'unpaid', fulfillment_status: state, fiscal_status: 'not_requested' }, actual = await rows(order, false, locale)
  assert.equal(actual[0][1], text.orderTrackingText[locale][state]); assert.notEqual(actual[0][1], text.orderTrackingText[locale].legacy_unknown); assert.equal(actual.length, 2)
  if (state.startsWith('simulated_')) assert.match(actual[0][1], locale === 'uk' ? /Тест/ : /Test/); else assert.doesNotMatch(actual[0][1], locale === 'uk' ? /Тест/ : /Test/)
  assert.deepEqual(await rows(order, true, locale), [])
  if (state.endsWith('refusal_closed')) assert.match(actual[0][1], locale === 'uk' ? /без платежу/ : /without payment/)
 }
})
test('account mounts only whitelisted NP facts even for an unpaid order with no fiscal document', () => {
 for (const fulfillment_status of text.npReturnProjectionStates) assert.equal(text.shopOrderHasNPReturnProjection({ fulfillment_status, fiscal_status: 'not_requested' }), true)
 for (const fulfillment_status of ['np_return_fake','simulated_np_return_fake','cancelled','legacy_unknown']) assert.equal(text.shopOrderHasNPReturnProjection({ fulfillment_status }), false)
 assert.equal(text.shopOrderHasTestProjection({ fulfillment_status: 'np_refusal_closed' }), false)
})
