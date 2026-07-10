<script setup lang="ts">
import type { CategoryFilterGroupDto, CategoryTreeNodeDto } from '@shared-types'
import FeedbackState from '~/components/ui/FeedbackState.vue'

const DEFAULT_LIMIT = 20
const reservedQueryKeys = new Set([
  'page',
  'page_size',
  'limit',
  'offset',
  'category',
  'brand',
  'q',
  'sort',
  'ordering',
  'priceMin',
  'priceMax',
  'price_min',
  'price_max',
  'is_top',
])

const props = withDefaults(defineProps<{
  topOnly?: boolean
}>(), {
  topOnly: false,
})

const route = useRoute()
const router = useRouter()
const domain = useCatalogDomain()
const { terms } = useShopLocale()

const readQueryValue = (value: unknown) =>
  Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '')

const readQueryList = (value: unknown) => {
  const raw = Array.isArray(value) ? value.join(',') : String(value ?? '')
  return raw.split(',').map(item => item.trim()).filter(Boolean)
}

const readIntegerQuery = (value: unknown, fallback: number) => {
  const numeric = Number(readQueryValue(value))
  return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : fallback
}

const limit = ref(readIntegerQuery(route.query.limit, DEFAULT_LIMIT) || DEFAULT_LIMIT)
const offset = ref(readIntegerQuery(route.query.offset, 0))
const ordering = ref(
  readQueryValue(route.query.ordering)
  || readQueryValue(route.query.sort)
  || (props.topOnly ? '-is_top' : ''),
)
const query = ref(readQueryValue(route.query.q))
const category = ref(readQueryValue(route.query.category))
const brand = ref(readQueryValue(route.query.brand))
const priceMin = ref(readQueryValue(route.query.priceMin) || readQueryValue(route.query.price_min))
const priceMax = ref(readQueryValue(route.query.priceMax) || readQueryValue(route.query.price_max))
const selectedFilters = reactive<Record<string, string[]>>({})
const isFilterDrawerOpen = ref(false)
let applyTimer: ReturnType<typeof setTimeout> | undefined

for (const [key, value] of Object.entries(route.query)) {
  if (!reservedQueryKeys.has(key)) {
    const values = readQueryList(value)
    if (values.length) selectedFilters[key] = values
  }
}

const [{ data: categoryTree }, { data: brands }] = await Promise.all([
  useAsyncData('shop-category-tree-all-goods', domain.getCategoryTree),
  useAsyncData('shop-brands-all-goods', () => domain.getBrands({ hasActiveProducts: true })),
])

const flattenCategories = (nodes: CategoryTreeNodeDto[] = [], depth = 0): Array<{ label: string, value: string }> =>
  nodes.flatMap(node => [
    { label: `${depth ? `${'  '.repeat(depth)}- ` : ''}${node.name}`, value: node.slug },
    ...flattenCategories(node.children, depth + 1),
  ])

const categoryOptions = computed(() => flattenCategories(categoryTree.value || []))
const brandOptions = computed(() =>
  (brands.value || []).map(item => ({ label: item.name, value: item.slug })),
)

const buildDynamicQuery = () =>
  Object.fromEntries(
    Object.entries(selectedFilters)
      .filter(([, values]) => values.length > 0)
      .map(([key, values]) => [key, values]),
  )

const buildApiQuery = () => ({
  q: query.value || undefined,
  limit: limit.value,
  offset: offset.value,
  ordering: ordering.value || undefined,
  priceMin: priceMin.value || undefined,
  priceMax: priceMax.value || undefined,
  is_top: props.topOnly || undefined,
  ...buildDynamicQuery(),
})

const buildRouteQuery = () => {
  const nextQuery: Record<string, string> = {
    limit: String(limit.value),
    offset: String(offset.value),
  }

  if (ordering.value) nextQuery.ordering = ordering.value
  if (query.value) nextQuery.q = query.value
  if (category.value) nextQuery.category = category.value
  if (brand.value && !category.value) nextQuery.brand = brand.value
  if (priceMin.value) nextQuery.priceMin = priceMin.value
  if (priceMax.value) nextQuery.priceMax = priceMax.value
  for (const [key, values] of Object.entries(selectedFilters)) {
    if (values.length) nextQuery[key] = values.join(',')
  }

  return nextQuery
}

const { data: categoryFacets, pending: filtersPending, refresh: refreshCategoryFacets } = await useAsyncData(
  props.topOnly ? 'shop-top-all-goods-facets' : 'shop-catalog-all-goods-facets',
  async () => category.value
    ? await domain.getCategoryFilters(category.value, { is_top: props.topOnly || undefined })
    : { price: { min: null, max: null }, filters: {} },
  { watch: [] },
)

