import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { vue } from './runtime-localization-harness.mjs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const run = (source, globals) => vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, globals)
const flush = () => new Promise(resolve => setImmediate(resolve))
// Legacy responses remain supported during rolling releases.
const waiting = () => ({ order_id: 42, enabled: true, status: 'waiting', paid: false,
  receipt_accepted: false, page_url: 'https://pay.mbnk.biz/invoice_42', receipt_url: null,
  amount_minor: 12345, currency: 'UAH', retry_after_seconds: 30 })
const load = (token = 'guest-capability', reactive = false) => {
  const calls = [], timers = [], errors = [], redirects = [], watches = [], mounts = [], unmounts = [], emitted = []
  const signals = [], guards = new Set(), telemetry = {}
  run(read('utils/commerceTelemetry.ts'), { exports: telemetry, Error, Date, Map, Number })
  telemetry.configureCommerceTelemetry(signal => {
    signals.push(signal)
    if (signal.error) errors.push([signal.step, signal.error, signal.data])
  })
  const stored = new Map(), exports = {}, events = {}
  const props = { orderId: 42, guestToken: token }
  const auth = { isAuthenticated: false, customer: null, sessionRevision: 0, accessToken: null }
  const state = { response: { ...waiting(), status: 'not_started', page_url: null }, createResponse: waiting(), failure: null, delay: false, resolve: null, redirectFailure: null }
  const document = { hidden: false, addEventListener: (name, fn) => events[name] = fn, removeEventListener: name => delete events[name] }
  const globals = {
    exports, URL, document, crypto: { randomUUID: () => 'stable-key' },
    sessionStorage: { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) },
    Error,
    ref: reactive ? vue.ref : value => ({ value }), computed: fn => ({ get value() { return fn() } }),
    watch: (_identity, fn) => watches.push(fn), onMounted: fn => mounts.push(fn), onBeforeUnmount: fn => unmounts.push(fn),
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length }, clearTimeout() {},
    useCustomerAuthStore: () => auth,
    useRouter: () => ({ beforeEach: fn => { guards.add(fn); return () => guards.delete(fn) } }),
    require: () => telemetry,
    useApi: () => async (path, options) => {
      calls.push({ path, options })
      if (state.delay && (options.method === 'POST' || state.delayReads)) await new Promise(resolve => { state.resolve = resolve })
      if (state.failure) throw state.failure
      return options.method === 'POST' ? state.createResponse : state.response
    },
  }
  run(read('composables/useOrderPayment.ts'), globals)
  const payment = exports.useOrderPayment(() => props.orderId, () => props.guestToken)
  const viewGlobals = { ...globals, exports: {},
    useOrderPayment: () => payment, defineProps: () => props, defineEmits: () => (...args) => emitted.push(args),
    usePaymentDisplay: () => ({ paymentText: { value: {} } }), useShopRuntimeDisplay: () => ({ runtimeMessage: value => value }),
    safePaymentUrl: exports.safePaymentUrl,
    window: { location: { assign: url => { if (state.redirectFailure) throw state.redirectFailure; redirects.push(url) } } },
  }
  run(read('components/OrderPayment.vue').split('<script setup lang="ts">')[1].split('</script>')[0]
    + '\nexports.view = { beginPayment, paid, settled, pageUrl, receiptUrl, accessDenied, hint, illustrationTone, syncMethod, changeOpen, canChange, recordRedirect };', viewGlobals)
  return { ...viewGlobals.exports.view, payment, props, auth, state, calls, timers, errors, redirects, emitted, exports, signals, guards,
    document, events, stored, mount: () => mounts.forEach(fn => fn()), unmount: () => unmounts.forEach(fn => fn()),
    navigate: () => guards.forEach(fn => fn()), actorChanged: () => watches[0]() }
}

