<script setup lang="ts">
import type { CustomerOrder } from '~/types/order'
import FeedbackState from '~/components/ui/FeedbackState.vue'
import { orderTrackingText, shopOrderHasTestProjection, shopOrderHasCheckboxProjection, shopOrderHasNPReturnProjection, shopOrderHasPaymentResolutionProjection, shopOrderHasPaymentProjection } from '~/utils/orderTrackingText'
const { runtimeText, runtimeMessage, orderItemName } = useShopRuntimeDisplay()

const route = useRoute()
const auth = useCustomerAuthStore()
const api = useApi()
const { locale, dateLocale, terms } = useShopLocale()
const trackingText = computed(() => orderTrackingText[locale.value] || orderTrackingText.uk)
const { formatPrice } = useShopPriceFormatter()
const order = ref<CustomerOrder | null>(null)
const state = reactive({ loading: false, error: '', notFound: false })
const orderId = computed(() => Number(route.params.id))

const formatDate = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(dateLocale.value, { dateStyle: 'long' }).format(date)
}
const normalizedMethod = (value: string) => value.replace(/[\s_-]/g, '').toLowerCase()
const paymentLabel = computed(() => {
  const method = normalizedMethod(order.value?.payment_method || '')
  if (!method) return ''
  if (['cashondelivery', 'cod'].includes(method)) return terms.value.checkout.paymentOptions.cashOnDelivery
  if (method === 'cardondelivery') return terms.value.checkout.paymentOptions.cardOnDelivery
  if (['card', 'online', 'onlinecard', 'monobank'].includes(method)) return runtimeText.value.card
  return method === 'cash' ? runtimeText.value.cash : runtimeText.value.unknownPayment
})
const deliveryLabel = computed(() => {
  if (!order.value) return ''
  const rawMethod = normalizedMethod(order.value.shipping_method || '')
  const method = !rawMethod ? '' : rawMethod === 'warehouse' ? terms.value.cabinet.warehouse
    : rawMethod === 'courier' ? terms.value.cabinet.courier
      : ['pickup', 'selfpickup'].includes(rawMethod) ? runtimeText.value.pickup : runtimeText.value.unknownDelivery
  const carrierCode = normalizedMethod(order.value.shipping_company || '')
  const carrier = !carrierCode ? ''
    : ['novapost', 'novaposhta', 'новапошта', 'новаяпочта'].includes(carrierCode) ? runtimeText.value.novaPost : runtimeText.value.unknownCarrier
  return [carrier, method].filter(Boolean).join(' · ')
})
const addressLines = computed(() => {
  if (!order.value) return []
  if (order.value.delivery_address) return [order.value.delivery_address]
  const locality = [order.value.shipping_area, order.value.shipping_city].filter(Boolean).join(', ')
  const destination = order.value.shipping_warehouse_number
    ? `${terms.value.cabinet.warehouse} №${order.value.shipping_warehouse_number}`
    : [order.value.shipping_street, order.value.building_number && `№${order.value.building_number}`, order.value.shipping_apartment && `${terms.value.cabinet.apartment} ${order.value.shipping_apartment}`].filter(Boolean).join(', ')
  return [locality, destination].filter(Boolean)
})

let generation = 0
const sessionIdentity = () => `${auth.customer?.id}:${auth.sessionRevision}:${auth.accessToken}`
const loadOrder = async () => {
  const current = ++generation
  if (!auth.isAuthenticated) { order.value = null; state.loading = false; return }
  const id = orderId.value
  const session = sessionIdentity()
  const isCurrent = () => current === generation && id === orderId.value && session === sessionIdentity() && auth.isAuthenticated
  if (!Number.isSafeInteger(id) || id < 1) { order.value = null; state.notFound = true; state.loading = false; return }
  state.loading = true; state.error = ''; state.notFound = false
  try {
    const result = await api<CustomerOrder>(`/public/orders/me/${id}`, { retry: 0 })
    if (isCurrent()) order.value = result
  }
  catch (error: unknown) {
    if (!isCurrent()) return
    const statusCode = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 0
    state.notFound = statusCode === 404 || statusCode === 403 || statusCode === 401
    if (state.notFound) order.value = null
    state.error = state.notFound ? '' : terms.value.cabinet.orderErrorTitle
  }
  finally { if (isCurrent()) state.loading = false }
}
const trackingUnavailable = () => { generation++; order.value = null; state.loading = false; state.notFound = true }
watch([orderId, sessionIdentity], () => {
  generation++; order.value = null; state.error = ''; state.notFound = false; state.loading = false
  if (auth.isAuthenticated) void loadOrder()
}, { immediate: true })
onBeforeUnmount(() => { generation++ })

useSeo(() => order.value ? `${terms.value.cabinet.order} #${order.value.id}` : terms.value.cabinet.purchaseHistory, () => terms.value.cabinet.purchaseHistoryDescription)
</script>

