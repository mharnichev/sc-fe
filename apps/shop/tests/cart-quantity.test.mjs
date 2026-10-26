import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../stores/cart.ts', import.meta.url), 'utf8')
const product = () => ({ id: 1, slug: 'available-product', name: 'Product', price: '350', stock: 0, images: [], is_available_for_purchase: true })
const loadStore = ({ authenticated = false, getProduct = async () => product(), captureSession = () => () => true, ...domain } = {}) => {
  const toasts = []
  const syncWatchers = new Set()
  const context = vm.createContext({
    useCustomerAuthStore: () => ({ isAuthenticated: authenticated, customer: authenticated ? { id: 42 } : null, captureSession }),
    useShopLocale: () => ({ terms: { value: { basket: { unavailable: 'unavailable', quantityLimit: 'limit', updateFailed: 'failed' } } } }),
    useCatalogDomain: () => ({ getProduct, ...domain }),
    useToastStore: () => ({ show: (...args) => toasts.push(args) }),
    isProductUnavailable: p => p.is_available_for_purchase === false || p.is_effectively_visible === false,
    watch: (_source, callback) => {
      syncWatchers.add(callback)
      return () => syncWatchers.delete(callback)
    },
    defineStore: (_name, options) => {
      const store = options.state()
      let syncing = store.syncing
      Object.defineProperty(store, 'syncing', {
        get: () => syncing,
        set: value => {
          syncing = value
          for (const callback of syncWatchers) callback(value)
        },
      })
      for (const [key, getter] of Object.entries(options.getters)) Object.defineProperty(store, key, { get: () => getter(store) })
      for (const [key, action] of Object.entries(options.actions)) store[key] = action.bind(store)
      return () => store
    },
  })
  const script = ts.transpileModule(source.replace(/^import[^\n]+\n/gm, '').replace('export const', 'const'), {
    compilerOptions: { module: ts.ModuleKind.None },
  }).outputText
  vm.runInContext(script + '\nglobalThis.result = useCartStore()', context)
  return { store: context.result, toasts, syncWatchers }
}

test('unknown public stock does not cap available product at one; guest limit stays ten', async () => {
  const { store } = loadStore()
  await store.add(product())
  await store.update(1, 2)
  assert.equal(store.items[0].quantity, 2)
  assert.equal(store.total, 700)
  assert.equal(store.maxQuantity(product()), 10)
  await store.update(1, 11)
  assert.equal(store.items[0].quantity, 2)
  assert.equal(store.error, 'limit')
})

for (const current of [{ ...product(), is_available_for_purchase: false }, { ...product(), is_effectively_visible: false }]) {
  test(`fresh availability blocks stale add: ${JSON.stringify(current)}`, async () => {
    const { store, toasts } = loadStore({ getProduct: async () => current })
    await store.add(product())
    assert.equal(store.items.length, 0)
    assert.equal(toasts.length, 0)
    assert.equal(store.error, 'unavailable')
  })
}

test('unavailable item cannot increase but can decrease and be removed', async () => {
  const { store } = loadStore({ getProduct: async () => ({ ...product(), is_available_for_purchase: false }) })
  store.setItems([{ product: product(), quantity: 2 }])
  await store.update(1, 3)
  assert.equal(store.items[0].quantity, 2)
  assert.equal(store.hasUnavailableItems, true)
  assert.equal(store.maxQuantity(store.items[0].product, 2), 2)
  await store.update(1, 1)
  assert.equal(store.items[0].quantity, 1)
  await store.update(1, 0)
  assert.equal(store.items.length, 0)
})

for (const statusCode of [404, 503]) {
  test(`availability HTTP${statusCode} never adds or increments`, async () => {
    const { store, toasts } = loadStore({ getProduct: async () => { throw { statusCode } } })
    await store.add(product())
    assert.equal(store.items.length, 0)
    store.setItems([{ product: product(), quantity: 1 }])
    await store.update(1, 2)
    assert.equal(store.items[0].quantity, 1)
    assert.equal(toasts.length, 0)
    assert.equal(store.syncing, false)
  })
}

test('authenticated increase sends only delta and keeps server row on failure', async () => {
  const calls = []
  const { store } = loadStore({
    authenticated: true,
    addServerCartItem: async (id, quantity) => { calls.push([id, quantity]); throw new Error('offline') },
    deleteServerCartItem: async () => { throw new Error('must not delete') },
  })
  store.setItems([{ product: product(), quantity: 2 }])
  await store.update(1, 3)
  assert.deepEqual(calls, [[1, 1]])
  assert.equal(store.items[0].quantity, 2)
  assert.equal(store.error, 'failed')
})

test('failed authenticated add does not create local phantom item or success toast', async () => {
  const { store, toasts } = loadStore({ authenticated: true, addServerCartItem: async () => { throw new Error('offline') } })
  await store.add(product())
  assert.equal(store.items.length, 0)
  assert.equal(toasts.length, 0)
})

test('availability checks serialize repeated clicks and reject invalid quantities', async () => {
  let resolve, requests = 0
  const pending = new Promise(done => { resolve = done })
  const { store } = loadStore({ getProduct: () => { requests++; return pending } })
  const first = store.add(product())
  await store.add(product())
  assert.equal(requests, 1)
  assert.equal(store.syncing, true)
  resolve(product())
  await first
  assert.equal(store.items[0].quantity, 1)
  for (const quantity of [NaN, Infinity, 1.5, -1]) await store.add(product(), quantity)
  for (const quantity of [NaN, Infinity, 1.5]) await store.update(1, quantity)
  assert.equal(store.items[0].quantity, 1)
})

