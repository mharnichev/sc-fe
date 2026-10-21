import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { sourceModule } from './runtime-localization-harness.mjs'
const { safeRequestBody } = await sourceModule(readFileSync(new URL('../utils/inputSafety.ts', import.meta.url), 'utf8'))

const page = readFileSync(new URL('../pages/checkout/purchase.vue', import.meta.url), 'utf8')
const source = page.slice(page.indexOf('// Keep the exact submitted intent'), page.indexOf('\nuseSeo('))
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.None } }).outputText
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const storageKey = 'shop-checkout-intent-v1'
const original = { key: 'original', scope: 'guest', body: { items: [{ product_id: 1, quantity: 1 }] } }
const load = (storage, send) => {
  let dispose
  const auth = { isAuthenticated: false, sessionRevision: 0, captureSession() { const revision = this.sessionRevision; return () => revision === this.sessionRevision } }
  const state = { loading: false, order: null, error: '' }
  const context = vm.createContext({ safeRequestBody, ref: value => ({ value }), computed: fn => ({ get value() { return fn() } }), watch() {}, onNuxtReady: fn => fn(), onBeforeUnmount: fn => { dispose = fn }, auth, state,
    sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }, crypto: { randomUUID: () => 'new-intent' },
    cart: { items: [{ product: { id: 1 }, quantity: 1 }], clear() {} }, form: { firstName: 'Fixture', lastName: 'Buyer', phoneNumber: '+380501234567', email: '', shippingStreet: '' }, selectedCity: { value: null }, selectedBranch: { value: null }, selectedStreet: { value: null }, unavailableItems: { value: [] }, canSubmit: { value: true }, unavailableMessage: { value: '' }, terms: { value: { checkout: { failed: 'failed' } } }, domain: { createOrder: send } })
  vm.runInContext(code + '\nglobalThis.checkout = { sendIntent, submit, pendingIntent }', context)
  return { ...context.checkout, auth, state, dispose: () => dispose() }
}

for (const outcome of ['success', 'rejection']) test(`old checkout ${outcome} cannot consume a newer durable intent after remount`, async () => {
  const storage = new Map([[storageKey, JSON.stringify(original)]]), firstResponse = deferred(), newResponse = deferred()
  const first = load(storage, () => firstResponse.promise)
  const oldPending = first.sendIntent(first.pendingIntent.value)
  first.dispose()
  let calls = 0
  const second = load(storage, () => ++calls === 1 ? Promise.reject({ statusCode: 422 }) : newResponse.promise)
  await second.sendIntent(second.pendingIntent.value)
  const newPending = second.submit()
  assert.equal(JSON.parse(storage.get(storageKey)).key, 'new-intent')
  if (outcome === 'success') firstResponse.resolve({ id: 1 }); else firstResponse.reject({ statusCode: 422 })
  await oldPending
  assert.equal(JSON.parse(storage.get(storageKey)).key, 'new-intent')
  assert.equal(first.state.order, null)
  newResponse.resolve({ id: 2 }); await newPending
  assert.equal(second.state.order.id, 2)
})

test('guest-login-logout ABA transition cannot accept an old guest order response', async () => {
  const storage = new Map([[storageKey, JSON.stringify(original)]]), response = deferred()
  const checkout = load(storage, () => response.promise)
  const pending = checkout.sendIntent(checkout.pendingIntent.value)
  checkout.auth.sessionRevision += 2
  response.resolve({ id: 1 }); await pending
  assert.equal(checkout.state.order, null)
  assert.equal(JSON.parse(storage.get(storageKey)).key, original.key)
})
