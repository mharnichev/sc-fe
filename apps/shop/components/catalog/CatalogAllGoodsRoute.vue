<script setup lang="ts">
import type { LocationQueryRaw } from 'vue-router'
import type { CategoryFilterGroupDto } from '@shared-types'
import { isMonochromeBrandLogo, localBrandLogoUrl, resolveApiAssetUrl } from '@shared-utils'
import { categoryPathBySlug } from '~/utils/category-routing'
import FeedbackState from '~/components/ui/FeedbackState.vue'

const { categoryDisplayName, categoryDisplayDescription } = useCategoryDisplay()

const DEFAULT_LIMIT = 20
const props = withDefaults(defineProps<{
  topOnly?: boolean
  saleOnly?: boolean
}>(), {
  topOnly: false,
  saleOnly: false,
})

const route = useRoute()
const router = useRouter()
const domain = useCatalogDomain()
const { locale, terms } = useShopLocale()
const config = useRuntimeConfig()
const requestUrl = useRequestURL()
const shopAsset = useShopAsset()
const saleTitle = computed(() => locale.value === 'uk' ? 'Спеціальна пропозиція' : 'Special offer')
const saleDescription = computed(() => locale.value === 'uk' ? 'Товари з актуальними знижками та спеціальними цінами.' : 'Products with current discounts and special prices.')
const catalogKeyPrefix = props.saleOnly ? 'shop-sale' : props.topOnly ? 'shop-top' : 'shop-catalog'

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

const filterDraft = ref<LocationQueryRaw | null>(null)
const filterQuery = computed(() => filterDraft.value ?? route.query)

const limit = computed(() => Math.min(100, readIntegerQuery(filterQuery.value.limit, DEFAULT_LIMIT) || DEFAULT_LIMIT))
const offset = computed(() => readIntegerQuery(filterQuery.value.offset, 0))
const ordering = computed(() => readQueryValue(filterQuery.value.ordering) || readQueryValue(filterQuery.value.sort) || (props.topOnly ? '-is_top' : ''))
const query = computed(() => readQueryValue(filterQuery.value.q))
const category = computed(() => readQueryValue(filterQuery.value.category))
const types = computed(() => readQueryList(filterQuery.value.type))
const selectedBrands = computed(() => readQueryList(filterQuery.value.brand))
const priceMin = ref('')
const priceMax = ref('')
const isFilterDrawerOpen = ref(false)
const isSortOpen = ref(false)
let applyTimer: ReturnType<typeof setTimeout> | undefined

const resetFilterDraft = () => {
  filterDraft.value = null
  if (applyTimer) clearTimeout(applyTimer)
  applyTimer = undefined
  priceMin.value = readQueryValue(filterQuery.value.priceMin ?? filterQuery.value.price_min)
  priceMax.value = readQueryValue(filterQuery.value.priceMax ?? filterQuery.value.price_max)
}

watch(isFilterDrawerOpen, (open) => {
  if (!open) resetFilterDraft()
})
watch(() => route.fullPath, () => {
  isFilterDrawerOpen.value = false
  resetFilterDraft()
}, { immediate: true })

const [{ data: categoryTree }, { data: brands }] = await Promise.all([
  useAsyncData('shop-category-tree-all-goods', domain.getCategoryTree),
  useAsyncData('shop-brands-all-goods', () => domain.getBrands({ hasActiveProducts: true })),
])