test('buy clicks on different products queue instead of dropping the second request', async () => {
  const pending = new Map()
  const requested = []
  const { store } = loadStore({ getProduct: slug => {
    requested.push(slug)
    return new Promise(resolve => pending.set(slug, resolve))
  } })
  const firstProduct = product()
  const secondProduct = { ...product(), id: 2, slug: 'second-product' }
  const first = store.toggle(firstProduct)
  const second = store.toggle(secondProduct)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(requested, [firstProduct.slug])
  pending.get(firstProduct.slug)(firstProduct)
  await first
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(requested, [firstProduct.slug, secondProduct.slug])
  pending.get(secondProduct.slug)(secondProduct)
  await second
  assert.deepEqual(Array.from(store.items, item => item.product.id), [1, 2])
  assert.equal(store.syncing, false)
})

test('a failed buy does not block a queued product', async () => {
  const { store } = loadStore({ getProduct: async slug => {
    if (slug === 'available-product') throw new Error('network failed')
    return { ...product(), id: 2, slug }
  } })
  await Promise.all([store.toggle(product()), store.toggle({ ...product(), id: 2, slug: 'second-product' })])
  assert.deepEqual(Array.from(store.items, item => item.product.id), [2])
  assert.equal(store.syncing, false)
})

test('a card click waits for an existing cart sync instead of disappearing', async () => {
  let requests = 0
  const { store } = loadStore({ getProduct: async () => { requests++; return product() } })
  store.syncing = true
  const buying = store.toggle(product())
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(requests, 0)
  store.syncing = false
  await buying
  assert.equal(requests, 1)
  assert.equal(store.items.length, 1)
})

test('queued clicks from a previous session do not modify the next session cart', async () => {
  let revision = 1
  const { store } = loadStore({ captureSession: () => {
    const captured = revision
    return () => captured === revision
  } })
  store.syncing = true
  const buying = store.toggle(product())
  await new Promise(resolve => setImmediate(resolve))
  revision++
  store.syncing = false
  await buying
  assert.equal(store.items.length, 0)
})

for (const nextScope of ['guest', 'customer:2']) {
  test(`session reset to ${nextScope} detaches an unresolved actor A request`, async () => {
    let revision = 1, finishOld
    const requested = []
    const oldRequest = new Promise(resolve => { finishOld = resolve })
    const second = { ...product(), id: 2, slug: 'actor-b-product' }
    const { store, syncWatchers } = loadStore({
      captureSession: () => { const captured = revision; return () => captured === revision },
      getProduct: slug => { requested.push(slug); return slug === product().slug ? oldRequest : Promise.resolve(second) },
    })
    store.prepareSession('customer:1')
    const old = store.toggle(product())
    await new Promise(resolve => setImmediate(resolve))
    const staleQueued = store.toggle({ ...product(), id: 3, slug: 'stale-queued' })
    revision++
    store.prepareSession(nextScope)
    const current = store.toggle(second)
    await new Promise(resolve => setImmediate(resolve))
    // Actor B must finish before actor A's unresolved transport is released.
    assert.deepEqual(requested, [product().slug, second.slug])
    assert.deepEqual(Array.from(store.items, item => item.product.id), [2])
    await current
    await staleQueued
    assert.equal(syncWatchers.size, 0)
    finishOld(product())
    await old
    assert.deepEqual(Array.from(store.items, item => item.product.id), [2])
    assert.equal(store.syncing, false)
  })
}

test('session reset cancels a sync wait and removes its watcher immediately', async () => {
  const { store, syncWatchers } = loadStore()
  store.syncing = true
  const stale = store.toggle(product())
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(syncWatchers.size, 1)
  store.prepareSession('customer:2')
  assert.equal(syncWatchers.size, 0)
  await stale
  assert.equal(store.items.length, 0)
  await store.toggle(product())
  assert.equal(store.items.length, 1)
  assert.equal(syncWatchers.size, 0)
})

test('session reset releases the active same-card toggle before its old transport settles', async () => {
  let revision = 1, finishOld, requests = 0, pending = false
  const oldTransport = new Promise(resolve => { finishOld = resolve })
  const { store } = loadStore({
    captureSession: () => { const captured = revision; return () => captured === revision },
    getProduct: () => ++requests === 1 ? oldTransport : Promise.resolve(product()),
  })
  const click = async () => {
    if (pending) return
    pending = true
    try { await store.toggle(product()) }
    finally { pending = false }
  }
  const oldClick = click()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(pending, true)
  revision++
  store.prepareSession('customer:2')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(pending, false, 'mounted card must unlock before the old transport completes')
  await oldClick
  await click()
  assert.equal(requests, 2)
  assert.equal(store.items.length, 1)
  finishOld(product())
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(store.items[0].quantity, 1)
})

test('outward toggle preserves operation rejection and leaves the next toggle usable', async () => {
  const { store } = loadStore()
  const add = store.add
  store.add = async () => { throw new Error('unexpected operation failure') }
  await assert.rejects(store.toggle(product()), /unexpected operation failure/)
  store.add = add
  await store.toggle(product())
  assert.equal(store.items.length, 1)
})
