import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const vue = createRequire(require.resolve('nuxt/package.json'))('vue')
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const flush = async () => { await Promise.resolve(); await vue.nextTick(); await new Promise(resolve => setImmediate(resolve)); await vue.nextTick() }
const snapshot = (patch = {}) => ({ order_id: 42, enabled: true, status: 'not_started', paid: false,
  receipt_accepted: false, page_url: null, receipt_url: null, amount_minor: 18000, currency: 'UAH',
  revision: 1, attempt_id: null, actions: { start: true, continue_payment: true, refresh: true }, ...patch })
const waiting = (patch = {}) => snapshot({ status: 'waiting', attempt_id: 1, page_url: 'https://pay.mbnk.biz/mock-invoice', ...patch })

// Real Vue watchers and the actual composable/component script; all HTTP, storage and navigation are isolated.
function fixture({ authenticated = false, autoStart = true, hidden = false } = {}) {
  const props = vue.reactive({ orderId: 42, guestToken: authenticated ? undefined : 'fixture-capability', autoStart })
  const auth = vue.reactive({ isAuthenticated: authenticated, customer: authenticated ? { id: 10 } : null,
    accessToken: authenticated ? 'fixture-access' : null, sessionRevision: 0 })
  auth.captureSession = () => {
    const identity = () => JSON.stringify([auth.isAuthenticated, auth.customer?.id, auth.accessToken, auth.sessionRevision])
    const captured = identity()
    return () => captured === identity()
  }
  const calls = [], redirects = [], signals = [], mounts = [], unmounts = []
  const guards = new Set(), stored = new Map(), timers = new Map()
  let timerId = 0
  const document = { hidden, addEventListener() {}, removeEventListener() {} }
  const exports = {}, scope = vue.effectScope()
  const globals = {
    ...vue, exports, URL, Error, document,
    crypto: { randomUUID: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    sessionStorage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) },
    onMounted: fn => mounts.push(fn), onBeforeUnmount: fn => unmounts.push(fn),
    setTimeout: (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId }, clearTimeout: id => timers.delete(id),
    useCustomerAuthStore: () => auth,
    useRouter: () => ({ beforeEach: fn => { guards.add(fn); return () => guards.delete(fn) } }),
    useApi: () => (path, options) => new Promise((resolve, reject) => calls.push({ path, options, resolve, reject })),
    require: () => ({ commerceBreadcrumb: (step, data) => signals.push({ step, data }), reportCommerceError: (step, _cause, data) => signals.push({ step, data }) }),
  }
  vm.runInNewContext(compile(read('composables/useOrderPayment.ts')), globals)
  const payment = scope.run(() => exports.useOrderPayment(() => props.orderId, () => props.guestToken))
  const context = vm.createContext({ ...globals,
    defineProps: () => props, defineEmits: () => () => {}, useOrderPayment: () => payment,
    usePaymentDisplay: () => ({ paymentText: vue.ref({ statuses: {} }) }),
    useShopRuntimeDisplay: () => ({ runtimeMessage: String }), safePaymentUrl: exports.safePaymentUrl,
    window: { location: { assign: url => redirects.push(url) } },
  })
  const source = read('components/OrderPayment.vue').split('<script setup lang="ts">')[1].split('</script>')[0]
  scope.run(() => vm.runInContext(compile(source) + '\nglobalThis.view = { beginPayment, autoStartConsumed, paid, settled };', context))
  let destroyed = false
  return { props, auth, calls, redirects, signals, payment, document, stored, ...context.view,
    runInScope: fn => scope.run(fn), onDispose: fn => unmounts.push(fn),
    mount: async () => { mounts.forEach(fn => fn()); await flush() },
    navigate: () => guards.forEach(fn => fn()),
    destroy: () => { if (!destroyed) { destroyed = true; unmounts.forEach(fn => fn()); scope.stop() } },
  }
}