<template>
  <CabinetShell>
    <section class="order-detail" :aria-busy="state.loading">
      <BaseButton class="order-detail__back" to="/cabinet/purchase-history" variant="text" size="sm">
        <BaseIcon class="order-detail__back-arrow" name="arrow-left" size="xxs" /> {{ terms.cabinet.backToOrders }}
      </BaseButton>
      <OrderLoadingSkeleton v-if="state.loading && !order" :label="terms.cabinet.orderLoading" detail />
      <FeedbackState v-else-if="state.notFound" class="order-detail__feedback" kind="unavailable" :title="terms.cabinet.orderNotFoundTitle" :description="terms.cabinet.orderNotFoundDescription" />
      <FeedbackState v-else-if="state.error && !order" class="order-detail__feedback" kind="error" :title="terms.cabinet.orderErrorTitle" :description="terms.cabinet.orderErrorDescription">
        <BaseButton type="button" :disabled="state.loading" @click="loadOrder">{{ terms.cabinet.retry }}</BaseButton>
      </FeedbackState>
      <template v-else-if="order">
        <header class="order-detail__head">
          <div><p>{{ terms.cabinet.order }} #{{ order.id }}</p><h1>{{ formatDate(order.created_at) }}</h1></div>
          <BaseBadge tone="dark" class="order-detail__amount">{{ formatPrice(order.total_amount) }}</BaseBadge>
          <OrderDates class="order-detail__dates" :order="order" acceptance-only />
          <OrderCustomerStatus v-if="order.status === 'cancelled' || order.shipments?.length !== 1" class="order-detail__status" :order="order" carrier-icon />
        </header>
        <OrderProjections v-if="shopOrderHasPaymentProjection(order) || shopOrderHasTestProjection(order) || shopOrderHasCheckboxProjection(order) || shopOrderHasNPReturnProjection(order) || shopOrderHasPaymentResolutionProjection(order)" :order="order" />
        <p v-if="state.error" role="alert">{{ runtimeMessage(state.error) }} {{ trackingText.preserved }}</p>
        <OrderCallbackPreference :requested="order.callback_requested" />
        <OrderPayment v-if="order.payment_method === 'onlineCard' || order.payment_channel === 'online_monobank'" :order-id="order.id" />
        <OrderDocuments v-if="order.preliminary_documents?.length" :order-id="order.id" :documents="order.preliminary_documents" />
        <section class="order-detail__section">
          <h2>{{ terms.cabinet.items }}</h2>
          <ul class="order-detail__items">
            <li v-for="item in order.items" :key="item.id" class="order-detail__item">
              <div class="order-detail__product"><NuxtLink class="order-detail__product-link" :aria-label="orderItemName(item)" :to="`/products/id/${item.product_id}`"><OrderItemImage :src="item.product_image_url" :name="orderItemName(item)" /><div class="order-detail__item-copy"><h3>{{ orderItemName(item) }}</h3><p v-if="item.product_variant">{{ item.product_variant }}</p><p v-if="item.product_sku">{{ terms.cabinet.sku }}: {{ item.product_sku }}</p></div></NuxtLink><BaseQuantityStepper variant="stacked" :model-value="item.quantity" :min="1" disabled :aria-label="terms.checkout.quantityFor(orderItemName(item))" /></div>
              <dl class="order-detail__item-meta"><div><dt>{{ terms.cabinet.price }}</dt><dd>{{ formatPrice(item.price) }}</dd></div><div v-if="item.total_price != null && item.quantity > 1"><dt>{{ terms.common.total }}</dt><dd>{{ formatPrice(item.total_price) }}</dd></div></dl>
            </li>
          </ul>
        </section>
        <OrderShipments :key="`${order.id}:${auth.customer?.id}:${auth.sessionRevision}`" :shipments="order.shipments" :order-id="order.id" :items="order.items" @updated="loadOrder" @unavailable="trackingUnavailable" />
        <section v-if="Number(order.discount_amount) > 0" class="order-detail__section order-detail__summary" :aria-label="terms.checkout.orderSummary">
          <h2>{{ terms.checkout.orderSummary }}</h2>
          <dl>
            <div><dt>{{ terms.cabinet.subtotal }}</dt><dd>{{ formatPrice(order.subtotal_amount) }}</dd></div>
            <div v-if="Number(order.discount_amount) > 0"><dt>{{ terms.cabinet.discount }}</dt><dd>-{{ formatPrice(order.discount_amount) }}</dd></div>
          </dl>
        </section>
        <section v-if="deliveryLabel || addressLines.length || paymentLabel || order.tracking_number" class="order-detail__section order-detail__fulfilment">
          <h2>{{ terms.cabinet.delivery }}</h2>
          <dl>
            <div v-if="deliveryLabel"><dt>{{ terms.cabinet.delivery }}</dt><dd>{{ deliveryLabel }}</dd></div>
            <div v-if="addressLines.length"><dt>{{ terms.cabinet.address }}</dt><dd><template v-for="(line, index) in addressLines" :key="line"><br v-if="index">{{ line }}</template></dd></div>
            <div v-if="paymentLabel"><dt>{{ terms.cabinet.payment }}</dt><dd>{{ paymentLabel }}</dd></div>
            <div v-if="order.tracking_number && !order.shipments?.some(shipment => shipment.tracking_number === order?.tracking_number)"><dt>{{ terms.cabinet.trackingNumber }}</dt><dd class="order-detail__tracking">{{ order.tracking_number }}</dd></div>
          </dl>
        </section>
      </template>
    </section>
  </CabinetShell>