test('old production response works: mount/poll only GET; explicit create redirects in same tab', async () => {
  const env = load(); env.mount(); await flush()
  assert.equal(env.calls.length, 1)
  assert.equal(env.calls[0].options.method, 'GET')
  assert.equal(env.pageUrl.value, null)
  env.timers.at(-1).fn(); await flush()
  assert.ok(env.calls.every(call => call.options.method === 'GET'))
  await env.beginPayment()
  assert.deepEqual(env.redirects, [waiting().page_url])
  assert.equal(env.calls.filter(call => call.options.method === 'POST').length, 1)
  assert.equal(env.calls.at(-1).options.timeout, 15000)
  assert.equal(env.calls.at(-1).options.retry, 0)
  assert.deepEqual(Object.keys(env.calls.at(-1).options.body), [])
  env.unmount()
})

test('late create never navigates after route leave/return, unmount, actor, order or token change', async () => {
  for (const invalidate of [env => { env.navigate(); env.navigate() }, env => env.unmount(),
    env => { env.auth.sessionRevision++; env.auth.isAuthenticated = true; env.actorChanged() },
    env => { env.props.orderId++; env.actorChanged() }, env => { env.props.guestToken = 'other'; env.actorChanged() }]) {
    const env = load(); env.mount(); await flush(); env.state.delay = true
    const pending = env.beginPayment()
    invalidate(env)
    env.state.resolve(); await pending
    assert.deepEqual(env.redirects, [])
    env.unmount()
  }
})

test('URL allowlist, ownership, paid and unresolved results prevent navigation', async () => {
  for (const patch of [{ order_id: 99 }, { paid: true }, { status: 'creation_unknown' }, { status: 'requires_review' },
    ...['http://pay.mbnk.biz/x', 'https://pay.mbnk.biz.evil.test/x', 'https://user@pay.mbnk.biz/x',
      'https://pay.mbnk.biz:8443/x', 'https://pay.mbnk.biz/a/b', 'javascript:alert(1)'].map(page_url => ({ page_url }))]) {
    const env = load(); env.mount(); await flush(); env.state.createResponse = { ...waiting(), ...patch }
    await env.beginPayment(); assert.deepEqual(env.redirects, []); env.unmount()
  }
})

test('late create also rejects a changed stored guest capability', async () => {
  const env = load(); env.props.guestToken = undefined
  env.stored.set('shop-order-payment-token:42', 'original-capability')
  env.mount(); await flush(); env.state.delay = true
  const pending = env.beginPayment()
  env.stored.set('shop-order-payment-token:42', 'replacement-capability')
  env.state.resolve(); await pending
  assert.deepEqual(env.redirects, [])
  assert.equal(env.payment.busy.value, false)
  assert.equal(env.payment.payment.value, null)
  assert.equal(env.accessDenied.value, true)
  const posts = env.calls.filter(call => call.options.method === 'POST').length
  await env.beginPayment()
  assert.equal(env.calls.filter(call => call.options.method === 'POST').length, posts)
  env.state.delay = false
  await env.payment.refresh()
  assert.equal(env.calls.at(-1).options.method, 'GET')
  assert.equal(env.calls.at(-1).options.headers['X-Order-Payment-Token'], 'replacement-capability')
  assert.equal(env.payment.busy.value, false)
  assert.equal(env.payment.payment.value.status, 'not_started')
  assert.equal(env.accessDenied.value, false)
  assert.deepEqual(env.redirects, [])
  env.unmount()
})

