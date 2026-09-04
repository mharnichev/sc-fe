import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const apiSource = await readFile(new URL('../composables/useBackofficeApi.ts', import.meta.url), 'utf8')
const stylesSource = await readFile(new URL('../assets/css/main.css', import.meta.url), 'utf8')
const productsSource = await readFile(new URL('../pages/products/index.vue', import.meta.url), 'utf8')
const categoriesSource = await readFile(new URL('../pages/categories.vue', import.meta.url), 'utf8')
const treeItemSource = await readFile(new URL('../components/CategoryTreeItem.vue', import.meta.url), 'utf8')
const brandsSource = await readFile(new URL('../pages/brands.vue', import.meta.url), 'utf8')
const loaderSource = await readFile(new URL('../components/BaseLoader.vue', import.meta.url), 'utf8')
const toggleSource = await readFile(new URL('../components/BaseToggle.vue', import.meta.url), 'utf8')
const tabsSource = await readFile(new URL('../components/BaseTabs.vue', import.meta.url), 'utf8')

test('backoffice API models effective visibility and category updates', () => {
  assert.match(apiSource, /is_effectively_visible: boolean/)
  assert.match(apiSource, /hidden_reason: 'product' \| 'category' \| 'parent_category' \| null/)
  assert.match(apiSource, /const updateCategory = .*\{ is_active: boolean \}/)
  assert.match(apiSource, /method: 'PUT'/)
  assert.match(apiSource, /updateCategory,/)
})

test('brand visibility uses the backoffice update contract and independent pending cards', () => {
  assert.match(apiSource, /export interface Brand[\s\S]*is_active: boolean/)
  assert.match(apiSource, /const updateBrand = .*payload: \{ is_active: boolean \}/)
  assert.match(apiSource, /updateBrand,/)
  assert.match(brandsSource, /pendingBrandIds = ref<Set<number>>/)
  assert.match(brandsSource, /api\.updateBrand\(brand\.id, \{ is_active: nextActive \}\)/)
  assert.match(brandsSource, /updated\.is_active !== nextActive/)
  assert.match(brandsSource, /Приховати/)
  assert.match(brandsSource, /Показати/)
})

test('product visibility uses independent pending rows and server-authoritative state', () => {
  assert.match(productsSource, /pendingVisibilityIds = ref<Set<number>>/)
  assert.match(productsSource, /api\.updateProduct\(product\.id, \{ is_active: !product\.is_active \}\)/)
  assert.match(productsSource, /HTMLInputElement\)\.checked = product\.is_active/)
  assert.match(productsSource, /<BaseToggle/)
  assert.match(productsSource, /await refresh\(\)/)
  assert.match(productsSource, /Причина: прихована батьківська категорія/)
  assert.match(productsSource, /return product\.is_effectively_visible \? 'Активний' : 'Прихований'/)
  assert.match(productsSource, /<th class="min-w-64">Видимість<\/th>/)
  assert.doesNotMatch(productsSource, /<th>Статус<\/th>/)
  assert.doesNotMatch(productsSource, /data-label="Статус"/)
  assert.match(productsSource, /Показані/)
  assert.match(productsSource, /Приховані/)
})

test('product filters use base selects, submit on enter, and accept a brand query', () => {
  assert.match(productsSource, /normalizeBrandQuery\(route\.query\.brand_id\)/)
  assert.match(productsSource, /<BaseFilterPanel[\s\S]*?@apply="applyFilters"/)
  assert.match(productsSource, /<BaseSelect v-model="filters\.brand_id" :options="brandOptions"/)
  assert.doesNotMatch(productsSource, /<BaseSelect native v-model="filters\.(?:category_id|brand_id|is_active)"/)
  assert.match(productsSource, /fields-class="md:grid-cols-2"/)
  assert.doesNotMatch(productsSource, /xl:grid-cols-5/)
  assert.match(brandsSource, /path: '\/products', query: \{ brand_id: String\(item\.id\) \}/)
})

test('BaseToggle exposes switch semantics and controlled change events', () => {
  assert.match(toggleSource, /role="switch"/)
  assert.match(toggleSource, /:checked="isChecked"/)
  assert.match(toggleSource, /'update:modelValue': \[value: boolean\]/)
  assert.match(toggleSource, /emit\('change', event\)/)
  assert.match(toggleSource, /loadingLabel: 'Оновлення…'/)
  assert.match(toggleSource, /:disabled="isUnavailable"/)
  assert.match(toggleSource, /:aria-busy="loading \|\| undefined"/)
  assert.match(toggleSource, /<BaseLoader/)
  assert.match(toggleSource, /class="base-toggle__loader"/)
  assert.match(loaderSource, /:is="as"/)
  assert.match(loaderSource, /:class="labelClass"/)
  assert.match(productsSource, /:loading="isVisibilityPending\(item\.id\)"/)
  assert.doesNotMatch(productsSource, /v-if="isVisibilityPending\(item\.id\)" class="text-xs text-ui-muted"/)
  assert.match(categoriesSource, /:loading="isCategoryPending\(item\.id\)"/)
  assert.match(treeItemSource, /:loading="pendingIds\.has\(node\.id\)"/)
})

