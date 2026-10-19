import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const page = readFileSync(new URL('../pages/checkout/purchase.vue', import.meta.url), 'utf8')
const source = page.slice(page.indexOf('// Keep the exact submitted intent'), page.indexOf('\nuseSeo('))
const clone = value => JSON.parse(JSON.stringify(value))
const loadCheckout = () => {
  const stored = new Map()
  const original = { key: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', scope: 'guest', body: { items: [{ product_id: 1, quantity: 2 }] } }
  stored.set('shop-checkout-intent-v1', JSON.stringify(original))
  const requests = []
  const cart = { items: [{ product: { id: 1 }, quantity: 2 }], clear() { this.items = [] } }
  const state = { loading: false, order: null, error: '' }
  const context = vm.createContext({
    ref: value => ({ value }), computed: fn => ({ get value() { return fn() } }), watch() {},
    onNuxtReady: fn => fn(), onBeforeUnmount() {},
    sessionStorage: { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) },
    crypto: { randomUUID: () => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    auth: { isAuthenticated: false, captureSession: () => () => true }, cart, state, form: { email: '', firstName: 'Fixture', shippingStreet: '' },
    selectedCity: { value: null }, selectedBranch: { value: null }, selectedStreet: { value: null },
    unavailableItems: { value: [] }, canSubmit: { value: true }, unavailableMessage: { value: 'unavailable' }, terms: { value: { checkout: { failed: 'failed' } } },
    domain: { async createOrder(body, key) {
      requests.push({ body: clone(body), key })
      if (requests.length === 1) throw { statusCode: 409, data: { detail: 'Insufficient stock for product 1; backorders are disabled' } }
      return { id: 99, items: [], total_amount: '1.00' }
    } },
  })
  const script = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.None } }).outputText
  vm.runInContext(script + '\nglobalThis.checkout = { submit, retryIntent, pendingIntent, sendIntent }', context)
  return { checkout: context.checkout, cart, state, stored, requests, original }
}

test('conclusive stock rejection allows an edited checkout with a new intent key', async () => {
  const { checkout, cart, state, stored, requests, original } = loadCheckout()
  await checkout.sendIntent(checkout.pendingIntent.value)
  assert.equal(stored.has('shop-checkout-intent-v1'), false)
  assert.equal(checkout.pendingIntent.value, null)
  cart.items[0].quantity = 1
  await checkout.submit()
  assert.equal(state.order.id, 99)
  assert.equal(requests.length, 2)
  assert.equal(requests[0].key, original.key)
  assert.notEqual(requests[1].key, original.key)
  assert.equal(requests[1].body.items[0].quantity, 1)
})
