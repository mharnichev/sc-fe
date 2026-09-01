import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

const [
  domainSource,
  visibilitySource,
  cartSource,
  checkoutSource,
  favoriteModalSource,
  recentlyViewedSource,
  productPageSource,
] = await Promise.all([
  read('../domain/catalog.ts'),
  read('../utils/product-visibility.ts'),
  read('../stores/cart.ts'),
  read('../pages/checkout/purchase.vue'),
  read('../components/modals/UserFavoriteModal.vue'),
  read('../stores/recentlyViewed.ts'),
  read('../pages/products/[slug].vue'),
])

test('shop domain preserves backend visibility and purchase fields', () => {
  assert.match(domainSource, /is_effectively_visible: boolean/)
  assert.match(domainSource, /hidden_reason: 'product' \| 'category' \| 'parent_category' \| null/)
  assert.match(domainSource, /is_available_for_purchase: boolean/)
  assert.match(domainSource, /mapPrivateProduct/)
  assert.match(domainSource, /item\.is_available_for_purchase \?\? mapped\.is_available_for_purchase/)
})

test('cart and checkout keep unavailable items removable but block purchase', () => {
  assert.match(visibilitySource, /product\.is_available_for_purchase === false/)
  assert.match(cartSource, /hasUnavailableItems/)
  assert.match(cartSource, /quantity > item\.quantity/)
  assert.match(checkoutSource, /!cart\.hasUnavailableItems/)
  assert.match(checkoutSource, /unavailableItems\.value\.map\(item => item\.product\.name\)/)
  assert.match(checkoutSource, /:disable-increase="isProductUnavailable\(item\.product\)"/)
  assert.match(checkoutSource, /:min="0"/)
})

test('wishlist distinguishes hidden navigation from purchase availability', () => {
  assert.match(favoriteModalSource, /v-if="!isProductHidden\(product\)"/)
  assert.match(favoriteModalSource, /:disabled="isProductUnavailable\(product\)"/)
  assert.match(favoriteModalSource, /favorites\.remove\(product\.id\)/)
})

test('recently viewed stays local and removes a hidden product after a 404', () => {
  assert.match(recentlyViewedSource, /\.filter\(isProductEffectivelyVisible\)/)
  assert.match(recentlyViewedSource, /removeBySlug\(slug: string\)/)
  assert.doesNotMatch(recentlyViewedSource, /useCatalogDomain|\$fetch|useFetch/)
  assert.match(productPageSource, /isNotFoundError/)
  assert.match(productPageSource, /recentlyViewed\.removeBySlug/)
  assert.match(productPageSource, /isProductUnavailable\(product\) && !isInCart/)
})
