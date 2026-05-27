<script setup lang="ts">
import type { StatisticsWorkloadDayItem, StatisticsWorkloadWeekItem } from '~/composables/useBackofficeApi'

const props = defineProps<{
  days?: StatisticsWorkloadDayItem[]
  weeks?: StatisticsWorkloadWeekItem[]
  title?: string
  loading?: boolean
}>()

const { formatMoney } = useBookingFormatting()

const dayFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: 'short',
})

const rows = computed(() => {
  if (props.days?.length) {
    return props.days.map(item => ({
      key: item.date,
      label: dayFormatter.format(new Date(`${item.date}T12:00:00`)),
      appointments: item.completed_appointments,
      revenue: item.revenue,
    }))
  }

  return (props.weeks || []).map(item => ({
    key: String(item.week),
    label: `Тиждень ${item.week}`,
    appointments: item.completed_appointments,
    revenue: item.revenue,
  }))
})

const maxAppointments = computed(() => Math.max(...rows.value.map(row => row.appointments), 0))
</script>

<template>
  <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
    <h2 class="text-lg font-semibold text-slate-900">{{ title || 'Завантаження' }}</h2>
    <div v-if="loading" class="mt-4 space-y-3">
      <div v-for="index in 6" :key="index" class="h-11 animate-pulse rounded-2xl bg-slate-100" />
    </div>
    <StatisticsEmptyState
      v-else-if="!rows.length"
      class="mt-4"
      title="Немає завершених записів"
      description="Графік завантаження зʼявиться після завершених бронювань."
    />
    <div v-else class="mt-4 space-y-3">
      <div v-for="row in rows" :key="row.key" class="grid gap-2 sm:grid-cols-[7rem_1fr_auto] sm:items-center">
        <p class="text-sm font-medium text-slate-700">{{ row.label }}</p>
        <div class="h-3 overflow-hidden rounded-full bg-slate-100">
          <div class="h-full rounded-full bg-slate-950" :style="{ width: `${maxAppointments ? Math.max(5, (row.appointments / maxAppointments) * 100) : 0}%` }" />
        </div>
        <p class="text-sm text-slate-500 sm:text-right">{{ row.appointments }} · {{ formatMoney(row.revenue) }}</p>
      </div>
    </div>
  </section>
</template>
