import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const compile = code => ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.None } }).outputText

for (const sameActor of [false, true]) test(`401 never replays a previous session command (${sameActor ? 'same actor relogin' : 'different actor'})`, async () => {
  const first = deferred(), sent = []
  let refreshes = 0, logouts = 0
  const auth = { user: { id: 1 }, sessionRevision: 1, accessToken: 'actor-A', refreshToken: 'refresh-A', refreshSession: async () => { refreshes++; return true }, logout: async () => { logouts++ } }
  const context = vm.createContext({ Headers, useRuntimeConfig: () => ({ public: { apiBase: '/api/v1' } }), useAuthStore: () => auth, $fetch: { create: config => async (url, options) => {
    const request = { ...options }; config.onRequest({ options: request }); sent.push(request.headers.get('Authorization'))
    return sent.length === 1 ? first.promise : { id: 99 }
  } } })
  const source = readFileSync(new URL('../composables/useApi.ts', import.meta.url), 'utf8').replace('export const useApi', 'const useApi')
  vm.runInContext(compile(source) + '\nglobalThis.api = useApi()', context)
  const pending = context.api('/backoffice/shop/checkbox/documents/1/process', { method: 'POST', headers: { 'Idempotency-Key': 'original' } })
  auth.sessionRevision++; auth.user = { id: sameActor ? 1 : 2 }; auth.accessToken = 'new-session'; auth.refreshToken = 'new-refresh'
  const failure = { response: { status: 401 } }; first.reject(failure)
  await assert.rejects(pending, error => error === failure)
  assert.deepEqual(sent, ['Bearer actor-A']); assert.equal(refreshes, 0); assert.equal(logouts, 0)
})

const loadAuth = (fetch, api = {}) => {
  const context = vm.createContext({ useRuntimeConfig: () => ({ public: { apiBase: '/api/v1' } }), useBackofficeApi: () => api, $fetch: fetch,
    defineStore: (_id, definition) => () => Object.assign(definition.state(), definition.actions) })
  const source = readFileSync(new URL('../stores/auth.ts', import.meta.url), 'utf8').replace('export const useAuthStore', 'const useAuthStore').replaceAll('import.meta.client', 'false')
  vm.runInContext(compile(source) + '\nglobalThis.auth = useAuthStore()', context)
  return context.auth
}

for (const succeeds of [true, false]) test(`current actor token refresh ${succeeds ? 'retries once' : 'returns to login'}`, async () => {
  let sent = 0, logouts = 0
  const auth = { user: { id: 1 }, sessionRevision: 1, accessToken: 'old', refreshToken: 'refresh',
    refreshSession: async () => {
      if (succeeds) { auth.accessToken = 'rotated'; return true }
      auth.sessionRevision++; auth.accessToken = ''; auth.refreshToken = ''; auth.user = null; return false
    }, logout: async () => { logouts++ } }
  const context = vm.createContext({ Headers, useRuntimeConfig: () => ({ public: { apiBase: '/api/v1' } }), useAuthStore: () => auth, $fetch: { create: config => async (_url, options = {}) => {
    const request = { ...options }; config.onRequest({ options: request })
    if (++sent === 1) throw { response: { status: 401 } }
    assert.equal(request.headers.get('Authorization'), 'Bearer rotated'); return { id: 99 }
  } } })
  const source = readFileSync(new URL('../composables/useApi.ts', import.meta.url), 'utf8').replace('export const useApi', 'const useApi')
  vm.runInContext(compile(source) + '\nglobalThis.api = useApi()', context)
  const pending = context.api('/backoffice/orders')
  if (succeeds) { assert.equal((await pending).id, 99); assert.equal(sent, 2); assert.equal(logouts, 0) }
  else { await assert.rejects(pending); assert.equal(sent, 1); assert.equal(logouts, 1) }
})

for (const failure of [false, true]) test(`late token refresh ${failure ? 'failure' : 'success'} cannot alter a newer login`, async () => {
  const first = deferred(), auth = loadAuth(() => first.promise)
  auth.accessToken = 'old'; auth.refreshToken = 'old-refresh'; auth.user = { id: 1 }
  const pending = auth.refreshSession()
  auth.clearSession(); auth.accessToken = 'new'; auth.refreshToken = 'new-refresh'; auth.user = { id: 2 }
  if (failure) first.reject(new Error('offline')); else first.resolve({ access_token: 'late-old', refresh_token: 'late-refresh' })
  assert.equal(await pending, false)
  assert.equal(auth.accessToken, 'new'); assert.equal(auth.refreshToken, 'new-refresh'); assert.equal(auth.user.id, 2)
})

