<script setup lang="ts">
import type { ProductDto } from '@shared-types'
import { formatPrice } from '@shared-utils'

defineProps<{
  product: ProductDto
  to: string
}>()
</script>

<template>
  <NuxtLink :to="to" class="group flex h-full flex-col overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
    <img
      :src="product.images[0]?.image || 'https://placehold.co/800x800?text=Product'"
      :alt="product.images[0]?.alt || product.name"
      class="h-64 w-full object-cover"
    >
    <div class="flex flex-1 flex-col gap-3 p-5">
      <div class="flex items-center justify-between text-xs uppercase tracking-[0.25em] text-stone-500">
        <span>{{ product.brand.name }}</span>
        <span>{{ product.category.name }}</span>
      </div>
      <div class="space-y-2">
        <h3 class="text-xl font-semibold text-stone-900">
          {{ product.name }}
        </h3>
        <p class="line-clamp-2 text-sm leading-6 text-stone-600">
          {{ product.short_description || product.description }}
        </p>
      </div>
      <div class="mt-auto flex items-end justify-between">
        <div>
          <p class="text-lg font-semibold text-stone-900">
            {{ formatPrice(product.price) }}
          </p>
          <p v-if="product.compare_at_price" class="text-sm text-stone-400 line-through">
            {{ formatPrice(product.compare_at_price) }}
          </p>
        </div>
        <span class="text-sm font-medium text-amber-700">View</span>
      </div>
    </div>
  </NuxtLink>
</template>
