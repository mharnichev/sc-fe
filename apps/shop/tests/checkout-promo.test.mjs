import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
const require = createRequire(import.meta.url)
const vue = createRequire(require.resolve('nuxt/package.json', { paths: [new URL('..', import.meta.url).pathname] }))('vue')
const source = readFileSync(new URL('../composables/useCheckoutPromo.ts', import.meta.url), 'utf8')
const load = (saved = new Map()) => {
  const state = vue.reactive({ items: [{ productId: 1, quantity: 1 }], phone: '+380990000000', scope: 'guest', sessionRevision: 0 })
  state.captureSession = () => {
    const revision = state.sessionRevision, scope = state.scope
    return () => state.sessionRevision === revision && state.scope === scope
  }
  const timers = new Map(), calls = []
  let mount, unmount, timerId = 0
  const exports = {}, effects = vue.effectScope()
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, AbortController, ...vue,
    onMounted: fn => { mount = fn }, onBeforeUnmount: fn => { unmount = fn },
    useCustomerAuthStore: () => state, useShopLocale: () => ({ locale: vue.ref('uk') }),
    useApi: () => (path, options) => new Promise((resolve, reject) => calls.push({ path, options, resolve, reject })),
    localStorage: { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) },
    setTimeout: fn => { timers.set(++timerId, fn); return timerId }, clearTimeout: id => timers.delete(id),
  })
  const promo = effects.run(() => exports.useCheckoutPromo(() => state.items, () => state.phone, () => state.scope))
  const run = () => { const callbacks = [...timers.values()]; timers.clear(); return Promise.all(callbacks.map(fn => fn())) }
  return { promo, state, calls, saved, mount, run, destroy: () => { unmount(); effects.stop() } }
}
const quote = (total = '90.00', code = 'SAVE10') => ({ total_amount: total, subtotal_amount: (Number(total) + 10).toFixed(2), discount_amount: '10.00', applied_code: code })
test('applies the server quote and restores only the code after reload, requiring a fresh quote', async () => {
  const env = load(); env.mount(); env.promo.input.value = ' save10 '; env.promo.apply()
  assert.equal(env.promo.pending.value, true); assert.equal(env.promo.ready.value, false)
  const pending = env.run(); env.calls[0].resolve(quote()); await pending
  assert.equal(env.calls[0].options.body.promoCode, 'SAVE10')
  assert.equal(env.promo.quote.value.total_amount, '90.00')
  assert.equal(env.saved.get('shop-checkout-promo-v1:guest'), 'SAVE10')
  env.destroy()
  const restored = load(env.saved); restored.mount()
  assert.equal(restored.promo.input.value, 'SAVE10'); assert.equal(restored.promo.quote.value, null)
  assert.equal(restored.promo.ready.value, false)
  const refresh = restored.run(); restored.calls[0].resolve(quote('180.00')); await refresh
  assert.equal(restored.promo.quote.value.total_amount, '180.00'); restored.destroy()
})
test('quantity changes invalidate totals synchronously and ignore stale responses', async () => {
  const env = load(); env.mount(); env.promo.input.value = 'SAVE10'; env.promo.apply()
  const first = env.run()
  env.state.items[0].quantity = 2
  assert.equal(env.promo.ready.value, false)
  const second = env.run()
  env.calls[1].resolve(quote('180.00')); await second
  env.calls[0].resolve(quote('90.00')); await first
  assert.equal(env.promo.quote.value.total_amount, '180.00')
  assert.equal(env.calls[1].options.body.items[0].quantity, 2)
  env.promo.remove(); assert.equal(env.promo.quote.value, null); assert.equal(env.promo.ready.value, true)
  assert.equal(env.saved.size, 0); env.destroy()
})
test('failed or inapplicable codes cannot authorize checkout; accounts use separate saved codes', async () => {
  const env = load(); env.mount(); env.promo.input.value = 'SAVE10'; env.promo.apply()
  const pending = env.run(); env.calls[0].resolve(quote('100.00', null)); await pending
  assert.equal(env.promo.ready.value, false); assert.ok(env.promo.error.value); assert.equal(env.saved.size, 0)
  env.state.scope = 'customer:2'
  assert.equal(env.promo.code.value, ''); assert.equal(env.promo.quote.value, null)
  assert.equal(env.promo.ready.value, true); env.destroy()
})

test('phone and same-customer session changes invalidate immediately and ignore old success and failure', async () => {
  for (const mutate of [env => { env.state.phone = '+380990000001' }, env => { env.state.sessionRevision++ }]) {
    const env = load(); env.mount(); env.promo.input.value = 'SAVE10'; env.promo.apply()
    const first = env.run()
    mutate(env)
    assert.equal(env.calls[0].options.signal.aborted, true)
    assert.equal(env.promo.quote.value, null)
    assert.equal(env.promo.ready.value, false)
    const second = env.run()
    env.calls[1].resolve(quote('180.00')); await second
    env.calls[0].reject(new Error('old session failure')); await first
    assert.equal(env.promo.quote.value.total_amount, '180.00')
    assert.equal(env.promo.error.value, '')
    assert.equal(env.promo.pending.value, false)
    assert.equal(env.calls[1].options.body.customerPhone, env.state.phone)
    assert.equal(env.calls[1].options.retry, 0)
    env.destroy()
  }
})

