<script setup lang="ts">
import type { CategoryFilterGroupDto } from '@shared-types'
import FeedbackState from '~/components/ui/FeedbackState.vue'
import {
  categoryGoodsPath,
  categoryLandingPath,
  categoryPathBySegments,
  type CategoryRouteCrumb,
} from '~/utils/category-routing'

const DEFAULT_LIMIT = 20
const reservedQueryKeys = new Set([
  'page',
  'page_size',
  'limit',
  'offset',
  'sort',
  'ordering',
  'priceMin',
  'priceMax',
  'price_min',
  'price_max',
])

const props = defineProps<{
  segments: string[]
}>()

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

const slugSegments = computed(() => props.segments.map(item => String(item || '')).filter(Boolean))
const categorySlug = computed(() => slugSegments.value[slugSegments.value.length - 1] || '')

const limit = ref(readIntegerQuery(route.query.limit, DEFAULT_LIMIT) || DEFAULT_LIMIT)
const offset = ref(readIntegerQuery(route.query.offset, 0))
const ordering = ref(readQueryValue(route.query.ordering) || readQueryValue(route.query.sort))
const priceMin = ref(readQueryValue(route.query.priceMin) || readQueryValue(route.query.price_min))
const priceMax = ref(readQueryValue(route.query.priceMax) || readQueryValue(route.query.price_max))
const selectedFilters = reactive<Record<string, string[]>>({})
const isFilterDrawerOpen = ref(false)
let applyTimer: ReturnType<typeof setTimeout> | undefined

const syncSelectedFiltersFromQuery = () => {
  for (const key of Object.keys(selectedFilters)) delete selectedFilters[key]
  for (const [key, value] of Object.entries(route.query)) {
    if (!reservedQueryKeys.has(key)) {
      const values = readQueryList(value)
      if (values.length) selectedFilters[key] = values
    }
  }
}

syncSelectedFiltersFromQuery()

const { data: categoryTree } = await useAsyncData('shop-category-tree-catalog-routes', domain.getCategoryTree)
const categoryPath = computed(() => categoryPathBySegments(categoryTree.value || [], slugSegments.value))
const currentCategory = computed(() => categoryPath.value[categoryPath.value.length - 1] || null)

if (!categorySlug.value || !categoryPath.value.length) {
  throw createError({ statusCode: 404, statusMessage: 'Category not found' })
}

const breadcrumbs = computed<CategoryRouteCrumb[]>(() =>
  categoryPath.value.map((category, index, path) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    to: index < path.length - 1 ? categoryLandingPath(path.slice(0, index + 1)) : undefined,
  })),
)

const buildDynamicQuery = () =>
  Object.fromEntries(
    Object.entries(selectedFilters)
      .filter(([, values]) => values.length > 0)
      .map(([key, values]) => [key, values]),
  )

const buildApiQuery = () => ({
  limit: limit.value,
  offset: offset.value,
  ordering: ordering.value || undefined,
  priceMin: priceMin.value || undefined,
  priceMax: priceMax.value || undefined,
  ...buildDynamicQuery(),
})

const buildRouteQuery = () => {
  const query: Record<string, string> = {
    limit: String(limit.value),
    offset: String(offset.value),
  }

  if (ordering.value) query.ordering = ordering.value
  if (priceMin.value) query.priceMin = priceMin.value
  if (priceMax.value) query.priceMax = priceMax.value
  for (const [key, values] of Object.entries(selectedFilters)) {
    if (values.length) query[key] = values.join(',')
  }

  return query
}

const { data: categoryFacets, pending: filtersPending, refresh: refreshCategoryFacets } = await useAsyncData(
  () => `shop-category-facets-${categorySlug.value}`,
  () => domain.getCategoryFilters(categorySlug.value),
  { watch: [categorySlug] },
)

const { data: productsPage, pending: productsPending, refresh: refreshProducts } = await useAsyncData(
  () => `shop-category-products-${categorySlug.value}`,
  () => domain.getCategoryProducts(categorySlug.value, buildApiQuery()),
  { watch: [] },
)

const products = computed(() => productsPage.value?.items || [])
const total = computed(() => productsPage.value?.total || 0)
const facetGroups = computed<CategoryFilterGroupDto[]>(() => Object.values(categoryFacets.value?.filters || {}))
const priceBounds = computed(() => categoryFacets.value?.price || null)
const selectedFilterCount = computed(() =>
  Object.values(selectedFilters).reduce((sum, values) => sum + values.length, 0),
)
const isPending = computed(() => productsPending.value || filtersPending.value)

const applyState = async () => {
  if (applyTimer) {
    clearTimeout(applyTimer)
    applyTimer = undefined
  }

  await router.replace({
    path: categoryGoodsPath(slugSegments.value),
    query: buildRouteQuery(),
  })
  await refreshProducts()
}

const scheduleApplyState = () => {
  if (applyTimer) clearTimeout(applyTimer)
  applyTimer = setTimeout(() => {
    void applyState()
  }, 250)
}

const resetOffset = () => {
  offset.value = 0
}

const setOrdering = async (value: string) => {
  ordering.value = value
  resetOffset()
  await applyState()
}

