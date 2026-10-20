import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const vue = await import(pathToFileURL(createRequire(require.resolve('nuxt/package.json')).resolve('vue')).href)
const importSource = source => import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64')}`)
const localization = await importSource(await readFile(new URL('../utils/category-localization.ts', import.meta.url), 'utf8'))
const locale = vue.ref('uk')
Object.assign(globalThis, localization, { useShopLocale: () => ({ locale }) })
const { useCategoryDisplay } = await importSource((await readFile(new URL('../composables/useCategoryDisplay.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, ''))
const categorySource = (await readFile(new URL('../domain/catalog.ts', import.meta.url), 'utf8')).split('export const useCatalogDomain =')[0].replace("import { resolveApiAssetUrl } from '@shared-utils'", '')
const mapping = await importSource(categorySource + '\nexport { mapCategoryTreeNode, mapFlatCategoriesToTree, mapProduct };')
const routing = await importSource(await readFile(new URL('../utils/category-routing.ts', import.meta.url), 'utf8'))

const root = { id: 1, name: 'Косметика', name_en: 'Cosmetics', slug: 'cosmetics', children: [
  { id: 2, name: 'Для тіла', name_en: 'Body care', slug: 'body', children: [
    { id: 3, name: 'Гігієна', name_en: null, slug: 'hygiene' },
  ] },
] }

test('nested and flat category mappings retain English labels and original path identifiers', () => {
  const tree = mapping.mapCategoryTreeNode(root)
  assert.equal(tree.name, 'Косметика')
  assert.equal(tree.name_en, 'Cosmetics')
  assert.equal(tree.children[0].name_en, 'Body care')
  assert.equal(tree.children[0].children[0].name_en, null)
  const flat = mapping.mapFlatCategoriesToTree([{ ...root, children: undefined }, { ...root.children[0], parent_id: 1, children: undefined }])
  assert.equal(flat[0].children[0].name_en, 'Body care')
  assert.equal(routing.categoryLandingPath(routing.categoryPathBySlug([tree], 'hygiene')), '/cosmetics/body/hygiene')
})

test('breadcrumb chains, headings and nested child labels react UK → EN → UK without refetch', () => {
  const tree = mapping.mapCategoryTreeNode(root)
  const path = routing.categoryPathBySlug([tree], 'hygiene')
  const { categoryDisplayName } = useCategoryDisplay()
  const breadcrumbs = vue.computed(() => path.map(category => ({ id: category.id, name: categoryDisplayName(category), slug: category.slug })))
  assert.deepEqual(breadcrumbs.value.map(item => item.name), ['Косметика', 'Для тіла', 'Гігієна'])
  locale.value = 'en'
  assert.deepEqual(breadcrumbs.value.map(item => item.name), ['Cosmetics', 'Body care', 'Гігієна'])
  assert.equal(categoryDisplayName(tree.children[0]), 'Body care')
  assert.deepEqual(breadcrumbs.value.map(item => item.slug), ['cosmetics', 'body', 'hygiene'])
  locale.value = 'uk'
  assert.deepEqual(breadcrumbs.value.map(item => item.name), ['Косметика', 'Для тіла', 'Гігієна'])
  assert.equal(tree.name, 'Косметика')
})

test('nested product category and category path preserve translations and safe legacy fallback', () => {
  const product = mapping.mapProduct({ id: 1, name: 'Товар', price: 100, category: root, category_tree: [root, root.children[0]], slug: 'item' }, value => value)
  assert.equal(product.category.name_en, 'Cosmetics')
  assert.equal(product.category_tree[1].name_en, 'Body care')
  for (const name_en of [undefined, null, '', '   ']) assert.equal(localization.localizedCategoryName({ name: 'Гігієна', name_en }, 'en'), 'Гігієна')
})

test('category-only search suggestion chips react UK → EN → UK and retain unknown original values', async () => {
  const productLocalization = await importSource((await readFile(new URL('../utils/product-localization.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, ''))
  const results = { suggestions: ['Для тіла', 'Невідоме'], products: [], categories: [{ id: 2, name: 'Для тіла', name_en: 'Body care', slug: 'body' }] }
  Object.assign(globalThis, vue, productLocalization, {
    useCategoryDisplay,
    defineProps: () => ({ results }),
    defineEmits: () => () => {},
    useShopLocale: () => ({ locale, terms: vue.ref({}) }),
  })
  const source = (await readFile(new URL('../components/base/header/HeaderSearchResults.vue', import.meta.url), 'utf8'))
    .split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '')
  const { suggestionLabel } = await importSource(source + '\nexport { suggestionLabel };')
  const labels = vue.computed(() => results.suggestions.map(suggestionLabel))
  locale.value = 'uk'
  assert.deepEqual(labels.value, ['Для тіла', 'Невідоме'])
  locale.value = 'en'
  assert.deepEqual(labels.value, ['Body care', 'Невідоме'])
  locale.value = 'uk'
  assert.deepEqual(labels.value, ['Для тіла', 'Невідоме'])
  assert.deepEqual(results.suggestions, ['Для тіла', 'Невідоме'])
  assert.match(await readFile(new URL('../components/base/header/HeaderSearchResults.vue', import.meta.url), 'utf8'), /@click="emit\('suggestion', suggestion\)"/)
})
