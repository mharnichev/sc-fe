import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const pinia = await import(pathToFileURL(require.resolve('pinia')).href)
const vue = await import(pathToFileURL(createRequire(require.resolve('nuxt/package.json')).resolve('vue')).href)
let sequence = 0
const sourceModule = source => import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64')}#legacy-${sequence++}`)
const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const flush = () => new Promise(resolve => setImmediate(resolve))
const saved = (id = 924) => ({ id, slug: `product-${id}`, name: 'Шампунь Reuzel', product_type: 'ШАМПУНЬ', price: '100', stock: 5, status: 'active', images: [], is_available_for_purchase: true, category: { id: 7, name: 'Для волосся', slug: 'hair' } })
const published = (id = 924) => ({ ...saved(id), name: 'Changed source name', name_en: 'Reuzel dry shampoo', product_type_en: 'Dry shampoo', price: '999', stock: 0, is_available_for_purchase: false, category: { id: 7, name: 'Changed category source', name_en: 'Hair care', slug: 'hair' } })
const load = async (t, getProduct, storage = new Map()) => {
  const instance = pinia.createPinia(); pinia.setActivePinia(instance); t.after(() => pinia.disposePinia(instance))
  const helper = await sourceModule(await read('../utils/product-presentation-refresh.ts'))
  const visibility = await sourceModule(await read('../utils/product-visibility.ts'))
  Object.assign(globalThis, helper, visibility, { defineStore: pinia.defineStore, useCatalogDomain: () => ({ getProduct }), localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } })
  const module = await sourceModule((await read('../stores/recentlyViewed.ts')).replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true'))
  return { helper, store: module.useRecentlyViewedStore(instance), storage, instance }
}

test('legacy recent snapshots acquire published EN presentation, preserve business data and react UK → EN → UK', async t => {
  const request = deferred(); let calls = 0
  const original = saved()
  const storage = new Map([['shop-recently-viewed', JSON.stringify({ version: 1, products: [original] })]])
  const { store } = await load(t, async () => { calls++; return request.promise }, storage)
  store.hydrate(); store.hydrate(); await store.refreshTranslations(); await flush()
  assert.equal(calls, 1)
  request.resolve(published()); await flush()
  const enriched = store.products[0]
  for (const field of ['id', 'slug', 'name', 'price', 'stock', 'is_available_for_purchase']) assert.equal(enriched[field], original[field], field)
  assert.equal(enriched.category.name, original.category.name)
  assert.equal(enriched.name_en, 'Reuzel dry shampoo')
  assert.equal(enriched.product_type_en, 'Dry shampoo')
  assert.equal(enriched.category.name_en, 'Hair care')
  assert.equal(JSON.parse(storage.get('shop-recently-viewed')).products[0].name_en, 'Reuzel dry shampoo')
  const category = await sourceModule(await read('../utils/category-localization.ts')); Object.assign(globalThis, category)
  const display = await sourceModule((await read('../utils/product-localization.ts')).replace(/^import .*\n/gm, ''))
  const locale = vue.ref('uk')
  const title = vue.computed(() => display.localizedProductName(store.products[0], locale.value))
  const type = vue.computed(() => display.localizedProductType(store.products[0], locale.value))
  assert.equal(title.value, original.name)
  locale.value = 'en'; assert.equal(title.value, 'Reuzel dry shampoo'); assert.equal(type.value, 'Dry shampoo')
  locale.value = 'uk'; assert.equal(title.value, original.name); assert.equal(type.value, 'ШАМПУНЬ')
})

for (const outcome of ['404', 'network', 'wrong ID', 'unpublished']) {
  test(`public ${outcome} preserves legacy recent snapshot fallback`, async t => {
    const original = saved()
    const { store } = await load(t, async () => {
      if (outcome === '404') throw { statusCode: 404 }
      if (outcome === 'network') throw new Error('offline')
      return outcome === 'wrong ID' ? published(925) : { ...published(), is_effectively_visible: false }
    })
    store.products = [original]; await store.refreshTranslations()
    assert.equal(store.products.length, 1)
    assert.deepEqual(JSON.parse(JSON.stringify(store.products[0])), original)
  })
}

for (const action of ['removed', 'replaced']) {
  test(`late public response cannot resurrect or overwrite a ${action} recent item`, async t => {
    const request = deferred()
    const { store } = await load(t, () => request.promise)
    store.products = [saved()]
    const pending = store.refreshTranslations()
    if (action === 'removed') store.removeBySlug('product-924')
    else store.add({ ...saved(), name_en: 'Newer data', product_type_en: 'Newer type' })
    request.resolve(published()); await pending
    if (action === 'removed') assert.deepEqual(store.products, [])
    else assert.equal(store.products[0].name_en, 'Newer data')
  })
}

