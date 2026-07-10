<script setup lang="ts">
import FeedbackState from '~/components/ui/FeedbackState.vue'

const domain = useCatalogDomain()
const favorites = useFavoritesStore()
const auth = useCustomerAuthStore()
const { terms } = useShopLocale()
const { data: products } = await useAsyncData('favorite-products', () => domain.getProducts({ limit: 100 }))
const favoriteProducts = computed(() => {
  if (auth.isAuthenticated && favorites.products.length) return favorites.products

  return (products.value || []).filter(product => favorites.items.includes(product.id))
})

useSeo(
  () => terms.value.seo.favoritesTitle,
  () => terms.value.seo.favoritesDescription,
)
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="text-sm uppercase tracking-[0.3em] text-emerald-700">{{ terms.favorites.saved }}</p>
      <h1 class="mt-2 text-4xl font-semibold text-neutral-900">{{ terms.common.favorites }}</h1>
    </div>
    <CatalogProductGrid v-if="favoriteProducts.length" :products="favoriteProducts" />
    <FeedbackState
      v-else
      class="border border-neutral-200 bg-white"
      face="sad-droopy-face"
      :title="terms.favorites.noFavorites"
      :description="terms.favorites.saveFromCatalog"
    >
      <BaseButton to="/catalog">{{ terms.cabinet.toGoods }}</BaseButton>
    </FeedbackState>
  </div>
</template>