test('403 clears an accepted receipt and keeps access denied through pending GET and network failure', async () => {
  const env = load()
  env.state.response = { ...waiting(), status: 'accepted', paid: true, receipt_accepted: true,
    receipt_url: 'https://cabinet.tax.gov.ua/cashregs/check?id=fixture' }
  env.mount(); await flush()
  assert.equal(env.settled.value, true)
  assert.ok(env.receiptUrl.value)
  env.state.failure = { statusCode: 403 }
  await env.payment.refresh()
  const protectedStateIsHidden = () => {
    assert.equal(env.payment.payment.value, null)
    assert.equal(env.accessDenied.value, true)
    assert.equal(env.receiptUrl.value, null)
    assert.equal(env.pageUrl.value, null)
    assert.equal(env.settled.value, false)
    assert.notEqual(env.illustrationTone.value, 'success')
  }
  protectedStateIsHidden()
  env.state.failure = new Error('network unavailable')
  env.state.delay = true; env.state.delayReads = true
  const pending = env.payment.refresh()
  assert.equal(env.payment.busy.value, true)
  protectedStateIsHidden()
  env.state.resolve(); await pending
  assert.equal(env.payment.busy.value, false)
  protectedStateIsHidden()
  env.state.failure = null; env.state.delay = false
  await env.payment.refresh()
  assert.equal(env.accessDenied.value, false)
  assert.equal(env.settled.value, true)
  assert.ok(env.receiptUrl.value)
  assert.ok(env.calls.every(call => call.options.method === 'GET'))
  env.unmount()
})

test('failed POST retries keep the key; network and redirect errors stay visible', async () => {
  const env = load(); env.mount(); await flush()
  env.state.failure = new Error('timeout')
  await env.beginPayment()
  assert.equal(env.payment.errorKind.value, 'connection')
  assert.deepEqual(env.redirects, [])
  assert.equal(env.errors[0][0], 'payment.start_failed')
  const key = env.calls.at(-1).options.headers['Idempotency-Key']
  const failedCount = env.calls.length
  await env.beginPayment()
  assert.equal(env.calls.length, failedCount, 'uncertain POST must be reconciled with GET before another start')
  env.state.failure = null; env.state.redirectFailure = new Error('navigation unavailable')
  await env.payment.refresh()
  await env.beginPayment()
  assert.equal(env.calls.at(-1).options.headers['Idempotency-Key'], key)
  assert.equal(env.errors.at(-1)[0], 'payment.redirect_failed')
  env.unmount()
})

test('direct create refuses unknown, disabled, paid, waiting and unresolved states', async () => {
  const env = load()
  await env.payment.create(); assert.equal(env.calls.length, 0)
  env.mount(); await flush()
  for (const projection of [null, { ...waiting(), enabled: false, status: 'not_started' },
    { ...waiting(), paid: true, status: 'not_started' }, waiting(),
    ...['accepted', 'paid_receipt_pending', 'creation_unknown', 'requires_review'].map(status => ({ ...waiting(), status }))]) {
    env.payment.payment.value = projection
    const count = env.calls.length
    await env.payment.create(); assert.equal(env.calls.length, count)
  }
  env.unmount()
})

test('access denial stops polling; 403/404 report immediately, missing capability/401/410 are expected', async () => {
  for (const status of [401, 403, 404, 410]) {
    const env = load(); env.mount(); await flush()
    const count = env.timers.length
    env.state.failure = { response: { status } }
    await env.payment.refresh()
    assert.equal(env.payment.errorKind.value, 'access')
    assert.equal(env.timers.length, count)
    assert.equal(env.accessDenied.value, true)
    assert.equal(env.errors.length, [403, 404].includes(status) ? 1 : 0)
    env.unmount()
  }
  const env = load(undefined); env.props.guestToken = undefined; env.mount(); await flush()
  assert.equal(env.calls.length, 0); assert.equal(env.errors.length, 0); assert.equal(env.timers.length, 0)
  assert.equal(env.payment.errorKind.value, 'access'); env.unmount()
})

