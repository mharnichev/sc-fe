import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import { webcrypto } from 'node:crypto'

const source = readFileSync(new URL('../utils/checkoutReminder.ts', import.meta.url), 'utf8')
const module = { exports: {} }
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: module.exports, URLSearchParams })
const { takeRecoveryToken, cartFingerprint, readReminder, readReminderOrderKey } = module.exports
const { isRecoveryPath, recoveryPrivacyScript } = module.exports

test('recovery matching and early head stripping respect root and deployed base, leaving ordinary URLs alone', () => {
  for (const base of ['/', '/shop/']) {
    const path = `${base}checkout/recover`
    assert.equal(isRecoveryPath(path, base), true)
    assert.equal(isRecoveryPath(`${path}/`, base), true)
    assert.equal(isRecoveryPath(`${path}/extra`, base), false)
    for (const pathname of [path, `${base}catalog`, '/other/checkout/recover']) {
      const calls = [], carrier = {}
      const location = { pathname, hash: '#token=' + 'A'.repeat(43), search: '?private=value' }
      vm.runInNewContext(recoveryPrivacyScript(base), { location, window: carrier, URLSearchParams, history: { replaceState: (...args) => calls.push(args) } })
      assert.equal(calls.length, pathname === path ? 1 : 0)
      assert.equal(carrier.__scCheckoutRecoveryToken, pathname === path ? 'A'.repeat(43) : undefined)
      if (calls.length) assert.equal(calls[0][2], path)
    }
  }
  assert.equal(isRecoveryPath('/checkout/recover', '/shop/'), false)
})

test('pre plugin consumes and deletes SSR carrier at deployed base and sanitizes SPA recovery before later guards', () => {
  const source = readFileSync(new URL('../plugins/00.checkout-recovery.client.ts', import.meta.url), 'utf8').replace(/^import .*\n/gm, '').replace(/import\.meta\.hot/g, 'false')
  for (const base of ['/', '/shop/']) {
    const token = 'A'.repeat(43), state = { value: '' }, carrier = { __scCheckoutRecoveryToken: token, location: { pathname: `${base}checkout/recover`, hash: '', search: '' }, history: { replaceState() {} } }
    let guard
    const context = vm.createContext({ ...module.exports, window: carrier, defineNuxtPlugin: plugin => plugin, useRuntimeConfig: () => ({ app: { baseURL: base } }), useRouter: () => ({ beforeEach: fn => { guard = fn; return () => {} } }), useState: () => state })
    vm.runInContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, Object.assign(context, { exports: {} }))
    context.exports.default.setup()
    assert.equal(state.value, token)
    assert.equal('__scCheckoutRecoveryToken' in carrier, false)
    state.value = ''
    const ordinary = { path: '/catalog', query: { brand: 'one' }, hash: '#details' }
    assert.equal(guard(ordinary), undefined)
    assert.equal(ordinary.query.brand, 'one')
    const redirected = guard({ path: '/checkout/recover', hash: `#token=${token}`, query: { sensitive: 'discard' } })
    assert.equal(redirected.path, '/checkout/recover')
    assert.equal(redirected.hash, '')
    assert.equal(Object.keys(redirected.query).length, 0)
    assert.equal(state.value, token)
  }
})