test('scope changes restore only the new account code and cannot persist the previous quote', async () => {
  const saved = new Map([['shop-checkout-promo-v1:customer:2', 'BUYER2']])
  const env = load(saved); env.mount(); env.promo.input.value = 'SAVE10'; env.promo.apply()
  const first = env.run()
  env.state.scope = 'customer:2'
  assert.equal(env.promo.code.value, 'BUYER2')
  assert.equal(env.promo.input.value, 'BUYER2')
  assert.equal(env.promo.quote.value, null)
  assert.equal(env.promo.ready.value, false)
  const second = env.run()
  env.calls[0].resolve(quote()); await first
  assert.equal(saved.has('shop-checkout-promo-v1:guest'), false)
  assert.equal(saved.get('shop-checkout-promo-v1:customer:2'), 'BUYER2')
  assert.equal(env.promo.quote.value, null)
  env.calls[1].resolve(quote('180.00', 'BUYER2')); await second
  assert.equal(env.promo.quote.value.applied_code, 'BUYER2')
  env.state.scope = 'guest'
  assert.equal(env.promo.code.value, '')
  assert.equal(env.promo.quote.value, null)
  assert.equal(env.promo.ready.value, true)
  env.destroy()
})

test('remove and unmount cancel debounce and in-flight responses without resurrecting storage', async () => {
  for (const inFlight of [false, true]) {
    for (const operation of ['remove', 'unmount']) {
      const env = load(); env.mount(); env.promo.input.value = 'SAVE10'; env.promo.apply()
      const pending = inFlight ? env.run() : null
      if (operation === 'remove') env.promo.remove()
      else env.destroy()
      if (inFlight) {
        assert.equal(env.calls[0].options.signal.aborted, true)
        env.calls[0].resolve(quote()); await pending
      } else await env.run()
      assert.equal(env.calls.length, Number(inFlight))
      assert.equal(env.promo.quote.value, null)
      assert.equal(env.saved.size, 0)
      if (operation === 'remove') {
        assert.equal(env.promo.ready.value, true)
        env.destroy()
      }
    }
  }
})

for (const [name, patch] of [
  ['wrong code', { applied_code: 'OTHER' }],
  ['negative total', { total_amount: '-1.00' }],
  ['negative subtotal', { subtotal_amount: '-100.00' }],
  ['negative discount', { discount_amount: '-10.00' }],
  ['nonfinite total', { total_amount: Infinity }],
  ['nonnumeric subtotal', { subtotal_amount: 'not-money' }],
  ['missing discount', { discount_amount: undefined }],
  ['inconsistent arithmetic', { total_amount: '80.00' }],
  ['discount exceeds subtotal', { discount_amount: '110.00' }],
  ['empty money fields', { subtotal_amount: '', discount_amount: '', total_amount: '' }],
  ['null money fields', { subtotal_amount: null, discount_amount: null, total_amount: null }],
  ['boolean money fields', { subtotal_amount: true, discount_amount: false, total_amount: true }],
]) {
  test(`malformed quote (${name}) cannot authorize checkout or save a code`, async () => {
    const env = load(); env.mount(); env.promo.input.value = 'SAVE10'; env.promo.apply()
    const pending = env.run(); env.calls[0].resolve({ ...quote(), ...patch }); await pending
    try {
      assert.equal(env.promo.quote.value, null)
      assert.equal(env.promo.ready.value, false)
      assert.equal(env.promo.pending.value, false)
      assert.ok(env.promo.error.value)
      assert.equal(env.saved.size, 0)
    } finally { env.destroy() }
  })
}

test('server rejection can be removed without a new quote and invalid syntax never contacts the API', async () => {
  const env = load(); env.mount()
  for (const value of ['', 'A!', 'A'.repeat(51), '<script>']) {
    env.promo.input.value = value; env.promo.apply(); await env.run()
    assert.equal(env.calls.length, 0)
    assert.ok(env.promo.error.value)
  }
  env.promo.input.value = 'SAVE10'; env.promo.apply()
  const pending = env.run()
  env.calls[0].reject({ data: { detail: 'Customer phone is required for this promo code' } }); await pending
  assert.match(env.promo.error.value, /телефон/)
  assert.equal(env.promo.ready.value, false)
  env.promo.remove()
  assert.equal(env.promo.ready.value, true)
  assert.equal(env.promo.error.value, '')
  assert.equal(env.saved.size, 0)
  env.destroy()
})
