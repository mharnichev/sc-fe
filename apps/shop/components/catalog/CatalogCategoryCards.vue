<script setup lang="ts">
import type { CategoryTreeNodeDto } from '@shared-types'
import { categoryDestination } from '~/utils/category-routing'

defineProps<{
  categories: CategoryTreeNodeDto[]
  tree: CategoryTreeNodeDto[]
}>()
const { categoryDisplayName, categoryDisplayDescription } = useCategoryDisplay()
const { terms } = useShopLocale()
</script>

<template>
  <ul class="category-cards">
    <li v-for="category in categories" :key="category.id">
      <NuxtLink class="category-cards__card" :to="categoryDestination(tree, category)" :data-category-artwork="category.slug">
        <CategoryArtwork :slug="category.slug" />
        <span class="category-cards__caption">
          <span class="category-cards__copy">
            <strong><BaseHoverUnderlineText>{{ categoryDisplayName(category) }}</BaseHoverUnderlineText></strong>
            <span v-if="categoryDisplayDescription(category)" class="category-cards__description">{{ categoryDisplayDescription(category) }}</span>
            <span v-else class="category-cards__description">{{ category.children.length ? terms.catalog.sidebarFallbackTitle : terms.catalog.productsSuffix }}</span>
          </span>
          <BaseIcon name="simple-arrow-right" size="xxs" />
        </span>
      </NuxtLink>
    </li>
  </ul>
</template>

<style scoped>
/* Figma: card 292.31 × 367.96, illustration 245.66 square, no card border. */
.category-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 18.27rem));
  gap: 1.5rem;
}
.category-cards__card {
  display: grid;
  grid-template-rows: auto 1fr;
  min-height: 23rem;
  gap: 1rem;
  padding: 1.25rem 1.375rem;
  border: 0;
  color: #0a0a0a;
  transition: transform 180ms ease;
}
.category-cards__card:hover { transform: translateY(-0.125rem); }
.category-cards__card:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
.category-cards__caption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.category-cards__caption strong {
  min-width: 0;
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.category-cards__copy { display: grid; gap: 0.35rem; min-width: 0; }
.category-cards__description { font-size: 0.8125rem; line-height: 1.4; color: #737373; overflow-wrap: anywhere; }
@media (max-width: 767px) {
  .category-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
  .category-cards__card { min-height: 0; gap: 0.75rem; padding: 0.75rem; }
  .category-cards__caption { gap: 0.5rem; }
  .category-cards__caption strong { font-size: 0.875rem; }
}
@media (prefers-reduced-motion: reduce) {
  .category-cards__card { transition: none; transform: none; }
}
</style>
