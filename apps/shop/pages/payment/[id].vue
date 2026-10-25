<script setup lang="ts">
const { paymentText } = usePaymentDisplay()
const route = useRoute()
const auth = useCustomerAuthStore()
const id = computed(() => Number(route.params.id))
const valid = computed(() => Number.isSafeInteger(id.value) && id.value > 0)
useSeo(() => paymentText.value.title, () => paymentText.value.description)
useHead({ meta: [{ name: 'robots', content: 'noindex,nofollow' }, { name: 'referrer', content: 'no-referrer' }] })
</script>
<template>
  <main class="payment-page">
    <h1>{{ paymentText.title }}</h1>
    <OrderPayment v-if="valid" :key="id" :order-id="id" :order-path="auth.isAuthenticated ? `/cabinet/orders/${id}` : undefined" />
    <section v-else role="alert">
      <h2>{{ paymentText.unavailable }}</h2>
      <p>{{ paymentText.accessHint }}</p>
      <BaseButton to="/contacts" variant="outline-dark">{{ paymentText.contact }}</BaseButton>
    </section>
    <BaseButton to="/catalog" variant="text">{{ paymentText.catalog }}</BaseButton>
  </main>
</template>
<style scoped>
.payment-page { display: grid; gap: 1.25rem; max-width: 48rem; margin: 2rem auto; padding: 1rem; }
.payment-page h1 { font-size: 2rem; font-weight: 800; overflow-wrap: anywhere; }
.payment-page section { display: grid; gap: 1rem; line-height: 1.5; }
</style>
