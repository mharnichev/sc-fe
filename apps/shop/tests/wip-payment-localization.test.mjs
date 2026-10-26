import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { locale, vue, useShopRuntimeDisplay, sourceModule } from './runtime-localization-harness.mjs'
const require = createRequire(import.meta.url)
const { renderToString } = createRequire(require.resolve('nuxt/package.json'))('vue/server-renderer')

const { paymentCopy } = await sourceModule(await readFile(new URL('../utils/payment-localization.ts', import.meta.url), 'utf8'))
Object.assign(globalThis, { paymentCopy })
const { usePaymentDisplay } = await sourceModule((await readFile(new URL('../composables/usePaymentDisplay.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, ''))

test('WIP payment status and errors react UK → EN → UK without mutating provider data or requesting payments', async () => {
  const payment = vue.ref({ status: 'waiting', enabled: true, paid: false, receipt_accepted: false, page_url: 'https://pay.mbnk.biz/test', receipt_url: null })
  const error = vue.ref('')
  const errorKind = vue.ref('')
  let actions = 0
  Object.assign(globalThis, vue, {
    onMounted() {}, onBeforeUnmount() {},
    usePaymentDisplay, useShopRuntimeDisplay, defineProps: () => ({ orderId: 12 }),
    useOrderPayment: () => ({ payment, error, errorKind, busy: vue.ref(false), refresh: () => { actions++ }, create: () => { actions++ } }),
    safePaymentUrl: value => value,
  })
  const file = await readFile(new URL('../components/OrderPayment.vue', import.meta.url), 'utf8')
  const source = file.split('<script setup lang="ts">')[1].split('</script>')[0]
  const component = await sourceModule(source + '\nexport { labels, paymentError, paymentText, pageUrl, receiptUrl, settled, paid, amount, title, illustrationTone, hint, orderPath, accessDenied, beginPayment, canChange, methodChanged, changeOpen, availableMethods, selectedMethod, openChange, confirmChange };')
  const render = vue.compile(file.split('<template>')[1].split('</template>')[0])
  const html = () => {
    const app = vue.createSSRApp({ setup: () => ({ ...component, orderId: 12, payment, busy: false, error, create() {}, refresh() {} }), render })
    app.component('BaseButton', { props: ['href'], setup: (props, { slots }) => () => vue.h(props.href ? 'a' : 'button', props.href ? { href: props.href } : {}, slots.default?.()) })
    app.component('PaymentStatusIllustration', { props: ['tone'], setup: props => () => vue.h('span', { 'data-payment-tone': props.tone }) })
    app.component('CustomerAuthDialog', { props: ['label'], setup: props => () => vue.h('button', props.label) })
    app.component('BaseModal', { props: ['modelValue'], setup: (props, { slots }) => () => props.modelValue ? vue.h('dialog', slots.default?.()) : null })
    return renderToString(app)
  }
  const statuses = {
    not_started: ['Оплату ще не розпочато', 'Payment has not started'],
    creation_unknown: ['Уточнюємо стан оплати', 'Checking payment status'],
    waiting: ['Очікуємо оплату', 'Awaiting payment'],
    paid_receipt_pending: ['Оплату отримано. Готуємо чек.', 'Payment received. Preparing the receipt.'],
    accepted: ['Оплату прийнято, чек готовий', 'Payment accepted. Receipt is ready'],
    requires_review: ['Стан оплати потребує уточнення', 'Payment status needs review'],
  }
  for (const [status, expected] of Object.entries(statuses)) {
    payment.value.status = status
    const snapshot = JSON.stringify(payment.value)
    for (const language of ['uk', 'en', 'uk']) {
      locale.value = language
      assert.equal(component.labels.value[status], expected[language === 'en' ? 1 : 0])
      const rendered = await html()
      assert.ok(rendered.includes(expected[language === 'en' ? 1 : 0]))
      assert.ok(rendered.includes(component.paymentText.value.refresh))
      const buttons = [...rendered.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)]
      assert.equal(buttons.some(([, label]) => label.includes(component.paymentText.value.create)), status === 'not_started')
      assert.equal(rendered.includes('href="https://pay.mbnk.biz/test"'), status === 'waiting')
      assert.equal(JSON.stringify(payment.value), snapshot)
      assert.equal(actions, 0)
    }
  }
  payment.value.status = 'not_started'
  error.value = 'Не вдалося оновити оплату. Спробуйте ще раз.'
  for (const language of ['uk', 'en', 'uk']) {
    locale.value = language
    const rendered = await html()
    assert.ok(!rendered.includes(component.paymentText.value.create))
    assert.ok(rendered.includes(component.paymentText.value.connectionHint))
    assert.ok(rendered.includes(component.paymentError.value))
    assert.ok(rendered.includes(component.paymentText.value.refresh))
    assert.equal(payment.value.status, 'not_started')
    assert.equal(actions, 0)
  }
  payment.value.status = 'waiting'
  assert.equal(component.paymentError.value, error.value)
  locale.value = 'en'
  assert.equal(component.labels.value.waiting, 'Awaiting payment')
  assert.equal(component.paymentError.value, 'Could not update the payment. Please try again.')
  assert.equal(component.paymentText.value.receipt, 'View fiscal receipt')
  locale.value = 'uk'
  assert.equal(component.labels.value.waiting, 'Очікуємо оплату')
  assert.equal(payment.value.status, 'waiting')
  assert.equal(payment.value.page_url, 'https://pay.mbnk.biz/test')
  assert.equal(actions, 0)
  payment.value.paid = true
  payment.value.receipt_url = 'https://cabinet.tax.gov.ua/cashregs/check?id=fixture'
  payment.value.receipt_accepted = false
  assert.ok(!(await html()).includes('href='))
  payment.value.receipt_accepted = true
  const accepted = await html()
  assert.ok(accepted.includes(component.paymentText.value.receipt))
  assert.ok(accepted.includes('https://cabinet.tax.gov.ua/cashregs/check?id=fixture'))
  errorKind.value = 'access'
  const denied = await html()
  assert.ok(!denied.includes('href='), 'access denial must hide even a previously accepted receipt link')
  assert.ok(denied.includes(component.paymentText.value.signIn))
  errorKind.value = ''
  error.value = ''
  assert.equal(component.paymentError.value, '')
  error.value = 'Provider diagnostic stays unchanged'
  locale.value = 'en'
  assert.equal(component.paymentError.value, error.value)
  locale.value = 'uk'
})

test('WIP payment page retains numeric order validation while headings change locale', async () => {
  const route = vue.reactive({ params: { id: '12' } })
  Object.assign(globalThis, vue, { usePaymentDisplay, useRoute: () => route, useCustomerAuthStore: () => ({ isAuthenticated: false }), useSeo() {}, useHead() {} })
  const source = (await readFile(new URL('../pages/payment/[id].vue', import.meta.url), 'utf8')).split('<script setup lang="ts">')[1].split('</script>')[0]
  const component = await sourceModule(source + '\nexport { valid, id, paymentText };')
  locale.value = 'uk'; assert.equal(component.paymentText.value.title, 'Оплата замовлення')
  assert.equal(component.valid.value, true)
  locale.value = 'en'; assert.equal(component.paymentText.value.title, 'Order payment')
  for (const id of ['invalid', '-1', '0', '9007199254740992']) { route.params.id = id; assert.equal(component.valid.value, false) }
})

test('checkout payment capability and values stay stable across locale toggles', async () => {
  const file = await readFile(new URL('../pages/checkout/purchase.vue', import.meta.url), 'utf8')
  const onlinePaymentEnabled = vue.ref(true)
  Object.assign(globalThis, { onlinePaymentEnabled, terms: vue.ref({ checkout: { paymentOptions: { cashOnDelivery: 'Cash', cardOnDelivery: 'Card' } } }), paymentText: usePaymentDisplay().paymentText })
  const source = file.slice(file.indexOf('const paymentOptions ='), file.indexOf('const isDeliveryValid ='))
  const { paymentOptions } = await sourceModule(source + '\nexport { paymentOptions };')
  for (const language of ['uk', 'en', 'uk']) {
    locale.value = language
    assert.deepEqual(paymentOptions.value.map(option => option.value), ['cashOnDelivery', 'cardOnDelivery', 'onlineCard'])
    assert.equal(paymentOptions.value[2].label, language === 'uk' ? 'Онлайн карткою' : 'Pay online by card')
    assert.equal(globalThis.paymentText.value.statusPage, language === 'uk' ? 'Сторінка статусу оплати' : 'Payment status page')
  }
  onlinePaymentEnabled.value = false
  assert.deepEqual(paymentOptions.value.map(option => option.value), ['cashOnDelivery', 'cardOnDelivery'])
})
