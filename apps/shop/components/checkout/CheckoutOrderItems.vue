<script setup lang="ts">
import type { CheckoutOrderItem } from '~/types/order'
const props = defineProps<{ items: CheckoutOrderItem[] }>()
const { terms } = useShopLocale()
const { orderItemName } = useShopRuntimeDisplay()
const { formatPrice } = useShopPriceFormatter()
</script>

<template>
  <ul class="checkout-receipt" data-testid="confirmed-order-items" :aria-label="terms.cabinet.items">
    <li v-for="item in props.items" :key="item.id" class="checkout-receipt__item soft-surface">
      <OrderItemImage :src="item.product_image_url" :name="orderItemName(item)" />
      <div class="checkout-receipt__copy">
        <h2>{{ orderItemName(item) }}</h2>
        <p v-if="item.product_variant">{{ item.product_variant }}</p>
        <p v-if="item.product_sku">{{ item.product_sku }}</p>
        <p>{{ item.quantity }} × {{ formatPrice(item.price) }}</p>
      </div>
      <strong v-if="item.total_price != null">{{ formatPrice(item.total_price) }}</strong>
    </li>
  </ul>
</template>

<style scoped>
.checkout-receipt { display: grid; gap: .75rem; min-width: 0; }
.checkout-receipt__item { display: flex; flex-wrap: wrap; align-items: center; gap: .75rem; padding: 1rem; min-width: 0; }
.checkout-receipt__copy { flex: 1; min-width: 8rem; overflow-wrap: anywhere; }
.checkout-receipt__copy h2 { font-size: .95rem; font-weight: 800; line-height: 1.4; }
.checkout-receipt__copy p { margin-top: .25rem; color: #525252; font-size: .8rem; }
.checkout-receipt__item > strong { margin-left: auto; font-size: .9rem; }
</style>