test('late login response cannot resurrect a logged-out session', async () => {
  const first = deferred(), auth = loadAuth(() => {}, { login: () => first.promise, me: async () => ({ id: 1 }) })
  const pending = auth.login('fixture@example.invalid', 'fixture-only'); auth.clearSession()
  first.resolve({ access_token: 'old', refresh_token: 'old-refresh' })
  await assert.rejects(pending, /session changed/)
  assert.equal(auth.accessToken, ''); assert.equal(auth.user, null)
})

test('startup refresh failure cannot clear a newer login', async () => {
  const first = deferred(), refreshStarted = deferred()
  const auth = loadAuth(() => { refreshStarted.resolve(); return first.promise }, { me: async () => { throw { response: { status: 401 } } } })
  auth.accessToken = 'old'; auth.refreshToken = 'old-refresh'; auth.user = { id: 1 }
  const pending = auth.init()
  await refreshStarted.promise
  auth.clearSession(); auth.accessToken = 'new'; auth.refreshToken = 'new-refresh'; auth.user = { id: 2 }
  first.reject(new Error('old refresh expired')); await pending
  assert.equal(auth.accessToken, 'new'); assert.equal(auth.refreshToken, 'new-refresh'); assert.equal(auth.user.id, 2)
})

test('read-only diagnostic 401 never refreshes tokens or logs out', async () => {
  let refreshes = 0, logouts = 0, reads = 0
  const auth = { user: { id: 1 }, sessionRevision: 1, accessToken: 'existing-fixture', refreshToken: 'fixture-refresh',
    refreshSession: async () => { refreshes++; return true }, logout: async () => { logouts++ } }
  const failure = { response: { status: 401 } }
  const context = vm.createContext({ Headers, useRuntimeConfig: () => ({ public: { apiBase: '/api/v1' } }), useAuthStore: () => auth,
    $fetch: { create: config => async (_url, options) => {
      const request = { ...options }; config.onRequest({ options: request }); assert.equal(request.method, 'GET'); reads++; throw failure
    } } })
  const source = readFileSync(new URL('../composables/useApi.ts', import.meta.url), 'utf8').replace('export const useApi', 'const useApi')
  vm.runInContext(compile(source) + '\nglobalThis.api = useApi({ refreshOnUnauthorized: false })', context)
  await assert.rejects(context.api('/backoffice/shop-operations-watch', { method: 'GET', retry: 0 }), error => error === failure)
  assert.equal(reads, 1); assert.equal(refreshes, 0); assert.equal(logouts, 0)
})

test('transient refresh errors retain credentials; rejected refresh clears them', async () => {
  for (const status of [undefined, 503, 401, 403]) {
    const failure = status ? { response: { status } } : new Error('connection lost')
    const auth = loadAuth(async () => { throw failure })
    auth.accessToken = 'fixture'; auth.refreshToken = 'fixture-refresh'; auth.user = { id: 1 }
    if (status === 401 || status === 403) {
      assert.equal(await auth.refreshSession(), false)
      assert.equal(auth.refreshToken, '')
      assert.equal(auth.user, null)
    } else {
      await assert.rejects(auth.refreshSession(), error => error === failure)
      assert.equal(auth.refreshToken, 'fixture-refresh')
      assert.equal(auth.user.id, 1)
    }
  }
})

test('cold-start connection failure retains credentials but does not trust persisted identity', async () => {
  let refreshes = 0
  const auth = loadAuth(async () => { refreshes++; throw Error('must not refresh on connection failure') }, { me: async () => { throw Error('offline') } })
  auth.accessToken = 'fixture'; auth.refreshToken = 'fixture-refresh'; auth.user = { id: 1 }
  await auth.init()
  assert.equal(auth.user, null)
  assert.equal(auth.refreshToken, 'fixture-refresh')
  assert.equal(refreshes, 0)
  assert.equal(auth.initialized, true)
})

test('offline requests fail before transport; no cache or automatic transport retries', async () => {
  let sent = 0
  const auth = { sessionRevision: 1, user: { id: 1 }, accessToken: 'fixture' }
  const context = vm.createContext({ Headers, navigator: { onLine: false }, useRuntimeConfig: () => ({ public: { apiBase: '/api/v1' } }), useAuthStore: () => auth,
    $fetch: { create: config => {
      assert.equal(config.retry, 0); assert.equal(config.cache, 'no-store')
      return async () => { config.onRequest({ options: {} }); sent++; return {} }
    } } })
  const source = readFileSync(new URL('../composables/useApi.ts', import.meta.url), 'utf8').replace('export const useApi', 'const useApi')
  vm.runInContext(compile(source) + '\nglobalThis.api = useApi()', context)
  await assert.rejects(context.api('/backoffice/bookings', { method: 'POST' }), /Зміни не надіслано/)
  assert.equal(sent, 0)
})
