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
const brand = ref(category.value ? '' : readQueryValue(route.query.brand))
const priceMin = ref(readQueryValue(route.query.priceMin) || readQueryValue(route.query.price_min))
const priceMax = ref(readQueryValue(route.query.priceMax) || readQueryValue(route.query.price_max))
const selectedFilters = reactive<Record<string, string[]>>({})
const isFilterDrawerOpen = ref(false)
let applyTimer: ReturnType<typeof setTimeout> | undefined

const syncSelectedFiltersFromRoute = () => {
  for (const key of Object.keys(selectedFilters)) delete selectedFilters[key]
  for (const [key, value] of Object.entries(route.query)) {
    if (!reservedQueryKeys.has(key) || (key === 'brand' && category.value)) {
      const values = readQueryList(value)
      if (values.length) selectedFilters[key] = values
    }
  }
}

syncSelectedFiltersFromRoute()

const [{ data: categoryTree }, { data: brands }] = await Promise.all([
  useAsyncData('shop-category-tree-all-goods', domain.getCategoryTree),
  useAsyncData('shop-brands-all-goods', () => domain.getBrands({ hasActiveProducts: true })),
])

const brandSlugs = computed(() => new Set((brands.value || []).map(item => item.slug)))
const isBrandCategoryBranch = (node: CategoryTreeNodeDto) =>
  node.slug === 'brendi'
  || node.name.trim().toLocaleUpperCase('uk-UA') === 'БРЕНДИ'
  || (node.children.length > 0 && node.children.every(child => brandSlugs.value.has(child.slug)))

const buildCategoryFilterGroups = (
  nodes: CategoryTreeNodeDto[] = [],
  isRoot = true,
): CategoryFilterGroupDto[] => nodes.flatMap((node) => {
  if (isBrandCategoryBranch(node)) return []

  const directLeafValues = node.children
    .filter(child => !child.children.length)
    .map(child => ({ slug: child.slug, name: child.name, count: 0 }))
  const standaloneRootValues = isRoot && !node.children.length
    ? [{ slug: node.slug, name: node.name, count: 0 }]
    : []
  const values = directLeafValues.length ? directLeafValues : standaloneRootValues
  const currentGroup: CategoryFilterGroupDto[] = values.length
    ? [{ slug: `category:${node.slug}`, name: node.name, values }]
    : []

  return [
    ...currentGroup,
    ...buildCategoryFilterGroups(node.children, false),
  ]
})

const categoryFilterGroups = computed<CategoryFilterGroupDto[]>(() =>
  buildCategoryFilterGroups(categoryTree.value || []),
)
const brandFilterGroup = computed<CategoryFilterGroupDto>(() => ({
  slug: 'brand',
  name: terms.value.catalog.brand,
  values: (brands.value || []).map(item => ({
    slug: item.slug,
    name: item.name,
    count: 0,
  })),
}))

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
const filterGroups = computed<CategoryFilterGroupDto[]>(() =>
  category.value
    ? [...categoryFilterGroups.value, ...facetGroups.value]
    : [...categoryFilterGroups.value, brandFilterGroup.value],
)
const selectedCategoryGroup = computed(() =>
  categoryFilterGroups.value.find(group => group.values.some(value => value.slug === category.value)),
)
const panelSelectedFilters = computed<Record<string, string[]>>(() => ({
  ...selectedFilters,
  ...(category.value && selectedCategoryGroup.value
    ? { [selectedCategoryGroup.value.slug]: [category.value] }
    : {}),
  ...(!category.value && brand.value ? { brand: [brand.value] } : {}),
}))
const groupsWithoutCounts = computed(() =>
  category.value
    ? categoryFilterGroups.value.map(group => group.slug)
    : [...categoryFilterGroups.value.map(group => group.slug), 'brand'],
)
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
  if (group.startsWith('category:')) {
    void updateCategory(checked ? value : '')
    return
  }

  if (group === 'brand' && !category.value) {
    updateBrand(checked ? value : '')
    return
  }

  if (checked) selectedFilters[group] = [value]
  else delete selectedFilters[group]
  resetOffset()
  void applyState()
}

const removeFilter = (group: string, value: string) => {
  if (group.startsWith('category:')) {
    void updateCategory('')
    return
  }

  if (group === 'brand' && !category.value) {
    updateBrand('')
    return
  }

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

watch(
  () => readQueryValue(route.query.q),
  async (nextQuery) => {
    if (nextQuery === query.value) return

    limit.value = readIntegerQuery(route.query.limit, DEFAULT_LIMIT) || DEFAULT_LIMIT
    offset.value = readIntegerQuery(route.query.offset, 0)
    ordering.value = readQueryValue(route.query.ordering) || readQueryValue(route.query.sort)
    query.value = nextQuery
    category.value = readQueryValue(route.query.category)
    brand.value = category.value ? '' : readQueryValue(route.query.brand)
    priceMin.value = readQueryValue(route.query.priceMin) || readQueryValue(route.query.price_min)
    priceMax.value = readQueryValue(route.query.priceMax) || readQueryValue(route.query.price_max)
    syncSelectedFiltersFromRoute()

    await refreshCategoryFacets()
    await refreshProducts()
  },
)

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
          <p v-if="topOnly" class="type-eyebrow type-eyebrow--wide text-xs">{{ terms.home.popularEyebrow }}</p>
          <h1 class="catalog-route__title section-title type-title-strong">
            <BaseScribbleOutline>{{ topOnly ? terms.home.popularTitle : terms.catalog.title }}</BaseScribbleOutline>
          </h1>
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

        <div class="catalog-route__head-actions">
          <p class="catalog-route__count">{{ terms.catalog.productCount(total) }}</p>

          <button class="catalog-route__head-filter-btn" type="button" @click="isFilterDrawerOpen = true">
            <BaseIcon name="filter" size="xs" />
            <span v-if="selectedFilterCount" class="catalog-route__filter-count">{{ selectedFilterCount }}</span>
          </button>
        </div>
      </div>

      <div class="catalog-route__body">
        <div class="catalog-route__left-side-bar-wrapper">
          <CatalogFilterPanel
            class="catalog-route__left-side-bar is-filtered"
            :groups="filterGroups"
            :price="priceBounds"
            :selected-filters="panelSelectedFilters"
            :price-min="priceMin"
            :price-max="priceMax"
            :pending="filtersPending"
            :disabled="productsPending"
            :show-price="Boolean(category)"
            :hide-group-counts="groupsWithoutCounts"
            :query="query"
            @update:price-min="priceMin = $event"
            @update:price-max="priceMax = $event"
            @price-change="scheduleApplyState"
            @toggle-filter="setFilter"
            @remove-filter="removeFilter"
            @clear="clearFilters"
          />
        </div>

        <div class="catalog-route__content">
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
          :groups="filterGroups"
          :price="priceBounds"
          :selected-filters="panelSelectedFilters"
          :price-min="priceMin"
          :price-max="priceMax"
          :pending="filtersPending"
          :disabled="productsPending"
          :show-price="Boolean(category)"
          :hide-group-counts="groupsWithoutCounts"
          :query="query"
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

.type-eyebrow + .catalog-route__title {
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

.catalog-route__head-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-left: auto;
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
  max-width: 280px;
  flex: 0 0 280px;
}

.catalog-route__left-side-bar {
  width: 280px;
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
  color: #737373;
  font-size: 0.875rem;
  font-weight: 700;
  white-space: nowrap;
}

.catalog-route__empty {
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
