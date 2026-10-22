import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { locale, vue, useShopRuntimeDisplay, sourceModule } from './runtime-localization-harness.mjs'

const { paymentCopy } = await sourceModule(await readFile(new URL('../utils/payment-localization.ts', import.meta.url), 'utf8'))
const payment = vue.ref(null), error = vue.ref(''), busy = vue.ref(false)
Object.assign(globalThis, vue, {
  usePaymentDisplay: () => ({ paymentText: vue.computed(() => paymentCopy[locale.value]) }),
  useShopRuntimeDisplay,
  defineProps: () => ({ orderId: 42 }),
  useOrderPayment: () => ({ payment, error, busy, refresh() {}, create() {} }),
  safePaymentUrl: value => value,
})
const script = (await readFile(new URL('../components/OrderPayment.vue', import.meta.url), 'utf8')).split('<script setup lang="ts">')[1].split('</script>')[0]
const view = await sourceModule(script + '\nexport { settled, illustrationTone, title, hint, pageUrl };')
const reset = state => { locale.value = 'uk'; error.value = ''; busy.value = false; payment.value = state }

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