const { data: productsPage, pending: productsPending, refresh: refreshProducts } = await useAsyncData(
  props.topOnly ? 'shop-top-all-goods-products' : 'shop-catalog-all-goods-products',
  () => category.value
    ? domain.getCategoryProducts(category.value, buildApiQuery())
    : domain.getProductsPage({
        q: query.value || undefined,
        limit: limit.value,
        offset: offset.value,
        ordering: ordering.value || undefined,
        brand_slug: brand.value || undefined,
        is_top: props.topOnly || undefined,
      }),
  { watch: [] },
)

const products = computed(() => productsPage.value?.items || [])
const total = computed(() => productsPage.value?.total || 0)
const facetGroups = computed<CategoryFilterGroupDto[]>(() => Object.values(categoryFacets.value?.filters || {}))
const priceBounds = computed(() => categoryFacets.value?.price || null)
const selectedFilterCount = computed(() =>
  Object.values(selectedFilters).reduce((sum, values) => sum + values.length, 0)
  + Number(Boolean(query.value))
  + Number(Boolean(category.value))
  + Number(Boolean(brand.value && !category.value))
  + Number(Boolean(priceMin.value || priceMax.value)),
)
const isPending = computed(() => productsPending.value || filtersPending.value)

const applyState = async () => {
  if (applyTimer) {
    clearTimeout(applyTimer)
    applyTimer = undefined
  }

  await router.replace({ path: route.path, query: buildRouteQuery() })
  await refreshProducts()
}

const scheduleApplyState = () => {
  if (applyTimer) clearTimeout(applyTimer)
  applyTimer = setTimeout(() => void applyState(), 250)
}

const resetOffset = () => {
  offset.value = 0
}

const updateQuery = (value: string) => {
  query.value = value
  resetOffset()
  scheduleApplyState()
}

const updateBrand = (value: string) => {
  brand.value = value
  resetOffset()
  scheduleApplyState()
}

const updateCategory = async (value: string) => {
  category.value = value
  brand.value = ''
  priceMin.value = ''
  priceMax.value = ''
  for (const key of Object.keys(selectedFilters)) delete selectedFilters[key]
  resetOffset()
  await refreshCategoryFacets()
  await applyState()
}

const setOrdering = async (value: string) => {
  ordering.value = value
  resetOffset()
  await applyState()
}

const setFilter = (group: string, value: string, checked: boolean) => {
  if (checked) selectedFilters[group] = [value]
  else delete selectedFilters[group]
  resetOffset()
  void applyState()
}

const removeFilter = (group: string, value: string) => {
  const next = (selectedFilters[group] || []).filter(item => item !== value)
  if (next.length) selectedFilters[group] = next
  else delete selectedFilters[group]
  resetOffset()
  void applyState()
}

const clearFilters = async () => {
  query.value = ''
  category.value = ''
  brand.value = ''
  priceMin.value = ''
  priceMax.value = ''
  for (const key of Object.keys(selectedFilters)) delete selectedFilters[key]
  resetOffset()
  await refreshCategoryFacets()
  await applyState()
}

const changePage = async (page: number) => {
  offset.value = (page - 1) * limit.value
  await applyState()
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}

watch([priceMin, priceMax], resetOffset)

onBeforeUnmount(() => {
  if (applyTimer) clearTimeout(applyTimer)
})

useSeo(
  () => props.topOnly ? terms.value.home.popularTitle : terms.value.seo.catalogTitle,
  () => props.topOnly ? terms.value.home.popularDescription : terms.value.seo.catalogDescription,
)
</script>