const selectedBrand = computed(() =>
  !category.value && selectedBrands.value.length === 1
    ? (brands.value || []).find(item => item.slug === selectedBrands.value[0]) || null
    : null,
)
const selectedBrandLogoUrl = computed(() => {
  const selected = selectedBrand.value
  if (!selected) return ''

  return resolveApiAssetUrl(selected.logo_url, String(config.public.apiBase), requestUrl.origin)
    || shopAsset(localBrandLogoUrl(selected.slug))
})
const selectedBrandLogoMaskStyle = computed(() => ({
  '--brand-logo-url': `url(${JSON.stringify(selectedBrandLogoUrl.value)})`,
}))
const selectedBrandDescription = computed(() => {
  const selected = selectedBrand.value
  if (!selected) return ''

  return locale.value === 'en'
    ? selected.description_en || selected.description_uk || selected.description || ''
    : selected.description_uk || selected.description_en || selected.description || ''
})
const selectedBrandHistory = computed(() => {
  const selected = selectedBrand.value
  if (!selected) return ''

  return locale.value === 'en'
    ? selected.history_en || selected.history_uk || ''
    : selected.history_uk || selected.history_en || ''
})
const selectedBrandWebsite = computed(() => {
  const selected = selectedBrand.value
  if (!selected) return ''

  return selected.website || ''
})
const categoryNodes = computed(() => categoryTree.value || [])
const categoryNode = computed(() => categoryPathBySlug(categoryNodes.value, category.value).at(-1))
const categoryName = computed(() => categoryNode.value ? categoryDisplayName(categoryNode.value) : terms.value.catalog.title)
const categoryDescription = computed(() => categoryNode.value ? categoryDisplayDescription(categoryNode.value) : '')
const introElement = ref<HTMLElement | null>(null)
const introMeasure = ref<HTMLElement | null>(null)
const introOverflows = ref(false)
const introExpanded = ref(false)
const introId = useId()
watch(categoryDescription, () => { introExpanded.value = false })
watch([introElement, introMeasure], ([container, measure], _previous, onCleanup) => {
  if (!container || !measure) {
    introOverflows.value = false
    return
  }
  const updateOverflow = () => {
    introOverflows.value = measure.offsetWidth > container.clientWidth
    if (!introOverflows.value) introExpanded.value = false
  }
  updateOverflow()
  const observer = new ResizeObserver(updateOverflow)
  observer.observe(container)
  observer.observe(measure)
  onCleanup(() => observer.disconnect())
}, { flush: 'post' })
const sortOptions = computed(() => [
  { label: locale.value === 'uk' ? 'За замовчуванням' : 'Default', value: '' },
  { label: terms.value.catalog.sortOptions.newest, value: 'newest' },
  { label: locale.value === 'uk' ? 'Спочатку давніші' : 'Oldest first', value: 'created_at' },
  { label: terms.value.catalog.cheaper, value: 'price' },
  { label: terms.value.catalog.moreExpensive, value: '-price' },
  { label: terms.value.catalog.popular, value: '-is_top' },
  { label: terms.value.catalog.sortOptions.name, value: 'name' },
  { label: terms.value.catalog.sortOptions.nameDesc, value: '-name' },
])
const sortAliases: Record<string, string> = {
  '-created_at': 'newest',
  price_asc: 'price', cheap: 'price', cheaper: 'price',
  price_desc: '-price', expensive: '-price',
  name_asc: 'name', name_desc: '-name',
  top: '-is_top', popular: '-is_top', '-popularity': '-is_top',
}
const displayedOrdering = computed(() => sortAliases[ordering.value] || ordering.value)
const urlFlagCount = computed(() =>
  ['in_stock', 'is_top', 'has_discount'].filter(key => readQueryValue(filterQuery.value[key])).length,
)
const apiQuery = computed(() => ({
  category: category.value || undefined,
  type: types.value.length ? types.value : undefined,
  brand: selectedBrands.value.length ? selectedBrands.value : undefined,
  q: query.value || undefined,
  limit: limit.value,
  offset: offset.value,
  ordering: ordering.value || undefined,
  priceMin: readQueryValue(filterQuery.value.priceMin ?? filterQuery.value.price_min) || undefined,
  priceMax: readQueryValue(filterQuery.value.priceMax ?? filterQuery.value.price_max) || undefined,
  in_stock: readQueryValue(filterQuery.value.in_stock) || undefined,
  is_top: props.topOnly || readQueryValue(filterQuery.value.is_top) || undefined,
  has_discount: props.saleOnly || readQueryValue(filterQuery.value.has_discount) || undefined,
}))

