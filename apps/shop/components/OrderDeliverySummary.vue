<script setup lang="ts">
import type { CustomerShipment } from '~/types/order'
import { deliveryStatus, shipmentStatusLabel, deliverySummaryEntries, shipmentStatusIcon, shipmentStatusTone } from '~/utils/shipmentStatus'
import { orderTrackingText } from '~/utils/orderTrackingText'
const { locale } = useShopLocale()
const text = computed(() => orderTrackingText[locale.value] || orderTrackingText.uk)
const props = defineProps<{ summary?: Record<string, number>, shipments?: CustomerShipment[], compact?: boolean }>()
const entries = computed(() => {
  if (!props.shipments?.length) return deliverySummaryEntries(props.summary, locale.value)
  const groups = new Map<string, { status: string, count: number, label: string }>()
  for (const shipment of props.shipments) {
    const status = deliveryStatus(shipment)
    const key = `${shipment.simulation ? 'mock' : 'real'}:${status}`
    const existing = groups.get(key)
    if (existing) existing.count++
    else groups.set(key, { status: key, count: 1, label: shipmentStatusLabel(status, locale.value, !shipment.simulation) })
  }
  return [...groups.values()]
})
const total = computed(() => entries.value.reduce((sum, entry) => sum + entry.count, 0))
</script>
<template>
  <div class="delivery-summary" :class="{ 'delivery-summary--compact': compact }" :aria-label="text.summary">
    <p class="delivery-summary__title">{{ text.delivery }}</p>
    <ul v-if="entries.length"><li v-for="entry in entries" :key="entry.status"><OrderStatusBadge :label="entry.label + ((!compact || total > 1) ? ' · ' + entry.count : '')" :icon="shipmentStatusIcon(entry.status)" :tone="shipmentStatusTone(entry.status)" /></li></ul>
    <p v-else>{{ text.noShipments }}</p>
    <p v-if="entries.length && !compact" class="delivery-summary__note">{{ text.perShipment }}</p>
  </div>
</template>
<style scoped>
.delivery-summary { display: grid; gap: .35rem; font-size: .85rem; }
.delivery-summary--compact { display: flex; flex-wrap: wrap; align-items: baseline; gap: .25rem .5rem; }
.delivery-summary--compact .delivery-summary__title { font-weight: 500; color: #737373; }
.delivery-summary__note { color: #525252; font-size: .75rem; }
.delivery-summary__title { font-weight: 800; }
.delivery-summary li { display: inline-flex; align-items: center; gap: .3rem; }
.delivery-summary ul { display: flex; flex-wrap: wrap; gap: .4rem 1rem; }
</style>