const setFilter = (group: string, value: string, checked: boolean) => {
  if (checked) {
    selectedFilters[group] = [value]
  }
  else {
    delete selectedFilters[group]
  }

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
  priceMin.value = ''
  priceMax.value = ''
  for (const key of Object.keys(selectedFilters)) delete selectedFilters[key]
  resetOffset()
  await applyState()
}

const changePage = async (page: number) => {
  offset.value = (page - 1) * limit.value
  await applyState()
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}

watch([priceMin, priceMax], () => {
  resetOffset()
})

watch(categorySlug, async () => {
  limit.value = readIntegerQuery(route.query.limit, DEFAULT_LIMIT) || DEFAULT_LIMIT
  offset.value = readIntegerQuery(route.query.offset, 0)
  ordering.value = readQueryValue(route.query.ordering) || readQueryValue(route.query.sort)
  priceMin.value = readQueryValue(route.query.priceMin) || readQueryValue(route.query.price_min)
  priceMax.value = readQueryValue(route.query.priceMax) || readQueryValue(route.query.price_max)
  syncSelectedFiltersFromQuery()
  await refreshCategoryFacets()
  await refreshProducts()
})

onBeforeUnmount(() => {
  if (applyTimer) clearTimeout(applyTimer)
})

useSeo(
  () => currentCategory.value?.name || terms.value.seo.catalogTitle,
  () => currentCategory.value?.description || terms.value.seo.catalogDescription,
)
</script>

<template>
  <section class="category">
    <div class="category__container">
      <CatalogBreadcrumbs :items="breadcrumbs" />

      <div class="category__title-wrapper">
        <h1 class="category__title">{{ currentCategory?.name || categorySlug }}</h1>
      </div>

      <div class="category__head-side-bar">
        <CatalogSortTabs
          class="category__tab-list"
          :model-value="ordering"
          :disabled="productsPending"
          @update:model-value="setOrdering"
        />

        <button class="category__head-filter-btn" type="button" @click="isFilterDrawerOpen = true">
          <BaseIcon name="filter" size="xs" />
          <span v-if="selectedFilterCount" class="category__filter-count">{{ selectedFilterCount }}</span>
        </button>
      </div>

      <div class="category__body">
        <div class="category__left-side-bar-wrapper">
          <CatalogFilterPanel
            class="category__left-side-bar is-filtered"
            :groups="facetGroups"
            :price="priceBounds"
            :selected-filters="selectedFilters"
            :price-min="priceMin"
            :price-max="priceMax"
            :pending="filtersPending"
            :disabled="productsPending"
            @update:price-min="priceMin = $event"
            @update:price-max="priceMax = $event"
            @price-change="scheduleApplyState"
            @toggle-filter="setFilter"
            @remove-filter="removeFilter"
            @clear="clearFilters"
          />
        </div>

        <div class="category__content">
          <p class="category__count">{{ terms.catalog.productCount(total) }}</p>

          <CatalogProductGrid
            :products="products"
            :pending="productsPending"
            :skeleton-count="limit"
          />

          <FeedbackState
            v-if="!productsPending && !products.length"
            class="category__empty"
            kind="search"
            :seed="categorySlug"
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
      <div class="category__mobile-filters">
        <CatalogFilterPanel
          :groups="facetGroups"
          :price="priceBounds"
          :selected-filters="selectedFilters"
          :price-min="priceMin"
          :price-max="priceMax"
          :pending="filtersPending"
          :disabled="productsPending"
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
.category {
  color: #0a0a0a;
}

.category__container {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.category__title-wrapper {
  display: flex;
  min-height: 3rem;
  align-items: center;
}

.category__title {
  color: #0a0a0a;
  font-size: clamp(1.5rem, 1.1rem + 1.4vw, 2.375rem);
  font-weight: 800;
  line-height: 1.1;
}

.category__head-side-bar {
  position: sticky;
  top: 4.75rem;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  justify-content: space-between;
  padding: 0.375rem 0;
  background: #ffffff;
}

.category__tab-list {
  flex: 0 1 auto;
}

.category__head-filter-btn {
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

.category__filter-count {
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

.category__body {
  display: flex;
  gap: 0.75rem;
  padding-top: 0.75rem;
}

.category__left-side-bar-wrapper {
  display: none;
  width: 100%;
  max-width: 300px;
  flex: 0 0 300px;
}

.category__left-side-bar {
  width: 300px;
}

.category__left-side-bar.is-filtered {
  position: sticky;
  top: 130px;
  height: calc(100vh - 110px);
  overflow-y: auto;
  padding-bottom: 42px;
}

.category__content {
  min-width: 0;
  width: 100%;
}

.category__count {
  padding-bottom: 0.75rem;
  color: #737373;
  font-size: 0.875rem;
  font-weight: 700;
}

.category__empty {
  border: 1px solid rgb(10 10 10 / 0.1);
  background: #ffffff;
  --feedback-state-surface: #ffffff;
  color: #0a0a0a;
}

.category__mobile-filters {
  padding: 0.5rem;
}

@media (min-width: 1024px) {
  .category__head-filter-btn {
    display: none;
  }

  .category__left-side-bar-wrapper {
    display: block;
  }

}
</style>
