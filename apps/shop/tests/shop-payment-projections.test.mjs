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
const rows = async (order, paymentOnly = true, locale = 'uk') => {
  Object.assign(globalThis, vue, text, { defineProps: () => ({ order, paymentOnly }), useShopLocale: () => ({ locale: vue.ref(locale) }) })
  return (await importSource(source + '\nexport { rows };')).rows.value
}
for (const locale of ['uk', 'en']) {
  test(`${locale}: only canonical verified or explicit test payment projections create a payment row`, async () => {
    for (const state of [undefined, 'unpaid', 'paid', 'legacy_unknown', 'not_requested']) assert.deepEqual(await rows({ status: 'completed', payment_status: state }, true, locale), [])
    for (const state of ['paid_manual', 'paid_provider', 'simulated_paid']) {
      const actual = await rows({ status: 'pending', payment_status: state }, true, locale)
      assert.equal(actual.length, 1); assert.equal(actual[0][1], text.orderTrackingText[locale][state])
      if (state === 'simulated_paid') assert.match(actual[0][1], locale === 'uk' ? /Тестова/ : /Test/)
    }
  })
  test(`${locale}: canonical physical facts and test counterparts remain distinct from fiscal evidence`, async () => {
    for (const state of ['pickup_handed_over', 'carrier_dispatched', 'fulfilled', 'simulated_pickup_handed_over', 'simulated_carrier_dispatched', 'simulated_fulfilled']) {
      const actual = await rows({ fulfillment_status: state, fiscal_status: 'not_requested' }, false, locale)
      assert.equal(actual[0][1], text.orderTrackingText[locale][state]); assert.equal(actual[1][1], text.orderTrackingText[locale].not_requested)
      if (state.startsWith('simulated_')) assert.match(actual[0][1], locale === 'uk' ? /Тест/ : /Test/)
    }
  })
}


for (const locale of ['uk', 'en']) test(`${locale}: canonical Shop fiscal test projections never imply a real tax receipt or customer delivery`, async () => {
  for (const state of ['simulated_fiscal_queued', 'simulated_fiscal_unknown', 'simulated_fiscal_issued', 'simulated_fiscal_cancelled', 'simulated_fiscal_error', 'simulated_fiscal_invalid', 'simulated_fiscal_return_pending', 'simulated_fiscal_partial_return', 'simulated_fiscal_returned']) {
    const actual = await rows({ fulfillment_status: 'reserved', fiscal_status: state }, false, locale)
    assert.equal(actual[1][1], text.orderTrackingText[locale][state])
    assert.match(actual[1][1], locale === 'uk' ? /[Тт]ест/ : /[Tt]est/)
  }
  for (const state of ['simulated_pending_document', 'simulated_local_print_available']) {
    const actual = await rows({ fulfillment_status: 'reserved', fiscal_status: 'simulated_fiscal_issued', receipt_delivery_status: state }, false, locale)
    assert.equal(actual.length, 3); assert.equal(actual[2][1], text.orderTrackingText[locale][state])
    assert.match(actual[2][1], locale === 'uk' ? /[Тт]ест/ : /[Tt]est/)
  }
  const legacy = await rows({ fulfillment_status: 'reserved', fiscal_status: 'not_requested', receipt_delivery_status: 'pending_document' }, false, locale)
  assert.equal(legacy.length, 2)
})

for (const locale of ['uk', 'en']) test(`${locale}: carrier return facts are explicitly test-only and unpaid closure proves no payment`, async () => {
  for (const state of ['simulated_carrier_return_unknown','simulated_carrier_returning','simulated_carrier_returned','simulated_carrier_return_received','simulated_unpaid_refusal_closed']) {
    const actual = await rows({ payment_status: 'unpaid', fulfillment_status: state, fiscal_status: 'not_requested' }, false, locale)
    assert.equal(actual.length, 2); assert.equal(actual[0][1], text.orderTrackingText[locale][state]); assert.match(actual[0][1], locale === 'uk' ? /Тест/ : /Test/)
    assert.deepEqual(await rows({ payment_status: 'unpaid', fulfillment_status: state }, true, locale), [])
  }
})

test('account detail exposes explicit test carrier facts even for unpaid orders with no fiscal document', () => {
  for (const fulfillment_status of ['simulated_carrier_return_unknown','simulated_carrier_returning','simulated_carrier_returned','simulated_carrier_return_received','simulated_unpaid_refusal_closed']) assert.equal(text.shopOrderHasTestProjection({ fiscal_status: 'not_requested', fulfillment_status }), true)
  assert.equal(text.shopOrderHasTestProjection({ fiscal_status: 'simulated_fiscal_partial_return' }), true)
  for (const fulfillment_status of ['cancelled','fulfilled','legacy_unknown','simulated_unknown']) assert.equal(text.shopOrderHasTestProjection({ fiscal_status: 'not_requested', fulfillment_status }), false)
})

for (const locale of ['uk', 'en']) test(`${locale}: unknown reverse creation is visible without asserting waybill confirmation or parcel transit`, async () => {
  const order = { payment_status: 'unpaid', fulfillment_status: 'simulated_carrier_return_unknown', fiscal_status: 'not_requested' }
  assert.equal(text.shopOrderHasTestProjection(order), true)
  const actual = await rows(order, false, locale)
  assert.equal(actual[0][1], locale === 'uk' ? 'Тестове повернення НП: результат створення невідомий; зворотну ТТН не підтверджено' : 'Test NP return: creation outcome unknown; return waybill is not confirmed')
  assert.equal(actual.length, 2); assert.deepEqual(await rows(order, true, locale), [])
})

for (const locale of ['uk','en']) test(`${locale}: explicit Checkbox statuses preserve authority and never claim customer delivery`,async()=>{
 for(const state of text.checkboxProjectionStates){
  const receipt=state.endsWith('pending_document')||state.endsWith('local_print_available'),order={fulfillment_status:'reserved',[receipt?'receipt_delivery_status':'fiscal_status']:state}
  assert.equal(text.shopOrderHasCheckboxProjection(order),true);const actual=await rows(order,false,locale);assert.equal(actual[receipt?2:1][1],text.orderTrackingText[locale][state]);assert.notEqual(actual[receipt?2:1][1],text.orderTrackingText[locale].legacy_unknown)
  if(state.startsWith('simulated_'))assert.match(actual[receipt?2:1][1],locale==='uk'?/Тест/:/Test/)
  else assert.doesNotMatch(actual[receipt?2:1][1],locale==='uk'?/Тест/:/Test/)
  if(receipt)assert.match(actual[2][1],locale==='uk'?/надсилання покупцю не підтверджено/:/customer delivery unconfirmed/)
 }
 for(const fiscal_status of ['checkbox_unknown','checkbox_fiscal_fake','simulated_checkbox_fiscal_fake','legacy_unknown'])assert.equal(text.shopOrderHasCheckboxProjection({fiscal_status}),false)
 assert.equal(text.shopOrderHasTestProjection({fiscal_status:'checkbox_fiscal_issued'}),false)
})