function wireCheckout(f, { total = '10.00', navigationOutcome } = {}) {
  const autoPayOrderId = vue.ref(null)
  const state = vue.reactive({ loading: false, order: null, error: '' })
  const scope = f.auth.isAuthenticated ? `customer:${f.auth.customer.id}` : 'guest'
  const intent = { key: 'fresh-order', scope, expectedTotal: 10,
    body: { paymentMethod: 'onlineCard', items: [{ product_id: 1, quantity: 1 }] } }
  f.stored.set('shop-checkout-intent-v1', JSON.stringify(intent))
  let completeNavigation
  const navigation = new Promise(resolve => { completeNavigation = resolve })
  const navigationCalls = [], orderCalls = []
  const context = vm.createContext({
    ...vue, auth: f.auth, state, autoPayOrderId,
    customerScope: vue.computed(() => f.auth.isAuthenticated ? `customer:${f.auth.customer.id}` : 'guest'),
    watch() {}, onNuxtReady: fn => fn(), onBeforeUnmount: f.onDispose,
    sessionStorage: { getItem: key => f.stored.get(key) ?? null, setItem: (key, value) => f.stored.set(key, value), removeItem: key => f.stored.delete(key) },
    route: { query: {} }, router: { replace: query => { navigationCalls.push(query); f.navigate(); return navigation } },
    readCheckoutConfirmation: () => null, saveCheckoutConfirmation() {},
    promo: { clearSaved() {} }, reminderOrderStorageKey: scope => `reminder-order:${scope}`, reminderStorageKey: scope => `reminder:${scope}`,
    cart: { items: [], syncFromServer: async () => {} }, terms: { value: { checkout: { failed: 'failed' } } },
    commerceBreadcrumb() {}, reportCommerceError() {},
    domain: { createOrder: async (body, key) => { orderCalls.push({ body, key }); return { id: 42, payment_method: 'onlineCard', total_amount: total } } },
  })
  const page = read('pages/checkout/purchase.vue')
  const source = page.slice(page.indexOf('// Keep the exact submitted intent'), page.indexOf('\nuseSeo('))
  vm.runInContext(compile(source) + '\nglobalThis.checkout = { sendIntent, pendingIntent };', context)
  f.runInScope(() => vue.watch(autoPayOrderId, id => { f.props.autoStart = id === state.order?.id }, { flush: 'sync' }))
  return { state, autoPayOrderId, navigationCalls, orderCalls,
    submit: () => context.checkout.sendIntent(context.checkout.pendingIntent.value, true),
    completeNavigation: () => completeNavigation(navigationOutcome),
  }
}

test('actual checkout confirmation navigation completes before the mounted payment instance is armed', async t => {
  for (const authenticated of [false, true]) {
    const f = fixture({ authenticated, autoStart: false }); t.after(f.destroy)
    await f.mount()
    const checkout = wireCheckout(f)
    await checkout.submit()
    assert.equal(checkout.navigationCalls.length, 1)
    assert.equal(checkout.navigationCalls[0].query.confirmation, '42')
    assert.equal(checkout.autoPayOrderId.value, null)
    f.calls[0].resolve(snapshot({ amount_minor: 1000 })); await flush()
    assert.equal(f.calls.length, 1)
    assert.deepEqual(f.redirects, [])
    checkout.completeNavigation(); await flush()
    assert.equal(checkout.autoPayOrderId.value, 42)
    assert.equal(f.calls.length, 2, 'own confirmation navigation must not suppress the fresh one-shot POST')
    f.calls[1].resolve(waiting({ amount_minor: 1000 })); await flush()
    assert.deepEqual(f.redirects, ['https://pay.mbnk.biz/mock-invoice'])
    assert.equal(checkout.orderCalls.length, 1)
    assert.equal(f.calls.filter(call => call.options.method === 'POST').length, 1)
    assert.equal(checkout.state.order.total_amount, '10.00')
    assert.equal(f.settled.value, false)
  }
})

