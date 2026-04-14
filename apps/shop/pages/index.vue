<script setup lang="ts">
import { AppSection, ProductCard } from '@shared-ui'

const domain = useCatalogDomain()
const { data: products } = await useAsyncData('shop-home', () => domain.getProducts({ limit: 6 }))

useSeo('Men’s grooming store', 'Premium men’s cosmetics, styling, beard and skincare essentials with a clean checkout flow.')
</script>

<template>
  <div class="space-y-16">
    <section class="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
      <div class="space-y-6">
        <p class="text-sm uppercase tracking-[0.35em] text-emerald-700">E-commerce</p>
        <h1 class="text-5xl font-semibold leading-tight text-neutral-900 md:text-6xl">
          Men’s cosmetics chosen like a barber shelf, not a supermarket aisle.
        </h1>
        <p class="max-w-2xl text-lg leading-8 text-neutral-600">
          Tight catalog, strong product descriptions, sensible pricing and a backend that keeps stock, orders and content in one place.
        </p>
        <NuxtLink to="/catalog" class="inline-flex rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white">
          Browse catalog
        </NuxtLink>
      </div>
      <img src="https://images.unsplash.com/photo-1621607512214-68297480165e?auto=format&fit=crop&w=1200&q=80" alt="Cosmetics shelf" class="h-[32rem] rounded-[2.5rem] object-cover shadow-2xl">
    </section>

    <AppSection eyebrow="Popular now" title="Front shelf picks" description="The seed catalog is intentionally small so the storefront can focus on product quality, filtering and a clean path to checkout.">
      <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <ProductCard v-for="product in products || []" :key="product.id" :product="product" :to="`/products/${product.slug}`" />
      </div>
    </AppSection>
  </div>
</template>
