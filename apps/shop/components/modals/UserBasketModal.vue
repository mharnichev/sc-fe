<script setup lang="ts">
import type { ProductDto } from '@shared-types'
import FeedbackState from '~/components/ui/FeedbackState.vue'
import { isProductHidden, isProductUnavailable } from '~/utils/product-visibility'
const { runtimeMessage } = useShopRuntimeDisplay()

const { productDisplayName, productDisplayType } = useProductDisplay()

type BasketSidebarTab = 'basket' | 'recently-viewed'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const cart = useCartStore()
const favorites = useFavoritesStore()
const modal = useModalStore()
const recentlyViewed = useRecentlyViewedStore()
const { terms } = useShopLocale()
const { formatPrice } = useShopPriceFormatter()
const isShow = ref(false)
const activeTab = ref<BasketSidebarTab>('basket')

watch(() => props.modelValue, value => {
  isShow.value = value
}, { immediate: true })

watch(isShow, value => {
  if (!value) activeTab.value = 'basket'
})

onMounted(() => {
  recentlyViewed.hydrate()
})

const hideBasketModal = () => {
  emit('update:modelValue', false)
  isShow.value = false
  modal.hideModal()
}

const handleRecentlyViewedProductClick = (event: MouseEvent) => {
  const target = event.target
  if (!(target instanceof Element) || !target.closest('a')) return

  hideBasketModal()
}

const productImage = (product: ProductDto) =>
  product.images[0]?.image || product.images[0]?.image_url || 'https://placehold.co/160x160'

const unavailableMessage = computed(() => terms.value.checkout.unavailableProducts(
  cart.unavailableItems.map(item => productDisplayName(item.product)).join(', '),
))
</script>

