import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const transpile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const utility = { exports: {} }
vm.runInNewContext(transpile(readFileSync(new URL('../utils/checkoutReminder.ts', import.meta.url), 'utf8')), { exports: utility.exports })
const source = readFileSync(new URL('../pages/checkout/recover.vue', import.meta.url), 'utf8').split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '')
const intentKey = 'shop-checkout-intent-v1'
const setup = (saved, denied = false) => {
  const stored = new Map(saved === undefined ? [] : [[intentKey, saved]])
  const original = [{ product: { id: 1, price: '50', name: 'Original' }, quantity: 1 }]
  const recovered = [{ product_id: 2, quantity: 2, product: { id: 2, price: '70', name: 'Recovered' } }]
  const cart = { items: original, syncing: false, setItems(items) { this.items = items } }
  const token = { value: 'A'.repeat(43) }, navigations = []
  const context = vm.createContext({ ...utility.exports,
    ref: value => ({ value }), computed: fn => ({ get value() { return fn() } }),
    watch: (_value, callback, options) => { if (options?.immediate) callback(true) }, onUnmounted() {}, useHead() {},
    useCartStore: () => cart, useCustomerAuthStore: () => ({ isAuthenticated: true, customer: { id: 10 }, captureSession: () => () => true }),
    useCatalogDomain: () => ({ recoverCheckout: async () => ({ checkout_key: 'b'.repeat(64), locale: 'en', items: recovered, changes: [] }) }),
    useRuntimeConfig: () => ({ app: { baseURL: '/shop/' } }),
    useShopLocale: () => ({ locale: { value: 'en' }, setLocale() {} }),
    useShopPriceFormatter: () => ({ formatPrice: String }), useProductDisplay: () => ({ productDisplayName: product => product.name }),
    useState: key => key === 'checkout-recovery-token' ? token : { value: true },
    sessionStorage: { getItem: key => { if (denied) throw new Error('storage denied'); return stored.get(key) ?? null }, setItem: (key, value) => stored.set(key, value) },
    navigateTo: async path => { navigations.push(path) },
  })
  vm.runInContext(transpile(source) + '\nglobalThis.recovery = { review, apply, confirmed, intentBlocked }', context)
  return { recovery: context.recovery, cart, original, token, stored, navigations }
}

for (const [label, saved] of [
  ['same scope', JSON.stringify({ key: 'intent-a', scope: 'customer:10', body: { items: [{ product_id: 1, quantity: 1 }] } })],
  ['other account', JSON.stringify({ key: 'intent-a', scope: 'customer:11', body: { items: [{ product_id: 1, quantity: 1 }] } })],
  ['guest', JSON.stringify({ key: 'intent-a', scope: 'guest', body: { items: [{ product_id: 1, quantity: 1 }] } })],
  ['malformed JSON', '{broken'], ['null JSON', 'null'], ['empty string', ''], ['wrong shape', '[]'],
]) {
  test(`actual recovery refuses ${label} intent without changing intent, cart, capability or navigation`, async () => {
    const state = setup(saved)
    await state.recovery.review()
    state.recovery.confirmed.value = true
    await state.recovery.apply()
    assert.equal(state.recovery.intentBlocked.value, true)
    assert.equal(state.recovery.confirmed.value, false)
    assert.equal(state.stored.get(intentKey), saved)
    assert.equal(state.stored.size, 1)
    assert.equal(state.cart.items, state.original)
    assert.equal(state.token.value, 'A'.repeat(43))
    assert.deepEqual(state.navigations, [])
  })
}

test('storage read failure refuses application without writing a capability or altering cart', async () => {
  const state = setup(undefined, true)
  await state.recovery.review(); state.recovery.confirmed.value = true
  await state.recovery.apply()
  assert.equal(state.recovery.intentBlocked.value, true)
  assert.equal(state.cart.items, state.original)
  assert.equal(state.stored.size, 0)
  assert.deepEqual(state.navigations, [])
})

test('intent created after preview blocks apply; resolving it permits a fresh explicit confirmation', async () => {
  const state = setup()
  await state.recovery.review()
  state.stored.set(intentKey, '{uncertain')
  state.recovery.confirmed.value = true
  await state.recovery.apply()
  assert.equal(state.cart.items, state.original)
  // Simulate checkout resolving its own intent; recovery itself never removes it.
  state.stored.delete(intentKey)
  await state.recovery.apply()
  assert.equal(state.cart.items, state.original)
  state.recovery.confirmed.value = true
  await state.recovery.apply()
  assert.equal(state.recovery.intentBlocked.value, false)
  assert.equal(state.cart.items[0].product.id, 2)
  assert.equal(state.stored.get('shop-checkout-reminder-order-v1:customer:10'), 'b'.repeat(64))
  assert.deepEqual(state.navigations, ['/checkout/purchase'])
})
