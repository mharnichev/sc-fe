import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
const source = readFileSync(new URL('../composables/useOrderPayment.ts', import.meta.url), 'utf8')
const load = () => {
  const calls = [], timers = [], events = {}, stored = new Map(), watches = []
  let mounted, unmount
  const exports = {}
  const document = { hidden: false, addEventListener: (name, fn) => events[name] = fn, removeEventListener: name => delete events[name] }
  const auth = { isAuthenticated: false, customer: null, sessionRevision: 0, accessToken: null }
  const state = { response: { status: 'waiting', page_url: 'https://pay.mbnk.biz/abc', enabled: true }, resolve: null, delayed: false }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, URL, document, crypto: { randomUUID: () => 'stable-id' },
    sessionStorage: { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) },
    useApi: () => async (path, options) => { calls.push({ path, options }); if (state.delayed) await new Promise(resolve => state.resolve = resolve); return state.response },
    useCustomerAuthStore: () => auth, ref: value => ({ value }), watch: (identity, reset) => watches.push(reset),
    onMounted: fn => mounted = fn, onBeforeUnmount: fn => unmount = fn,
    setTimeout: (_fn, ms) => { timers.push(ms); return 1 }, clearTimeout() {},
  })
  return { exports, calls, timers, events, document, stored, auth, state, mount: () => mounted(), unmount: () => unmount(), watches }
}
const flush = () => new Promise(resolve => setImmediate(resolve))
test('cabinet retains verified online origin after card settlement, never infers it from generic card facts', () => {
  const cabinet = readFileSync(new URL('../pages/cabinet/orders/[id].vue', import.meta.url), 'utf8')
  const condition = cabinet.match(/<OrderPayment v-if="([^"]+)"/)[1]
  const visible = order => vm.runInNewContext(condition, { order })
  assert.equal(visible({ payment_method: 'onlineCard' }), true)
  for (const fiscal_status of ['pending', 'accepted']) {
    assert.equal(visible({ payment_method: 'card', payment_channel: 'online_monobank', fiscal_status }), true)
    for (const payment_channel of [undefined, null, '', 'card', 'online_monobank_other']) {
      assert.equal(visible({ payment_method: 'card', payment_channel, payment_status: 'paid', fiscal_status }), false)
    }
  }
})
test('hosted links reject lookalike hosts, credentials, ports and unsafe invoice paths', () => {
  const { exports: { safePaymentUrl } } = load()
  assert.equal(safePaymentUrl('https://pay.mbnk.biz/abc-123'), 'https://pay.mbnk.biz/abc-123')
  for (const value of ['http://pay.mbnk.biz/abc', 'https://pay.mbnk.biz.evil.test/abc', 'https://user@pay.mbnk.biz/abc', 'https://pay.mbnk.biz:8443/abc', 'https://pay.mbnk.biz/a/b', 'javascript:alert(1)']) assert.equal(safePaymentUrl(value), null)
  assert.equal(safePaymentUrl('https://cabinet.tax.gov.ua/cashregs/check?id=fixture', true), 'https://cabinet.tax.gov.ua/cashregs/check?id=fixture')
  assert.equal(safePaymentUrl('https://cabinet.tax.gov.ua/other', true), null)
})
test('guest mount only reads; explicit creation persists capability and stable idempotency key', async () => {
  const env = load(), payment = env.exports.useOrderPayment(() => 42, () => 'guest-capability')
  env.mount(); await flush()
  assert.equal(env.calls.length, 1)
  assert.equal(env.timers[0], 30000)
  assert.equal(env.calls[0].options.method, 'GET')
  assert.equal(env.stored.get('shop-order-payment-token:42'), 'guest-capability')
  await payment.create(); await payment.create()
  assert.equal(env.calls[1].options.headers['X-Order-Payment-Token'], 'guest-capability')
  assert.equal(env.calls[1].options.headers['Idempotency-Key'], env.calls[2].options.headers['Idempotency-Key'])
  env.unmount()
})
test('hidden page suppresses requests and account changes discard late responses', async () => {
  const env = load(), payment = env.exports.useOrderPayment(() => 42, () => 'guest-capability')
  env.mount(); await flush()
  env.document.hidden = true; env.events.visibilitychange(); await payment.refresh()
  assert.equal(env.calls.length, 1)
  env.document.hidden = false; env.state.delayed = true
  const pending = payment.refresh()
  const resolveOld = env.state.resolve
  env.auth.sessionRevision++; env.auth.isAuthenticated = true
  env.watches[0]()
  resolveOld(); await pending
  assert.equal(payment.payment.value, null)
  env.unmount()
})

test('poll projections retain receipt pending separately from accepted payment', async () => {
  const env = load(), payment = env.exports.useOrderPayment(() => 42, () => 'guest-capability')
  env.mount(); await flush()
  assert.equal(payment.payment.value.status, 'waiting')
  env.state.response = { status: 'paid_receipt_pending', paid: true, receipt_accepted: false, receipt_url: null }
  await payment.refresh()
  assert.equal(payment.payment.value.paid, true)
  assert.equal(payment.payment.value.receipt_accepted, false)
  env.state.response = { status: 'accepted', paid: true, receipt_accepted: true, receipt_url: 'https://cabinet.tax.gov.ua/cashregs/check?id=fixture' }
  await payment.refresh()
  assert.equal(payment.payment.value.status, 'accepted')
  assert.equal(payment.payment.value.receipt_accepted, true)
  env.unmount()
})
test('concurrent creation clicks send only one POST', async () => {
  const env = load(), payment = env.exports.useOrderPayment(() => 42, () => 'guest-capability')
  env.mount(); await flush(); env.state.delayed = true
  const first = payment.create()
  await payment.create()
  assert.equal(env.calls.filter(call => call.options.method === 'POST').length, 1)
  env.state.resolve(); await first; env.unmount()
})
