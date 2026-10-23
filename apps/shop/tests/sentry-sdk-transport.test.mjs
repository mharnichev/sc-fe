import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(new URL('../package.json', import.meta.url))
const Sentry = require('@sentry/vue')
const transpile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const telemetry = {}
vm.runInNewContext(transpile(readFileSync(new URL('../utils/commerceTelemetry.ts', import.meta.url), 'utf8')), { exports: telemetry, Error, Date, Map, Number })

test('installed SDK scrubs serialized envelopes and isolates buyers without networking', async () => {
  const envelopes = [], hooks = {}, plugin = {}
  let client
  const sdk = {
    ...Sentry,
    init(options) {
      client = Sentry.init({ ...options, transport: () => ({
        send: async envelope => { envelopes.push(envelope); return { statusCode: 200 } },
        flush: async () => true,
      }) })
      return client
    },
  }
  const router = { currentRoute: { value: { path: '/checkout/purchase' } } }
  try {
    vm.runInNewContext(transpile(readFileSync(new URL('../plugins/sentry.client.ts', import.meta.url), 'utf8')), {
      exports: plugin, require: name => name === '@sentry/vue' ? sdk : telemetry,
      defineNuxtPlugin: fn => fn,
      useRuntimeConfig: () => ({ public: { sentryDsn: 'https://public@sentry.invalid/1', sentryEnvironment: 'production', sentryRelease: 'isolated-test' } }),
      useRouter: () => router, useCustomerAuthStore: () => ({ sessionRevision: 0 }),
      watch: (_source, callback) => { hooks.sessionChanged = callback },
      window: { location: { origin: 'https://shop.test' }, addEventListener() {} }, URL, Error,
    })
    plugin.default({ hook() {} })
    assert.ok(client)
    telemetry.commerceBreadcrumb('checkout.previous_buyer', { flow: 'checkout', order_id: 424242 })
    assert.ok(Sentry.getIsolationScope().getScopeData().breadcrumbs.length > 0)
    hooks.sessionChanged()
    assert.equal(Sentry.getIsolationScope().getScopeData().breadcrumbs.length, 0)
    Sentry.setUser({ email: 'private@example.test' })
    Sentry.setExtra('token', 'private-capability')
    const cause = new Error('private@example.test private-capability')
    cause.stack = 'Error: private-capability\n at https://shop.test/shop/_nuxt/main.js?token=private-capability:10:2'
    telemetry.reportCommerceError('checkout.create_order_failed', cause, { flow: 'checkout', order_id: 77, http_status: 500 })
    await Sentry.flush(2000)
    const events = envelopes.flatMap(envelope => envelope[1].filter(item => item[0].type === 'event').map(item => item[1]))
    assert.equal(events.length, 1)
    const serialized = JSON.stringify(events)
    for (const privateValue of ['private@example.test', 'private-capability', '424242']) assert.ok(!serialized.includes(privateValue))
    assert.equal(events[0].contexts.commerce.order_id, 77)
    assert.equal(events[0].tags.flow, 'checkout')
    assert.equal(events[0].user, undefined)
    assert.equal(events[0].request, undefined)
  } finally {
    telemetry.configureCommerceTelemetry()
    Sentry.getIsolationScope().clear()
    await client?.close(2000)
  }
})
