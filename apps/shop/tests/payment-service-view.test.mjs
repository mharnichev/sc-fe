import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { locale, vue, useShopRuntimeDisplay, sourceModule } from './runtime-localization-harness.mjs'

const { paymentCopy } = await sourceModule(await readFile(new URL('../utils/payment-localization.ts', import.meta.url), 'utf8'))
const payment = vue.ref(null), error = vue.ref(''), busy = vue.ref(false)
Object.assign(globalThis, vue, {
  onMounted() {}, onBeforeUnmount() {},
  usePaymentDisplay: () => ({ paymentText: vue.computed(() => paymentCopy[locale.value]) }),
  useShopRuntimeDisplay,
  useCustomerAuthStore: () => ({ customer: null, sessionRevision: 0, accessToken: null, isAuthenticated: false }),
  defineProps: () => ({ orderId: 42 }),
  defineEmits: () => () => {},
  useOrderPayment: () => ({ payment, error, busy, refresh() {}, create() {} }),
  safePaymentUrl: value => value,
  safePaymentEmbedUrl: value => value,
})
const script = (await readFile(new URL('../components/OrderPayment.vue', import.meta.url), 'utf8')).split('<script setup lang="ts">')[1].split('</script>')[0]
const view = await sourceModule(script + '\nexport { settled, illustrationTone, title, hint, pageUrl, widgetUrl };')
const reset = state => { locale.value = 'uk'; error.value = ''; busy.value = false; payment.value = state ? { order_id: 42, ...state } : state }

test('created and waiting orders never show the success illustration', () => {
  reset({ status: 'not_started', paid: false, enabled: true })
  assert.equal(view.illustrationTone.value, null)
  reset({ status: 'waiting', paid: false, enabled: true, page_url: 'https://pay.mbnk.biz/invoice' })
  assert.equal(view.illustrationTone.value, null)
  assert.equal(view.pageUrl.value, payment.value.page_url)
})

test('only a settled provider result shows success; review stays unresolved', () => {
  reset({ status: 'paid_receipt_pending', paid: true })
  assert.equal(view.settled.value, true)
  assert.equal(view.illustrationTone.value, 'success')
  reset({ status: 'requires_review', paid: true })
  assert.equal(view.settled.value, false)
  assert.equal(view.illustrationTone.value, 'error')
  assert.equal(view.title.value, paymentCopy.uk.reviewTitle)
})

test('a connection error cannot imply payment failure', () => {
  reset(null)
  error.value = 'Не вдалося оновити оплату. Спробуйте ще раз.'
  assert.equal(view.illustrationTone.value, 'error')
  assert.equal(view.hint.value, paymentCopy.uk.connectionHint)
})


test('widget rendering requires the current waiting attempt with explicit trusted presentation', () => {
  const state = { order_id: 42, enabled: true, status: 'waiting', paid: false, attempt_id: 1,
    presentation_mode: 'iframe', embed_url: 'https://pay.mbnk.biz/opaque?proof=fixture' }
  reset(state)
  assert.equal(view.widgetUrl.value, state.embed_url)
  for (const delta of [{ order_id: 43 }, { paid: true }, { enabled: false }, { status: 'creation_unknown' },
    { status: 'paid_receipt_pending', paid: true }, { presentation_mode: 'redirect' }, { presentation_mode: undefined },
    { attempt_id: null }, { actions: { continue_payment: false } }]) {
    reset({ ...state, ...delta })
    assert.equal(view.widgetUrl.value, null)
  }
  reset(state); error.value = 'Connection unavailable'
  assert.equal(view.widgetUrl.value, null)
})

test('widget messages never trust another source, raw links, oversized or settlement payloads', async () => {
  const vm = await import('node:vm'), ts = await import('typescript')
  const source = (await readFile(new URL('../components/checkout/MonoPaymentModal.vue', import.meta.url), 'utf8')).split('<script setup lang="ts">')[1].split('</script>')[0]
  const props = { modelValue: true, frameKey: 2, embedUrl: 'https://pay.mbnk.biz/opaque?proof=synthetic' }
  const events = [], exports = {}, currentWindow = {}, oldWindow = {}
  vm.runInNewContext(ts.default.transpileModule(source + '\nexports.test = { frame, message, fallbackRequested };', {
    compilerOptions: { module: ts.default.ModuleKind.CommonJS },
  }).outputText, { exports, URL, defineProps: () => props, defineEmits: () => (...args) => events.push(args),
    usePaymentDisplay: () => ({ paymentText: {} }), ref: value => ({ value }), watch() {}, onMounted() {}, onBeforeUnmount() {},
  })
  const view = exports.test
  view.frame.value = { dataset: { frameKey: '2' }, getAttribute: () => props.embedUrl, contentWindow: currentWindow }
  const send = (data, origin = 'https://pay.mbnk.biz', source = currentWindow) => view.message({ data, origin, source })
  send('{"message":"close-button"}', 'https://pay.mbnk.biz.evil.test'); send('{"message":"close-button"}', 'https://pay.mbnk.biz', oldWindow)
  for (const data of ['{', 'null', '[]', 'x'.repeat(5000), '{"message":"paid"}', { message: 'close-button' }]) send(data)
  assert.equal(events.length, 0)
  send('{"message":"monopay-link","value":"javascript:alert(1)"}')
  assert.equal(view.fallbackRequested.value, true)
  assert.equal(events.length, 0)
  props.frameKey = 3; send('{"message":"close-button"}')
  assert.equal(events.length, 0)
  props.frameKey = 2; props.modelValue = false; send('{"message":"close-button"}')
  assert.equal(events.length, 0)
  props.modelValue = true; send('{"message":"close-button"}')
  assert.equal(JSON.stringify(events), '[["update:modelValue",false]]')
})