const reminderHarness = (authenticated = true) => {
  const calls = [], watches = [], storage = new Map(), timers = [], digests = []
  let ready, revision = 1, id = authenticated ? 10 : null
  const auth = {
    get isAuthenticated() { return id !== null }, get customer() { return id === null ? null : { id } },
    get accessToken() { return id === null ? '' : `fixture-${id}` }, get tokenType() { return 'Bearer' },
    get sessionRevision() { return revision }, captureSession() { const captured = revision; return () => captured === revision },
  }
  let capabilities = async () => ({ enabled: true, dry_run: true })
  const cart = { ownerScope: authenticated ? 'customer:10' : 'guest', syncing: false, hasUnavailableItems: false, items: [{ product: { id: 1, price: '50' }, quantity: 1 }] }
  const props = { email: 'fixture@example.test', active: true, checkpointRevision: 1 }
  const context = vm.createContext({
    ...module.exports, TextEncoder, crypto: { randomUUID: () => webcrypto.randomUUID(), subtle: { digest: (...args) => { const operation = webcrypto.subtle.digest(...args); digests.push(operation); return operation } } }, props,
    defineProps: () => props, ref: value => ({ value }), computed: fn => ({ get value() { return fn() } }),
    watch: (getter, callback) => watches.push(callback), nextTick: () => Promise.resolve(),
    onNuxtReady: fn => { ready = fn }, onUnmounted() {},
    useCartStore: () => cart, useCustomerAuthStore: () => auth,
    useShopLocale: () => ({ locale: { value: 'en' } }), checkedInput: value => value,
    useApi: () => async (path, options) => { calls.push({ path, options, token: auth.accessToken }); if (path.endsWith('capabilities')) return capabilities() },
    sessionStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    setTimeout: fn => { timers.push(fn); return timers.length }, clearTimeout: () => {},
  })
  const component = readFileSync(new URL('../components/checkout/CheckoutServiceReminder.vue', import.meta.url), 'utf8').split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '')
  vm.runInContext(ts.transpileModule(component, { compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 } }).outputText + '\nglobalThis.component = { scheduleCheckpoint, enabled, invalidate }', context)
  return { calls, storage, cart, props, component: context.component, ready: () => ready(), flush: async () => { timers.splice(0).forEach(fn => fn()); await Promise.all(digests.splice(0)); await new Promise(resolve => setImmediate(resolve)) },
    capabilities: fn => { capabilities = fn }, switch: async next => { id = next; revision++; watches[3](); await Promise.resolve(); await Promise.resolve() } }
}

test('only authenticated fresh capabilities permit immutable revision-fenced checkpoints and cancellation', async () => {
  const guest = reminderHarness(false)
  await guest.ready(); guest.component.scheduleCheckpoint(); await guest.flush()
  assert.equal(guest.calls.length, 0)
  const pilot = reminderHarness()
  await pilot.ready(); pilot.component.scheduleCheckpoint(); await pilot.flush()
  const saved = pilot.calls.find(call => call.path.endsWith('/checkpoint'))
  assert.equal(saved.token, 'fixture-10')
  assert.equal(saved.options.headers['X-Checkout-Revision'], '1')
  assert.deepEqual(JSON.parse(JSON.stringify(saved.options.body)), { email: 'fixture@example.test', locale: 'en', items: [{ product_id: 1, quantity: 1 }] })
  pilot.component.scheduleCheckpoint(); await pilot.flush()
  assert.equal(pilot.calls.filter(call => call.path.endsWith('/checkpoint')).length, 1)
  pilot.props.email = 'changed@example.test'; pilot.component.invalidate()
  assert.equal(pilot.calls.at(-1).options.headers['X-Checkout-Revision'], '2')
  assert.ok(pilot.calls.at(-1).path.endsWith('/cancel'))
})

test('capability response and pending debounce cannot survive logout or a nonpilot session', async () => {
  const state = reminderHarness()
  let resolve
  state.capabilities(() => new Promise(done => { resolve = done }))
  const pending = state.ready()
  await state.switch(null)
  resolve({ enabled: true, dry_run: false }); await pending
  assert.equal(state.component.enabled.value, false)
  state.capabilities(async () => ({ enabled: false }))
  await state.switch(11)
  await new Promise(done => setImmediate(done))
  state.component.scheduleCheckpoint(); await state.flush()
  assert.equal(state.calls.filter(call => call.path.endsWith('/checkpoint')).length, 0)
  assert.equal(state.calls.at(-1).token, 'fixture-11')
})

