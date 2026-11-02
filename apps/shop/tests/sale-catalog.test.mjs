import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const vue = await import(pathToFileURL(createRequire(require.resolve('nuxt/package.json')).resolve('vue')).href)
const source = readFileSync(new URL('../components/catalog/CatalogAllGoodsRoute.vue', import.meta.url), 'utf8')
const script = ts.transpileModule(source.split('<script setup lang="ts">')[1].split('</script>')[0], {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace(/^import .*\n/gm, '').replace(/export \{\};?/, '').replaceAll('import.meta.client', 'false')
const plain = value => JSON.parse(JSON.stringify(value))

async function harness(t, props = { saleOnly: true }, initialQuery = {}) {
  const calls = [], keys = [], stops = [], cleanup = []
  const route = vue.reactive({ path: props.saleOnly ? '/sale' : '/catalog', query: initialQuery, fullPath: '' })
  const locale = vue.ref('en')
  const terms = vue.ref({ catalog: { brand: 'Brand' }, home: { popularTitle: 'Popular', popularDescription: 'Popular products' }, seo: { catalogTitle: 'Catalog', catalogDescription: 'Catalog products' } })
  const domain = {
    getCategoryTree: async () => [{ id: 1, name: 'Hair', slug: 'hair', children: [] }],
    getBrands: async () => [{ slug: 'fixture', name: 'Fixture' }],
    getProductsPage: async query => { calls.push({ kind: 'all', query: plain(query) }); return { items: [], total: 100 } },
    getCategoryProducts: async (slug, query) => { calls.push({ kind: 'category', slug, query: plain(query) }); return { items: [], total: 100 } },
    getCategoryFilters: async (slug, query) => { calls.push({ kind: 'facets', slug, query: plain(query) }); return { price: { min: '10', max: '100' }, filters: { scent: { slug: 'scent', name: 'Scent', values: [] } } } },
  }
  const router = { replace: async location => {
    route.query = location.query
    route.fullPath = `${location.path}?${new URLSearchParams(location.query)}`
    await vue.nextTick()
  } }
  const context = vm.createContext({ ...vue, setTimeout, clearTimeout,
    defineProps: () => ({ topOnly: false, saleOnly: false, ...props }), withDefaults: value => value,
    useRoute: () => route, useRouter: () => router, useCatalogDomain: () => domain,
    useShopLocale: () => ({ locale, terms }), useCategoryDisplay: () => ({ categoryDisplayName: item => item.name }),
    useRuntimeConfig: () => ({ public: { apiBase: '/api/v1' } }), useRequestURL: () => ({ origin: 'http://shop.test' }),
    localBrandLogoUrl: () => '', resolveApiAssetUrl: value => value || '', isMonochromeBrandLogo: () => false,
    watch: (...args) => { const stop = vue.watch(...args); stops.push(stop); return stop },
    onBeforeUnmount: callback => cleanup.push(callback), useSeo: (...args) => { context.seo = args },
    useAsyncData: async (key, load) => {
      keys.push(key)
      const data = vue.ref(await load())
      return { data, pending: vue.ref(false), refresh: async () => { data.value = await load() } }
    },
  })
  const model = await vm.runInContext(`(async () => { ${script}; return { buildApiQuery, buildRouteQuery, selectedFilters, updateCategory, clearFilters, setFilter, setOrdering, changePage, priceMin, priceMax, offset, saleTitle, saleDescription } })()`, context)
  t.after(() => { cleanup.forEach(fn => fn()); stops.forEach(stop => stop()) })
  return { ...model, calls, keys, route, router, locale, seo: context.seo }
}

test('sale ignores a false query fence and uses separate products/facets keys with reactive titles', async t => {
  const h = await harness(t, { saleOnly: true }, { has_discount: 'false', q: 'cream', limit: '12', offset: '24' })
  assert.ok(h.keys.includes('shop-sale-all-goods-products'))
  assert.ok(h.keys.includes('shop-sale-all-goods-facets'))
  assert.deepEqual(h.calls, [{ kind: 'all', query: { q: 'cream', limit: 12, offset: 24, has_discount: true } }])
  assert.equal(h.selectedFilters.has_discount, undefined)
  assert.equal(h.buildRouteQuery().has_discount, undefined)
  h.selectedFilters.has_discount = ['false']
  assert.equal(h.buildApiQuery().has_discount, true)
  assert.equal(h.seo[0](), 'Special offer')
  h.locale.value = 'uk'
  assert.equal(h.seo[0](), 'Спеціальна пропозиція')
  assert.match(h.seo[1](), /знижками/)
})

test('sale keeps its fence for category facets, dynamic filters, pagination, sorting and clear', async t => {
  const h = await harness(t)
  await h.updateCategory('hair')
  h.setFilter('scent', 'fresh', true)
  await vue.nextTick()
  await h.changePage(3)
  assert.equal(h.offset.value, 40)
  assert.equal(h.calls.at(-1).query.offset, 40)
  assert.deepEqual(h.calls.at(-1).query.scent, ['fresh'])
  await h.setOrdering('-price')
  assert.equal(h.offset.value, 0)
  assert.equal(h.calls.at(-1).query.ordering, '-price')
  await h.clearFilters()
  assert.equal(h.calls.at(-1).kind, 'all')
  assert.ok(h.calls.some(call => call.kind === 'facets'))
  for (const call of h.calls) assert.equal(call.query.has_discount, true, JSON.stringify(call))
})

test('sale refreshes dynamic-only route changes and retains category price pagination on navigation', async t => {
  const h = await harness(t, { saleOnly: true }, { category: 'hair', scent: 'fresh', priceMin: '10' })
  const before = h.calls.length
  h.route.query = { category: 'hair', scent: 'warm', priceMin: '10' }
  h.route.fullPath = '/sale?category=hair&scent=warm&priceMin=10'
  await vue.nextTick()
  assert.ok(h.calls.length > before)
  assert.deepEqual(h.calls.at(-1).query.scent, ['warm'])
  h.route.query = { category: 'hair', scent: 'warm', priceMin: '20', offset: '40' }
  h.route.fullPath = '/sale?category=hair&scent=warm&priceMin=20&offset=40'
  await vue.nextTick()
  await vue.nextTick()
  assert.equal(h.offset.value, 40)
  assert.equal(h.calls.at(-1).query.has_discount, true)
})

test('ordinary and popular listing/facet keys remain separate and do not enable sale', async t => {
  for (const props of [{}, { topOnly: true }]) {
    const h = await harness(t, props, { category: 'hair', has_discount: 'false' })
    const prefix = props.topOnly ? 'shop-top' : 'shop-catalog'
    assert.ok(h.keys.includes(`${prefix}-all-goods-products`))
    assert.ok(h.keys.includes(`${prefix}-all-goods-facets`))
    for (const call of h.calls) {
      assert.equal(call.query.has_discount, undefined)
      assert.equal(call.query.is_top, props.topOnly || undefined)
    }
    assert.equal(h.seo[0](), props.topOnly ? 'Popular' : 'Catalog')
  }
})