const { data: productsPage, pending: productsPending, error: productsError } = await useAsyncData(
  `${catalogKeyPrefix}-all-goods-products`,
  () => domain.getCatalogPage(apiQuery.value),
  { watch: [apiQuery], dedupe: 'cancel' },
)
const products = computed(() => productsPage.value?.items || [])
const total = computed(() => productsPage.value?.total || 0)
const priceBounds = computed(() => productsPage.value?.price || null)
const filterGroups = computed<CategoryFilterGroupDto[]>(() => {
  const facets = productsPage.value?.filters
  const typeName = (slug: string, fallback: string) => {
    const node = categoryPathBySlug(categoryNodes.value, slug).at(-1)
    return node ? categoryDisplayName(node) : fallback
  }
  const groups = [
    {
      slug: 'type',
      name: terms.value.catalog.productType,
      values: (facets?.type?.values || []).map(value => ({ ...value, name: typeName(value.slug, value.name) })),
    },
    { slug: 'brand', name: terms.value.catalog.brand, values: [...(facets?.brand?.values || [])] },
  ]
  for (const group of groups) {
    for (const slug of group.slug === 'type' ? types.value : selectedBrands.value) {
      if (!group.values.some(value => value.slug === slug)) {
        group.values.push({
          slug,
          name: group.slug === 'type' ? typeName(slug, slug) : brands.value?.find(brand => brand.slug === slug)?.name || slug,
          count: 0,
        })
      }
    }
  }
  return [
    ...(!category.value || categoryNode.value ? [{
      slug: 'category',
      name: terms.value.catalog.category,
      values: (category.value && categoryNode.value ? [categoryNode.value] : categoryNodes.value.filter(node => node.slug !== 'brendi'))
        .map(node => ({ slug: node.slug, name: categoryDisplayName(node), count: 0 })),
    }] : []),
    ...groups.filter(group => group.values.length),
  ]
})
const quickTypes = computed(() => category.value || types.value.length
  ? filterGroups.value.find(group => group.slug === 'type')?.values || []
  : [])
const panelSelectedFilters = computed(() => ({
  ...(category.value ? { category: [category.value] } : {}),
  ...(types.value.length ? { type: types.value } : {}),
  ...(selectedBrands.value.length ? { brand: selectedBrands.value } : {}),
}))
const selectedFilterCount = computed(() => types.value.length + selectedBrands.value.length + urlFlagCount.value
  + Number(Boolean(query.value)) + Number(Boolean(category.value)) + Number(Boolean(priceMin.value || priceMax.value)))

const updateQuery = (patch: Record<string, string | string[] | undefined>) => {
  if (applyTimer) clearTimeout(applyTimer)
  applyTimer = undefined
  const nextQuery = {
    ...filterQuery.value,
    offset: undefined,
    priceMin: priceMin.value || undefined,
    priceMax: priceMax.value || undefined,
    price_min: undefined,
    price_max: undefined,
    ...patch,
  }
  if (isFilterDrawerOpen.value) {
    filterDraft.value = nextQuery
    priceMin.value = readQueryValue(nextQuery.priceMin)
    priceMax.value = readQueryValue(nextQuery.priceMax)
    return
  }
  return router.push({ path: route.path, query: nextQuery })
}

const isFilterPreviewPending = computed(() => productsPending.value
  || priceMin.value !== readQueryValue(filterQuery.value.priceMin ?? filterQuery.value.price_min)
  || priceMax.value !== readQueryValue(filterQuery.value.priceMax ?? filterQuery.value.price_max))

const confirmFilters = async () => {
  if (isFilterPreviewPending.value || productsError.value) return
  if (filterDraft.value) {
    const destination = { path: route.path, query: filterDraft.value }
    if (router.resolve(destination).fullPath !== route.fullPath && await router.push(destination)) return
  }
  isFilterDrawerOpen.value = false
}

