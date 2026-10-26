import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = await readFile(new URL('../components/catalog/RecentlyViewedProducts.vue', import.meta.url), 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]

function harness(width, gridColumn, gap = 12) {
  const events = new Map(), observed = [], hooks = {}
  const grid = gridColumn === null ? null : { style: { gridTemplateColumns: gridColumn } }
  const track = { style: { columnGap: String(gap) } }
  const element = {
    clientWidth: width, scrollWidth: width * 3, scrollLeft: 0,
    closest: () => ({ querySelector: () => grid }),
    querySelector: selector => selector.endsWith('__track') ? track : { getBoundingClientRect: () => ({ width: 140 }) },
    scrollBy: options => { element.scrolled = options },
  }
  const context = {
    defineProps: () => ({}),
    useRecentlyViewedStore: () => ({ products: [{ id: 1 }], hydrate() {} }),
    useShopLocale: () => ({ terms: {} }),
    ref: value => ({ value }), computed: getter => ({ get value() { return getter() } }),
    nextTick: callback => callback(), watch() {},
    onMounted: callback => { hooks.mount = callback },
    onBeforeUnmount: callback => { hooks.unmount = callback },
    getComputedStyle: node => node.style,
    ResizeObserver: class {
      constructor(callback) { hooks.resize = callback }
      observe(node) { observed.push(node) }
      disconnect() { hooks.disconnected = true }
    },
    window: {
      matchMedia: query => ({ matches: query.includes('1241') ? width >= 1241 : query.includes('568') ? width >= 568 : true }),
      addEventListener: (name, fn) => events.set(name, fn),
      removeEventListener: (name, fn) => { if (events.get(name) === fn) events.delete(name) },
    },
  }
  vm.runInNewContext(ts.transpileModule(`${script}\nglobalThis.result = { viewport, cardWidth, updateLayout, observeViewport, scrollProducts, canScrollBack, canScrollForward }`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, context)
  context.result.viewport.value = element
  return { ...context.result, element, grid, track, events, observed, hooks }
}

test('recent tiles use the actual catalog column, including filter-reserved width', () => {
  const h = harness(1200, '257.5px 257.5px 257.5px')
  h.updateLayout()
  assert.equal(h.cardWidth.value, 257.5)
  assert.equal(h.canScrollForward.value, true)
  h.element.scrollLeft = h.element.scrollWidth - h.element.clientWidth
  h.updateLayout()
  assert.equal(h.canScrollForward.value, false)
  assert.equal(h.canScrollBack.value, true)
})

for (const [width, gap, columns] of [[320, 5.6, 2], [390, 5.6, 2], [768, 12, 3], [1440, 12, 4]]) {
  test(`no-grid fallback sizes ${columns} columns at ${width}px`, () => {
    const h = harness(width, null, gap)
    h.updateLayout()
    assert.equal(h.cardWidth.value, (width - gap * (columns - 1)) / columns)
  })
}

test('scroll distance uses track gap and honors reduced motion', () => {
  const h = harness(390, null, 5.6)
  h.scrollProducts(1)
  assert.equal(h.element.scrolled.left, 145.6)
  assert.equal(h.element.scrolled.behavior, 'auto')
  h.scrollProducts(-1)
  assert.equal(h.element.scrolled.left, -145.6)
})

test('mount observes both grid and viewport; unmount releases observer and resize listener', () => {
  const h = harness(768, '240px 240px 240px')
  h.hooks.mount()
  assert.deepEqual(h.observed, [h.element, h.grid])
  assert.equal(h.events.get('resize'), h.updateLayout)
  h.grid.style.gridTemplateColumns = '260px 260px'
  h.hooks.resize()
  assert.equal(h.cardWidth.value, 260)
  h.hooks.unmount()
  assert.equal(h.events.size, 0)
  assert.equal(h.hooks.disconnected, true)
})

test('tile presentation retains localized metadata, cart guards, hidden links and review-only ratings', async () => {
  const tile = await readFile(new URL('../components/catalog/CatalogProductTile.vue', import.meta.url), 'utf8')
  assert.match(tile, /localizedPackageSize\(typeof props\.product\.package_size === 'string'/)
  assert.equal(tile.match(/:disabled="cartPending \|\| \(isUnavailable && !isInCart\)"/g)?.length, 2)
  assert.equal(tile.match(/:aria-busy="cartPending"/g)?.length, 2)
  assert.equal(tile.match(/:aria-label="isInCart \? terms\.product\.removeFromCart : \(isUnavailable \? unavailableLabel : terms\.product\.addToCart\)"/g)?.length, 2)
  assert.equal(tile.match(/isInCart \? inCartLabel : \(isUnavailable \? unavailableLabel : buyLabel\)/g)?.length, 2)
  assert.match(tile, /if \(cartPending\.value\) return/)
  assert.match(tile, /finally\s*\{\s*cartPending\.value = false/)
  assert.equal(tile.match(/:is="isHidden \? 'div' : NuxtLink"/g)?.length, 3)
  assert.match(tile, /Number\(product\.average_rating\) > 0 \|\| product\.reviews_count > 0/)
  assert.match(tile, /await cart\.toggle\(props\.product\)/)
  assert.match(tile, /\.catalog-product-tile__volume\.base-badge\s*\{\s*max-width: 100%;\s*flex-shrink: 0;\s*white-space: normal;\s*overflow-wrap: anywhere;/)
})

test('persisted malformed package metadata cannot crash tile computation', async () => {
  const tile = await readFile(new URL('../components/catalog/CatalogProductTile.vue', import.meta.url), 'utf8')
  const expression = tile.match(/const packageSize = computed\(\(\) => (.*)\)/)[1]
  for (const value of [undefined, null, 500, {}, ['500 ml'], ' 500 ml ']) {
    const result = vm.runInNewContext(expression, {
      props: { product: { package_size: value } }, locale: { value: 'en' }, localizedPackageSize: value => value,
    })
    assert.equal(result, typeof value === 'string' ? value.trim() : '')
  }
})

test('tile pending state rejects duplicate clicks and resets after success or failure', async () => {
  const tile = await readFile(new URL('../components/catalog/CatalogProductTile.vue', import.meta.url), 'utf8')
  const handler = tile.slice(tile.indexOf('const cartPending ='), tile.indexOf('</script>'))
  for (const fails of [false, true]) {
    let finish, calls = 0
    const pending = new Promise((resolve, reject) => { finish = () => fails ? reject(new Error('offline')) : resolve() })
    const context = vm.createContext({ ref: value => ({ value }), props: { product: { id: 1 } }, cart: { toggle: () => { calls++; return pending } } })
    vm.runInContext(handler + '\nglobalThis.handlers = { cartPending, toggleCart }', context)
    const first = context.handlers.toggleCart()
    assert.equal(context.handlers.cartPending.value, true)
    await context.handlers.toggleCart()
    assert.equal(calls, 1)
    finish()
    if (fails) await assert.rejects(first, /offline/)
    else await first
    assert.equal(context.handlers.cartPending.value, false)
  }
})

test('mobile purchase row wraps full-size controls instead of shrinking or clipping prices', async () => {
  const tile = await readFile(new URL('../components/catalog/CatalogProductTile.vue', import.meta.url), 'utf8')
  const mobile = tile.slice(tile.indexOf('@media (max-width: 519px)'))
  assert.match(mobile, /\.catalog-product-tile__mobile-purchase-row\s*\{[^}]*flex-wrap: wrap/s)
  assert.match(mobile, /\.catalog-product-tile__mobile-layout \.catalog-product-tile__prices\s*\{[^}]*min-width: min-content;[^}]*flex: 0 0 auto/s)
  assert.match(mobile, /\.catalog-product-tile__mobile-purchase-row \.catalog-product-tile__cart\s*\{[^}]*max-width: 100%;[^}]*min-height: 2.75rem;[^}]*font-size: 12px;[^}]*white-space: normal/s)
  assert.doesNotMatch(mobile, /font-size: [89]px/)
})

