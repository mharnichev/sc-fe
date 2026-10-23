import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const load = () => {
  const exports = {}, events = []
  const source = readFileSync(new URL('../utils/commerceTelemetry.ts', import.meta.url), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, Error, Date, Map, Number })
  exports.configureCommerceTelemetry(event => events.push(event))
  return { ...exports, events }
}
test('expected client errors are dropped; server, timeout and rate-limit errors survive', () => {
  const t = load()
  for (const status of [400, 401, 410, 422]) t.reportCommerceError(`checkout.failed_${status}`, { status }, { flow: 'checkout' })
  assert.equal(t.events.length, 0)
  for (const status of [403, 404, 409, 429, 500]) t.reportCommerceError(`checkout.failed_${status}`, { response: { status } }, { flow: 'checkout' })
  assert.equal(t.events.length, 5)
})
test('repeated incident is dropped and unrelated events have a bounded per-minute budget', () => {
  const t = load()
  for (let n = 0; n < 20; n++) t.reportCommerceError('payment.read_failed', { status: 500 }, { flow: 'payment', order_id: 42 })
  assert.equal(t.events.length, 1)
  for (let n = 0; n < 20; n++) t.reportCommerceError('payment.start_failed', {}, { flow: 'payment', order_id: n + 100 })
  assert.equal(t.events.length, 5)
})
test('breadcrumbs and errors accept dotted steps but strip sensitive and arbitrary fields', () => {
  const t = load()
  const data = { flow: 'payment', order_id: 42, attempt_id: 'secret', payment_method: 'onlineCard', payment_status: 'waiting', token: 'secret', email: 'buyer@example.test', page_url: 'https://pay.mbnk.biz/secret' }
  t.commerceBreadcrumb('payment.status', data)
  t.reportCommerceError('payment.start_failed', new Error('buyer@example.test token=secret'), data)
  assert.equal(t.events.length, 2)
  assert.equal(t.events[0].data.order_id, 42)
  assert.equal(t.events[1].error.message, 'Commerce failure: payment.start_failed')
  for (const event of t.events) {
    const json = JSON.stringify(event)
    assert.ok(!json.includes('secret')); assert.ok(!json.includes('buyer@')); assert.ok(!json.includes('page_url'))
  }
})
test('disabled or throwing telemetry cannot break checkout', () => {
  const t = load()
  t.configureCommerceTelemetry(() => { throw new Error('SDK unavailable') })
  assert.doesNotThrow(() => t.reportCommerceError('checkout.failed', new Error('failure')))
  assert.doesNotThrow(() => t.commerceBreadcrumb('checkout.started'))
  t.configureCommerceTelemetry()
  assert.doesNotThrow(() => t.reportCommerceError('checkout.failed', null))
})
const loadPlugin = (publicConfig = { sentryDsn: 'https://public@example.test/1', sentryEnvironment: 'production', sentryRelease: 'shop@test' }) => {
  const exports = {}, t = load(), hooks = {}, listeners = {}, captured = [], crumbs = []
  let options
  const sdk = {
    init: value => { options = value },
    addBreadcrumb: value => crumbs.push(value),
    withScope: fn => {
      const event = { tags: {}, contexts: {} }
      fn({ setTags: tags => event.tags = tags, setContext: (key, value) => event.contexts[key] = value, setFingerprint: value => event.fingerprint = value })
    },
    captureException: error => captured.push(error),
    getCurrentScope: () => ({ clearBreadcrumbs() {} }),
    getIsolationScope: () => ({ clearBreadcrumbs: () => { crumbs.length = 0 } }),
  }
  const router = { currentRoute: { value: { path: '/checkout/purchase' } } }
  const source = readFileSync(new URL('../plugins/sentry.client.ts', import.meta.url), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, require: name => name === '@sentry/vue' ? sdk : t,
    defineNuxtPlugin: fn => fn, useRuntimeConfig: () => ({ public: publicConfig }), useRouter: () => router,
    useCustomerAuthStore: () => ({ sessionRevision: 0 }), watch: (_source, callback) => { hooks.sessionChanged = callback },
    window: { location: { origin: 'https://shop.test' }, addEventListener: (name, fn) => listeners[name] = fn }, URL, Error,
  })
  exports.default({ hook: (name, fn) => hooks[name] = fn })
  return { options, hooks, listeners, captured, crumbs, t, router }
}
test('plugin is disabled without DSN or outside production and has no automatic integrations', () => {
  assert.equal(loadPlugin({ sentryDsn: '', sentryEnvironment: 'production' }).options, undefined)
  assert.equal(loadPlugin({ sentryDsn: 'test', sentryEnvironment: 'staging' }).options, undefined)
  const p = loadPlugin()
  assert.equal(p.options.defaultIntegrations, false)
  assert.equal(p.options.sendDefaultPii, false)
  p.t.commerceBreadcrumb('checkout.create_order', { flow: 'checkout' })
  assert.equal(p.crumbs.length, 1)
  assert.equal(p.captured.length, 0)
  p.t.reportCommerceError('checkout.create_order_failed', new Error('secret'), { flow: 'checkout' })
  assert.equal(p.captured.length, 1)
})
test('beforeSend drops unmarked events and strips URLs, contacts, request data and source snippets', () => {
  const { options } = loadPlugin()
  assert.equal(options.beforeSend({ tags: {} }), null)
  const event = options.beforeSend({
    type: undefined, tags: { critical: 'true', flow: 'payment', step: 'payment.start_failed', provider: 'monobank', email: 'secret' },
    request: { url: 'https://shop.test/tracking/secret?token=secret', headers: { authorization: 'secret' } },
    user: { email: 'secret' }, extra: { body: 'secret' }, contexts: { commerce: { flow: 'payment', order_id: 42, token: 'secret' } },
    exception: { values: [{ type: 'FetchError', value: 'secret', stacktrace: { frames: [
      { filename: 'https://shop.test/_nuxt/main.js?token=secret', function: 'secret', vars: { password: 'secret' }, pre_context: ['secret'], lineno: 10 },
      { filename: 'https://shop.test/tracking/secret', lineno: 11 },
    ] } }] },
    breadcrumbs: [{ category: 'fetch', message: 'secret' }, { category: 'commerce', message: 'payment.status', data: { order_id: 42, token: 'secret' } }],
  })
  assert.ok(!JSON.stringify(event).includes('secret'))
  assert.equal(event.exception.values[0].stacktrace.frames[0].filename, '/_nuxt/main.js')
  assert.equal(event.contexts.commerce.order_id, 42)
  assert.equal(event.breadcrumbs.length, 1)
})
test('unhandled code failures are limited to commerce routes and deduplicated across hooks', () => {
  const p = loadPlugin()
  const error = new Error('sensitive failure'); error.name = 'TypeError'
  p.hooks['vue:error'](error); p.hooks['app:error'](error)
  assert.equal(p.captured.length, 1)
  p.router.currentRoute.value.path = '/catalog'
  p.listeners.error({ error })
  assert.equal(p.captured.length, 1)
})
test('account changes clear breadcrumbs and reset deduplication without contact data', () => {
  const p = loadPlugin()
  p.t.commerceBreadcrumb('checkout.started', { flow: 'checkout', order_id: 42 })
  p.t.reportCommerceError('checkout.failed', new Error('failure'), { flow: 'checkout' })
  p.hooks.sessionChanged()
  assert.equal(p.crumbs.length, 0)
  p.t.reportCommerceError('checkout.failed', new Error('failure'), { flow: 'checkout' })
  assert.equal(p.captured.length, 2)
})
test('beforeSend rejects unsafe labels and reconstructs fingerprints and asset paths', () => {
  const { options } = loadPlugin()
  const tags = { critical: 'true', flow: 'checkout', step: 'checkout.failed', provider: 'secret' }
  assert.equal(options.beforeSend({ tags: { ...tags, step: 'buyer@example.test' } }), null)
  const event = options.beforeSend({ tags, fingerprint: ['secret'], contexts: {}, breadcrumbs: [
    { category: 'commerce', message: 'buyer@example.test' },
  ], exception: { values: [{ stacktrace: { frames: [
    { filename: 'https://shop.test/shop/_nuxt/main.js?secret' },
    { filename: 'https://external.test/_nuxt/secret.js' },
  ] } }] } })
  assert.ok(!JSON.stringify(event).includes('secret'))
  assert.equal(event.exception.values[0].stacktrace.frames[0].filename, '/shop/_nuxt/main.js')
  assert.equal(event.breadcrumbs.length, 0)
})