const setFilter = (group: string, value: string, checked: boolean) => {
  if (group === 'category') return updateQuery({ category: checked ? value : undefined, type: undefined })
  if (group !== 'type' && group !== 'brand') return
  const current = group === 'type' ? types.value : selectedBrands.value
  const values = checked ? [...new Set([...current, value])] : current.filter(item => item !== value)
  return updateQuery({ [group]: values.length ? values : undefined })
}
const removeFilter = (group: string, value: string) => setFilter(group, value, false)
const setOrdering = (value: string) => updateQuery({ ordering: value || undefined, sort: undefined })
const clearFilters = () => updateQuery({
  q: undefined, category: undefined, type: undefined, brand: undefined,
  priceMin: undefined, priceMax: undefined, price_min: undefined, price_max: undefined,
  in_stock: undefined, is_top: undefined, has_discount: undefined,
})
const scheduleApplyState = () => {
  if (applyTimer) clearTimeout(applyTimer)
  applyTimer = setTimeout(() => void updateQuery({}), 250)
}
const changePage = async (page: number) => {
  await updateQuery({ offset: page > 1 ? String((page - 1) * limit.value) : undefined })
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}
onBeforeUnmount(() => {
  if (applyTimer) clearTimeout(applyTimer)
})

useSeo(
  () => props.saleOnly ? saleTitle.value : props.topOnly ? terms.value.home.popularTitle : terms.value.seo.catalogTitle,
  () => props.saleOnly ? saleDescription.value : props.topOnly ? terms.value.home.popularDescription : terms.value.seo.catalogDescription,
)
</script>

