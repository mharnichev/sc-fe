import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const pinia = await import(pathToFileURL(require.resolve('pinia')).href)
let sequence = 0
const importSource = source => import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText).toString('base64')}#${sequence++}`)
const deferred = () => {
  let resolve, reject
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail })
  return { promise, resolve, reject }
}
const product = id => ({ id, name: `Product ${id}`, slug: `product-${id}`, price: '100', images: [], is_available_for_purchase: true })
const customer = id => ({ id, name: `Customer ${id}`, phone: '+380990000001' })
const session = id => ({ access_token: `fixture-${id}`, token_type: 'Bearer', customer: customer(id) })
const obsolete = error => error.name === 'ObsoleteCustomerSessionError' && error.statusCode === 401

const setup = async (t, overrides = {}, storage = new Map()) => {
  const instance = pinia.createPinia()
  pinia.setActivePinia(instance)
  t.after(() => pinia.disposePinia(instance))
  const calls = [], toasts = []
  let auth, cart, favorites, ready
  const domain = {
    getProduct: async () => product(1),
    getServerCart: async () => [],
    getWishlist: async () => [],
    addServerCartItem: async (id, quantity) => { calls.push(['cart', auth.customer.id, id, quantity]); return { product: product(id), quantity } },
    addWishlistItem: async id => { calls.push(['favorite', auth.customer.id, id]); return { product: product(id), product_id: id } },
    deleteServerCartItem: async () => {}, deleteWishlistItem: async () => {},
    ...overrides.domain,
  }
  Object.assign(globalThis, {
    defineStore: pinia.defineStore,
    useCustomerAuthStore: () => auth, useCartStore: () => cart, useFavoritesStore: () => favorites,
    useApi: () => overrides.api || (async () => customer(auth.customer.id)),
    useCatalogDomain: () => domain,
    useShopLocale: () => ({ terms: { value: { basket: { unavailable: 'unavailable', updateFailed: 'failed', quantityLimit: 'limit' } } } }),
    useToastStore: () => ({ show: (...args) => toasts.push(args) }),
    isProductUnavailable: item => item.is_available_for_purchase === false || item.is_effectively_visible === false,
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    defineNuxtPlugin: fn => fn, onNuxtReady: fn => { ready = fn },
  })
  const authModule = await importSource(await readFile(new URL('../stores/customerAuth.ts', import.meta.url), 'utf8'))
  const cartModule = await importSource((await readFile(new URL('../stores/cart.ts', import.meta.url), 'utf8')).replace(/^import .*product-visibility.*\n/m, ''))
  const favoritesModule = await importSource((await readFile(new URL('../stores/favorites.ts', import.meta.url), 'utf8')).replace(/^import .*product-visibility.*\n/m, ''))
  auth = authModule.useCustomerAuthStore(instance)
  cart = cartModule.useCartStore(instance)
  favorites = favoritesModule.useFavoritesStore(instance)
  return { auth, cart, favorites, domain, calls, toasts, storage, startPersistence: async () => {
    const plugin = await importSource(await readFile(new URL('../plugins/persist.client.ts', import.meta.url), 'utf8'))
    plugin.default()
    ready()
  } }
}

for (const transition of ['logout', 'switch']) {
  test(`${transition} removes previous account cart and favorites`, async t => {
    const { auth, cart, favorites } = await setup(t)
    auth.setSession(session(1))
    cart.ownerScope = favorites.ownerScope = 'customer:1'
    cart.setItems([{ product: product(11), quantity: 2 }])
    favorites.items = [11]; favorites.products = [product(11)]
    if (transition === 'logout') auth.logout()
    else auth.setSession(session(2))
    assert.equal(cart.count, 0)
    assert.equal(favorites.count, 0)
    assert.equal(favorites.products.length, 0)
    assert.equal(cart.ownerScope, transition === 'logout' ? 'guest' : 'customer:2')
  })
}

