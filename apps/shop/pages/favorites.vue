<script setup lang="ts">
import { ProductCard } from '@shared-ui'

const domain = useCatalogDomain()
const favorites = useFavoritesStore()
const { data: products } = await useAsyncData('favorite-products', () => domain.getProducts({ limit: 100 }))
const favoriteProducts = computed(() => (products.value || []).filter(product => favorites.items.includes(product.id)))

useSeo('Favorites', 'Saved grooming products.')
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="text-sm uppercase tracking-[0.3em] text-emerald-700">Saved</p>
      <h1 class="mt-2 text-4xl font-semibold text-neutral-900">Favorites</h1>
    </div>
    <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <ProductCard v-for="product in favoriteProducts" :key="product.id" :product="product" :to="`/products/${product.slug}`" />
    </div>
  </div>
</template>
