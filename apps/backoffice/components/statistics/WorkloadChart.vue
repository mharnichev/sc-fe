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
const progressWidth = (appointments: number) => {
  if (!appointments || !maxAppointments.value) return 0
  return Math.max(5, (appointments / maxAppointments.value) * 100)
}
</script>

<template>
  <section class="rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm xl:rounded-[1.75rem] xl:p-4">
    <h2 class="text-base font-semibold text-slate-900 xl:text-lg">{{ title || 'Завантаження' }}</h2>
    <div v-if="loading" class="mt-3 space-y-2 xl:mt-4 xl:space-y-3">
      <div v-for="index in 6" :key="index" class="h-9 animate-pulse rounded-xl bg-slate-100 xl:h-11 xl:rounded-2xl" />
    </div>
    <StatisticsEmptyState
      v-else-if="!rows.length"
      class="mt-3 xl:mt-4"
      title="Немає завершених записів"
      description="Графік завантаження зʼявиться після завершених бронювань."
    />
    <div v-else class="mt-3 space-y-2 xl:mt-4 xl:space-y-3">
      <div v-for="row in rows" :key="row.key" class="grid gap-1.5 sm:grid-cols-[6rem_1fr_auto] sm:items-center xl:grid-cols-[7rem_1fr_auto] xl:gap-2">
        <p class="text-xs font-medium text-slate-700 xl:text-sm">{{ row.label }}</p>
        <div class="h-2.5 overflow-hidden rounded-full bg-slate-100 xl:h-3">
          <div class="h-full rounded-full bg-cyan-500" :style="{ width: `${progressWidth(row.appointments)}%` }" />
        </div>
        <p class="text-xs text-slate-500 sm:text-right xl:text-sm">{{ row.appointments }} · {{ formatMoney(row.revenue) }}</p>
      </div>
    </div>
  </section>
</template>