test('primary buttons and active toggles use the green action palette', () => {
  assert.match(stylesSource, /--bo-action: #6fa77f;/)
  assert.match(stylesSource, /--bo-action: #477a57;/)
  assert.match(stylesSource, /\.base-button--primary \{[\s\S]*?background: var\(--bo-action\);[\s\S]*?color: var\(--bo-on-action\)/)
  assert.match(stylesSource, /\.base-toggle__input:checked \+ \.base-toggle__track \{[\s\S]*?background: var\(--bo-action\);/)
  assert.match(stylesSource, /\.base-toggle__loader \.base-loader__spinner \{[\s\S]*?border-top-color: var\(--bo-action\);/)
})

test('the global accent and legacy cyan utilities render without turquoise', () => {
  assert.match(stylesSource, /--bo-accent: #6fa77f;/)
  assert.match(stylesSource, /--bo-accent: #477a57;/)
  assert.match(stylesSource, /--bo-info: #60a5fa;/)
  assert.match(stylesSource, /--bo-info: #2563eb;/)
  assert.match(stylesSource, /\.bg-cyan-500,[\s\S]*?background-color: var\(--bo-accent\) !important;/)
  assert.match(stylesSource, /\[class~="focus:ring-cyan-500"\]:focus,[\s\S]*?--tw-ring-color: var\(--bo-focus-border\) !important;/)
  assert.doesNotMatch(stylesSource, /#(?:8be9f7|b4f4ff|67d9ea|64d2ff|a7e7ff|0e7490|155e75|164e63|087ea4|0891b2)/i)
  assert.doesNotMatch(stylesSource, /#(?:30d158|4adf69|26b94a|248a3d|1d7632|176229|16a34a|15803d)/i)
})

test('category views use accessible BaseTabs and render one panel at a time', () => {
  assert.match(tabsSource, /role="tablist"/)
  assert.match(tabsSource, /role="tab"/)
  assert.match(tabsSource, /ArrowLeft/)
  assert.match(tabsSource, /ArrowRight/)
  assert.match(categoriesSource, /<BaseTabs v-model="activeView"/)
  assert.match(categoriesSource, /v-if="activeTab === 'flat'"/)
  assert.match(categoriesSource, /role="tabpanel"/)
  assert.match(categoriesSource, /v-else/)
})

test('category status filter uses the custom BaseSelect options API', () => {
  assert.match(categoriesSource, /const categoryStatusOptions = \[/)
  assert.match(categoriesSource, /<BaseSelect[\s\S]*?v-model="filters\.is_active"[\s\S]*?:options="categoryStatusOptions"/)
  assert.doesNotMatch(categoriesSource, /<BaseSelect native v-model="filters\.is_active"/)
})

test('category visibility confirms hides and refreshes flat and recursive views', () => {
  assert.match(categoriesSource, /pendingCategoryIds = ref<Set<number>>/)
  assert.match(categoriesSource, /Promise\.all\(\[refresh\(\), refreshTree\(\)\]\)/)
  assert.match(categoriesSource, /<ConfirmActionModal/)
  assert.match(categoriesSource, /Категорія і вся її гілка будуть приховані з shop/)
  assert.match(categoriesSource, /if \(await updateCategoryVisibility\(category\)\) categoryToHide\.value = null/)
  assert.match(categoriesSource, /<BaseToggle/)
  assert.match(categoriesSource, /handleCategoryVisibilityChange\(item, \$event\)/)
  assert.match(treeItemSource, /<BaseToggle/)
  assert.match(treeItemSource, /@change="handleVisibilityChange"/)
  assert.doesNotMatch(treeItemSource, /<BaseButton/)
  assert.match(treeItemSource, /pendingIds\.has\(node\.id\)/)
  assert.match(treeItemSource, /Прихована батьківською категорією/)
  assert.match(treeItemSource, /Рівень \{\{ depth \+ 1 \}\}/)
  assert.match(treeItemSource, /:depth="depth \+ 1"/)
  assert.match(treeItemSource, /category-tree-children/)
})

test('category list labels do not repeat the visible section heading', () => {
  assert.equal(categoriesSource.match(/Плоский список/g)?.length, 1)
  assert.match(categoriesSource, /caption="Таблиця категорій"/)
})