<template>
  <section class="catalog-route">
    <div class="catalog-route__container">
      <div class="catalog-route__title-wrapper">
        <div>
          <p v-if="topOnly" class="catalog-route__eyebrow">{{ terms.home.popularEyebrow }}</p>
          <h1 class="catalog-route__title">{{ topOnly ? terms.home.popularTitle : terms.catalog.title }}</h1>
          <p v-if="topOnly" class="catalog-route__description">{{ terms.home.popularDescription }}</p>
        </div>
      </div>

      <div class="catalog-route__head-side-bar">
        <CatalogSortTabs
          class="catalog-route__tab-list"
          :model-value="ordering"
          :disabled="productsPending"
          @update:model-value="setOrdering"
        />

        <button class="catalog-route__head-filter-btn" type="button" @click="isFilterDrawerOpen = true">
          <BaseIcon name="filter" size="xs" />
          <span v-if="selectedFilterCount" class="catalog-route__filter-count">{{ selectedFilterCount }}</span>
        </button>
      </div>

      <div class="catalog-route__body">
        <div class="catalog-route__left-side-bar-wrapper">
          <CatalogFilterPanel
            class="catalog-route__left-side-bar is-filtered"
            :groups="facetGroups"
            :price="priceBounds"
            :selected-filters="selectedFilters"
            :price-min="priceMin"
            :price-max="priceMax"
            :pending="filtersPending"
            :disabled="productsPending"
            show-catalog-controls
            :show-price="Boolean(category)"
            :query="query"
            :category="category"
            :brand="brand"
            :category-options="categoryOptions"
            :brand-options="brandOptions"
            @update:query="updateQuery"
            @update:category="updateCategory"
            @update:brand="updateBrand"
            @update:price-min="priceMin = $event"
            @update:price-max="priceMax = $event"
            @price-change="scheduleApplyState"
            @toggle-filter="setFilter"
            @remove-filter="removeFilter"
            @clear="clearFilters"
          />
        </div>

        <div class="catalog-route__content">
          <p class="catalog-route__count">{{ terms.catalog.productCount(total) }}</p>

          <CatalogProductGrid
            :products="products"
            :pending="productsPending"
            :skeleton-count="limit"
          />

          <FeedbackState
            v-if="!productsPending && !products.length"
            class="catalog-route__empty"
            kind="search"
            :seed="String(route.fullPath)"
            :title="terms.catalog.empty"
          />

          <CatalogPagination
            :total="total"
            :limit="limit"
            :offset="offset"
            :disabled="isPending"
            @update:page="changePage"
          />
        </div>
      </div>
    </div>

    <BaseModal
      v-model="isFilterDrawerOpen"
      full-height
      type="right"
      root-class="catalog-filter-drawer"
      content-type="secondary"
    >
      <template #header-title>{{ terms.catalog.filters }}</template>
      <div class="catalog-route__mobile-filters">
        <CatalogFilterPanel
          :groups="facetGroups"
          :price="priceBounds"
          :selected-filters="selectedFilters"
          :price-min="priceMin"
          :price-max="priceMax"
          :pending="filtersPending"
          :disabled="productsPending"
          show-catalog-controls
          :show-price="Boolean(category)"
          :query="query"
          :category="category"
          :brand="brand"
          :category-options="categoryOptions"
          :brand-options="brandOptions"
          @update:query="updateQuery"
          @update:category="updateCategory"
          @update:brand="updateBrand"
          @update:price-min="priceMin = $event"
          @update:price-max="priceMax = $event"
          @price-change="scheduleApplyState"
          @toggle-filter="setFilter"
          @remove-filter="removeFilter"
          @clear="clearFilters"
        />
      </div>
    </BaseModal>
  </section>
</template>

<style scoped>
.catalog-route {
  color: #0a0a0a;
}

.catalog-route__container {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.catalog-route__title-wrapper {
  display: flex;
  min-height: 4.5rem;
  align-items: center;
}

.catalog-route__eyebrow {
  color: #d97706;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
}

.catalog-route__title {
  color: #0a0a0a;
  font-size: clamp(1.5rem, 1.1rem + 1.4vw, 2.375rem);
  font-weight: 800;
  line-height: 1.1;
}

.catalog-route__eyebrow + .catalog-route__title {
  margin-top: 0.4rem;
}

.catalog-route__description {
  max-width: 42rem;
  padding-top: 0.5rem;
  color: #737373;
  font-size: 0.875rem;
  line-height: 1.6;
}

.catalog-route__head-side-bar {
  position: sticky;
  top: 4.75rem;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.375rem 0;
  background: #ffffff;
}

.catalog-route__tab-list {
  flex: 0 1 auto;
}

.catalog-route__head-filter-btn {
  position: relative;
  display: inline-flex;
  width: 2.75rem;
  height: 2.75rem;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(10 10 10 / 0.12);
  border-radius: 0;
  background: #ffffff;
  color: #0a0a0a;
}

.catalog-route__filter-count {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  display: inline-flex;
  min-width: 1rem;
  height: 1rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: #0a0a0a;
  color: #ffffff;
  font-size: 0.625rem;
  font-weight: 900;
  line-height: 1;
}

.catalog-route__body {
  display: flex;
  gap: 0.75rem;
  padding-top: 0.75rem;
}

.catalog-route__left-side-bar-wrapper {
  display: none;
  width: 100%;
  max-width: 300px;
  flex: 0 0 300px;
}

.catalog-route__left-side-bar {
  width: 300px;
}

.catalog-route__left-side-bar.is-filtered {
  position: sticky;
  top: 130px;
  height: calc(100vh - 110px);
  overflow-y: auto;
  padding-bottom: 42px;
}

.catalog-route__content {
  min-width: 0;
  width: 100%;
}

.catalog-route__count {
  padding-bottom: 0.75rem;
  color: #737373;
  font-size: 0.875rem;
  font-weight: 700;
}

.catalog-route__empty {
  border: 1px solid rgb(10 10 10 / 0.1);
  background: #ffffff;
  --feedback-state-surface: #ffffff;
  color: #0a0a0a;
}

.catalog-route__mobile-filters {
  padding: 0.5rem;
}

@media (min-width: 1024px) {
  .catalog-route__head-filter-btn {
    display: none;
  }

  .catalog-route__left-side-bar-wrapper {
    display: block;
  }
}
</style>
