<script setup lang="ts">
import type { CustomerOrder } from '~/types/order'
import { orderReceiptDates } from '~/utils/orderReceiptDates'
const props = defineProps<{ order: CustomerOrder, acceptanceOnly?: boolean }>()
const { locale, dateLocale } = useShopLocale()
const receipts = computed(() => props.acceptanceOnly ? [] : orderReceiptDates(props.order.shipments))
const formatDate = (value: string) => new Intl.DateTimeFormat(dateLocale.value, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Kyiv' }).format(new Date(value))
</script>
<template>
  <dl class="order-dates">
    <div><dt>{{ locale === 'en' ? 'Accepted by store' : 'Прийнято магазином' }}</dt><dd>{{ locale === 'en' ? 'Date not recorded' : 'Дату не зафіксовано' }}</dd></div>
    <div v-for="(receipt, index) in receipts" :key="receipt.id"><dt>{{ locale === 'en' ? 'Received' : 'Отримано' }}{{ receipts.length > 1 ? ` (${index + 1})` : '' }}</dt><dd><time v-if="receipt.date" :datetime="receipt.date">{{ formatDate(receipt.date) }}</time><span v-else>{{ locale === 'en' ? 'Date not recorded' : 'Дату не зафіксовано' }}</span></dd></div>
  </dl>
</template>
<style scoped>
.order-dates { display: flex; flex-wrap: wrap; gap: .25rem 1.25rem; font-size: .75rem; color: #737373; }
.order-dates div { display: flex; flex-wrap: wrap; gap: .3rem; }
.order-dates dt::after { content: ':'; }
.order-dates dd { color: #525252; }
</style>
