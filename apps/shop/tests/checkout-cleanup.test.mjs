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
const flushNavigation = () => new Promise(resolve => setImmediate(resolve))

function fixture({ navigation = () => Promise.resolve(), sync = () => Promise.resolve(), removalFailure = false,
  expectedTotal = 180, resultTotal = '180.00', delayed = false } = {}) {
  const intent = { key: 'fixture-intent', scope: 'customer:10', expectedTotal,
    body: { items: [{ product_id: 1, quantity: 2 }], paymentMethod: 'onlineCard', promoCode: 'SAVE10' } }
  const stored = new Map([['shop-checkout-intent-v1', JSON.stringify(intent)]])
  const auth = { isAuthenticated: true, customer: { id: 10 }, sessionRevision: 0, captureSession() { const revision = this.sessionRevision; return () => revision === this.sessionRevision } }
  const state = { loading: false, order: null, error: '' }
  const signals = [], requests = []
  let dispose, resolveOrder
  const autoPayOrderId = { value: null }
  const context = vm.createContext({ ...reminder, auth, state,
    ref: value => ({ value }), computed: fn => ({ get value() { return fn() } }), watch() {}, onNuxtReady: fn => fn(), onBeforeUnmount: fn => { dispose = fn },
    sessionStorage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => {
      if (removalFailure && key === 'shop-checkout-intent-v1') throw new Error('fixture storage failure')
      stored.delete(key)
    } },
    customerScope: { get value() { return auth.isAuthenticated ? `customer:${auth.customer?.id}` : 'guest' } },
    autoPayOrderId, promo: { clearSaved() {} },
    cart: { items: [], syncFromServer: sync }, route: { query: {} }, router: { replace: navigation },
    saveCheckoutConfirmation() {}, readCheckoutConfirmation: () => null,
    commerceBreadcrumb() {}, reportCommerceError: (step, error, data) => signals.push({ step, data }),
    terms: { value: { checkout: { failed: 'failed' } } },
    domain: { createOrder: async (body, key) => {
      requests.push({ body, key })
      if (delayed) await new Promise(resolve => { resolveOrder = resolve })
      return { id: 42, payment_method: 'onlineCard', total_amount: resultTotal }
    } },
  })
  vm.runInContext(code + '\nglobalThis.checkout = { sendIntent, pendingIntent }', context)
  return { ...context.checkout, state, auth, signals, requests, stored, autoPayOrderId,
    resolveOrder: () => resolveOrder(), dispose: () => dispose() }
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

test('only an explicitly fresh intent with the displayed total authorizes automatic payment', async () => {
  for (const fresh of [false, true]) {
    for (const [expectedTotal, resultTotal, allowed] of [
      [180, '180.00', true], [180, '181.00', false], [180, '179.00', false],
      [10, '10.00', true], [10, '10.01', false], [10, '9.99', false],
      [undefined, '180.00', false], [NaN, '180.00', false], [180, 'not-money', false],
    ]) {
      const f = fixture({ expectedTotal, resultTotal })
      if (expectedTotal === undefined) {
        delete f.pendingIntent.value.expectedTotal
        f.stored.set('shop-checkout-intent-v1', JSON.stringify(f.pendingIntent.value))
      }
      await f.sendIntent(f.pendingIntent.value, fresh)
      assert.equal(f.state.order.id, 42, 'drift still retains the authoritative order confirmation')
      assert.equal(f.state.order.total_amount, resultTotal)
      assert.equal(f.state.error, '')
      assert.equal(f.autoPayOrderId.value, fresh && allowed ? 42 : null)
      assert.equal(f.requests.length, 1)
      assert.equal(f.requests[0].body.promoCode, 'SAVE10')
      assert.equal(f.requests[0].key, 'fixture-intent')
      assert.equal(f.pendingIntent.value, null)
      f.dispose()
    }
  }
})

test('fresh checkout arms only after its confirmation navigation completes successfully', async () => {
  let completeNavigation
  const f = fixture({ navigation: () => new Promise(resolve => { completeNavigation = resolve }) })
  await f.sendIntent(f.pendingIntent.value, true)
  assert.equal(f.state.order.id, 42)
  assert.equal(f.autoPayOrderId.value, null, 'an accepted order alone cannot authorize auto-payment')
  completeNavigation(undefined)
  await flushNavigation()
  assert.equal(f.autoPayOrderId.value, 42)
  assert.equal(f.requests.length, 1)
  f.dispose()
})

test('failed or stale confirmation navigation never arms an accepted order', async () => {
  for (const outcome of ['rejected', 'aborted', 'session', 'account', 'unmounted', 'different-order']) {
    let completeNavigation, rejectNavigation
    const f = fixture({ navigation: () => new Promise((resolve, reject) => {
      completeNavigation = resolve; rejectNavigation = reject
    }) })
    await f.sendIntent(f.pendingIntent.value, true)
    assert.equal(f.autoPayOrderId.value, null)
    if (outcome === 'session') f.auth.sessionRevision++
    if (outcome === 'account') f.auth.customer = { id: 11 }
    if (outcome === 'unmounted') f.dispose()
    if (outcome === 'different-order') f.state.order = { id: 99 }
    if (outcome === 'rejected') rejectNavigation(new Error('synthetic navigation rejection'))
    else completeNavigation(outcome === 'aborted' ? { type: 4 } : undefined)
    await flushNavigation()
    assert.equal(f.autoPayOrderId.value, null)
    assert.equal(f.requests.length, 1)
    assert.equal(f.state.error, '')
    assert.equal(f.state.order.id, outcome === 'different-order' ? 99 : 42)
    assert.deepEqual(f.signals.map(signal => signal.step), outcome === 'rejected' ? ['checkout.confirmation_navigation_failed'] : [])
    f.dispose()
  }
})

test('late fresh order completion cannot authorize payment after session, intent or component invalidation', async () => {
  for (const invalidate of [
    f => { f.auth.sessionRevision++ }, f => { f.auth.customer = { id: 11 } },
    f => { f.auth.isAuthenticated = false }, f => f.dispose(),
    f => { f.stored.set('shop-checkout-intent-v1', JSON.stringify({ key: 'new-intent', scope: 'customer:10' })) },
    f => { f.stored.delete('shop-checkout-intent-v1') },
  ]) {
    const f = fixture({ delayed: true })
    const pending = f.sendIntent(f.pendingIntent.value, true)
    assert.equal(f.requests.length, 1)
    const original = JSON.stringify(f.requests[0])
    invalidate(f)
    f.resolveOrder(); await pending
    assert.equal(f.state.order, null)
    assert.equal(f.autoPayOrderId.value, null)
    assert.equal(f.state.error, '')
    assert.deepEqual(f.signals, [])
    assert.equal(JSON.stringify(f.requests[0]), original, 'the submitted promo/body/key remain frozen')
    f.dispose()
  }
})