test('successful login merges genuine guest cart once, then uses the authoritative account cart', async t => {
  const { auth, cart, favorites, calls } = await setup(t, { api: async () => session(2), domain: {
    getServerCart: async () => [{ product: product(11), quantity: 2 }],
  } })
  cart.setItems([{ product: product(11), quantity: 2 }])
  await auth.verifyOtp('+380990000001', '123456')
  assert.deepEqual(calls, [['cart', 2, 11, 2]])
  assert.equal(cart.ownerScope, 'customer:2')
  assert.equal(favorites.ownerScope, 'customer:2')
  await cart.mergeAnonymousIntoServer()
  assert.deepEqual(calls, [['cart', 2, 11, 2]])
})

for (const storeName of ['cart', 'favorites']) {
  for (const outcome of ['success', 'failure']) {
    test(`late ${storeName} sync ${outcome} cannot repopulate or alter a new account`, async t => {
      const pending = deferred()
      const apiName = storeName === 'cart' ? 'getServerCart' : 'getWishlist'
      const state = await setup(t, { domain: { [apiName]: () => pending.promise } })
      state.auth.setSession(session(1))
      const operation = state[storeName].syncFromServer()
      state.auth.logout(); state.auth.setSession(session(2))
      if (outcome === 'success') pending.resolve([{ product: product(11), product_id: 11, quantity: 2 }])
      else pending.reject(new Error('old account offline'))
      await operation
      assert.equal(state[storeName].items.length, 0)
      assert.equal(state[storeName].error, '')
      assert.equal(state.auth.customer.id, 2)
    })
  }
}

for (const action of ['fetchMe', 'updateProfile', 'verifyOtp']) {
  for (const outcome of ['success', 'failure']) {
    test(`late ${action} ${outcome} cannot replace or log out a newer session`, async t => {
      const pending = deferred()
      const { auth, calls } = await setup(t, { api: () => pending.promise })
      auth.setSession(session(1))
      const operation = action === 'fetchMe' ? auth.fetchMe() : action === 'updateProfile' ? auth.updateProfile({ name: 'Changed' }) : auth.verifyOtp('+380990000001', '123456')
      auth.logout(); auth.setSession(session(2))
      const rejected = assert.rejects(operation, outcome === 'success' || action !== 'verifyOtp' ? obsolete : /old account offline/)
      if (outcome === 'success') pending.resolve(action === 'verifyOtp' ? session(1) : customer(1))
      else pending.reject(new Error('old account offline'))
      await rejected
      assert.equal(auth.accessToken, 'fixture-2')
      assert.equal(auth.customer.id, 2)
      assert.equal(auth.error, '')
      assert.equal(calls.length, 0)
    })
  }
}

test('an obsolete availability check cannot add its item into the next account', async t => {
  const pending = deferred()
  const { auth, cart, calls, toasts } = await setup(t, { domain: { getProduct: () => pending.promise } })
  const operation = cart.add(product(11))
  auth.setSession(session(2))
  pending.resolve(product(11)); await operation
  assert.deepEqual(calls, [])
  assert.deepEqual(toasts, [])
  assert.equal(cart.count, 0)
})

for (const storeName of ['cart', 'favorites']) {
  test(`late ${storeName} add cannot insert old account data or show a success toast`, async t => {
    const pending = deferred()
    const apiName = storeName === 'cart' ? 'addServerCartItem' : 'addWishlistItem'
    const state = await setup(t, { domain: { [apiName]: () => pending.promise } })
    state.auth.setSession(session(1))
    const operation = storeName === 'cart' ? state.cart.add(product(11)) : state.favorites.add(11, product(11))
    // Cart add first awaits its availability recheck.
    await new Promise(resolve => setImmediate(resolve))
    state.auth.logout(); state.auth.setSession(session(2))
    pending.resolve({ product: product(11), product_id: 11, quantity: 1 }); await operation
    assert.equal(state[storeName].items.length, 0)
    assert.deepEqual(state.toasts, [])
  })

  test(`${storeName} guest merge stops before a second write after an account switch`, async t => {
    const pending = deferred(), writes = []
    const apiName = storeName === 'cart' ? 'addServerCartItem' : 'addWishlistItem'
    const state = await setup(t, { domain: { [apiName]: id => { writes.push(id); return pending.promise } } })
    state.cart.setItems([{ product: product(11), quantity: 2 }, { product: product(12), quantity: 1 }])
    state.favorites.items = [11, 12]
    state.auth.setSession(session(1))
    const operation = state[storeName].mergeAnonymousIntoServer()
    state.auth.setSession(session(2))
    pending.resolve({ product: product(11), quantity: 2 }); await operation
    assert.deepEqual(writes, [11])
    assert.equal(state[storeName].items.length, 0)
  })
}

