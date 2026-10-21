import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { locale, vue, runtimeDisplay, sourceModule } from './runtime-localization-harness.mjs'

const { productPageCopy } = await sourceModule(await readFile(new URL('../utils/product-page-localization.ts', import.meta.url), 'utf8'))
const page = await readFile(new URL('../pages/products/[slug].vue', import.meta.url), 'utf8')
Object.assign(globalThis, vue, { productPageCopy, locale })
const selection = page.split('\n').find(line => line.startsWith('const productText ='))
const { productText } = await sourceModule(selection + '\nexport { productText };')

test('actual product page copy switches UK → EN → UK for ingredients, gallery, loading and unavailable states', () => {
  const view = vue.computed(() => [productText.value.composition, productText.value.characteristics, productText.value.description, productText.value.loadingProduct, productText.value.notFoundTitle, productText.value.retry])
  locale.value = 'uk'
  assert.deepEqual(view.value, ['Склад', 'Характеристики', 'Опис', 'Завантаження товару', 'Товар не знайдено', 'Спробувати ще раз'])
  locale.value = 'en'
  assert.deepEqual(view.value, ['Ingredients', 'Characteristics', 'Description', 'Loading product', 'Product not found', 'Try again'])
  assert.equal(productText.value.openImage(2, 'Shampoo'), 'Open image 2 of Shampoo')
  assert.equal(productText.value.goToSlide(3, 4), 'Go to slide 3 of 4')
  assert.equal(productText.value.showImage(2), 'Show image 2')
  assert.equal(productText.value.loadErrorTitle, 'Could not load the product')
  locale.value = 'uk'
  assert.equal(view.value[0], 'Склад')
  assert.equal(productText.value.openImage(2, 'Шампунь'), 'Відкрити зображення 2 товару Шампунь')
  for (const key of ['composition', 'characteristics', 'description', 'loadingProduct', 'notFoundTitle', 'loadErrorTitle', 'retry', 'gallery', 'compositionTitle', 'galleryNavigation', 'chooseVolume', 'otherImages']) assert.ok(page.includes(`productText.${key}`), key)
})

test('review failures saved in Ukrainian translate when English is selected and preserve the stored source', () => {
  const stored = vue.ref(globalThis.shopTerms.uk.product.saveReviewError)
  const rendered = vue.computed(() => runtimeDisplay.runtimeMessage(stored.value))
  locale.value = 'uk'
  assert.equal(rendered.value, 'Не вдалося зберегти відгук.')
  locale.value = 'en'
  assert.equal(rendered.value, globalThis.shopTerms.en.product.saveReviewError)
  stored.value = globalThis.shopTerms.uk.product.deleteReviewError
  assert.equal(rendered.value, globalThis.shopTerms.en.product.deleteReviewError)
  locale.value = 'uk'
  assert.equal(rendered.value, 'Не вдалося видалити відгук.')
  assert.equal(stored.value, 'Не вдалося видалити відгук.')
  assert.match(page, /\{\{ runtimeMessage\(reviewState\.error\) \}\}/)
})

test('sort tab names and fallback accessible label use the same active locale', async () => {
  const source = await readFile(new URL('../components/catalog/CatalogSortTabs.vue', import.meta.url), 'utf8')
  const terms = vue.computed(() => globalThis.shopTerms[locale.value])
  Object.assign(globalThis, vue, {
    defineProps: () => ({ modelValue: 'price' }), withDefaults: value => value, defineEmits: () => () => {},
    useShopLocale: () => ({ terms }),
  })
  const setup = source.split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '')
  const { defaultTabs } = await sourceModule(setup + '\nexport { defaultTabs };')
  locale.value = 'uk'
  assert.equal(terms.value.catalog.sort, 'Сортування')
  locale.value = 'en'
  assert.equal(terms.value.catalog.sort, 'Sort')
  assert.equal(defaultTabs.value[0].label, globalThis.shopTerms.en.catalog.cheaper)
  assert.equal(defaultTabs.value[0].value, 'price')
  locale.value = 'uk'
  assert.equal(terms.value.catalog.sort, 'Сортування')
  assert.match(source, /:aria-label="ariaLabel \|\| terms\.catalog\.sort"/)
})
