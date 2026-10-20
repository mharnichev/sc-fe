import assert from 'node:assert/strict'
import test from 'node:test'
import { locale, runtimeDisplay, localization, vue } from './runtime-localization-harness.mjs'

test('saved runtime errors, document and tracking labels react UK → EN → UK', () => {
  const storedError = vue.ref('Посилання недоступне або строк його дії закінчився.')
  const displayError = vue.computed(() => runtimeDisplay.runtimeMessage(storedError.value))
  locale.value = 'uk'
  assert.equal(displayError.value, storedError.value)
  assert.equal(runtimeDisplay.runtimeText.value.documentsTitle, 'Документи')
  locale.value = 'en'
  assert.equal(displayError.value, 'This link is unavailable or has expired.')
  assert.equal(runtimeDisplay.runtimeText.value.documentsTitle, 'Documents')
  assert.equal(runtimeDisplay.runtimeText.value.trackingHeading, 'Delivery status')
  locale.value = 'uk'
  assert.equal(displayError.value, storedError.value)
  assert.equal(storedError.value, 'Посилання недоступне або строк його дії закінчився.')
})

test('order name presentation preserves original snapshots and legacy/deleted-product fallback', () => {
  const item = { product_name: 'Шампунь', product_name_en: 'Shampoo', product_id: 7 }
  const name = vue.computed(() => runtimeDisplay.orderItemName(item))
  locale.value = 'uk'; assert.equal(name.value, 'Шампунь')
  locale.value = 'en'; assert.equal(name.value, 'Shampoo')
  assert.equal(runtimeDisplay.orderItemName({ product_name: 'Старий товар', product_id: 9 }), 'Старий товар')
  assert.equal(runtimeDisplay.orderItemName({ product_id: 10 }), 'Product #10')
  locale.value = 'uk'; assert.equal(name.value, 'Шампунь')
  assert.equal(item.product_name, 'Шампунь')
})

test('validation and store errors have bilingual display without mutating safety inputs', () => {
  assert.equal(localization.localizedShopMessage('Код має містити 6 цифр.', 'en'), 'The code must contain 6 digits.')
  assert.equal(localization.localizedShopMessage('Could not send OTP code.', 'uk'), 'Не вдалося надіслати код.')
  assert.equal(localization.localizedShopMessage('Невідома помилка постачальника', 'en'), 'Could not complete this action. Please try again.')
  assert.equal(localization.localizedShopMessage('', 'en'), '')
})

test('actual order-detail method labels support historical aliases and react without changing the order', async () => {
  const { readFile } = await import('node:fs/promises')
  const { sourceModule, useShopRuntimeDisplay } = await import('./runtime-localization-harness.mjs')
  Object.assign(globalThis, vue, {
    useShopRuntimeDisplay,
    useShopLocale: () => ({ locale, terms: vue.computed(() => globalThis.shopTerms[locale.value]), dateLocale: vue.ref('en-US') }),
    useRoute: () => ({ params: { id: 1 } }), useCustomerAuthStore: () => ({ isAuthenticated: false }),
    useApi: () => () => { throw new Error('No requests expected') },
    useShopPriceFormatter: () => ({ formatPrice: String }), onBeforeUnmount() {}, useSeo() {},
  })
  const source = (await readFile(new URL('../pages/cabinet/orders/[id].vue', import.meta.url), 'utf8'))
    .split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '')
  const component = await sourceModule(source + '\nexport { order, paymentLabel, deliveryLabel };')
  for (const payment_method of ['cashOnDelivery', 'cash_on_delivery', 'cod']) {
    component.order.value = { payment_method, shipping_company: 'novaPoshta', shipping_method: 'self_pickup' }
    locale.value = 'en'
    assert.equal(component.paymentLabel.value, globalThis.shopTerms.en.checkout.paymentOptions.cashOnDelivery)
    assert.equal(component.deliveryLabel.value, 'Nova Poshta · Pickup')
    locale.value = 'uk'
    assert.equal(component.paymentLabel.value, globalThis.shopTerms.uk.checkout.paymentOptions.cashOnDelivery)
    assert.equal(component.deliveryLabel.value, 'Нова пошта · Самовивіз')
    assert.equal(component.order.value.payment_method, payment_method)
  }
  component.order.value = { payment_method: 'card_on_delivery', shipping_company: 'novaPost', shipping_method: 'selfPickup' }
  locale.value = 'en'
  assert.equal(component.paymentLabel.value, globalThis.shopTerms.en.checkout.paymentOptions.cardOnDelivery)
  assert.equal(component.deliveryLabel.value, 'Nova Poshta · Pickup')
  component.order.value.payment_method = 'onlineCard'
  assert.equal(component.paymentLabel.value, 'Bank card')
})