test('expected 10.00 and returned 10.01 keep confirmation but require an explicit payment action', async t => {
  const f = fixture({ autoStart: false }); t.after(f.destroy)
  await f.mount()
  const checkout = wireCheckout(f, { total: '10.01' })
  await checkout.submit(); f.calls[0].resolve(snapshot({ amount_minor: 1001 })); await flush()
  checkout.completeNavigation(); await flush()
  assert.equal(checkout.state.order.total_amount, '10.01')
  assert.equal(checkout.autoPayOrderId.value, null)
  assert.equal(f.calls.length, 1)
  assert.deepEqual(f.redirects, [])
  const manual = f.beginPayment()
  assert.equal(f.calls.at(-1).options.method, 'POST')
  f.calls.at(-1).resolve(waiting({ amount_minor: 1001 })); await manual; await flush()
  assert.deepEqual(f.redirects, ['https://pay.mbnk.biz/mock-invoice'])
  assert.equal(checkout.orderCalls.length, 1)
})

test('a later navigation or identity change invalidates an explicit post-confirmation arm', async t => {
  for (const invalidate of [f => f.navigate(), f => { f.auth.sessionRevision++ },
    f => { const token = f.props.guestToken; f.props.guestToken = 'replacement'; f.props.guestToken = token },
    f => { const token = f.auth.accessToken; f.auth.accessToken = 'replacement'; f.auth.accessToken = token },
    f => { f.props.guestToken = 'replacement' }, f => { f.auth.accessToken = 'replacement' }, f => f.destroy()]) {
    const f = fixture({ autoStart: false }); t.after(f.destroy)
    await f.mount()
    const checkout = wireCheckout(f)
    await checkout.submit(); checkout.completeNavigation(); await flush()
    assert.equal(checkout.autoPayOrderId.value, 42)
    invalidate(f)
    f.calls[0].resolve(waiting({ amount_minor: 1000 })); await flush()
    // New-session GETs can be authoritative without inheriting the old payment authorization.
    for (const call of f.calls.slice(1)) call.resolve(waiting({ amount_minor: 1000 }))
    await flush()
    assert.equal(f.calls.some(call => call.options.method === 'POST'), false)
    assert.deepEqual(f.redirects, [])
  }
})

test('aborted confirmation navigation cannot arm the payment instance', async t => {
  const f = fixture({ autoStart: false }); t.after(f.destroy)
  await f.mount()
  const checkout = wireCheckout(f, { navigationOutcome: { type: 4 } })
  await checkout.submit(); f.calls[0].resolve(snapshot({ amount_minor: 1000 })); await flush()
  checkout.completeNavigation(); await flush()
  assert.equal(checkout.autoPayOrderId.value, null)
  assert.equal(f.calls.length, 1)
  assert.deepEqual(f.redirects, [])
})

for (const authenticated of [false, true]) {
  test(`${authenticated ? 'customer' : 'guest'} fresh checkout auto-starts one invoice and never interprets redirect as payment`, async t => {
    const f = fixture({ authenticated }); t.after(f.destroy)
    await f.mount()
    assert.equal(f.calls.length, 1)
    assert.equal(f.calls[0].options.method, 'GET')
    assert.equal(f.calls[0].options.headers['X-Order-Payment-Token'], authenticated ? undefined : 'fixture-capability')
    f.calls[0].resolve(snapshot()); await flush()
    assert.equal(f.calls.length, 2)
    const post = f.calls[1]
    assert.equal(post.options.method, 'POST')
    assert.equal(post.options.retry, 0)
    assert.equal(post.options.timeout, 15000)
    assert.ok(post.options.headers['Idempotency-Key'])
    assert.equal(JSON.stringify(post.options.body), '{}')
    post.resolve(waiting()); await flush()
    assert.deepEqual(f.redirects, ['https://pay.mbnk.biz/mock-invoice'])
    assert.equal(f.autoStartConsumed.value, true)
    assert.equal(f.payment.payment.value.paid, false)
    assert.equal(f.payment.payment.value.receipt_accepted, false)
    assert.equal(f.settled.value, false)
    f.props.autoStart = false; await flush(); f.props.autoStart = true; await flush()
    assert.equal(f.calls.filter(call => call.options.method === 'POST').length, 1)
    assert.equal(f.redirects.length, 1)
    assert.equal(f.signals.filter(signal => signal.step === 'payment.redirect').length, 1)
  })
}

