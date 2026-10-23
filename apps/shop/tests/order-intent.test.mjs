import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import { sourceModule, commerceTelemetry } from './runtime-localization-harness.mjs'
const { safeRequestBody } = await sourceModule(readFileSync(new URL('../utils/inputSafety.ts', import.meta.url), 'utf8'))
const reminder = await sourceModule(readFileSync(new URL('../utils/checkoutReminder.ts', import.meta.url), 'utf8'))

const page = readFileSync(new URL('../pages/checkout/purchase.vue', import.meta.url), 'utf8')
const source = page.slice(page.indexOf('// Keep the exact submitted intent'), page.indexOf('\nuseSeo('))
const clone = value => JSON.parse(JSON.stringify(value))
const loadCheckout = (uncertain = false) => {
  const stored = new Map()
  const original = { key: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', scope: 'guest', body: { items: [{ product_id: 1, quantity: 2 }] } }
  stored.set('shop-checkout-intent-v1', JSON.stringify(original))
  const requests = []
  const cart = { items: [{ product: { id: 1 }, quantity: 2 }], clear() { this.items = [] } }
  const state = { loading: false, order: null, error: '' }
  const context = vm.createContext({
    ...reminder,
    ...commerceTelemetry,
    ref: value => ({ value }), computed: fn => ({ get value() { return fn() } }), watch() {},
    onNuxtReady: fn => fn(), onBeforeUnmount() {},
    sessionStorage: { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) },
    crypto: { randomUUID: () => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    safeRequestBody,
    auth: { isAuthenticated: false, captureSession: () => () => true }, cart, state, form: { email: '', firstName: 'Fixture', lastName: 'Buyer', phoneNumber: '+380501234567', shippingStreet: '' },
    selectedCity: { value: null }, selectedBranch: { value: null }, selectedStreet: { value: null },
    unavailableItems: { value: [] }, canSubmit: { value: true }, unavailableMessage: { value: 'unavailable' }, terms: { value: { checkout: { failed: 'failed' } } },
    domain: { async createOrder(body, key) {
      requests.push({ body: clone(body), key })
      if (uncertain) throw { statusCode: 503 }
      if (requests.length === 1) throw { statusCode: 409, data: { detail: 'Insufficient stock for product 1; backorders are disabled' } }
      return { id: 99, items: [], total_amount: '1.00' }
    } },
  })
  const script = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.None } }).outputText
  vm.runInContext(script + '\nglobalThis.checkout = { submit, retryIntent, pendingIntent, sendIntent }', context)
  return { checkout: context.checkout, cart, state, stored, requests, original, form: context.form }
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

test('new checkout normalizes before persistence; retry retains exact durable body and key', async () => {
  const { checkout, stored, requests, form, cart } = loadCheckout(true)
  stored.clear(); checkout.pendingIntent.value = null
  Object.assign(form, { firstName: ' <b>Fixture</b> ', lastName: ' Buyer ', shippingStreet: '<b>Main</b>', buildingNumber: ' 12<> ', shippingApartment: ' 3 ', comment: ' <b>Leave at door</b> ' })
  await checkout.submit()
  const durable = JSON.parse(stored.get('shop-checkout-intent-v1'))
  assert.equal(durable.body.firstName, 'Fixture')
  assert.equal(durable.body.lastName, 'Buyer')
  assert.equal(durable.body.shippingStreet, 'Main')
  assert.equal(durable.body.buildingNumber, '12')
  assert.equal(durable.body.shippingApartment, '3')
  assert.equal(durable.body.comment, 'Leave at door')
  assert.deepEqual(requests[0], { body: durable.body, key: durable.key })
  form.firstName = 'Changed'; cart.items[0].quantity = 9
  await checkout.retryIntent()
  assert.deepEqual(requests[1], requests[0])
  assert.deepEqual(JSON.parse(stored.get('shop-checkout-intent-v1')), durable)
})

test('invalid new checkout cannot create a durable intent or send a request', async () => {
  for (const invalid of [{ firstName: '' }, { phoneNumber: '123' }, { email: 'bad@example' }, { comment: 'x'.repeat(501) }]) {
    const { checkout, stored, requests, form, state } = loadCheckout()
    stored.clear(); checkout.pendingIntent.value = null
    Object.assign(form, invalid)
    await checkout.submit()
    assert.equal(requests.length, 0)
    assert.equal(stored.size, 0)
    assert.equal(checkout.pendingIntent.value, null)
    assert.ok(state.error)
  }
})
