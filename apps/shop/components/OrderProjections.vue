<script setup lang="ts">
import type { OrderProjections } from '~/types/order'
import { orderTrackingText, checkboxProjectionStates, npReturnProjectionStates, paymentResolutionProjectionStates } from '~/utils/orderTrackingText'
const { locale } = useShopLocale()
const text = computed(() => orderTrackingText[locale.value] || orderTrackingText.uk)
const props = defineProps<{ order: OrderProjections, paymentOnly?: boolean }>()
const known = [...paymentResolutionProjectionStates,...checkboxProjectionStates, ...npReturnProjectionStates,'simulated_carrier_return_unknown','simulated_carrier_returning','simulated_carrier_returned','simulated_carrier_return_received','simulated_unpaid_refusal_closed','simulated_fiscal_queued','simulated_fiscal_unknown','simulated_fiscal_issued','simulated_fiscal_cancelled','simulated_fiscal_error','simulated_fiscal_invalid','simulated_fiscal_return_pending','simulated_fiscal_partial_return','simulated_fiscal_returned','simulated_pending_document','simulated_local_print_available', 'unpaid', 'paid_manual', 'paid_provider', 'simulated_paid', 'pickup_handed_over', 'carrier_dispatched', 'fulfilled', 'simulated_pickup_handed_over', 'simulated_carrier_dispatched', 'simulated_fulfilled', 'simulated_carrier_handover', 'simulated_handed_over', 'legacy_unknown', 'reserved', 'unfulfilled', 'cancelled', 'not_requested', 'pending_document'] as const
const label = (value?: string) => {
  const key = known.find(key => key === value) || 'legacy_unknown'
  return text.value[key]
}
const rows = computed(() => {
  // Only canonical payment projections prove a payment; general order status does not.
  const payment = (['paid_manual', 'paid_provider', 'simulated_paid', 'refunded', 'simulated_refunded', 'financial_exception', 'simulated_financial_exception'].includes(props.order.payment_status || '') || props.order.payment_status === 'unpaid' && ['cancelled_before_handover', 'simulated_cancelled_before_handover'].includes(props.order.fulfillment_status || ''))
    ? [[text.value.payment, label(props.order.payment_status), 'info-outline']] : []
  return props.paymentOnly ? payment : [
    ...payment,
    [text.value.fulfillment, label(props.order.fulfillment_status), 'box'],
    [text.value.fiscal, label(props.order.fiscal_status), 'info-outline'],
    ...(['simulated_pending_document', 'simulated_local_print_available', 'checkbox_pending_document', 'checkbox_local_print_available', 'simulated_checkbox_pending_document', 'simulated_checkbox_local_print_available'].includes(props.order.receipt_delivery_status || '') ? [[text.value.receipt_preview, label(props.order.receipt_delivery_status), 'info-outline']] : []),
  ]
})
</script>
<template>
  <dl v-if="rows.length"><div v-for="[title, value, icon] in rows" :key="title"><dt :class="{ 'sr-only': paymentOnly }">{{ title }}</dt><dd><BaseIcon :name="icon" size="xs" /><span>{{ value }}</span></dd></div></dl>
</template>

<style scoped>
dd { display: inline-flex; align-items: center; gap: .4rem; line-height: 1.25; }
dd :deep(.base-icon) { flex-shrink: 0; vertical-align: middle; }
dd span { display: inline-block; }
</style>