test('restored confirmations read current payment but never auto-create or auto-redirect', async t => {
  for (const result of [snapshot(), waiting()]) {
    const f = fixture({ autoStart: false }); t.after(f.destroy)
    await f.mount(); f.calls[0].resolve(result); await flush()
    assert.equal(f.calls.length, 1)
    assert.deepEqual(f.redirects, [])
    assert.equal(f.autoStartConsumed.value, false)
  }
})

test('a fresh waiting snapshot continues its valid invoice once without another POST', async t => {
  const f = fixture(); t.after(f.destroy)
  await f.mount(); f.calls[0].resolve(waiting()); await flush()
  assert.equal(f.calls.length, 1)
  assert.deepEqual(f.redirects, ['https://pay.mbnk.biz/mock-invoice'])
})

for (const [label, result] of [
  ['disabled', snapshot({ enabled: false })], ['forbidden start', snapshot({ actions: { start: false } })],
  ['paid', snapshot({ paid: true })], ['review', snapshot({ status: 'requires_review' })],
  ['uncertain creation', snapshot({ status: 'creation_unknown' })], ['another order', snapshot({ order_id: 99 })],
  ['unsafe URL', waiting({ page_url: 'https://evil.test/private' })],
  ['forbidden continuation', waiting({ actions: { continue_payment: false } })],
]) {
  test(`auto-payment refuses ${label} without a new POST or redirect`, async t => {
    const f = fixture(); t.after(f.destroy)
    await f.mount(); f.calls[0].resolve(result); await flush()
    assert.equal(f.calls.length, 1)
    assert.deepEqual(f.redirects, [])
  })
}

test('navigation attempt, hidden document and replaced stored capability block automatic continuation of an initial GET', async t => {
  for (const invalidate of [f => f.navigate(), f => { f.document.hidden = true }, f => f.destroy(),
    f => { f.props.guestToken = undefined; f.stored.set('shop-order-payment-token:42', 'replacement') }]) {
    const f = fixture(); t.after(f.destroy)
    await f.mount(); const first = f.calls[0]
    invalidate(f); first.resolve(waiting()); await flush()
    assert.deepEqual(f.redirects, [])
    assert.equal(f.calls.some(call => call.options.method === 'POST'), false)
  }
})

test('an in-flight auto-start cannot redirect after navigation, logout, session rotation or capability replacement', async t => {
  for (const invalidate of [f => f.navigate(), f => f.destroy(),
    f => { f.auth.sessionRevision++ }, f => { f.auth.isAuthenticated = false; f.auth.accessToken = null; f.auth.customer = null },
    f => { f.props.guestToken = 'replacement' }, f => { f.props.orderId = 99 }]) {
    const f = fixture({ authenticated: true }); t.after(f.destroy)
    await f.mount(); f.calls[0].resolve(snapshot()); await flush()
    const post = f.calls.find(call => call.options.method === 'POST')
    assert.ok(post)
    invalidate(f); post.resolve(waiting()); await flush()
    assert.deepEqual(f.redirects, [])
    assert.equal(f.calls.filter(call => call.options.method === 'POST').length, 1)
    assert.equal(f.signals.some(signal => signal.step === 'payment.redirect'), false)
  }
})

test('unknown invoice creation is not automatically retried after reconciliation', async t => {
  const f = fixture(); t.after(f.destroy)
  await f.mount(); f.calls[0].resolve(snapshot()); await flush()
  const post = f.calls[1]
  post.reject(new Error('synthetic timeout')); await flush()
  assert.ok(f.payment.error.value)
  assert.equal(f.autoStartConsumed.value, true)
  const refresh = f.payment.refresh()
  f.calls.at(-1).resolve(snapshot()); await refresh; await flush()
  assert.equal(f.calls.filter(call => call.options.method === 'POST').length, 1)
  assert.deepEqual(f.redirects, [])
  const explicitRetry = f.beginPayment()
  const retry = f.calls.at(-1)
  assert.equal(retry.options.method, 'POST')
  assert.equal(retry.options.headers['Idempotency-Key'], post.options.headers['Idempotency-Key'])
  retry.resolve(waiting()); await explicitRetry; await flush()
  assert.equal(f.calls.filter(call => call.options.method === 'POST').length, 2)
  assert.deepEqual(f.redirects, ['https://pay.mbnk.biz/mock-invoice'])
})
