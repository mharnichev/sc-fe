<script setup lang="ts">
import type { BookingStatus } from '~/composables/useBackofficeApi'

defineProps<{
  status: BookingStatus | string
}>()

const { formatBookingStatus } = useBookingFormatting()

const statusClass = (status: BookingStatus | string) => {
  switch (status) {
    case 'confirmed':
      return 'bg-emerald-400/12 text-emerald-100 ring-emerald-300/20'
    case 'cancelled':
      return 'bg-red-400/12 text-red-100 ring-red-300/20'
    case 'completed':
      return 'bg-white/10 text-white/80 ring-white/15'
    default:
      return 'bg-white/[0.06] text-white/65 ring-white/12'
  }
}
</script>

<template>
  <span class="inline-flex rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.15em] ring-1 backdrop-blur" :class="statusClass(status)">
    {{ formatBookingStatus(status) }}
  </span>
</template>
