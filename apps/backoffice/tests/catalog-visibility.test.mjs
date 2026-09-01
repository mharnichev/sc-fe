import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const apiSource = await readFile(new URL('../composables/useBackofficeApi.ts', import.meta.url), 'utf8')
const productsSource = await readFile(new URL('../pages/products/index.vue', import.meta.url), 'utf8')
const categoriesSource = await readFile(new URL('../pages/categories.vue', import.meta.url), 'utf8')
const treeItemSource = await readFile(new URL('../components/CategoryTreeItem.vue', import.meta.url), 'utf8')

test('backoffice API models effective visibility and category updates', () => {
  assert.match(apiSource, /is_effectively_visible: boolean/)
  assert.match(apiSource, /hidden_reason: 'product' \| 'category' \| 'parent_category' \| null/)
  assert.match(apiSource, /const updateCategory = .*\{ is_active: boolean \}/)
  assert.match(apiSource, /method: 'PUT'/)
  assert.match(apiSource, /updateCategory,/)
})

test('product visibility uses independent pending rows and server-authoritative state', () => {
  assert.match(productsSource, /pendingVisibilityIds = ref<Set<number>>/)
  assert.match(productsSource, /api\.updateProduct\(product\.id, \{ is_active: !product\.is_active \}\)/)
  assert.match(productsSource, /HTMLInputElement\)\.checked = product\.is_active/)
  assert.match(productsSource, /await refresh\(\)/)
  assert.match(productsSource, /Прихований батьківською категорією/)
  assert.match(productsSource, /Показані/)
  assert.match(productsSource, /Приховані/)
})

test('category visibility confirms hides and refreshes flat and recursive views', () => {
  assert.match(categoriesSource, /pendingCategoryIds = ref<Set<number>>/)
  assert.match(categoriesSource, /Promise\.all\(\[refresh\(\), refreshTree\(\)\]\)/)
  assert.match(categoriesSource, /<ConfirmActionModal/)
  assert.match(categoriesSource, /Категорія і вся її гілка будуть приховані з shop/)
  assert.match(categoriesSource, /if \(await updateCategoryVisibility\(category\)\) categoryToHide\.value = null/)
  assert.match(treeItemSource, /@toggle="emit\('toggle', \$event\)"/)
  assert.match(treeItemSource, /pendingIds\.has\(node\.id\)/)
  assert.match(treeItemSource, /Прихована батьківською категорією/)
})
