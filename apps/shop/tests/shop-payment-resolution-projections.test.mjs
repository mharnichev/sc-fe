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
for (const locale of ['uk','en']) test(`${locale}: exactR4 projections distinguish refund, money review and unpaid closure`,async()=>{
 for(const state of text.paymentResolutionProjectionStates){const paymentState=['refunded','simulated_refunded','financial_exception','simulated_financial_exception'].includes(state),order={payment_status:paymentState?state:'unpaid',fulfillment_status:paymentState?'cancelled_before_handover':state,fiscal_status:'not_requested'},actual=await rows(order,false,locale);assert.ok(actual.some(row=>row[1]===text.orderTrackingText[locale][state]));assert.equal(text.shopOrderHasPaymentResolutionProjection(order),true);if(state.startsWith('simulated_'))assert.match(text.orderTrackingText[locale][state],locale==='uk'?/Тест/:/Test/);else assert.doesNotMatch(text.orderTrackingText[locale][state],locale==='uk'?/Тест/:/Test/);if(paymentState)assert.equal((await rows(order,true,locale))[0][1],text.orderTrackingText[locale][state]);assert.equal(text.shopOrderHasTestProjection(order),false)}
 const unpaid={payment_status:'unpaid',fulfillment_status:'simulated_cancelled_before_handover',fiscal_status:'not_requested'};const actual=await rows(unpaid,false,locale);assert.equal(actual[0][1],text.orderTrackingText[locale].unpaid);assert.doesNotMatch(actual[0][1],locale==='uk'?/повернено|Оплачено/:/refund|Payment confirmed/)
})
test('only explicit serverR4 enums mount account projection; arbitrary refund labels/orderstatus cannot imply money',async()=>{
 for(const order of [{status:'cancelled'},{payment_status:'refunded_fake'},{payment_status:'simulated_refunded_fake'},{fulfillment_status:'cancelled'}])assert.equal(text.shopOrderHasPaymentResolutionProjection(order),false)
 assert.deepEqual(await rows({payment_status:'legacy_unknown',fulfillment_status:'reserved'},true),[])
})

test('actual account mount renders canonical payment before any fiscal document; unknown/orderstatus cannot imply money', async()=>{
 const cabinet = await readFile(new URL('../pages/cabinet/orders/[id].vue', import.meta.url), 'utf8')
 const template = cabinet.match(/<OrderProjections\b[^>]*\/>/)[0]
 const compiler = require(createRequire(require.resolve('nuxt/package.json')).resolve('@vue/compiler-dom'))
 const server = require(createRequire(require.resolve('nuxt/package.json')).resolve('@vue/server-renderer'))
 const render = new Function('Vue',compiler.compile(template,{mode:'function'}).code)(vue)
 for (const payment_status of ['paid_manual','paid_provider','simulated_paid','unpaid','legacy_unknown','simulated_paid_fake',undefined]) {
  const order={payment_status,fulfillment_status:'reserved',fiscal_status:'not_requested',receipt_delivery_status:'pending_document',status:'paid'}
  const values=await rows(order,true)
  const app=vue.createSSRApp({setup:()=>({...text,order}),render})
  app.component('OrderProjections',{setup:()=>()=>vue.h('span',{'data-payment-fact':''},values.map(row=>row[1]).join(' '))})
  const html=await server.renderToString(app)
  const expected=['paid_manual','paid_provider','simulated_paid'].includes(payment_status)
  assert.equal(text.shopOrderHasPaymentProjection(order),expected)
  assert.equal(html.includes('data-payment-fact'),expected)
  if(expected)assert.ok(html.includes(text.orderTrackingText.uk[payment_status]))
 }
})
