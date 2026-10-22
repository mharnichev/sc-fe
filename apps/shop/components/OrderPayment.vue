<script setup lang="ts">
const { paymentText } = usePaymentDisplay()
const { runtimeMessage } = useShopRuntimeDisplay()
const props = defineProps<{ orderId: number, guestToken?: string, orderPath?: string }>()
const { payment, busy, error, refresh, create } = useOrderPayment(() => props.orderId, () => props.guestToken)
const orderPath = ref('')
const isOrderPath = (value: string) => value === `/cabinet/orders/${props.orderId}` || /^\/tracking\/[A-Za-z0-9._~-]{20,2048}$/.test(value)
watch(() => [props.orderId, props.orderPath], () => {
  const key = `shop-order-payment-order-path:${props.orderId}`
  const supplied = props.orderPath && isOrderPath(props.orderPath) ? props.orderPath : ''
  try {
    const path = supplied || sessionStorage.getItem(key) || ''
    orderPath.value = isOrderPath(path) ? path : ''
    if (supplied) sessionStorage.setItem(key, supplied)
  } catch { orderPath.value = supplied }
}, { immediate: true })
const settled = computed(() => Boolean(payment.value?.paid && ['accepted', 'paid_receipt_pending'].includes(payment.value.status)))
const paid = computed(() => Boolean(payment.value?.paid || ['accepted', 'paid_receipt_pending'].includes(payment.value?.status || '')))
const pageUrl = computed(() => !paid.value && payment.value?.status === 'waiting' ? safePaymentUrl(payment.value.page_url) : null)
const receiptUrl = computed(() => safePaymentUrl(payment.value?.receipt_url, true))
const labels = computed(() => paymentText.value.statuses)
const paymentError = computed(() => error.value === 'Не вдалося оновити оплату. Спробуйте ще раз.'
  ? paymentText.value.updateError : runtimeMessage(error.value))
const illustrationTone = computed(() => settled.value ? 'success'
  : error.value || payment.value?.status === 'requires_review' || (payment.value && !payment.value.enabled) ? 'error' : null)
const title = computed(() => settled.value ? paymentText.value.paidTitle
  : payment.value?.status === 'requires_review' ? paymentText.value.reviewTitle : paymentText.value.heading)
const hint = computed(() => {
  if (!payment.value && busy.value) return paymentText.value.loading
  if (settled.value) return paymentText.value.paidNext
  if (payment.value?.status === 'requires_review') return paymentText.value.reviewHint
  if (error.value) return paymentText.value.connectionHint
  if (payment.value?.status === 'creation_unknown') return paymentText.value.checking
  if (payment.value && !payment.value.enabled) return paymentText.value.disabled
  if (payment.value?.status === 'waiting') return paymentText.value.waitingHint
  return paymentText.value.ready
})
const amount = computed(() => {
  const minor = payment.value?.amount_minor
  if (typeof minor !== 'number' || !Number.isSafeInteger(minor) || minor < 0) return ''
  return new Intl.NumberFormat(paymentText.value.order === 'Order' ? 'en-GB' : 'uk-UA', { style: 'currency', currency: 'UAH' }).format(minor / 100)
})
</script>

<template>
  <section class="order-payment soft-surface" :class="{ 'order-payment--paid': settled }" :aria-label="paymentText.label" :aria-busy="busy">
    <div class="order-payment__context">
      <span>{{ paymentText.order }} № {{ orderId }}</span>
      <strong v-if="amount">{{ amount }}</strong>
    </div>
    <div class="order-payment__heading">
      <h2>{{ title }}</h2>
      <span class="order-payment__illustration"><PaymentStatusIllustration v-if="illustrationTone" :tone="illustrationTone" /></span>
    </div>
    <p v-if="payment" class="order-payment__status" role="status">{{ labels[payment.status] || paymentText.statuses.requires_review }}</p>
    <p v-else-if="busy" role="status">{{ paymentText.loading }}</p>
    <p class="order-payment__hint">{{ hint }}</p>
    <p v-if="settled && !payment?.receipt_accepted" class="order-payment__hint">{{ paymentText.receiptPending }}</p>
    <div class="order-payment__actions">
      <BaseButton v-if="payment?.enabled && payment.status === 'not_started' && !paid && !error" :disabled="busy" @click="create">{{ paymentText.create }}</BaseButton>
      <BaseButton v-if="pageUrl" :href="pageUrl" target="_blank" rel="noopener noreferrer">{{ paymentText.pay }}</BaseButton>
      <BaseButton v-if="receiptUrl && payment?.receipt_accepted" :href="receiptUrl" target="_blank" rel="noopener noreferrer">{{ paymentText.receipt }}</BaseButton>
      <BaseButton variant="borderless" :disabled="busy" @click="refresh">{{ paymentText.refresh }}</BaseButton>
      <BaseButton v-if="orderPath" :to="orderPath" variant="borderless">{{ paymentText.viewOrder }}</BaseButton>
      <BaseButton v-if="error || payment?.status === 'requires_review' || (payment && !payment.enabled)" to="/contacts" variant="text">{{ paymentText.contact }}</BaseButton>
    </div>
    <p v-if="pageUrl || payment?.status === 'not_started'" class="order-payment__security">{{ paymentText.provider }}. {{ paymentText.protected }}</p>
    <p v-if="error" class="order-payment__error" role="alert">{{ paymentError }}</p>
  </section>
</template>

<style scoped>
.order-payment {
  display: grid;
  min-width: 0;
  gap: 1rem;
  padding: clamp(1rem, 3vw, 2rem);
}
.order-payment--paid h2 { color: #166534; }
.order-payment__context { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .5rem 1rem; font-size: .875rem; }
.order-payment__heading { display: grid; grid-template-columns: minmax(0, 1fr) 64px; align-items: center; gap: .75rem; min-height: 64px; }
.order-payment__illustration { width: 64px; height: 64px; display: grid; place-items: center; }
.order-payment h2 { font-size: clamp(1.25rem, 3vw, 1.75rem); font-weight: 800; line-height: 1.2; }
.order-payment__status { font-weight: 700; }
.order-payment__hint { color: #525252; line-height: 1.6; }
.order-payment__actions { display: flex; flex-wrap: wrap; gap: .75rem; }
.order-payment__actions > * { max-width: 100%; }
.order-payment__security { color: #737373; font-size: .75rem; line-height: 1.5; }
.order-payment__error { color: #a16207; line-height: 1.5; }
@media (max-width: 575px) {
  .order-payment__heading { grid-template-columns: minmax(0, 1fr) 56px; min-height: 56px; }
  .order-payment__illustration { width: 56px; height: 56px; }
  .order-payment__actions { display: grid; }
  .order-payment__actions > * { width: 100%; }
}
</style>
