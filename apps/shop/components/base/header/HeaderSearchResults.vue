<script setup lang="ts">
import type { CategoryTreeNodeDto, ProductSearchResponseDto } from '@shared-types'
import FeedbackState from '~/components/ui/FeedbackState.vue'
import { categoryDestination } from '~/utils/category-routing'
import { localizedProductSuggestion } from '~/utils/product-localization'

const { categoryDisplayName } = useCategoryDisplay()

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

const { terms, locale } = useShopLocale()
const suggestionTitle = computed(() => locale.value === 'uk' ? 'Можливо, ви шукаєте' : 'You might be looking for')
const suggestionLabel = (suggestion: string) => {
  const category = props.results.categories.find(category => category.name === suggestion)
  return category
    ? categoryDisplayName(category)
    : localizedProductSuggestion(suggestion, props.results.products, locale.value)
}

const hasResults = computed(() =>
  props.results.suggestions.length > 0
  || props.results.products.length > 0
  || props.results.categories.length > 0,
)

const categoryLink = (category: ProductSearchResponseDto['categories'][number]) =>
  categoryDestination(category.slug)

const selectProductResult = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (target.closest('.catalog-product-tile a[href]')) emit('select')
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
    <div v-if="$slots['heading-actions']" class="header-search-results__heading">
      <h6 class="header-search-results__title">{{ suggestionTitle }}</h6>
      <slot name="heading-actions" />
    </div>
    <div v-if="hasResults" class="header-search-results__content">
      <div class="header-search-results__tags">
      <template v-if="results.categories.length">
        <h6 class="header-search-results__title">{{ terms.catalog.sidebarFallbackTitle }}</h6>
        <ul class="header-search-results__list header-search-results__list--categories">
          <li v-for="category in results.categories" :key="category.id">
            <NuxtLink
              class="header-search-results__item header-search-results__item--category"
              :to="categoryLink(category)"
              @click="emit('select')"
            >
              <BaseHoverUnderlineText>{{ categoryDisplayName(category) }}</BaseHoverUnderlineText>
            </NuxtLink>
          </li>
        </ul>
      </template>

      <template v-if="results.suggestions.length">
        <h6 v-if="!$slots['heading-actions']" class="header-search-results__title">{{ suggestionTitle }}</h6>
        <ul class="header-search-results__list header-search-results__list--categories">
          <li v-for="suggestion in results.suggestions" :key="suggestion">
            <BaseButton
              type="button"
              variant="borderless"
              class="header-search-results__item header-search-results__item--category"
              @click="emit('suggestion', suggestion)"
            >
              <BaseHoverUnderlineText>{{ suggestionLabel(suggestion) }}</BaseHoverUnderlineText>
            </BaseButton>
          </li>
        </ul>
      </template>

      </div>

      <div v-if="results.products.length" class="header-search-results__product-scroll">
        <h6 class="header-search-results__title">{{ locale === 'uk' ? 'Знайдені товари' : 'Products found' }}</h6>
        <CatalogProductGrid
          class="header-search-results__products"
          :products="results.products"
          @click="selectProductResult"
        />
      </div>
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

.header-search-results__heading {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  background: #fff;
  padding: 0.25rem 0.4rem 0.75rem;
}

.header-search-results__heading .header-search-results__title {
  min-width: 0;
  padding: 0;
  line-height: 1.4;
}

.header-search-results--empty {
  background: #ffffff;
}

.header-search-results__content {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.header-search-results__tags {
  flex: 0 0 auto;
  padding-bottom: 1rem;
}

.header-search-results__product-scroll {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior-y: contain;
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
  min-height: 44px;
  align-items: center;
  gap: 0.75rem;
  border: 0;
  background: transparent;
  padding: 0.55rem 0.7rem;
  color: #3f3f46;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: inherit;
  line-height: 1.3;
  text-transform: none;
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

.header-search-results__item:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: -2px;
}

@media (max-width: 767px) {
  .header-search-results__list--categories {
    flex-wrap: nowrap;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    padding-bottom: 0.35rem;
  }

  .header-search-results__list--categories > li {
    flex: 0 0 auto;
    white-space: nowrap;
  }
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

@media (prefers-reduced-motion: reduce) {
  .header-search-results__spinner { animation: none; }
}
</style>
