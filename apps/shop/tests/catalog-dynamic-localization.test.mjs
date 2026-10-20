import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const vue = await import(pathToFileURL(createRequire(require.resolve('nuxt/package.json')).resolve('vue')).href)
const importSource = source => import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64')}`)
const category = await importSource(await readFile(new URL('../utils/category-localization.ts', import.meta.url), 'utf8'))
Object.assign(globalThis, category)
const product = await importSource((await readFile(new URL('../utils/product-localization.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, ''))
const metadata = await importSource(await readFile(new URL('../utils/catalog-metadata-localization.ts', import.meta.url), 'utf8'))
const locale = vue.ref('uk')
Object.assign(globalThis, product, { useShopLocale: () => ({ locale }) })
const { useProductDisplay } = await importSource((await readFile(new URL('../composables/useProductDisplay.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, ''))
const { useCategoryDisplay } = await importSource((await readFile(new URL('../composables/useCategoryDisplay.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, ''))

test('already loaded product HTML, summary, ingredients and nested category descriptions react UK → EN → UK', () => {
  const item = { description: '<p>Догляд</p>', description_en: '<p>Care</p>', short_description: 'Коротко', short_description_en: 'Summary', ingredients: 'Склад', ingredients_en: 'Ingredients' }
  const nested = { description: 'Для тіла', description_en: 'Body care' }
  const { productDisplayContent } = useProductDisplay()
  const { categoryDisplayDescription } = useCategoryDisplay()
  const rendered = vue.computed(() => ['description', 'short_description', 'ingredients'].map(field => productDisplayContent(item, field)).concat(categoryDisplayDescription(nested)))
  assert.deepEqual(rendered.value, ['<p>Догляд</p>', 'Коротко', 'Склад', 'Для тіла'])
  locale.value = 'en'
  assert.deepEqual(rendered.value, ['<p>Care</p>', 'Summary', 'Ingredients', 'Body care'])
  locale.value = 'uk'
  assert.deepEqual(rendered.value, ['<p>Догляд</p>', 'Коротко', 'Склад', 'Для тіла'])
  assert.equal(item.description, '<p>Догляд</p>')
})

test('missing, blank and null translations retain original catalog content', () => {
  for (const description_en of [undefined, null, '', '  ']) {
    assert.equal(product.localizedProductContent({ description: 'Оригінал', description_en }, 'description', 'en'), 'Оригінал')
    assert.equal(category.localizedCategoryDescription({ description: 'Оригінал', description_en }, 'en'), 'Оригінал')
  }
})

test('public product and recursive category mapping retain translated content without overwriting originals', async () => {
  const source = (await readFile(new URL('../domain/catalog.ts', import.meta.url), 'utf8')).split('export const useCatalogDomain =')[0].replace("import { resolveApiAssetUrl } from '@shared-utils'", '')
  const { mapProduct, mapCategoryTreeNode } = await importSource(source + '\nexport { mapProduct, mapCategoryTreeNode };')
  const mapped = mapProduct({ id: 1, name: 'Товар', price: 1, description: 'Опис', description_en: 'Description', short_description_en: 'Summary', ingredients_en: 'INCI', category: { id: 1, name: 'Догляд', description_en: 'Care' } }, value => value)
  assert.equal(mapped.description, 'Опис')
  assert.equal(mapped.description_en, 'Description')
  assert.equal(mapped.short_description_en, 'Summary')
  assert.equal(mapped.ingredients_en, 'INCI')
  assert.equal(mapped.category.description_en, 'Care')
  const tree = mapCategoryTreeNode({ id: 1, name: 'Root', description_en: 'Root text', children: [{ id: 2, name: 'Child', description_en: 'Child text' }] })
  assert.equal(tree.children[0].description_en, 'Child text')
})

test('all cached public size variants normalize units without changing pack names', () => {
  const sizes = ['100 г', '100 гр', '100 мл', '1000 мл', '100г', '100мл', 'MAX (300г)', 'MIDI (25г)', 'MIDI (30г)', 'MINI (35 гр)', 'STANDART (100г)', 'STANDART (70г)', 'STANDART (90г)', 'STANDART (95 гр)']
  for (const value of sizes) assert.doesNotMatch(metadata.localizedPackageSize(value, 'en'), /[А-Яа-я]/u)
  assert.equal(metadata.localizedPackageSize('MINI (35 гр)', 'en'), 'MINI (35 g)')
  assert.equal(metadata.localizedPackageSize('100 ml', 'uk'), '100 мл')
  assert.equal(metadata.localizedPackageSize('Custom packaging', 'en'), 'Custom packaging')
  assert.equal(metadata.localizedVolumeLabel({ volume_ml: 125, volume_label: '125 мл' }, 'en'), '125 ml')
  assert.equal(metadata.localizedVolumeLabel({ volume_ml: null, volume_label: '100 гр' }, 'en'), '100 g')
})

test('finite metadata glossary translates actual colors, leaves scent names and arbitrary content unchanged', () => {
  assert.equal(metadata.localizedMetadataValue('color', 'Бежевий', 'en'), 'Beige')
  assert.equal(metadata.localizedMetadataValue('Колір', 'Черный', 'en'), 'Black')
  for (const value of ['Artic Blue', 'Azur Lime', 'Cypress & Vetyver', 'Protective Aloe', 'Refresh', 'Refresh Eucalyptus', 'Sensitive Green Tea', 'Wood & Spice', 'Невідоме']) {
    assert.equal(metadata.localizedMetadataValue('color', value, 'en'), value)
  }
  assert.equal(metadata.localizedMetadataValue('brand', 'Бежевий', 'en'), 'Бежевий')
  assert.equal(metadata.localizedMetadataLabel('category:skin', 'Для шкіри', 'en'), 'Для шкіри')
  assert.equal(metadata.localizedMetadataLabel('constructor', 'Authored label', 'en'), 'Authored label')
  for (const name of ['Бренд', 'brand', 'Brand']) assert.equal(metadata.catalogCharacteristicKind(name), 'brand')
  for (const name of ['Категорія', 'Category', 'category']) assert.equal(metadata.catalogCharacteristicKind(name), 'category')
  for (const name of ['Код товару', 'Product code', 'sku']) assert.equal(metadata.catalogCharacteristicKind(name), 'code')
})

test('actual filter setup localizes selected chips and checkbox labels without changing selected slugs', async () => {
  const props = { groups: [{ slug: 'size', name: 'Розмір', values: [{ slug: '100-ml', name: '100 мл', count: 1 }] }, { slug: 'color', name: 'Колір', values: [{ slug: 'black', name: 'Черный', count: 1 }] }], selectedFilters: { size: ['100-ml'], color: ['black'] }, hideGroupCounts: [] }
  Object.assign(globalThis, vue, metadata, {
    defineProps: () => props, withDefaults: value => value, defineEmits: () => () => {},
    useShopLocale: () => ({ locale, terms: vue.ref({}) }),
  })
  const source = (await readFile(new URL('../components/catalog/CatalogFilterPanel.vue', import.meta.url), 'utf8')).split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '')
  const { selectedLabel } = await importSource(source + '\nexport { selectedLabel };')
  const chips = vue.computed(() => [selectedLabel('size', '100-ml'), selectedLabel('color', 'black')])
  locale.value = 'uk'
  assert.deepEqual(chips.value, [{ group: 'Розмір', value: '100 мл' }, { group: 'Колір', value: 'Черный' }])
  locale.value = 'en'
  assert.deepEqual(chips.value, [{ group: 'Size', value: '100 ml' }, { group: 'Color', value: 'Black' }])
  locale.value = 'uk'
  assert.equal(chips.value[0].group, 'Розмір')
  assert.deepEqual(props.selectedFilters, { size: ['100-ml'], color: ['black'] })
})

test('actual product characteristic computation filters source category/code keys in both locales and preserves brand values', async () => {
  const page = await readFile(new URL('../pages/products/[slug].vue', import.meta.url), 'utf8')
  const source = page.slice(page.indexOf('const isBrandCharacteristic ='), page.indexOf('\nconst toggleFavorite ='))
  const loaded = vue.ref({ brand: { name: 'Uppercut Deluxe' }, parameters: { Бренд: 'Uppercut Deluxe', Категорія: 'Догляд', 'Код товару': 'SKU-1', Розмір: '100 мл', Колір: 'Черный' }, package_size: '100 мл' })
  Object.assign(globalThis, vue, metadata, { product: loaded, locale, terms: vue.computed(() => ({ catalog: { brand: locale.value === 'en' ? 'Brand' : 'Бренд' } })) })
  const { characteristicEntries, isBrandCharacteristic } = await importSource(source + '\nexport { characteristicEntries, isBrandCharacteristic };')
  locale.value = 'uk'
  assert.deepEqual(characteristicEntries.value, [['Бренд', 'Uppercut Deluxe'], ['Розмір', '100 мл'], ['Колір', 'Черный']])
  locale.value = 'en'
  assert.deepEqual(characteristicEntries.value, [['Brand', 'Uppercut Deluxe'], ['Size', '100 ml'], ['Color', 'Black']])
  assert.equal(isBrandCharacteristic('Brand'), true)
  loaded.value.parameters = {}
  assert.deepEqual(characteristicEntries.value, [['Brand', 'Uppercut Deluxe'], ['Volume', '100 ml']])
  locale.value = 'uk'
  assert.deepEqual(characteristicEntries.value, [['Бренд', 'Uppercut Deluxe'], ['Об’єм', '100 мл']])
})
