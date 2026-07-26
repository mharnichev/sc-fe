<script setup lang="ts">
import FeedbackState from '~/components/ui/FeedbackState.vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const cart = useCartStore()
const modal = useModalStore()
const { terms } = useShopLocale()
const { formatPrice } = useShopPriceFormatter()
const isShow = ref(false)

watch(() => props.modelValue, value => {
  isShow.value = value
}, { immediate: true })

const hideBasketModal = () => {
  emit('update:modelValue', false)
  isShow.value = false
  modal.hideModal()
}

const productImage = (item: typeof cart.items[number]) =>
  item.product.images[0]?.image || 'https://placehold.co/160x160'
</script>

<template>
  <BaseModal v-model="isShow" full-height type="bottom" content-type="secondary" @close="hideBasketModal">
    <template #header-title>{{ terms.common.basket }}</template>

    <div class="basket-sidebar">
      <div v-if="cart.items.length" class="basket-sidebar__list">
        <article v-for="item in cart.items" :key="item.product.id" class="basket-sidebar__item">
          <img :src="productImage(item)" :alt="item.product.name" class="basket-sidebar__image">
          <div class="basket-sidebar__body">
            <div>
              <p class="basket-sidebar__brand">{{ item.product.brand.name }}</p>
              <NuxtLink :to="`/products/${item.product.slug}`" class="basket-sidebar__name" @click="hideBasketModal">
                <BaseHoverUnderlineText>{{ item.product.name }}</BaseHoverUnderlineText>
              </NuxtLink>
            </div>

            <div class="basket-sidebar__meta">
              <span>{{ formatPrice(item.product.price) }}</span>
              <BaseQuantityStepper
                class="basket-sidebar__qty"
                :model-value="item.quantity"
                :min="0"
                :max="Math.max(1, item.product.stock)"
                :disabled="cart.syncing"
                :aria-label="terms.checkout.quantityFor(item.product.name)"
                @update:model-value="cart.update(item.product.id, $event)"
              />
            </div>

            <BaseButton class="basket-sidebar__remove" type="button" variant="text" @click="cart.remove(item.product.id)">
              {{ terms.common.remove }}
            </BaseButton>
          </div>
        </article>
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

    <template v-if="cart.items.length" #bottom-buttons>
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
.basket-sidebar {
  height: 100%;
  padding: 0.75rem;
}

.basket-sidebar__list {
  display: grid;
  gap: 0.75rem;
  padding-bottom: 1rem;
}

.basket-sidebar__item {
  display: grid;
  grid-template-columns: 5.5rem minmax(0, 1fr);
  gap: 0.75rem;
  border: 1px solid rgb(10 10 10 / 0.1);
  background: #ffffff;
  padding: 0.65rem;
}

.basket-sidebar__image {
  aspect-ratio: 1;
  width: 100%;
  object-fit: cover;
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

.basket-sidebar__name {
  display: -webkit-box;
  overflow: hidden;
  color: #0a0a0a;
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.25;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.basket-sidebar__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.85rem;
  font-weight: 800;
}

.basket-sidebar__qty {
  grid-template-columns: 1.75rem 2rem 1.75rem;
}

.basket-sidebar__qty :deep(.base-quantity-stepper__button),
.basket-sidebar__qty :deep(.base-quantity-stepper__input) {
  height: 1.75rem;
}

.basket-sidebar__remove {
  --sc-button-text: rgb(82 82 82);
  --sc-button-hover-text: #0a0a0a;

  justify-self: start;
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
