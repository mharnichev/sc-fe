import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../stores/cart.ts', import.meta.url), 'utf8')
const product = () => ({ id: 1, slug: 'available-product', name: 'Product', price: '350', stock: 0, images: [], is_available_for_purchase: true })
const loadStore = ({ authenticated = false, getProduct = async () => product(), ...domain } = {}) => {
  const toasts = []
  const context = vm.createContext({
    useCustomerAuthStore: () => ({ isAuthenticated: authenticated, customer: authenticated ? { id: 42 } : null, captureSession: () => () => true }),
    useShopLocale: () => ({ terms: { value: { basket: { unavailable: 'unavailable', quantityLimit: 'limit', updateFailed: 'failed' } } } }),
    useCatalogDomain: () => ({ getProduct, ...domain }),
    useToastStore: () => ({ show: (...args) => toasts.push(args) }),
    isProductUnavailable: p => p.is_available_for_purchase === false || p.is_effectively_visible === false,
    defineStore: (_name, options) => {
      const store = options.state()
      for (const [key, getter] of Object.entries(options.getters)) Object.defineProperty(store, key, { get: () => getter(store) })
      for (const [key, action] of Object.entries(options.actions)) store[key] = action.bind(store)
      return () => store
    },
  })
  const script = ts.transpileModule(source.replace(/^import[^\n]+\n/gm, '').replace('export const', 'const'), {
    compilerOptions: { module: ts.ModuleKind.None },
  }).outputText
  vm.runInContext(script + '\nglobalThis.result = useCartStore()', context)
  return { store: context.result, toasts }
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