<template>
  <section class="catalog-route">
    <div class="catalog-route__container">
      <CatalogBreadcrumbs
        v-if="!topOnly && !saleOnly"
        :items="[{ id: 0, slug: 'catalog', name: categoryName }]"
      />
      <header v-if="!topOnly && !saleOnly" class="catalog-route__category-header">
        <h1 class="section-title type-title-strong">{{ categoryName }}</h1>
        <div v-if="categoryDescription" ref="introElement" class="catalog-route__intro">
          <span ref="introMeasure" class="catalog-route__intro-measure" aria-hidden="true">{{ categoryDescription }}</span>
          <p :id="introId" :class="{ 'catalog-route__intro-collapsed': !introExpanded }">{{ categoryDescription }}</p>
          <BaseButton
            v-if="introOverflows"
            type="button"
            variant="text"
            size="sm"
            :aria-expanded="introExpanded"
            :aria-controls="introId"
            @click="introExpanded = !introExpanded"
          >{{ introExpanded ? terms.catalog.collapse : terms.home.showMore }}</BaseButton>
        </div>
      </header>

      <div v-if="topOnly || saleOnly" class="catalog-route__title-wrapper">
        <div>
          <p v-if="topOnly" class="type-eyebrow type-eyebrow--wide text-xs">{{ terms.home.popularEyebrow }}</p>
          <h1 class="catalog-route__title section-title type-title-strong">
            <BaseScribbleOutline>{{ saleOnly ? saleTitle : topOnly ? terms.home.popularTitle : terms.catalog.title }}</BaseScribbleOutline>
          </h1>
          <p class="catalog-route__description">{{ saleOnly ? saleDescription : terms.home.popularDescription }}</p>
        </div>
      </div>

      <section v-if="selectedBrand" class="catalog-route__brand-info">
        <span v-if="selectedBrandLogoUrl" class="catalog-route__brand-logo">
          <span
            v-if="isMonochromeBrandLogo(selectedBrand.slug)"
            class="catalog-route__brand-logo-mask"
            :style="selectedBrandLogoMaskStyle"
            role="img"
            :aria-label="selectedBrand.name"
          />
          <img
            v-else
            :src="selectedBrandLogoUrl"
            :alt="selectedBrand.name"
            width="240"
            height="120"
          >
        </span>
        <div class="catalog-route__brand-copy">
          <h2 class="catalog-route__brand-name">{{ selectedBrand.name }}</h2>
          <div
            v-if="selectedBrandDescription || selectedBrandHistory"
            class="catalog-route__brand-description"
          >
            <p v-if="selectedBrandDescription">{{ selectedBrandDescription }}</p>
            <p v-if="selectedBrandHistory">{{ selectedBrandHistory }}</p>
          </div>
          <a
            v-if="selectedBrandWebsite"
            class="catalog-route__brand-website"
            :href="selectedBrandWebsite"
            target="_blank"
            rel="noopener noreferrer"
          >
            <BaseHoverUnderlineText>{{ selectedBrandWebsite }}</BaseHoverUnderlineText>
          </a>
        </div>
      </section>

      <div
        v-if="quickTypes.length"
        class="catalog-route__quick-filters"
        role="group"
        :aria-label="terms.catalog.productTypes"
        tabindex="0"
      >
        <BaseButton
          v-for="type in quickTypes"
          :key="type.slug"
          class="catalog-route__type-chip"
          type="button"
          variant="outline-dark"
          shape="pill"
          size="sm"
          :aria-pressed="types.includes(type.slug)"
          @click="setFilter('type', type.slug, !types.includes(type.slug))"
        >{{ type.name }}</BaseButton>
      </div>

      <div class="catalog-route__head-side-bar">
        <div class="catalog-route__head-actions">
          <BaseButton
            type="button"
            variant="outline-dark"
            size="sm"
            :disabled="productsPending"
            aria-haspopup="dialog"
            :aria-expanded="isSortOpen"
            @click="isSortOpen = true"
          >
            {{ terms.catalog.sort }}
            <BaseIcon name="chevron-down" size="xxs" />
          </BaseButton>
          <CatalogFilterTrigger
            :count="selectedFilterCount"
            aria-haspopup="dialog"
            :aria-expanded="isFilterDrawerOpen"
            @click="isFilterDrawerOpen = true"
          />
        </div>
        <p class="catalog-route__count" aria-live="polite">{{ terms.catalog.productCount(total) }}</p>
      </div>

      <div class="catalog-route__content">
        <CatalogProductGrid
          :products="products"
          :pending="productsPending"
          :skeleton-count="limit"
        />

        <FeedbackState
          v-if="!productsPending && (productsError || !products.length)"
          class="catalog-route__empty"
          kind="search"
          :seed="String(route.fullPath)"
          :title="productsError ? (locale === 'uk' ? 'Не вдалося завантажити товари' : 'Could not load products') : terms.catalog.empty"
        />

        <CatalogPagination
          :total="total"
          :limit="limit"
          :offset="offset"
          :disabled="productsPending"
          @update:page="changePage"
        />
      </div>

      <RecentlyViewedProducts class="catalog-route__recently-viewed" />
    </div>

    <BaseModal v-model="isSortOpen" type="right" manage-focus>
      <template #header-title>{{ terms.catalog.sort }}</template>
      <div class="catalog-route__sort-options">
        <BaseRadio
          v-for="option in sortOptions"
          :key="option.value"
          name="catalog-ordering"
          :label="option.label"
          :value="option.value"
          :model-value="displayedOrdering"
          @update:model-value="isSortOpen = false; setOrdering(String($event))"
        />
      </div>
    </BaseModal>

    <BaseModal
      v-model="isFilterDrawerOpen"
      full-height
      manage-focus
      type="right"
      root-class="catalog-filter-drawer"
      content-type="secondary"
    >
      <template #header-title>{{ terms.catalog.filters }}</template>
      <div class="catalog-route__drawer-filters">
        <CatalogFilterPanel
          :groups="filterGroups"
          :price="priceBounds"
          :selected-filters="panelSelectedFilters"
          :price-min="priceMin"
          :price-max="priceMax"
          :pending="productsPending && !productsPage"
          :show-price="Boolean(priceBounds?.min != null && priceBounds?.max != null)"
          :hide-group-counts="['category']"
          :query="query"
          :has-extra-filters="urlFlagCount > 0"
          @update:price-min="priceMin = $event"
          @update:price-max="priceMax = $event"
          @price-change="scheduleApplyState"
          @toggle-filter="setFilter"
          @remove-filter="removeFilter"
          @clear="clearFilters"
        />
      </div>
      <template #bottom-buttons>
        <div class="catalog-route__filter-actions">
          <BaseButton type="button" variant="outline-dark" @click="clearFilters">
            {{ terms.catalog.clearAllFilters }}
          </BaseButton>
          <BaseButton
            type="button"
            :disabled="isFilterPreviewPending || Boolean(productsError)"
            @click="confirmFilters"
          >
            {{ terms.catalog.viewAllResults }}: {{ isFilterPreviewPending || productsError ? '…' : total }}
          </BaseButton>
        </div>
      </template>
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