test('poll interval is bounded; conflict clears after refresh without automatic POST', async () => {
  const env = load(); env.mount(); await flush()
  for (const [value, expected] of [[12, 12000], [-1, 5000], [999, 120000], [NaN, 30000], [undefined, 30000]]) {
    env.state.response = { ...waiting(), retry_after_seconds: value }
    await env.payment.refresh(); assert.equal(env.timers.at(-1).ms, expected)
  }
  env.state.failure = { statusCode: 409 }; await env.payment.refresh()
  assert.equal(env.payment.errorKind.value, 'conflict')
  env.state.failure = null; await env.payment.refresh()
  assert.equal(env.payment.errorKind.value, '')
  assert.ok(env.calls.every(call => call.options.method === 'GET'))
  env.unmount()
})

test('paid/settled semantics remain exact for contradictory legacy responses', async () => {
  const env = load(); env.mount(); await flush()
  for (const [status, paid, expectedPaid, settled] of [['accepted', false, true, false],
    ['paid_receipt_pending', true, true, true], ['requires_review', true, true, false], ['waiting', false, false, false]]) {
    env.payment.payment.value = { ...waiting(), status, paid }
    assert.equal(env.paid.value, expectedPaid); assert.equal(env.settled.value, settled)
  }
  env.unmount()
})

const changeable = () => ({ ...waiting(), status: 'not_started', page_url: null, revision: 3, attempt_id: null,
  actions: { start: true, change_method: true, refresh: true }, available_payment_methods: ['cashOnDelivery'] })

test('method change requires explicit complete authority; legacy/unsafe snapshots cannot write', async () => {
  const env = load(); env.mount(); await flush()
  for (const snapshot of [null, waiting(), { ...changeable(), actions: undefined },
    { ...changeable(), revision: undefined }, { ...changeable(), revision: 0 },
    { ...changeable(), attempt_id: undefined }, { ...changeable(), attempt_id: 7 },
    { ...changeable(), paid: true }, { ...changeable(), status: 'waiting' }]) {
    env.payment.payment.value = snapshot
    const count = env.calls.length
    await env.payment.changeMethod('cashOnDelivery')
    assert.equal(env.calls.length, count)
  }
  env.payment.payment.value = changeable()
  const count = env.calls.length
  for (const method of ['cash', 'onlineCard', 'invalid']) await env.payment.changeMethod(method)
  assert.equal(env.calls.length, count)
  env.unmount()
})

test('method change writes revision/attempt with durable key, no retry and reconciles uncertainty by GET', async () => {
  const env = load(); env.state.response = changeable(); env.mount(); await flush()
  env.state.failure = new Error('timeout')
  await env.payment.changeMethod('cashOnDelivery')
  const first = env.calls.at(-1)
  assert.equal(first.path, '/public/orders/42/online-payment/change-method')
  assert.equal(first.options.method, 'POST')
  assert.equal(first.options.retry, 0)
  assert.equal(first.options.timeout, 15000)
  assert.equal(JSON.stringify(first.options.body), JSON.stringify({ payment_method: 'cashOnDelivery', expected_revision: 3, expected_attempt_id: null }))
  assert.equal(env.errors.at(-1)[0], 'payment.change_method_failed')
  const count = env.calls.length
  await env.payment.changeMethod('cashOnDelivery')
  assert.equal(env.calls.length, count)
  env.state.failure = null
  await env.payment.refresh()
  env.state.createResponse = { ...changeable(), reason: 'offline_payment_selected', revision: 4,
    order: { payment_method: 'cashOnDelivery' }, actions: { start: false, change_method: false } }
  await env.payment.changeMethod('cashOnDelivery')
  assert.equal(env.calls.at(-1).options.headers['Idempotency-Key'], first.options.headers['Idempotency-Key'])
  assert.equal(env.payment.payment.value.revision, 4)
  const settledCount = env.calls.length
  await env.payment.changeMethod('cashOnDelivery')
  await env.payment.create()
  assert.equal(env.calls.length, settledCount)
  env.unmount()
})

