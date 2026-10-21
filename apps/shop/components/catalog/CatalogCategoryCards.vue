<script setup lang="ts">
import type { CategoryTreeNodeDto } from '@shared-types'
import { categoryDestination } from '~/utils/category-routing'

defineProps<{
  categories: CategoryTreeNodeDto[]
  tree: CategoryTreeNodeDto[]
}>()
const { categoryDisplayName, categoryDisplayDescription } = useCategoryDisplay()
</script>

<template>
  <ul class="category-cards">
    <li v-for="category in categories" :key="category.id">
      <NuxtLink class="category-cards__card" :to="categoryDestination(tree, category)" :data-category-artwork="category.slug">
        <CategoryArtwork class="category-cards__artwork" :slug="category.slug" />
        <span class="category-cards__caption">
          <span class="category-cards__copy">
            <strong><BaseHoverUnderlineText>{{ categoryDisplayName(category) }}</BaseHoverUnderlineText></strong>
            <span v-if="categoryDisplayDescription(category)" class="category-cards__description">{{ categoryDisplayDescription(category) }}</span>
          </span>
          <span class="category-cards__arrow" aria-hidden="true">
            <BaseIcon name="arrow-right" size="xs" />
          </span>
        </span>
      </NuxtLink>
    </li>
  </ul>
</template>

<style scoped>
/* Artwork stays centered and shrinks proportionally on narrow cards. */
.category-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 18.27rem));
  gap: 1.5rem;
}
.category-cards__card {
  display: grid;
  grid-template-rows: auto auto;
  align-content: start;
  justify-items: center;
  gap: 1rem;
  padding: 1.25rem 1.375rem;
  border: 0;
  color: #0a0a0a;
}
.category-cards__card:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
.category-cards__artwork {
  width: min(100%, 160px);
}
.category-cards__caption {
  position: relative;
  display: block;
  width: 100%;
  padding-inline: 1.375rem;
  text-align: center;
}
.category-cards__arrow {
  position: absolute;
  right: 0;
  top: 50%;
  display: inline-flex;
  transform: translateY(-50%) rotate(0deg);
  transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
}
.category-cards__card:hover .category-cards__arrow,
.category-cards__card:focus-visible .category-cards__arrow {
  transform: translateY(-50%) rotate(90deg);
}
.category-cards__caption strong {
  display: block;
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
  .category-cards__caption strong { font-size: 0.875rem; }
}
@media (prefers-reduced-motion: reduce) {
  .category-cards__arrow { transition: none; }
}
</style>