const guestSetup = async (t, getProduct) => {
  const storage = new Map([
    ['shop-cart', JSON.stringify({ ownerScope: 'guest', items: [{ product: saved(), quantity: 3 }] })],
    ['shop-favorites', JSON.stringify({ ownerScope: 'guest', items: [924], products: [{ ...saved(), price: '200' }] })],
  ])
  const env = await load(t, getProduct, storage)
  const auth = { isAuthenticated: false, customer: null, accessToken: '', sessionRevision: 0, $subscribe() {}, captureSession() { const revision = this.sessionRevision; return () => revision === this.sessionRevision } }
  let ready
  Object.assign(globalThis, { useCustomerAuthStore: () => auth, useShopLocale: () => ({ terms: vue.ref({}) }), useToastStore: () => ({ show() {} }), defineNuxtPlugin: fn => fn, onNuxtReady: callback => { ready = callback } })
  const { useCartStore } = await sourceModule((await read('../stores/cart.ts')).replace(/^import .*\n/gm, ''))
  const { useFavoritesStore } = await sourceModule((await read('../stores/favorites.ts')).replace(/^import .*\n/gm, ''))
  const cart = useCartStore(env.instance), favorites = useFavoritesStore(env.instance)
  Object.assign(globalThis, { useCartStore: () => cart, useFavoritesStore: () => favorites })
  const plugin = await sourceModule((await read('../plugins/persist.client.ts')).replace(/^import .*\n/gm, ''))
  plugin.default(); ready()
  return { ...env, auth, cart, favorites, ready }
}

test('actual guest persistence refresh deduplicates cart/wishlist GETs and preserves quantity, prices and source names', async t => {
  const request = deferred(); let calls = 0
  const { cart, favorites, ready } = await guestSetup(t, async () => { calls++; return request.promise })
  ready(); await flush(); assert.equal(calls, 1)
  request.resolve(published()); await flush()
  assert.equal(cart.items[0].product.name_en, 'Reuzel dry shampoo')
  assert.equal(favorites.products[0].product_type_en, 'Dry shampoo')
  assert.equal(cart.items[0].quantity, 3)
  assert.equal(cart.items[0].product.price, '100')
  assert.equal(favorites.products[0].price, '200')
  assert.equal(cart.items[0].product.is_available_for_purchase, true)
  assert.equal(cart.items[0].product.name, 'Шампунь Reuzel')
})

test('guest refresh cannot touch items removed while its public request is pending', async t => {
  const request = deferred()
  const { cart, favorites } = await guestSetup(t, () => request.promise)
  cart.items = []; favorites.products = []; favorites.items = []
  request.resolve(published()); await flush()
  assert.deepEqual(cart.items, []); assert.deepEqual(favorites.products, [])
})

test('guest refresh cannot apply after an account transition', async t => {
  const request = deferred()
  const { auth, cart, favorites } = await guestSetup(t, () => request.promise)
  auth.isAuthenticated = true; auth.sessionRevision++
  cart.ownerScope = favorites.ownerScope = 'customer:7'
  cart.items = [{ product: saved(), quantity: 1 }]; favorites.products = [saved()]
  request.resolve(published()); await flush()
  assert.equal(cart.items[0].product.name_en, undefined)
  assert.equal(favorites.products[0].name_en, undefined)
})

test('public refresh concurrency is bounded and never repeats already attempted saved objects', async t => {
  const { helper } = await load(t, async () => published())
  const sources = [saved(1), saved(2), saved(3), saved(4), saved(5)]
  let active = 0, maximum = 0, calls = 0
  const refresh = async slug => { active++; calls++; maximum = Math.max(maximum, active); await flush(); active--; return published(Number(slug.split('-')[1])) }
  await helper.refreshLegacyProductPresentation(sources, refresh, () => {})
  assert.equal(maximum, 3)
  await helper.refreshLegacyProductPresentation(sources, refresh, () => {})
  assert.equal(calls, 5)
})


test('five cart and five matching wishlist snapshots share five GETs while all ten snapshots are enriched', async t => {
  const { helper } = await load(t, async () => published())
  const cart = [1, 2, 3, 4, 5].map(id => ({ ...saved(id), price: '100' }))
  const wishlist = [1, 2, 3, 4, 5].map(id => ({ ...saved(id), price: '200' }))
  const snapshots = [...cart, ...wishlist]
  let calls = 0, active = 0, maximum = 0
  const updates = new Map()
  await helper.refreshLegacyProductPresentation(snapshots, async slug => {
    calls++; active++; maximum = Math.max(maximum, active)
    await flush(); active--
    return published(Number(slug.split('-')[1]))
  }, (source, enriched) => updates.set(source, enriched))
  assert.equal(calls, 5)
  assert.equal(updates.size, 10)
  assert.ok(maximum <= 3)
  for (const source of snapshots) {
    assert.equal(updates.get(source).name_en, 'Reuzel dry shampoo')
    assert.equal(updates.get(source).price, source.price)
  }
})