<template>
  <BaseModal v-model="isShow" full-height type="bottom" @close="hideBasketModal">
    <template #header-title>
      <div
        class="basket-sidebar__tabs"
        :style="{ '--basket-tab-index': activeTab === 'basket' ? 0 : 1 }"
        role="tablist"
        :aria-label="terms.common.basket"
      >
        <button
          id="basket-sidebar-tab-basket"
          class="basket-sidebar__tab"
          :class="{ 'basket-sidebar__tab--active': activeTab === 'basket' }"
          type="button"
          role="tab"
          :aria-selected="activeTab === 'basket'"
          aria-controls="basket-sidebar-panel-basket"
          @click="activeTab = 'basket'"
        >
          {{ terms.common.basket }}
        </button>
        <button
          id="basket-sidebar-tab-recently-viewed"
          class="basket-sidebar__tab"
          :class="{ 'basket-sidebar__tab--active': activeTab === 'recently-viewed' }"
          type="button"
          role="tab"
          :aria-selected="activeTab === 'recently-viewed'"
          aria-controls="basket-sidebar-panel-recently-viewed"
          @click="activeTab = 'recently-viewed'"
        >
          {{ terms.common.recentlyViewed }}
        </button>
      </div>
    </template>

    <div
      :id="`basket-sidebar-panel-${activeTab}`"
      class="basket-sidebar"
      role="tabpanel"
      :aria-labelledby="`basket-sidebar-tab-${activeTab}`"
    >
      <Transition name="basket-sidebar-list" mode="out-in">
        <div v-if="activeTab === 'basket'" key="basket" class="basket-sidebar__panel">
        <div v-if="cart.items.length" class="basket-sidebar__list">
          <template v-for="(item, index) in cart.items" :key="item.product.id">
            <div v-if="index > 0" class="basket-sidebar__divider" aria-hidden="true">
              <span class="basket-sidebar__divider-line" />
            </div>
            <article class="basket-sidebar__item" :class="{ 'basket-sidebar__item--unavailable': isProductUnavailable(item.product) }">
              <img :src="productImage(item.product)" :alt="productDisplayName(item.product)" class="basket-sidebar__image">
              <div class="basket-sidebar__body">
                <div class="basket-sidebar__title-row">
                  <div class="basket-sidebar__title-copy">
                    <p class="basket-sidebar__brand">{{ item.product.brand.name }}</p>
                    <NuxtLink v-if="!isProductHidden(item.product)" :to="`/products/${item.product.slug}`" class="basket-sidebar__name" @click="hideBasketModal">
                      <BaseHoverUnderlineText>{{ productDisplayName(item.product) }}</BaseHoverUnderlineText>
                    </NuxtLink>
                    <span v-else class="basket-sidebar__name basket-sidebar__name--unavailable" aria-disabled="true">
                      {{ productDisplayName(item.product) }}
                    </span>
                    <p v-if="productDisplayType(item.product)" class="basket-sidebar__type">{{ productDisplayType(item.product) }}</p>
                    <p v-if="isProductUnavailable(item.product)" class="basket-sidebar__unavailable">
                      {{ terms.basket.unavailable }}
                    </p>
                  </div>
                  <p class="basket-sidebar__meta">{{ formatPrice(item.product.price) }}</p>
                </div>
                <BaseQuantityStepper
                  class="basket-sidebar__qty"
                  variant="stacked"
                  :model-value="item.quantity"
                  :min="0"
                  :max="cart.maxQuantity(item.product, item.quantity)"
                  :disabled="cart.syncing"
                  :disable-increase="isProductUnavailable(item.product)"
                  :aria-label="terms.checkout.quantityFor(productDisplayName(item.product))"
                  @update:model-value="cart.update(item.product.id, $event)"
                />
                <div class="basket-sidebar__actions">
                  <BaseButton class="basket-sidebar__remove" type="button" variant="text" :disabled="cart.syncing" @click="cart.remove(item.product.id)">
                    <BaseHoverUnderlineText :disabled="cart.syncing">{{ terms.common.remove }}</BaseHoverUnderlineText>
                  </BaseButton>
                  <BaseButton
                    class="basket-sidebar__remove"
                    :class="{ 'basket-sidebar__favorite--active': favorites.has(item.product.id) }"
                    type="button"
                    variant="text"
                    :disabled="favorites.syncing || (isProductUnavailable(item.product) && !favorites.has(item.product.id))"
                    :aria-pressed="favorites.has(item.product.id)"
                    @click="favorites.toggle(item.product.id, item.product)"
                  >
                    <BaseIcon name="heart" size="xxs" effect="heart" />
                    <BaseHoverUnderlineText :disabled="favorites.syncing || (isProductUnavailable(item.product) && !favorites.has(item.product.id))">
                      {{ favorites.has(item.product.id) ? terms.product.removeFavorite : terms.product.saveFavorite }}
                    </BaseHoverUnderlineText>
                  </BaseButton>
                </div>
              </div>
            </article>
          </template>
        </div>

        <FeedbackState
          v-else
          class="basket-sidebar__empty"
          compact
          face="sad-droopy-face"
          :title="terms.basket.emptyTitle"
          :description="terms.basket.emptyText"
        >
          <BaseButton to="/catalog" variant="outline-dark" block @click="hideBasketModal">
            {{ terms.basket.browseCatalog }}
          </BaseButton>
        </FeedbackState>
        </div>

        <div v-else key="recently-viewed" class="basket-sidebar__panel">
        <div
          v-if="recentlyViewed.products.length"
          class="basket-sidebar__product-grid-wrapper"
          @click="handleRecentlyViewedProductClick"
        >
          <CatalogProductGrid
            class="basket-sidebar__product-grid"
            :products="recentlyViewed.products"
          />
        </div>

        <FeedbackState
          v-else
          class="basket-sidebar__empty"
          compact
          face="sad-droopy-face"
          :title="terms.common.recentlyViewed"
          :description="terms.common.recentlyViewedDescription"
        >
          <BaseButton to="/catalog" variant="outline-dark" block @click="hideBasketModal">
            {{ terms.basket.browseCatalog }}
          </BaseButton>
        </FeedbackState>
        </div>
      </Transition>
    </div>

    <template v-if="activeTab === 'basket' && cart.items.length" #bottom-buttons>
      <div class="basket-sidebar__summary">
        <div class="basket-sidebar__total">
          <span>{{ terms.basket.orderTotal }}</span>
          <strong>{{ formatPrice(cart.total) }}</strong>
        </div>
        <p class="basket-sidebar__discount-note">{{ terms.basket.discountNote }}</p>
        <p v-if="cart.error" class="basket-sidebar__unavailable-summary" role="alert">{{ runtimeMessage(cart.error) }}</p>
        <p v-if="cart.hasUnavailableItems" class="basket-sidebar__unavailable-summary" role="alert">
          {{ unavailableMessage }}
        </p>
        <BaseButton :to="cart.hasUnavailableItems ? undefined : '/checkout/purchase'" block :disabled="cart.syncing || cart.hasUnavailableItems" @click="hideBasketModal">
          {{ terms.basket.proceedToPayment }}
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
.basket-sidebar__tabs {
  position: relative;
  display: grid;
  width: min(21rem, 100%);
  min-height: 2.25rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: center;
  background: #ffffff;
}

.basket-sidebar__tabs::before {
  position: absolute;
  inset-block: 0;
  left: 0;
  z-index: 0;
  width: 50%;
  background: #0a0a0a;
  content: '';
  transform: translateX(calc(var(--basket-tab-index) * 100%));
  transition: transform 300ms cubic-bezier(0.3, 1, 0.3, 1);
}

.basket-sidebar__tab {
  position: relative;
  z-index: 1;
  min-width: 0;
  min-height: 2.125rem;
  overflow: hidden;
  padding: 0.375rem 0.45rem;
  border: 0;
  background: transparent;
  color: #5d626c;
  font-size: 0.725rem;
  font-weight: 700;
  line-height: 1.05;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
  cursor: pointer;
  transition: color 220ms ease;
}

