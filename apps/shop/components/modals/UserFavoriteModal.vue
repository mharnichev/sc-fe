<script setup lang="ts">
import FeedbackState from '~/components/ui/FeedbackState.vue'
import { isProductHidden, isProductUnavailable } from '~/utils/product-visibility'

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
const { formatPrice } = useShopPriceFormatter()
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
        <article v-for="product in favorites.products" :key="product.id" class="favorite-sidebar__item" :class="{ 'favorite-sidebar__item--unavailable': isProductUnavailable(product) }">
          <img :src="productImage(product)" :alt="product.name" class="favorite-sidebar__image">
          <div class="favorite-sidebar__body">
            <p class="favorite-sidebar__brand">{{ product.brand.name }}</p>
            <NuxtLink v-if="!isProductHidden(product)" :to="`/products/${product.slug}`" class="favorite-sidebar__name" @click="hideFavoriteModal">
              <BaseHoverUnderlineText>{{ product.name }}</BaseHoverUnderlineText>
            </NuxtLink>
            <span v-else class="favorite-sidebar__name favorite-sidebar__name--unavailable" aria-disabled="true">
              {{ product.name }}
            </span>
            <strong class="favorite-sidebar__price">{{ formatPrice(product.price) }}</strong>
            <p v-if="isProductUnavailable(product)" class="favorite-sidebar__unavailable">{{ terms.favorites.unavailable }}</p>
            <div class="favorite-sidebar__actions">
              <BaseButton type="button" variant="text" :disabled="isProductUnavailable(product)" @click="cart.toggle(product)">
                {{ isInCart(product.id) ? terms.product.removeFromCart : terms.favorites.addToCart }}
              </BaseButton>
              <BaseButton type="button" variant="text" @click="favorites.remove(product.id)">
                {{ terms.common.remove }}
              </BaseButton>
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
  background: #ffffff;
  padding: 0.65rem;
}

.favorite-sidebar__item--unavailable {
  opacity: 0.72;
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

.favorite-sidebar__name--unavailable,
.favorite-sidebar__unavailable {
  color: #a16207;
}

.favorite-sidebar__unavailable {
  font-size: 0.75rem;
  font-weight: 600;
}

.favorite-sidebar__price {
  font-size: 0.9rem;
}

.favorite-sidebar__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.favorite-sidebar__actions :deep(.sc-button) {
  --sc-button-text: rgb(82 82 82);
  --sc-button-hover-text: #0a0a0a;

  font-size: 0.75rem;
  font-weight: 700;
}

.favorite-sidebar__empty {
  min-height: 100%;
  --feedback-state-surface: #f3f4f7;
}
</style>
