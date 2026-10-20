<script setup lang="ts">
const route = useRoute()
const id = computed(() => Number(route.params.id))
const valid = computed(() => Number.isSafeInteger(id.value) && id.value > 0)
useSeo(() => 'Оплата замовлення', () => 'Захищений статус оплати замовлення')
useHead({ meta: [{ name: 'robots', content: 'noindex,nofollow' }, { name: 'referrer', content: 'no-referrer' }] })
</script>
<template><main class="payment-page"><h1>Оплата замовлення</h1><OrderPayment v-if="valid" :key="id" :order-id="id" /><p v-else role="alert">Замовлення недоступне.</p></main></template>
<style scoped>.payment-page { display: grid; gap: 1rem; max-width: 48rem; margin: 2rem auto; padding: 1rem; }</style>