.basket-sidebar__tab--active {
  color: #ffffff;
}

.basket-sidebar__tab:not(.basket-sidebar__tab--active):hover {
  color: #0a0a0a;
}

.basket-sidebar__tab:focus-visible {
  outline: 2px solid #0a0a0a;
  outline-offset: 0.125rem;
}

.basket-sidebar {
  height: 100%;
  padding: 0.75rem;
}

.basket-sidebar .basket-sidebar__product-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.basket-sidebar__panel {
  min-height: 100%;
}

.basket-sidebar-list-enter-active,
.basket-sidebar-list-leave-active {
  transition:
    opacity 220ms ease,
    transform 300ms cubic-bezier(0.3, 1, 0.3, 1);
}

.basket-sidebar-list-enter-from {
  opacity: 0;
  transform: translateY(0.5rem);
}

.basket-sidebar-list-leave-to {
  opacity: 0;
  transform: translateY(-0.25rem);
}

.basket-sidebar__list {
  display: grid;
  padding-bottom: 1rem;
}

.basket-sidebar__item {
  display: grid;
  grid-template-columns: 5.5rem minmax(0, 1fr);
  gap: 0.75rem;
  background: #ffffff;
  padding: 0.65rem;
}

.basket-sidebar__item--unavailable {
  opacity: 0.72;
}

.basket-sidebar__divider {
  padding: 0.75rem 0.65rem;
}

.basket-sidebar__divider-line {
  display: block;
  height: 1px;
  background: rgb(10 10 10 / 0.08);
}

.basket-sidebar__image {
  aspect-ratio: 1;
  width: 100%;
  object-fit: cover;
  transition: transform 300ms cubic-bezier(0.3, 1, 0.3, 1);
}

.basket-sidebar__image-link {
  display: block;
  overflow: hidden;
  aspect-ratio: 1;
}

.basket-sidebar__image-link .basket-sidebar__image {
  height: 100%;
}

@media (hover: hover) {
  .basket-sidebar__image:hover {
    transform: scale(1.04);
  }
}

@media (prefers-reduced-motion: reduce) {
  .basket-sidebar-list-enter-active,
  .basket-sidebar-list-leave-active,
  .basket-sidebar__tabs::before,
  .basket-sidebar__tab,
  .basket-sidebar__image {
    transition: none;
  }
}

.basket-sidebar__body {
  display: grid;
  min-width: 0;
  gap: 0.6rem;
}

.basket-sidebar__brand {
  color: rgb(82 82 82);
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
}

.basket-sidebar__title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.basket-sidebar__title-copy {
  min-width: 0;
  flex: 1;
}

.basket-sidebar__name {
  display: -webkit-box;
  overflow: hidden;
  min-width: 0;
  color: #0a0a0a;
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.25;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.basket-sidebar__name--unavailable,
.basket-sidebar__unavailable {
  color: #a16207;
}

.basket-sidebar__unavailable {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.basket-sidebar__type {
  margin-top: 0.3rem;
  color: #737373;
  font-size: 0.8rem;
  line-height: 1.4;
}

.basket-sidebar__qty {
  justify-self: start;
}

.basket-sidebar__meta {
  flex: 0 0 auto;
  white-space: nowrap;
  font-size: 0.85rem;
  font-weight: 800;
}

.basket-sidebar__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
}

.basket-sidebar__remove {
  --sc-button-text: rgb(82 82 82);
  --sc-button-hover-text: #0a0a0a;

  font-size: 0.75rem;
  font-weight: 700;
  text-decoration: none;
}

.basket-sidebar__favorite--active :deep(.base-icon) {
  color: #c01818;
}

.basket-sidebar__favorite--active :deep(svg) {
  fill: currentColor;
}

@media (max-width: 479px) {
  .basket-sidebar__item {
    grid-template-columns: 4rem minmax(0, 1fr);
    gap: 0.5rem;
    padding-inline: 0;
  }

  .basket-sidebar__title-row {
    gap: 0.5rem;
  }

  .basket-sidebar__meta {
    font-size: 0.75rem;
  }
}

.basket-sidebar__empty {
  min-height: 100%;
  --feedback-state-surface: var(--sc-surface-muted);
}

.basket-sidebar__summary {
  display: grid;
  gap: 0.85rem;
}

.basket-sidebar__total {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.9rem;
}

.basket-sidebar__total strong {
  white-space: nowrap;
}

.basket-sidebar__discount-note {
  color: #737373;
  font-size: 0.75rem;
  line-height: 1.45;
}

.basket-sidebar__unavailable-summary {
  color: #a16207;
  font-size: 0.75rem;
  line-height: 1.45;
}
</style>
