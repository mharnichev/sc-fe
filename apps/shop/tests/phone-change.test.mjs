import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../stores/customerAuth.ts', import.meta.url), 'utf8')
const loadStore = (api) => {
  const context = vm.createContext({
    useApi: () => api,
    defineStore: (_name, options) => {
      const store = options.state()
      for (const [name, action] of Object.entries(options.actions)) store[name] = action.bind(store)
      return () => store
    },
  })
  vm.runInContext(ts.transpileModule(source.replace('export const', 'const'), {
    compilerOptions: { module: ts.ModuleKind.None },
  }).outputText.replace(/Object\.defineProperty\(exports[^\n]+\n/g, '') + '\nglobalThis.result = useCustomerAuthStore()', context)
  return context.result
}

test('phone change posts the dedicated contracts and retains the JWT', async () => {
  const calls = []
  const customer = { id: 7, phone: '+380990001234' }
  const store = loadStore(async (url, options) => {
    calls.push({ url, ...options })
    return url.endsWith('/confirm') ? customer : { retry_after_seconds: 30, sends_left_today: 2 }
  })
  store.accessToken = 'retained-jwt'
  store.tokenType = 'bearer'
  await store.requestPhoneChange(customer.phone)
  await store.confirmPhoneChange(customer.phone, '123456')
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    { url: '/public/customers/me/phone-change/request-otp', method: 'POST', body: { phone: customer.phone } },
    { url: '/public/customers/me/phone-change/confirm', method: 'POST', body: { phone: customer.phone, otp_code: '123456' } },
  ])
  assert.equal(store.accessToken, 'retained-jwt')
  assert.equal(store.tokenType, 'bearer')
  assert.equal(store.customer, customer)
})

test('ordinary PATCH strips phone even from an untyped caller', async () => {
  let body
  const store = loadStore(async (_url, options) => { body = options.body; return { id: 7 } })
  await store.updateProfile({ phone: '+380990001234', name: 'Changed' })
  assert.equal('phone' in body, false)
  assert.equal(body.name, 'Changed')
})

for (const status of [400, 401, 409, 422, 429, 503]) {
  test(`failed confirmation (${status}) preserves customer and session`, async () => {
    const error = { statusCode: status }
    const store = loadStore(async () => { throw error })
    const customer = { id: 7, phone: '+380990009999' }
    store.customer = customer
    store.accessToken = 'retained-jwt'
    await assert.rejects(store.confirmPhoneChange('+380990001234', '123456'), value => value === error)
    assert.equal(store.customer, customer)
    assert.equal(store.accessToken, 'retained-jwt')
  })
}

const deferred = () => {
  let resolve, reject
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail })
  return { promise, resolve, reject }
}
const customerA = { id: 7, phone: '+380990009999' }
const customerB = { id: 8, phone: '+380990008888' }
const obsoleteSession = error => error.name === 'ObsoleteCustomerSessionError' && error.statusCode === 401

for (const action of ['requestPhoneChange', 'confirmPhoneChange']) {
  for (const transition of ['logout', 'relogin-other', 'relogin-same', 'hydrate-other', 'jwt-only', 'identity-only', 'token-type-only']) {
    test(`${action} rejects obsolete success after ${transition}`, async () => {
      const pending = deferred()
      const store = loadStore(() => pending.promise)
      store.setSession({ access_token: 'jwt-a', token_type: 'Bearer', customer: customerA })
      const operation = store[action]('+380990001234', '123456')
      if (!['jwt-only', 'identity-only', 'token-type-only'].includes(transition)) store.logout()
      if (transition === 'relogin-other') store.setSession({ access_token: 'jwt-b', token_type: 'Bearer', customer: customerB })
      if (transition === 'relogin-same') store.setSession({ access_token: 'jwt-a', token_type: 'Bearer', customer: customerA })
      if (transition === 'hydrate-other') store.hydrate({ accessToken: 'jwt-b', customer: customerB })
      if (['jwt-only', 'identity-only', 'token-type-only'].includes(transition)) {
        // Direct state changes also invalidate responses without lifecycle actions.
        if (transition === 'jwt-only') store.accessToken = 'jwt-b'
        else if (transition === 'identity-only') store.customer = customerB
        else store.tokenType = 'different-type'
      }
      const expected = { token: store.accessToken, customer: store.customer, revision: store.sessionRevision }
      pending.resolve(action === 'confirmPhoneChange' ? { ...customerA, phone: '+380990001234' } : { sends_left_today: 2 })
      await assert.rejects(operation, obsoleteSession)
      assert.equal(store.accessToken, expected.token)
      assert.equal(store.customer, expected.customer)
      assert.equal(store.sessionRevision, expected.revision)
      assert.equal(store.error, '')
    })
  }

  test(`${action} replaces stale network error with session-expired UI error`, async () => {
    const pending = deferred()
    const store = loadStore(() => pending.promise)
    store.setSession({ access_token: 'jwt-a', customer: customerA })
    const operation = store[action]('+380990001234', '123456')
    store.logout()
    store.setSession({ access_token: 'jwt-b', customer: customerB })
    pending.reject({ statusCode: 429 })
    await assert.rejects(operation, obsoleteSession)
    assert.equal(store.customer, customerB)
    assert.equal(store.accessToken, 'jwt-b')
  })

  test(`${action} rejects session change between settled-response microtasks`, async () => {
    const pending = deferred()
    const store = loadStore(() => pending.promise)
    store.setSession({ access_token: 'jwt-a', customer: customerA })
    const operation = store[action]('+380990001234', '123456')
    pending.resolve(action === 'confirmPhoneChange' ? { ...customerA, phone: '+380990001234' } : { sends_left_today: 2 })
    queueMicrotask(() => {
      store.logout()
      store.setSession({ access_token: 'jwt-b', customer: customerB })
    })
    await assert.rejects(operation, obsoleteSession)
    assert.equal(store.customer, customerB)
    assert.equal(store.accessToken, 'jwt-b')
  })
}

test('same-session customer refresh does not invalidate phone confirmation', async () => {
  const pending = deferred()
  const store = loadStore(() => pending.promise)
  store.setSession({ access_token: 'jwt-a', customer: customerA })
  const operation = store.confirmPhoneChange('+380990001234', '123456')
  store.customer = { ...customerA, name: 'Refreshed' }
  const confirmed = { ...customerA, phone: '+380990001234' }
  pending.resolve(confirmed)
  assert.equal(await operation, confirmed)
  assert.equal(store.customer, confirmed)
  assert.equal(store.accessToken, 'jwt-a')
})
