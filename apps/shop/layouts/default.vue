<script setup lang="ts">
const cart = useCartStore()
const favorites = useFavoritesStore()
</script>

<template>
  <div class="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(22,163,74,0.12),_transparent_28%),linear-gradient(180deg,_#f7f7f4,_#ffffff)]">
    <header class="border-b border-neutral-200 bg-white/80 backdrop-blur">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <NuxtLink to="/" class="text-lg font-semibold tracking-[0.18em] text-neutral-900">
          ATELIER SUPPLY
        </NuxtLink>
        <nav class="hidden items-center gap-6 text-sm text-neutral-700 md:flex">
          <NuxtLink to="/catalog">Catalog</NuxtLink>
          <NuxtLink to="/favorites">Favorites ({{ favorites.items.length }})</NuxtLink>
          <NuxtLink to="/checkout">Cart ({{ cart.count }})</NuxtLink>
        </nav>
      </div>
    </header>
    <main class="mx-auto max-w-6xl px-6 py-10">
      <slot />
    </main>
  </div>
</template>
