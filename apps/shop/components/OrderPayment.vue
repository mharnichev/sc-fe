<script setup lang="ts">
const { paymentText } = usePaymentDisplay()
const { runtimeMessage } = useShopRuntimeDisplay()
const props = defineProps<{ orderId: number, guestToken?: string }>()
const { payment, busy, error, refresh, create } = useOrderPayment(() => props.orderId, () => props.guestToken)
const pageUrl = computed(() => safePaymentUrl(payment.value?.page_url))
const receiptUrl = computed(() => safePaymentUrl(payment.value?.receipt_url, true))
const labels = computed(() => paymentText.value.statuses)
const paymentError = computed(() => error.value === 'Не вдалося оновити оплату. Спробуйте ще раз.'
  ? paymentText.value.updateError : runtimeMessage(error.value))
</script>
<template>
  <section class="order-payment" :aria-label="paymentText.label" :aria-busy="busy">
    <h2>{{ paymentText.heading }}</h2>
    <p v-if="payment" role="status">{{ labels[payment.status] }}</p>
    <BaseButton v-if="payment?.enabled && payment.status === 'not_started'" :disabled="busy" @click="create">{{ paymentText.create }}</BaseButton>
    <BaseButton v-if="pageUrl && !payment?.paid" :href="pageUrl" target="_blank" rel="noopener noreferrer">{{ paymentText.pay }}</BaseButton>
    <BaseButton v-if="receiptUrl && payment?.receipt_accepted" :href="receiptUrl" target="_blank" rel="noopener noreferrer">{{ paymentText.receipt }}</BaseButton>
    <BaseButton variant="outline-dark" :disabled="busy" @click="refresh">{{ paymentText.refresh }}</BaseButton>
    <p v-if="error" role="alert">{{ paymentError }}</p>
  </section>
</template>
<style scoped>.order-payment { display: grid; gap: .75rem; justify-items: start; }</style>