.catalog-route__category-header {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
  padding-block: 0.75rem 0.5rem;
}

.catalog-route__intro {
  position: relative;
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 0.5rem;
  overflow: hidden;
  color: #525252;
  font-size: 0.875rem;
  line-height: 1.5;
}

.catalog-route__intro p {
  min-width: 0;
  flex: 1;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.catalog-route__intro p.catalog-route__intro-collapsed {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.catalog-route__intro-measure {
  position: absolute;
  width: max-content;
  visibility: hidden;
  white-space: nowrap;
  pointer-events: none;
}

.catalog-route__intro .sc-button {
  flex: 0 0 auto;
  min-height: 1.5rem;
  padding: 0;
  text-transform: none;
}

.catalog-route__quick-filters {
  display: flex;
  min-width: 0;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.375rem 0.125rem 0.5rem;
  scrollbar-width: thin;
}

.catalog-route__type-chip {
  flex: 0 0 auto;
  white-space: nowrap;
  text-transform: none;
}

.catalog-route__type-chip[aria-pressed="true"] {
  background: #eeece7;
}

.catalog-route__head-side-bar {
  position: sticky;
  top: var(--shop-header-offset, 4.75rem);
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.375rem 0 0.625rem;
  background: #ffffff;
  transition: top 900ms cubic-bezier(0.55, 0.05, 0.75, 1);
}

.catalog-route__head-actions {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
}

.catalog-route__sort-options {
  display: grid;
  gap: 0.75rem;
  padding: 0.75rem;
}

.catalog-route__sort-options :deep(.base-choice) {
  border-color: transparent;
}

.catalog-route__content {
  min-width: 0;
  width: 100%;
}

.catalog-route__brand-info {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 0.75rem;
  padding: 0.5rem 0 1rem;
}

.catalog-route__brand-logo {
  display: flex;
  width: 18.85rem;
  height: 9.1rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  color: #292524;
}

.catalog-route__brand-logo img,
.catalog-route__brand-logo-mask {
  width: 100%;
  height: 100%;
}

.catalog-route__brand-logo img {
  object-fit: contain;
}

.catalog-route__brand-logo-mask {
  display: block;
  background-color: currentColor;
  -webkit-mask-image: var(--brand-logo-url);
  -webkit-mask-position: center;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-size: contain;
  mask-image: var(--brand-logo-url);
  mask-position: center;
  mask-repeat: no-repeat;
  mask-size: contain;
}

.catalog-route__brand-copy {
  min-width: 0;
}

.catalog-route__brand-name {
  font-size: 1.125rem;
  font-weight: 800;
  line-height: 1.2;
}

.catalog-route__brand-description {
  max-height: 8rem;
  margin-top: 0.5rem;
  overflow-y: auto;
  color: #525252;
  font-size: 0.875rem;
  line-height: 1.5;
  white-space: pre-line;
}

.catalog-route__brand-description p + p {
  margin-top: 0.75rem;
}

.catalog-route__brand-website {
  display: inline-block;
  margin-top: 0.5rem;
  color: #0a0a0a;
  font-size: 0.875rem;
  overflow-wrap: anywhere;
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

.catalog-route__filter-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.catalog-route__filter-actions .sc-button {
  min-width: 0;
  padding-inline: 0.5rem;
  white-space: normal;
}

.catalog-route__drawer-filters {
  padding: 0.5rem;
}

.catalog-route__recently-viewed {
  padding-top: 2rem;
}

@media (max-width: 575px) {
  .catalog-route__title :deep(.base-scribble-outline) {
    margin-inline: 0.38em;
    max-width: calc(100% - 0.76em);
  }

  .catalog-route__brand-info {
    align-items: stretch;
    flex-direction: column;
  }

  .catalog-route__brand-logo {
    width: 100%;
  }
}
</style>
