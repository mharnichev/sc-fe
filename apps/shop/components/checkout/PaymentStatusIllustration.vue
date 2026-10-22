<script setup lang="ts">
defineProps<{ tone: 'success' | 'error' }>()
const shopAsset = useShopAsset()
</script>
<template>
  <img class="payment-status-illustration" :src="shopAsset(`/checkout-status/${tone}.webp`)" alt="" aria-hidden="true" width="64" height="64" decoding="async">
</template>
<style scoped>
.payment-status-illustration { display: block; width: 64px; height: 64px; object-fit: contain; flex: none; }
@media (max-width: 575px) { .payment-status-illustration { width: 56px; height: 56px; } }
</style>
