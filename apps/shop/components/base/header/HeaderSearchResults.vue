<script setup lang="ts">
import type { CategoryTreeNodeDto, ProductSearchResponseDto } from '@shared-types'
import FeedbackState from '~/components/ui/FeedbackState.vue'
import { categoryGoodsDestination } from '~/utils/category-routing'

const props = defineProps<{
  query: string
  loading: boolean
  results: ProductSearchResponseDto
  categoryTree?: CategoryTreeNodeDto[]
}>()

const emit = defineEmits<{
  select: []
  suggestion: [value: string]
}>()

const { terms } = useShopLocale()
const hasResults = computed(() =>
  props.results.suggestions.length > 0
  || props.results.products.length > 0
  || props.results.categories.length > 0,
)

const categoryLink = (category: ProductSearchResponseDto['categories'][number]) =>
  props.categoryTree?.length
    ? categoryGoodsDestination(props.categoryTree, category)
    : { path: '/catalog', query: { category: category.slug } }

const selectProductResult = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (target.closest('a[href^="/products/"]')) emit('select')
}

</script>

<template>
  <div
    class="header-search-results"
    :class="{
      'header-search-results--loading': loading,
      'header-search-results--empty': !hasResults && !loading,
    }"
    :aria-busy="loading"
    aria-live="polite"
  >
    <div v-if="hasResults" class="header-search-results__content">
      <template v-if="results.categories.length">
        <h6 class="header-search-results__title">{{ terms.catalog.sidebarFallbackTitle }}</h6>
        <ul class="header-search-results__list header-search-results__list--categories">
          <li v-for="category in results.categories" :key="category.id">
            <NuxtLink
              class="header-search-results__item header-search-results__item--category"
              :to="categoryLink(category)"
              @click="emit('select')"
            >
              <BaseHoverUnderlineText>{{ category.name }}</BaseHoverUnderlineText>
            </NuxtLink>
          </li>
        </ul>
      </template>

      <template v-if="results.suggestions.length">
        <h6 class="header-search-results__title">{{ terms.common.search }}</h6>
        <ul class="header-search-results__list header-search-results__list--categories">
          <li v-for="suggestion in results.suggestions" :key="suggestion">
            <button
              type="button"
              class="header-search-results__item header-search-results__item--category"
              @click="emit('suggestion', suggestion)"
            >
              <BaseHoverUnderlineText>{{ suggestion }}</BaseHoverUnderlineText>
            </button>
          </li>
        </ul>
      </template>

      <template v-if="results.products.length">
        <h6 class="header-search-results__title">{{ terms.common.products }}</h6>
        <CatalogProductGrid
          class="header-search-results__products"
          :products="results.products"
          @click="selectProductResult"
        />
      </template>
    </div>

    <FeedbackState
      v-else-if="!loading"
      class="header-search-results__empty"
      kind="search"
      compact
      :seed="query"
      :title="terms.header.searchEmptyTitle"
      :description="terms.header.searchEmptyText(query)"
    />

    <div v-if="loading" class="header-search-results__loader" role="status">
      <span class="header-search-results__spinner" aria-hidden="true" />
      <span>{{ terms.header.searchLoading }}</span>
    </div>
  </div>
</template>

<style scoped>
.header-search-results {
  position: relative;
  display: flex;
  min-height: 10rem;
  max-height: min(78vh, 28rem);
  flex-direction: column;
  overflow: auto;
  background: #ffffff;
  padding: 0.5rem;
}

.header-search-results--empty {
  background: #ffffff;
}

.header-search-results__content {
  display: grid;
}

.header-search-results__title {
  padding: 0.65rem 0.4rem 0.45rem;
  color: #737373;
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
}

.header-search-results__list--categories {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.header-search-results__item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.75rem;
  border: 0;
  background: transparent;
  padding: 0.55rem 0.7rem;
  color: #3f3f46;
  cursor: pointer;
  font-size: 0.85rem;
  text-align: left;
  transition: color 180ms ease;
}

.header-search-results__item--category {
  background: var(--sc-surface-muted);
}

.header-search-results__item:hover,
.header-search-results__item:focus-visible {
  color: #0a0a0a;
  outline: none;
}

.header-search-results__products.catalog-product-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 0.25rem;
}

.header-search-results__empty {
  flex: 1 1 auto;
  --feedback-state-surface: #ffffff;
  color: #0a0a0a;
}

.header-search-results__loader {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 0.75rem;
  background: rgb(255 255 255 / 0.42);
  color: #525252;
  font-size: 0.8rem;
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
}

.header-search-results__spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid #0a0a0a;
  border-right-color: transparent;
  border-radius: 50%;
  animation: header-search-spinner 0.75s linear infinite;
}

@keyframes header-search-spinner {
  to {
    transform: rotate(360deg);
  }
}
</style>
