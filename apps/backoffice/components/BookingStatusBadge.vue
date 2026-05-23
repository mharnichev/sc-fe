<script setup lang="ts">
import type { BookingStatus } from '~/composables/useBackofficeApi'

defineProps<{
  status: BookingStatus | string
}>()

const { formatBookingStatus } = useBookingFormatting()

const statusClass = (status: BookingStatus | string) => {
  switch (status) {
    case 'confirmed':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    case 'cancelled':
      return 'bg-rose-50 text-rose-700 ring-rose-200'
    case 'completed':
      return 'bg-slate-100 text-slate-600 ring-slate-200'
    case 'pending':
    default:
      return 'bg-amber-50 text-amber-700 ring-amber-200'
  }
}
</script>

<template>
  <span class="inline-flex rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.15em] ring-1" :class="statusClass(status)">
    {{ formatBookingStatus(status) }}
  </span>
</template>
