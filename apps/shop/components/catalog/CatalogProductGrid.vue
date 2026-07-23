<script setup lang="ts">
import type { ProductDto } from '@shared-types'

withDefaults(defineProps<{
  products: ProductDto[]
  pending?: boolean
  skeletonCount?: number
  tailSkeletonCount?: number
}>(), {
  pending: false,
  skeletonCount: 12,
  tailSkeletonCount: 0,
})
</script>

<template>
  <ul v-reveal-list class="catalog-product-grid sc-reveal-list">
    <template v-if="pending">
      <li v-for="index in skeletonCount" :key="`skeleton-${index}`">
        <ProductCardSkeleton />
      </li>
    </template>

    <template v-else>
      <li v-for="product in products" :key="product.id" data-sc-reveal-item>
        <CatalogProductTile :product="product" />
      </li>
      <li v-for="index in tailSkeletonCount" :key="`tail-skeleton-${index}`">
        <ProductCardSkeleton />
      </li>
    </template>
  </ul>
</template>

<style scoped>
.catalog-product-grid {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(auto-fill, minmax(146px, 1fr));
  gap: 0.35rem;
  padding-bottom: 1rem;
}

.catalog-product-grid > li {
  display: flex;
  min-width: 0;
}

@media (min-width: 520px) {
  .catalog-product-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 0.75rem;
  }
}

@media (min-width: 1024px) {
  .catalog-product-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