test('method change ignores stale capability results and access denial clears private snapshot', async () => {
  const env = load(); env.state.response = changeable(); env.mount(); await flush()
  env.state.delay = true
  const pending = env.payment.changeMethod('cashOnDelivery')
  env.props.guestToken = 'replacement'; env.actorChanged()
  env.state.resolve(); await pending
  assert.equal(env.payment.payment.value?.reason, undefined)
  env.state.delay = false; env.state.failure = { statusCode: 403 }
  await env.payment.refresh()
  assert.equal(env.payment.payment.value, null)
  const count = env.calls.length
  await env.payment.changeMethod('cashOnDelivery')
  assert.equal(env.calls.length, count)
  env.unmount()
})

test('GET reconciles committed method change after POST timeout and updates parent exactly once', async () => {
  const env = load(); env.state.response = changeable(); env.mount(); await flush()
  env.changeOpen.value = true
  env.state.failure = new Error('timeout')
  await env.payment.changeMethod('cashOnDelivery')
  env.syncMethod()
  assert.equal(env.emitted.length, 0)
  env.state.failure = null
  env.state.response = { ...changeable(), revision: 4, reason: 'offline_payment_selected', order: { payment_method: 'cashOnDelivery' } }
  await env.payment.refresh()
  env.syncMethod()
  assert.equal(env.changeOpen.value, false)
  assert.equal(JSON.stringify(env.emitted), JSON.stringify([['method-changed', 'cashOnDelivery']]))
  await env.payment.refresh(); env.syncMethod()
  assert.equal(env.emitted.length, 1)
  env.unmount()
})

test('initial invalid provider URL is private, deduplicated per numeric attempt and never navigates', async () => {
  const env = load()
  env.state.response = { ...waiting(), attempt_id: 1, page_url: 'https://evil.test/private-capability?email=buyer@example.test' }
  env.mount(); await flush()
  const invalid = () => env.signals.filter(signal => signal.step === 'payment.invalid_provider_url')
  assert.equal(invalid().length, 1, 'the first accepted GET is diagnosed without an immediate watcher')
  await env.payment.refresh(); await env.payment.refresh()
  assert.equal(invalid().length, 1)
  env.state.response = { ...env.state.response, attempt_id: 2 }
  await env.payment.refresh(); await env.payment.refresh()
  assert.equal(invalid().length, 2)
  assert.equal(invalid()[1].data.attempt_id, 2)
  assert.equal(env.signals.filter(signal => signal.step === 'payment.status').length, 2)
  env.recordRedirect()
  assert.equal(env.signals.filter(signal => signal.step === 'payment.redirect').length, 0)
  assert.deepEqual(env.redirects, [])
  const serialized = JSON.stringify(env.signals)
  for (const secret of ['evil.test', 'private-capability', 'buyer@example.test', 'guest-capability', 'page_url']) assert.ok(!serialized.includes(secret))
  env.unmount()
})

test('valid, paid, review, forbidden-continuation and foreign-order snapshots are not invalid-URL incidents', async () => {
  for (const patch of [{}, { paid: true, page_url: 'bad' }, { status: 'requires_review', page_url: 'bad' },
    { actions: { continue_payment: false }, page_url: 'bad' }, { order_id: 99, page_url: 'bad' }]) {
    const env = load(); env.state.response = { ...waiting(), ...patch }; env.mount(); await flush()
    assert.equal(env.errors.length, 0)
    env.unmount()
  }
})

test('attempt-only transitions emit once and string attempt capabilities are never serialized', async () => {
  const env = load(); env.state.response = { ...waiting(), attempt_id: 1 }; env.mount(); await flush()
  await env.payment.refresh()
  env.state.response = { ...waiting(), attempt_id: 2 }
  await env.payment.refresh(); await env.payment.refresh()
  assert.equal(env.signals.filter(signal => signal.step === 'payment.status').length, 2)
  env.state.response = { ...waiting(), attempt_id: 'private-attempt-capability' }
  await env.payment.refresh()
  env.recordRedirect()
  assert.ok(!JSON.stringify(env.signals).includes('private-attempt-capability'))
  env.unmount()
})

