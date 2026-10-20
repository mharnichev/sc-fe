<script setup lang="ts">
const props = defineProps<{ orderId: number, guestToken?: string }>()
const { payment, busy, error, refresh, create } = useOrderPayment(() => props.orderId, () => props.guestToken)
const pageUrl = computed(() => safePaymentUrl(payment.value?.page_url))
const receiptUrl = computed(() => safePaymentUrl(payment.value?.receipt_url, true))
const labels = { not_started: 'Оплату ще не розпочато', creation_unknown: 'Уточнюємо стан оплати', waiting: 'Очікуємо оплату', paid_receipt_pending: 'Оплату отримано. Готуємо чек.', accepted: 'Оплату прийнято, чек готовий', requires_review: 'Стан оплати потребує уточнення' }
</script>
<template>
  <section class="order-payment" aria-label="Онлайн-оплата" :aria-busy="busy">
    <h2>Онлайн-оплата карткою</h2>
    <p v-if="payment" role="status">{{ labels[payment.status] }}</p>
    <BaseButton v-if="payment?.enabled && payment.status === 'not_started'" :disabled="busy" @click="create">Створити посилання на оплату</BaseButton>
    <BaseButton v-if="pageUrl && !payment?.paid" :href="pageUrl" target="_blank" rel="noopener noreferrer">Перейти до оплати</BaseButton>
    <BaseButton v-if="receiptUrl && payment?.receipt_accepted" :href="receiptUrl" target="_blank" rel="noopener noreferrer">Переглянути фіскальний чек</BaseButton>
    <BaseButton variant="outline-dark" :disabled="busy" @click="refresh">Оновити статус оплати</BaseButton>
    <p v-if="error" role="alert">{{ error }}</p>
  </section>
</template>
<style scoped>.order-payment { display: grid; gap: .75rem; justify-items: start; }</style>
