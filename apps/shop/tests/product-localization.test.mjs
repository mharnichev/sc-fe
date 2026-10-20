import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const vue = await import(pathToFileURL(createRequire(require.resolve('nuxt/package.json')).resolve('vue')).href)
const importSource = source => import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64')}`)
const categoryLocalization = await importSource(await readFile(new URL('../utils/category-localization.ts', import.meta.url), 'utf8'))
Object.assign(globalThis, categoryLocalization)
const localization = await importSource((await readFile(new URL('../utils/product-localization.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, ''))
const locale = vue.ref('uk')
Object.assign(globalThis, localization, { useShopLocale: () => ({ locale }) })
const { useProductDisplay } = await importSource((await readFile(new URL('../composables/useProductDisplay.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, ''))

test('the same loaded product and persisted snapshot follow UK → EN → UK without mutating source names', () => {
  const product = { name: 'Шампунь', name_en: 'Shampoo', product_type: 'Для волосся', product_type_en: 'Hair care', category: { name: 'Догляд' } }
  const snapshot = JSON.parse(JSON.stringify(product))
  const display = useProductDisplay()
  const names = vue.computed(() => [product, snapshot].map(display.productDisplayName))
  const type = vue.computed(() => display.productDisplayType(product))
  assert.deepEqual(names.value, ['Шампунь', 'Шампунь'])
  assert.equal(type.value, 'Для волосся')
  locale.value = 'en'
  assert.deepEqual(names.value, ['Shampoo', 'Shampoo'])
  assert.equal(type.value, 'Hair care')
  locale.value = 'uk'
  assert.deepEqual(names.value, ['Шампунь', 'Шампунь'])
  assert.equal(type.value, 'Для волосся')
  assert.equal(product.name, 'Шампунь')
  assert.equal(snapshot.name, 'Шампунь')
})

test('older products, null and blank translations retain the original name/type with category fallback', () => {
  for (const translation of [undefined, null, '', '   ']) {
    const product = { name: 'Шампунь', name_en: translation, product_type: 'Догляд', product_type_en: translation }
    assert.equal(localization.localizedProductName(product, 'en'), 'Шампунь')
    assert.equal(localization.localizedProductType(product, 'en'), 'Догляд')
  }
  assert.equal(localization.localizedProductType({ name: 'X', category: { name: 'Категорія' } }, 'en'), 'Категорія')
})

test('public API mapping preserves both names and English type in snapshots', async () => {
  const source = (await readFile(new URL('../domain/catalog.ts', import.meta.url), 'utf8'))
    .split('export const useCatalogDomain =')[0]
    .replace("import { resolveApiAssetUrl } from '@shared-utils'", '')
  const { mapProduct } = await importSource(source + '\nexport { mapProduct };')
  const product = mapProduct({
    id: 1, name: 'Повна назва', model_name: 'Модель', name_en: 'English model',
    product_type: 'Шампунь', product_type_en: 'Shampoo', slug: 'model', price: '100',
    is_effectively_visible: true, is_available_for_purchase: true,
    volume_variants: [{ id: 2, slug: 'large', name_en: 'Large model', price: 120 }],
  }, value => value)
  assert.equal(product.name, 'Модель')
  assert.equal(product.old_name, 'Повна назва')
  assert.equal(product.name_en, 'English model')
  assert.equal(product.product_type_en, 'Shampoo')
  assert.equal(product.volume_variants[0].name_en, 'Large model')
  assert.equal(localization.localizedProductName(JSON.parse(JSON.stringify(product)), 'en'), 'English model')
})

test('search suggestions translate matching model/original names reactively and preserve unknown terms', () => {
  const products = [{ name: 'Модель', old_name: 'Повна назва', name_en: 'English model' }]
  const suggestions = ['Модель', 'Повна назва', 'Категорія']
  const rendered = vue.computed(() => suggestions.map(value => localization.localizedProductSuggestion(value, products, locale.value)))
  locale.value = 'uk'
  assert.deepEqual(rendered.value, suggestions)
  locale.value = 'en'
  assert.deepEqual(rendered.value, ['English model', 'English model', 'Категорія'])
  locale.value = 'uk'
  assert.deepEqual(rendered.value, suggestions)
})

test('image mapping leaves generated alt empty for locale rendering and preserves authored descriptions', async () => {
  const source = (await readFile(new URL('../domain/catalog.ts', import.meta.url), 'utf8'))
    .split('export const useCatalogDomain =')[0]
    .replace("import { resolveApiAssetUrl } from '@shared-utils'", '')
  const { mapProductImages } = await importSource(source + '\nexport { mapProductImages };')
  const product = { name: 'Шампунь', name_en: 'Shampoo', images: ['one.jpg', { image: 'two.jpg' }, { image: 'three.jpg', alt: 'Authored description' }] }
  const images = mapProductImages(product, value => value)
  assert.deepEqual(images.map(image => image.alt), [null, null, 'Authored description'])
  for (const language of ['uk', 'en', 'uk']) {
    assert.equal(images[0].alt || localization.localizedProductName(product, language), language === 'en' ? 'Shampoo' : 'Шампунь')
    assert.equal(images[2].alt || localization.localizedProductName(product, language), 'Authored description')
  }
  assert.equal(mapProductImages({ ...product, images: [], image_url: 'fallback.jpg' }, value => value)[0].alt, null)
})
