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
      return 'bg-indigo-50 text-indigo-700 ring-indigo-200'
    default:
      return 'bg-slate-50 text-slate-700 ring-slate-200'
  }
}
</script>

<template>
  <span class="inline-flex rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.15em] ring-1" :class="statusClass(status)">
    {{ formatBookingStatus(status) }}
  </span>
</template>
