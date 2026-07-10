<script setup lang="ts">
import FeedbackState from '~/components/ui/FeedbackState.vue'
import { formatPrice } from '@shared-utils'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const favorites = useFavoritesStore()
const cart = useCartStore()
const modal = useModalStore()
const { terms } = useShopLocale()
const isShow = ref(false)

watch(() => props.modelValue, value => {
  isShow.value = value
}, { immediate: true })

const hideFavoriteModal = () => {
  emit('update:modelValue', false)
  isShow.value = false
  modal.hideModal()
}

const productImage = (product: typeof favorites.products[number]) =>
  product.images[0]?.image || 'https://placehold.co/160x160'

const isInCart = (productId: number) =>
  cart.items.some(item => item.product.id === productId)
</script>

<template>
  <BaseModal v-model="isShow" full-height type="bottom" content-type="secondary" @close="hideFavoriteModal">
    <template #header-title>{{ terms.common.favorite }}</template>

    <div class="favorite-sidebar">
      <div v-if="favorites.products.length" class="favorite-sidebar__list">
        <article v-for="product in favorites.products" :key="product.id" class="favorite-sidebar__item">
          <img :src="productImage(product)" :alt="product.name" class="favorite-sidebar__image">
          <div class="favorite-sidebar__body">
            <p class="favorite-sidebar__brand">{{ product.brand.name }}</p>
            <NuxtLink :to="`/products/${product.slug}`" class="favorite-sidebar__name" @click="hideFavoriteModal">
              <BaseHoverUnderlineText>{{ product.name }}</BaseHoverUnderlineText>
            </NuxtLink>
            <strong class="favorite-sidebar__price">{{ formatPrice(product.price) }}</strong>
            <div class="favorite-sidebar__actions">
              <button type="button" @click="cart.toggle(product)">
                <BaseHoverUnderlineText>
                  {{ isInCart(product.id) ? terms.product.removeFromCart : terms.favorites.addToCart }}
                </BaseHoverUnderlineText>
              </button>
              <button type="button" @click="favorites.remove(product.id)">
                <BaseHoverUnderlineText>{{ terms.common.remove }}</BaseHoverUnderlineText>
              </button>
            </div>
          </div>
        </article>
      </div>

      <FeedbackState
        v-else
        class="favorite-sidebar__empty"
        compact
        face="sad-droopy-face"
        :title="favorites.count ? terms.favorites.openFull : terms.favorites.noFavorites"
        :description="favorites.count ? terms.favorites.loadFromPage : terms.favorites.saveFromCatalog"
      >
        <BaseButton to="/cabinet/favorites" variant="outline-dark" block @click="hideFavoriteModal">
          {{ terms.favorites.openFavorites }}
        </BaseButton>
      </FeedbackState>
    </div>
  </BaseModal>
</template>

<style scoped>
.favorite-sidebar {
  height: 100%;
  padding: 0.75rem;
}

.favorite-sidebar__list {
  display: grid;
  gap: 0.75rem;
}

.favorite-sidebar__item {
  display: grid;
  grid-template-columns: 5.5rem minmax(0, 1fr);
  gap: 0.75rem;
  border: 1px solid rgb(10 10 10 / 0.1);
  background: #ffffff;
  padding: 0.65rem;
}

.favorite-sidebar__image {
  aspect-ratio: 1;
  width: 100%;
  object-fit: cover;
}

.favorite-sidebar__body {
  display: grid;
  min-width: 0;
  gap: 0.45rem;
}

.favorite-sidebar__brand {
  color: rgb(82 82 82);
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
}

.favorite-sidebar__name {
  display: -webkit-box;
  overflow: hidden;
  color: #0a0a0a;
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.25;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.favorite-sidebar__price {
  font-size: 0.9rem;
}

.favorite-sidebar__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.favorite-sidebar__actions button {
  border: 0;
  background: transparent;
  color: rgb(82 82 82);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 700;
}

.favorite-sidebar__empty {
  min-height: 100%;
  --feedback-state-surface: #f3f4f7;
}
</style>