test('redirect intent works with Vue-proxied snapshots and preserves redirect-failure reporting', async () => {
  const env = load('guest-capability', true); env.mount(); await flush()
  env.state.redirectFailure = new Error('private-navigation-detail')
  await env.beginPayment()
  assert.equal(env.signals.filter(signal => signal.step === 'payment.redirect').length, 1)
  assert.equal(env.errors.at(-1)[0], 'payment.redirect_failed')
  assert.ok(!JSON.stringify(env.signals).includes('private-navigation-detail'))
  env.recordRedirect()
  assert.equal(env.signals.filter(signal => signal.step === 'payment.redirect').length, 2, 'explicit continuation click records an intent')
  env.unmount()
  assert.equal(env.guards.size, 0)
})

test('late invalid/new-attempt responses and continuation clicks cannot report after lifecycle invalidation', async () => {
  for (const invalidate of [env => { env.navigate(); env.navigate() }, env => env.unmount(),
    env => { env.auth.sessionRevision++; env.actorChanged() },
    env => { env.auth.isAuthenticated = true; env.actorChanged() },
    env => { env.props.orderId++; env.actorChanged() },
    env => { env.props.guestToken = 'replacement'; env.actorChanged() },
    env => { env.props.guestToken = undefined; env.stored.set('shop-order-payment-token:42', 'replacement') }]) {
    const env = load(); env.state.response = { ...waiting(), attempt_id: 1 }; env.mount(); await flush()
    env.state.delay = true; env.state.delayReads = true
    const pending = env.payment.refresh()
    const resolveOld = env.state.resolve
    invalidate(env)
    const count = env.signals.length
    env.recordRedirect()
    env.state.response = { ...waiting(), attempt_id: 2, page_url: 'https://evil.test/private' }
    resolveOld(); await pending
    env.recordRedirect()
    assert.equal(env.signals.length, count)
    env.unmount()
  }
})

test('late create cannot emit redirect intent after navigation or a same-customer session rotation', async () => {
  for (const invalidate of [env => env.navigate(), env => env.unmount(), env => { env.auth.sessionRevision++; env.actorChanged() }]) {
    const env = load(); env.mount(); await flush(); env.state.delay = true
    const pending = env.beginPayment()
    invalidate(env)
    const count = env.signals.length
    env.state.resolve(); await pending
    assert.equal(env.signals.slice(count).some(signal => signal.step === 'payment.redirect' || signal.data.payment_status === 'waiting'), false,
      'a fresh-session GET may report its own state, but the old POST must not report or redirect')
    assert.deepEqual(env.redirects, [])
    env.unmount()
  }
})

test('409 and 422 method conflicts keep the modal and snapshot, block writes, then clear only after GET', async () => {
  for (const status of [409, 422]) {
    const env = load(); env.state.response = changeable(); env.mount(); await flush()
    env.changeOpen.value = true
    env.state.failure = { response: { status } }
    await env.payment.changeMethod('cashOnDelivery')
    assert.equal(env.payment.errorKind.value, 'conflict')
    assert.equal(env.changeOpen.value, true)
    assert.equal(env.payment.payment.value.revision, 3)
    assert.equal(env.canChange.value, false)
    const posts = () => env.calls.filter(call => call.options.method === 'POST').length
    assert.equal(posts(), 1)
    await env.payment.changeMethod('cashOnDelivery')
    assert.equal(posts(), 1)
    env.state.failure = null
    await env.payment.refresh()
    assert.equal(env.payment.errorKind.value, '')
    assert.equal(env.canChange.value, true)
    assert.equal(posts(), 1)
    env.state.failure = { response: { status: 403 } }
    await env.payment.refresh()
    assert.equal(env.payment.payment.value, null)
    assert.equal(env.canChange.value, false)
    env.unmount()
  }
})