test('a delayed cart decrease cannot re-add an account A product into account B', async t => {
  const pending = deferred()
  const { auth, cart, calls } = await setup(t, { domain: { deleteServerCartItem: () => pending.promise } })
  auth.setSession(session(1))
  cart.ownerScope = 'customer:1'
  cart.setItems([{ product: product(11), quantity: 2 }])
  const operation = cart.update(11, 1)
  auth.setSession(session(2))
  pending.resolve(); await operation
  assert.deepEqual(calls, [])
  assert.equal(cart.count, 0)
})

test('obsolete completion cannot unlock a new account cart request', async t => {
  const oldRequest = deferred(), newRequest = deferred()
  let requests = 0
  const { auth, cart } = await setup(t, { domain: { getServerCart: () => (++requests === 1 ? oldRequest : newRequest).promise } })
  auth.setSession(session(1))
  const oldOperation = cart.syncFromServer()
  auth.setSession(session(2))
  const newOperation = cart.syncFromServer()
  oldRequest.resolve([]); await oldOperation
  assert.equal(cart.syncing, true)
  newRequest.resolve([]); await newOperation
  assert.equal(cart.syncing, false)
})

for (const legacy of [false, true]) {
  for (const transition of ['logout', 'switch']) {
    test(`${legacy ? 'legacy' : 'owned'} persistence cannot restore A cart after early ${transition}, including the next reload`, async t => {
      const owner = legacy ? {} : { ownerScope: 'customer:1' }
      const storage = new Map([
        ['shop-customer-auth', JSON.stringify({ accessToken: 'fixture-1', tokenType: 'Bearer', customer: customer(1) })],
        ['shop-cart', JSON.stringify({ ...owner, items: [{ product: product(11), quantity: 2 }] })],
        ['shop-favorites', JSON.stringify({ ...owner, items: [11], products: [product(11)] })],
      ])
      const first = await setup(t, {}, storage)
      first.auth.hydrate(JSON.parse(storage.get('shop-customer-auth')))
      if (transition === 'logout') first.auth.logout()
      else first.auth.setSession(session(2))
      await first.startPersistence()
      assert.equal(first.cart.count, 0)
      assert.equal(first.favorites.count, 0)
      assert.equal(JSON.parse(storage.get('shop-cart')).items.length, 0)
      const second = await setup(t, {}, storage)
      await second.startPersistence()
      assert.equal(second.cart.count, 0)
      assert.equal(second.favorites.count, 0)
      assert.equal(second.cart.ownerScope, transition === 'logout' ? 'guest' : 'customer:2')
    })
  }
}


test('direct replacement session resets obsolete OTP loading state', async t => {
  const pending = deferred()
  const { auth } = await setup(t, { api: () => pending.promise })
  const operation = auth.verifyOtp('+380990000001', '123456')
  assert.equal(auth.loading, true)
  auth.setSession(session(2))
  assert.equal(auth.loading, false)
  const rejected = assert.rejects(operation, obsolete)
  pending.resolve(session(1)); await rejected
  assert.equal(auth.loading, false)
  assert.equal(auth.customer.id, 2)
})

test('OTP verification cannot report successful old-account login after its merge was interrupted', async t => {
  const pending = deferred()
  const { auth, cart } = await setup(t, { api: async () => session(1), domain: { addServerCartItem: () => pending.promise } })
  cart.setItems([{ product: product(11), quantity: 2 }])
  const operation = auth.verifyOtp('+380990000001', '123456')
  await new Promise(resolve => setImmediate(resolve))
  auth.setSession(session(2))
  const rejected = assert.rejects(operation, obsolete)
  pending.resolve({ product: product(11), quantity: 2 }); await rejected
  assert.equal(auth.customer.id, 2)
  assert.equal(auth.loading, false)
  assert.equal(cart.count, 0)
})
