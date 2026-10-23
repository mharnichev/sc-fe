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
  assert.match(tile, /localizedPackageSize\(props\.product\.package_size\?\.trim\(\) \|\| '', locale\.value\)/)
  assert.equal(tile.match(/:disabled="cart\.syncing \|\| \(isUnavailable && !isInCart\)"/g)?.length, 2)
  assert.equal(tile.match(/:is="isHidden \? 'div' : NuxtLink"/g)?.length, 3)
  assert.match(tile, /Number\(product\.average_rating\) > 0 \|\| product\.reviews_count > 0/)
  assert.match(tile, /await cart\.toggle\(props\.product\)/)
})
