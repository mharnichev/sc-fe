<script setup lang="ts">
import type { ProductDto } from '@shared-types'
import FeedbackState from '~/components/ui/FeedbackState.vue'

type BasketSidebarTab = 'basket' | 'recently-viewed'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const cart = useCartStore()
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

const productImage = (product: ProductDto) =>
  product.images[0]?.image || product.images[0]?.image_url || 'https://placehold.co/160x160'
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
            <article class="basket-sidebar__item">
              <img :src="productImage(item.product)" :alt="item.product.name" class="basket-sidebar__image">
              <div class="basket-sidebar__body">
                <div>
                  <p class="basket-sidebar__brand">{{ item.product.brand.name }}</p>
                  <div class="basket-sidebar__title-row">
                    <div class="basket-sidebar__title-copy">
                      <NuxtLink :to="`/products/${item.product.slug}`" class="basket-sidebar__name" @click="hideBasketModal">
                        <BaseHoverUnderlineText>{{ item.product.name }}</BaseHoverUnderlineText>
                      </NuxtLink>
                      <div class="basket-sidebar__meta">
                        <span>{{ formatPrice(item.product.price) }}</span>
                      </div>
                    </div>
                    <div class="basket-sidebar__actions">
                      <BaseQuantityStepper
                        class="basket-sidebar__qty"
                        variant="stacked"
                        :model-value="item.quantity"
                        :min="0"
                        :max="Math.max(1, item.product.stock)"
                        :disabled="cart.syncing"
                        :aria-label="terms.checkout.quantityFor(item.product.name)"
                        @update:model-value="cart.update(item.product.id, $event)"
                      />
                      <BaseButton class="basket-sidebar__remove" type="button" variant="text" @click="cart.remove(item.product.id)">
                        {{ terms.common.remove }}
                      </BaseButton>
                    </div>
                  </div>
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
        <div v-if="recentlyViewed.products.length" class="basket-sidebar__list">
          <template v-for="(product, index) in recentlyViewed.products" :key="product.id">
            <div v-if="index > 0" class="basket-sidebar__divider" aria-hidden="true">
              <span class="basket-sidebar__divider-line" />
            </div>
            <article class="basket-sidebar__item">
              <NuxtLink
                :to="`/products/${product.slug}`"
                class="basket-sidebar__image-link"
                @click="hideBasketModal"
              >
                <img :src="productImage(product)" :alt="product.name" class="basket-sidebar__image">
              </NuxtLink>
              <div class="basket-sidebar__body">
                <div>
                  <p class="basket-sidebar__brand">{{ product.brand.name }}</p>
                  <NuxtLink :to="`/products/${product.slug}`" class="basket-sidebar__name" @click="hideBasketModal">
                    <BaseHoverUnderlineText>{{ product.name }}</BaseHoverUnderlineText>
                  </NuxtLink>
                  <div class="basket-sidebar__meta">
                    <span>{{ formatPrice(product.price) }}</span>
                  </div>
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
          <span>{{ terms.basket.beforeDelivery }}</span>
          <strong>{{ formatPrice(cart.total) }}</strong>
        </div>
        <BaseButton to="/checkout/purchase" block @click="hideBasketModal">
          {{ terms.common.checkout }}
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

.basket-sidebar__meta {
  margin-top: 0.3rem;
  font-size: 0.85rem;
  font-weight: 800;
}

.basket-sidebar__actions {
  display: grid;
  flex: 0 0 auto;
  justify-items: center;
  gap: 1rem;
}

.basket-sidebar__remove {
  --sc-button-text: rgb(82 82 82);
  --sc-button-hover-text: #0a0a0a;

  font-size: 0.75rem;
  font-weight: 700;
}

.basket-sidebar__empty {
  min-height: 100%;
  --feedback-state-surface: #f3f4f7;
}

.basket-sidebar__summary {
  display: grid;
  gap: 0.85rem;
}

.basket-sidebar__total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.9rem;
}
</style>