</template>

<style scoped>
.order-detail { display: grid; min-width: 0; gap: 1rem; }
.order-detail__back { justify-self: start; }
.order-detail__feedback { min-height: 28rem; }
.order-detail__head, .order-detail__section { min-width: 0; background: transparent; padding: 1rem; }
.order-detail__head { display: flex; flex-wrap: wrap; align-items: start; justify-content: space-between; gap: 0.75rem; }
.order-detail__head p, .order-detail__item-meta dt, .order-detail__summary dt, .order-detail__fulfilment dt { color: #737373; font-size: 0.75rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
.order-detail__head h1 { margin-top: 0.25rem; font-size: clamp(1.5rem, 4vw, 2rem); font-weight: 800; }
.order-detail__section { display: grid; gap: 1rem; }
.order-detail__section h2 { font-size: 1.05rem; font-weight: 800; }
.order-detail__items { display: grid; min-width: 0; gap: 0.75rem; }
.order-detail__item { display: grid; min-width: 0; gap: 0.75rem; padding-top: 0.75rem; }
.order-detail__product { display: flex; gap: .75rem; align-items: center; min-width: 0; }
.order-detail__item-copy { min-width: 0; }
.order-detail__item-copy h3, .order-detail__item-copy p, .order-detail__item-meta dd, .order-detail__summary dd, .order-detail__fulfilment dd { overflow-wrap: anywhere; }
.order-detail__item-copy h3 { font-size: 0.95rem; font-weight: 800; }
.order-detail__item-copy p { margin-top: 0.25rem; color: #737373; font-size: 0.8rem; }
.order-detail__item-meta, .order-detail__summary dl, .order-detail__fulfilment dl { display: grid; gap: 0.65rem; }
.order-detail__item-meta { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.order-detail__item-meta div, .order-detail__summary dl div, .order-detail__fulfilment dl div { min-width: 0; }
.order-detail__item-meta dd, .order-detail__summary dd, .order-detail__fulfilment dd { margin-top: 0.2rem; font-size: 0.92rem; font-weight: 800; }
.order-detail__summary dl div, .order-detail__fulfilment dl div { display: flex; align-items: start; justify-content: space-between; gap: 1rem; }
.order-detail__summary .order-detail__total { border-top: 1px solid rgb(10 10 10 / 0.12); margin-top: 0.25rem; padding-top: 0.75rem; }
.order-detail__summary .order-detail__total dt, .order-detail__summary .order-detail__total dd { color: #0a0a0a; font-size: 1rem; }
.order-detail__tracking { font-family: monospace; }

.order-detail__amount { margin-left: auto; background: #0a0a0a; color: white; border: 0; border-radius: .5rem; padding: .55rem .75rem; font-size: 1rem; font-weight: 800; text-transform: none; letter-spacing: normal; }
.order-detail__dates { flex-basis: 100%; }
.order-detail__product :deep(.base-quantity-stepper) { flex-shrink: 0; }
.order-detail__item-meta { display: flex; flex-wrap: wrap; gap: 1rem; padding-left: 0; }
.order-detail__back :deep(.order-detail__back-arrow) { width: 14px; height: 14px; flex: 0 0 14px; }
@keyframes order-back-arrow { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-8px); } }
@media (hover: hover) { .order-detail__back:hover :deep(.order-detail__back-arrow) { animation: order-back-arrow 1100ms cubic-bezier(0.3, 1, 0.3, 1) infinite; } }
.order-detail__back:focus-visible :deep(.order-detail__back-arrow) { animation: order-back-arrow 1100ms cubic-bezier(0.3, 1, 0.3, 1) infinite; }
@media (prefers-reduced-motion: reduce) { .order-detail__back :deep(.order-detail__back-arrow) { animation: none !important; } }
.order-detail__product-link { display: flex; align-items: center; gap: .75rem; min-width: 0; color: inherit; text-decoration: none; }
.order-detail__product-link:hover h3 { text-decoration: underline; text-underline-offset: .2em; }
.order-detail__product-link:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
</style>
