import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { sourceModule } from './runtime-localization-harness.mjs'

const reminder = await sourceModule(readFileSync(new URL('../utils/checkoutReminder.ts', import.meta.url), 'utf8'))
const page = readFileSync(new URL('../pages/checkout/purchase.vue', import.meta.url), 'utf8')
const source = page.slice(page.indexOf('// Keep the exact submitted intent'), page.indexOf('\nuseSeo('))
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.None } }).outputText

function fixture({ navigation = () => Promise.resolve(), sync = () => Promise.resolve(), removalFailure = false } = {}) {
  const intent = { key: 'fixture-intent', scope: 'customer:10', body: { items: [{ product_id: 1, quantity: 1 }], paymentMethod: 'onlineCard' } }
  const stored = new Map([['shop-checkout-intent-v1', JSON.stringify(intent)]])
  const auth = { isAuthenticated: true, customer: { id: 10 }, sessionRevision: 0, captureSession() { const revision = this.sessionRevision; return () => revision === this.sessionRevision } }
  const state = { loading: false, order: null, error: '' }
  const signals = [], requests = []
  let dispose
  const context = vm.createContext({ ...reminder, auth, state,
    ref: value => ({ value }), computed: fn => ({ get value() { return fn() } }), watch() {}, onNuxtReady: fn => fn(), onBeforeUnmount: fn => { dispose = fn },
    sessionStorage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => {
      if (removalFailure && key === 'shop-checkout-intent-v1') throw new Error('fixture storage failure')
      stored.delete(key)
    } },
    cart: { items: [], syncFromServer: sync }, route: { query: {} }, router: { replace: navigation },
    saveCheckoutConfirmation() {}, readCheckoutConfirmation: () => null,
    commerceBreadcrumb() {}, reportCommerceError: (step, error, data) => signals.push({ step, data }),
    terms: { value: { checkout: { failed: 'failed' } } },
    domain: { createOrder: async (body, key) => { requests.push({ body, key }); return { id: 42, payment_method: 'onlineCard' } } },
  })
  vm.runInContext(code + '\nglobalThis.checkout = { sendIntent, pendingIntent }', context)
  return { ...context.checkout, state, auth, signals, requests, stored, dispose: () => dispose() }
}

test('post-order cart cleanup failure preserves confirmation and is not a failed order', async () => {
  const f = fixture({ sync: async () => { throw new Error('fixture sync failure') } })
  await f.sendIntent(f.pendingIntent.value)
  assert.equal(f.state.order.id, 42)
  assert.equal(f.state.error, '')
  assert.equal(f.requests.length, 1)
  assert.equal(f.pendingIntent.value, null)
  assert.equal(f.stored.has('shop-checkout-intent-v1'), false)
  assert.deepEqual(f.signals.map(signal => signal.step), ['checkout.confirmation_cleanup_failed'])
  assert.equal(f.signals[0].data.order_id, 42)
})

test('navigation rejection remains handled without retrying the accepted order', async () => {
  const f = fixture({ navigation: () => Promise.reject(new Error('fixture navigation failure')) })
  await f.sendIntent(f.pendingIntent.value)
  await Promise.resolve()
  assert.equal(f.state.order.id, 42)
  assert.equal(f.state.error, '')
  assert.equal(f.requests.length, 1)
  assert.deepEqual(f.signals.map(signal => signal.step), ['checkout.confirmation_navigation_failed'])
})

test('late navigation rejection after session change cannot emit previous customer telemetry', async () => {
  let reject
  const pending = new Promise((resolve, fail) => { reject = fail })
  const f = fixture({ navigation: () => pending })
  await f.sendIntent(f.pendingIntent.value)
  f.auth.sessionRevision++
  reject(new Error('fixture late failure'))
  await Promise.resolve()
  assert.deepEqual(f.signals, [])
  assert.equal(f.requests.length, 1)
})

test('late navigation rejection after unmount is ignored', async () => {
  let reject
  const pending = new Promise((resolve, fail) => { reject = fail })
  const f = fixture({ navigation: () => pending })
  await f.sendIntent(f.pendingIntent.value)
  f.dispose()
  reject(new Error('fixture late failure'))
  await Promise.resolve()
  assert.deepEqual(f.signals, [])
})

test('storage cleanup failure retains accepted confirmation and durable retry identity', async () => {
  const f = fixture({ removalFailure: true })
  await f.sendIntent(f.pendingIntent.value)
  assert.equal(f.state.order.id, 42)
  assert.equal(f.state.error, '')
  assert.equal(f.requests.length, 1)
  assert.equal(JSON.parse(f.stored.get('shop-checkout-intent-v1')).key, 'fixture-intent')
  assert.deepEqual(f.signals.map(signal => signal.step), ['checkout.confirmation_cleanup_failed'])
})
