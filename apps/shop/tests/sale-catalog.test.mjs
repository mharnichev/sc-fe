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
  const terms = vue.ref({ catalog: { brand: 'Brand', category: 'Category', title: 'Catalog', productType: 'Type', sortOptions: { newest: 'Newest', name: 'Name', nameDesc: 'Name descending' } }, home: { popularTitle: 'Popular', popularDescription: 'Popular products' }, seo: { catalogTitle: 'Catalog', catalogDescription: 'Catalog products' } })
  const domain = {
    getCategoryTree: async () => [{ id: 1, name: 'Hair', slug: 'hair', children: [] }],
    getBrands: async () => [{ slug: 'fixture', name: 'Fixture' }],
    getCatalogPage: async query => {
      calls.push({ kind: 'catalog', query: plain(query) })
      return { items: [], total: 100, price: { min: '10', max: '100' }, filters: {
        type: { slug: 'type', name: 'Type', values: [{ slug: 'shampoo', name: 'Shampoo', count: 50 }] },
        brand: { slug: 'brand', name: 'Brand', values: [{ slug: 'fixture', name: 'Fixture', count: 100 }] },
      } }
    },
  }
  const router = { replace: async location => {
    route.query = location.query
    route.fullPath = `${location.path}?${new URLSearchParams(location.query)}`
    await vue.nextTick()
  } }
  router.push = router.replace
  const context = vm.createContext({ ...vue, setTimeout, clearTimeout,
    defineProps: () => ({ topOnly: false, saleOnly: false, ...props }), withDefaults: value => value,
    useRoute: () => route, useRouter: () => router, useCatalogDomain: () => domain,
    useShopLocale: () => ({ locale, terms }), useCategoryDisplay: () => ({ categoryDisplayName: item => item.name, categoryDisplayDescription: item => item.description || '' }),
    useRuntimeConfig: () => ({ public: { apiBase: '/api/v1' } }), useRequestURL: () => ({ origin: 'http://shop.test' }),
    useShopAsset: () => value => value, useId: () => 'catalog-test', categoryPathBySlug: (nodes, slug) => nodes.filter(node => node.slug === slug), localBrandLogoUrl: () => '', resolveApiAssetUrl: value => value || '', isMonochromeBrandLogo: () => false,
    watch: (...args) => { const stop = vue.watch(...args); stops.push(stop); return stop },
    onBeforeUnmount: callback => cleanup.push(callback), useSeo: (...args) => { context.seo = args },
    useAsyncData: async (key, load, options = {}) => {
      keys.push(key)
      const data = vue.ref(await load())
      if (options.watch) stops.push(vue.watch(options.watch, async () => { data.value = await load() }))
      return { data, pending: vue.ref(false), refresh: async () => { data.value = await load() } }
    },
  })
  const model = await vm.runInContext(`(async () => { ${script}; return { apiQuery, updateQuery, panelSelectedFilters, clearFilters, setFilter, setOrdering, changePage, priceMin, priceMax, offset, saleTitle, saleDescription } })()`, context)
  t.after(() => { cleanup.forEach(fn => fn()); stops.forEach(stop => stop()) })
  return { ...model, calls, keys, route, router, locale, seo: context.seo }
}

test('sale ignores a false query fence and uses one combined products/facets response with reactive titles', async t => {
  const h = await harness(t, { saleOnly: true }, { has_discount: 'false', q: 'cream', limit: '12', offset: '24' })
  assert.ok(h.keys.includes('shop-sale-all-goods-products'))
  assert.equal(h.keys.filter(key => key.includes('facets')).length, 0)
  assert.deepEqual(h.calls, [{ kind: 'catalog', query: { q: 'cream', limit: 12, offset: 24, has_discount: true } }])
  assert.equal(h.panelSelectedFilters.value.has_discount, undefined)
  await h.updateQuery({ has_discount: 'false' })
  assert.equal(h.apiQuery.value.has_discount, true)
  assert.equal(h.seo[0](), 'Special offer')
  h.locale.value = 'uk'
  assert.equal(h.seo[0](), 'Спеціальна пропозиція')
  assert.match(h.seo[1](), /знижками/)
})

test('sale keeps its fence for category/type/brand facets, pagination, sorting and clear', async t => {
  const h = await harness(t)
  await h.updateQuery({ category: 'hair' })
  await h.setFilter('type', 'shampoo', true)
  await h.setFilter('brand', 'fixture', true)
  await h.changePage(3)
  assert.equal(h.offset.value, 40)
  assert.equal(h.calls.at(-1).query.offset, 40)
  assert.deepEqual(h.calls.at(-1).query.type, ['shampoo'])
  assert.deepEqual(h.calls.at(-1).query.brand, ['fixture'])
  await h.setOrdering('-price')
  assert.equal(h.offset.value, 0)
  assert.equal(h.calls.at(-1).query.ordering, '-price')
  await h.clearFilters()
  assert.equal(h.calls.at(-1).kind, 'catalog')
  assert.equal(h.calls.at(-1).query.category, undefined)
  for (const call of h.calls) assert.equal(call.query.has_discount, true, JSON.stringify(call))
})

test('sale refreshes type-only route changes and retains category price pagination on navigation', async t => {
  const h = await harness(t, { saleOnly: true }, { category: 'hair', type: 'shampoo', priceMin: '10' })
  const before = h.calls.length
  h.route.query = { category: 'hair', type: ['shampoo', 'balm'], priceMin: '10' }
  h.route.fullPath = '/sale?category=hair&type=shampoo&type=balm&priceMin=10'
  await vue.nextTick(); await vue.nextTick()
  assert.ok(h.calls.length > before)
  assert.deepEqual(h.calls.at(-1).query.type, ['shampoo', 'balm'])
  h.route.query = { category: 'hair', type: 'shampoo', priceMin: '20', offset: '40' }
  h.route.fullPath = '/sale?category=hair&type=shampoo&priceMin=20&offset=40'
  await vue.nextTick(); await vue.nextTick()
  assert.equal(h.offset.value, 40)
  assert.equal(h.calls.at(-1).query.priceMin, '20')
  assert.equal(h.calls.at(-1).query.has_discount, true)
})

test('ordinary, popular and sale response keys remain separate and preserve explicit URL flags', async t => {
  for (const props of [{}, { topOnly: true }]) {
    const h = await harness(t, props, { category: 'hair', has_discount: 'false' })
    const prefix = props.topOnly ? 'shop-top' : 'shop-catalog'
    assert.ok(h.keys.includes(`${prefix}-all-goods-products`))
    assert.equal(h.keys.filter(key => key.includes('facets')).length, 0)
    for (const call of h.calls) {
      assert.equal(call.query.has_discount, 'false')
      assert.equal(call.query.is_top, props.topOnly || undefined)
    }
    assert.equal(h.seo[0](), props.topOnly ? 'Popular' : 'Catalog')
  }
})