test('favorite uses article-relative placement below ratings, independent of metadata height', async () => {
  const tile = await readFile(new URL('../components/catalog/CatalogProductTile.vue', import.meta.url), 'utf8')
  assert.match(tile, /<BaseButton\s+class="catalog-product-tile__favorite"[^]*?<\/BaseButton>\s*<div class="catalog-product-tile__body">/)
  assert.match(tile, /\.catalog-product-tile__favorite\s*\{[^}]*position: absolute;\s*top: 3rem;\s*right: 0.75rem;\s*z-index: 3/s)
  assert.match(tile, /\.catalog-product-tile__rating\s*\{[^}]*top: 1rem/s)
  const mobile = tile.slice(tile.indexOf('@media (max-width: 519px)'))
  assert.match(mobile, /\.catalog-product-tile__favorite,\s*\.catalog-product-tile__bottom\s*\{\s*opacity: 1;\s*pointer-events: auto;/)
})

test('release layout retains base-aware brands, basket controls and small home rows', async () => {
  const brand = await readFile(new URL('../components/BrandSlider.vue', import.meta.url), 'utf8')
  assert.match(brand, /shopAsset\(localBrandLogoUrl\(brand.slug\)\)/)
  assert.match(brand, /grid-template-columns: auto minmax\(0, 1fr\) auto/)
  const basket = await readFile(new URL('../components/modals/UserBasketModal.vue', import.meta.url), 'utf8')
  assert.match(basket, /favorites\.toggle\(item.product.id, item.product\)/)
  assert.match(basket, /:aria-pressed="favorites.has\(item.product.id\)"/)
  assert.match(basket, /:disable-increase="isProductUnavailable\(item.product\)"/)
  const home = await readFile(new URL('../pages/index.vue', import.meta.url), 'utf8')
  assert.match(home, /!arePopularProductsLoading && popularProducts.length <= 4/)
  assert.match(home, /main-page__popular-list--single-row\s*\{\s*grid-template-rows: auto/)
  const bar = await readFile(new URL('../components/base/BaseBottomBar.vue', import.meta.url), 'utf8')
  assert.match(bar, /base-bottom-bar--compact/)
  assert.match(bar, /prefers-reduced-motion: reduce/)
  for (const name of ['product-review', 'product-buy-arrow']) {
    const icon = await readFile(new URL(`../public/lehko/icons/default/${name}.svg`, import.meta.url), 'utf8')
    assert.match(icon, /<svg/)
    assert.match(icon, /viewBox=/)
  }
})

test('compact header and basket layout retain base-aware assets and valid copy', async () => {
  const header = await readFile(new URL('../components/base/header/BaseHeader.vue', import.meta.url), 'utf8')
  const basket = await readFile(new URL('../components/modals/UserBasketModal.vue', import.meta.url), 'utf8')
  assert.match(header, /\.cl__compact-link\s*\{[^}]*justify-content: space-between/s)
  assert.match(header, /:src="shopAsset\('\/soulcuts\/sc-logo-name-dark.webp'\)"/)
  assert.match(basket, /\.basket-sidebar__total\s*\{[^}]*flex-wrap: wrap/s)
  assert.match(basket, /terms\.basket\.orderTotal/)
  assert.match(basket, /terms\.basket\.discountNote/)
  assert.match(basket, /terms\.basket\.proceedToPayment/)
  const copy = await readFile(new URL('../data/locale.ts', import.meta.url), 'utf8')
  assert.match(copy, /Остаточна сума підтверджується під час створення замовлення/)
  assert.match(copy, /The final total is confirmed when your order is placed/)
  assert.doesNotMatch(copy, /Additional discounts are applied on the payment page/)
})
