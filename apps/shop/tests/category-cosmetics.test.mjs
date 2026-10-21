import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('compact header dropdown stays text-only with compact row sizing', async () => {
  const header = await read('../components/base/header/BaseHeader.vue')
  assert.doesNotMatch(header, /CategoryArtwork|cl__compact-artwork/)
  assert.match(header, /compactRows \* 2\.65/)
  assert.match(header, /:to="categoryLink\(subCategory\)" @click="closeOverlays"/)
})

test('category cards cap centered artwork at 160px and rotate only the arrow on hover and focus', async () => {
  const cards = await read('../components/catalog/CatalogCategoryCards.vue')
  assert.match(cards, /<CategoryArtwork class="category-cards__artwork" :slug="category.slug"/)
  assert.match(cards, /width: min\(100%, 160px\)/)
  assert.match(cards, /justify-items: center/)
  assert.match(cards, /text-align: center/)
  assert.match(cards, /padding-inline: 1\.375rem/)
  assert.match(cards, /category-cards__card:hover \.category-cards__arrow,\s*\.category-cards__card:focus-visible \.category-cards__arrow/)
  assert.match(cards, /translateY\(-50%\) rotate\(90deg\)/)
  assert.doesNotMatch(cards, /\.category-cards__card:hover\s*\{/)
  assert.match(cards, /prefers-reduced-motion: reduce[\s\S]*category-cards__arrow \{ transition: none/)
  assert.match(cards, /categoryDestination\(tree, category\)/)
  assert.match(cards, /<BaseIcon name="arrow-right" size="xs"/)
})
