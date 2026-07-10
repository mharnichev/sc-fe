<script setup lang="ts">
import FeedbackState from '~/components/ui/FeedbackState.vue'

const domain = useCatalogDomain()
const favorites = useFavoritesStore()
const auth = useCustomerAuthStore()
const { terms } = useShopLocale()

const { data: products } = await useAsyncData('cabinet-favorite-products', () => domain.getProducts({ limit: 100 }))
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
  <CabinetShell>
    <section class="cabinet-favorites" :class="{ 'cabinet-favorites--empty': !favoriteProducts.length }">
      <template v-if="favoriteProducts.length">
        <div class="cabinet-favorites__head">
          <p>{{ terms.favorites.saved }}</p>
          <h1>{{ terms.common.favorites }}</h1>
        </div>
        <CatalogProductGrid :products="favoriteProducts" />
      </template>

      <FeedbackState
        v-else
        face="sad-droopy-face"
        :title="terms.favorites.noFavorites"
        :description="terms.favorites.saveFromCatalog"
      >
        <BaseButton to="/catalog">
          {{ terms.cabinet.toGoods }}
        </BaseButton>
      </FeedbackState>
    </section>
  </CabinetShell>
</template>

<style scoped>
.cabinet-favorites {
  display: grid;
  gap: 1.5rem;
}

.cabinet-favorites__head p {
  color: #047857;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.cabinet-favorites__head h1 {
  margin-top: 0.4rem;
  font-size: 2rem;
  font-weight: 800;
}

.cabinet-favorites--empty {
  min-height: 28rem;
  align-content: center;
  justify-items: center;
  text-align: center;
}

</style>