test('scope changes never send another owner key; pending cancellation replays only when that owner returns', async () => {
  let id = 10
  const key = 'a'.repeat(64), calls = [], watches = []
  const initial = { key, revision: 1, fingerprint: 'saved', cartSignature: cartFingerprint([{ product: { id: 1, price: '50' }, quantity: 1 }]) }
  const storage = new Map([[module.exports.reminderStorageKey('customer:10'), JSON.stringify(initial)]])
  const auth = { get isAuthenticated() { return id !== null }, get customer() { return id === null ? null : { id } } }
  const context = vm.createContext({ ...module.exports,
    defineNuxtPlugin: fn => fn, useCartStore: () => ({ items: [] }), useCustomerAuthStore: () => auth,
    useState: () => ({ value: true }),
    useApi: () => async (_path, options) => { calls.push({ id, key: options.headers['X-Checkout-Key'], revision: options.headers['X-Checkout-Revision'] }) },
    watch: (_getter, callback, options) => { watches.push(callback); if (options?.immediate) callback(true); return () => {} },
    sessionStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    window: { addEventListener() {}, removeEventListener() {} },
  })
  const source = readFileSync(new URL('../plugins/checkout-reminder-invalidation.client.ts', import.meta.url), 'utf8').replace(/^import .*\n/gm, '').replace(/import\.meta\.hot/g, 'false')
  // Ready starts in guest scope so initial restoration cannot trigger owner cancellation.
  id = null
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, Object.assign(context, { exports: {} }))
  context.exports.default()
  id = 11; watches[1]('customer:11', 'customer:10')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(calls.length, 0)
  assert.equal(storage.has(module.exports.reminderStorageKey('customer:11')), false)
  assert.equal(readReminder({ getItem: key => storage.get(key) }, 'customer:10').pendingCancel, true)
  id = null; watches[1]('guest', 'customer:11')
  assert.equal(calls.length, 0)
  id = 10; watches[1]('customer:10', 'guest')
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(calls, [{ id: 10, key, revision: '2' }])
  assert.equal(readReminder({ getItem: key => storage.get(key) }, 'customer:10').pendingCancel, false)
})
test('recovery strips fragment and query even for malformed links, without any network action', () => {
  for (const hash of ['#token=' + 'A'.repeat(43), '#token=private@example.test', '#unexpected=anything']) {
    const calls = []
    const token = takeRecoveryToken({ hash, pathname: '/checkout/recover', search: '?tracking=discard' }, { replaceState: (...args) => calls.push(args) })
    assert.equal(calls.length, 1)
    assert.equal(calls[0][2], '/checkout/recover')
    assert.equal(token, hash.startsWith('#token=AAA') ? 'A'.repeat(43) : '')
  }
})
test('cart conflict fingerprint ignores order but detects quantity and price edits', () => {
  const one = { product: { id: 1, price: '100' }, quantity: 1 }
  const two = { product: { id: 2, price: '200' }, quantity: 2 }
  assert.equal(cartFingerprint([one, two]), cartFingerprint([two, one]))
  assert.notEqual(cartFingerprint([one]), cartFingerprint([{ ...one, quantity: 2 }]))
  assert.notEqual(cartFingerprint([one]), cartFingerprint([{ ...one, product: { id: 1, price: '110' } }]))
})
test('management and completion keys are isolated by scope, malformed storage fails closed', () => {
  const map = new Map([['shop-checkout-reminder-v1:guest', JSON.stringify({ key: 'a'.repeat(64), fingerprint: 'hash' })], ['shop-checkout-reminder-order-v1:guest', 'a'.repeat(64)]])
  const storage = { getItem: key => map.get(key) }
  assert.equal(readReminder(storage, 'guest').key, 'a'.repeat(64))
  assert.equal(readReminder(storage, 'guest').revision, 0)
  map.set('shop-checkout-reminder-v1:guest', JSON.stringify({ key: 'a'.repeat(64), fingerprint: 'hash', revision: 7 }))
  assert.equal(readReminder(storage, 'guest').revision, 7)
  assert.equal(readReminder(storage, 'customer:42'), null)
  assert.equal(readReminderOrderKey(storage, 'guest'), 'a'.repeat(64))
  assert.equal(readReminderOrderKey(storage, 'customer:42'), undefined)
  assert.equal(readReminder({ getItem: () => '{broken' }, 'guest'), null)
})
