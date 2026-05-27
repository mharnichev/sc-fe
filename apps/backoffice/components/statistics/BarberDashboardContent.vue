<script setup lang="ts">
import type { BarberMonthlyStatisticsResponse } from '~/composables/useBackofficeApi'

const props = defineProps<{
  stats?: BarberMonthlyStatisticsResponse | null
  loading?: boolean
}>()

const { formatMoney } = useBookingFormatting()

const hasMonthlyData = computed(() => {
  const stats = props.stats
  if (!stats) return false
  return Boolean(
    Number(stats.total_income || 0)
    || stats.completed_appointments
    || stats.unique_clients
    || stats.cancelled_appointments
    || stats.no_show_appointments,
  )
})

const cancellationTotal = computed(() =>
  (props.stats?.cancelled_appointments || 0) + (props.stats?.no_show_appointments || 0),
)

const bestRevenueDayLabel = computed(() => {
  const day = props.stats?.best_revenue_day
  if (!day) return '—'
  const formatted = new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: 'long',
  }).format(new Date(`${day.date}T12:00:00`))
  return `${formatted} · ${formatMoney(day.revenue)}`
})
</script>

<template>
  <div class="space-y-4">
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatisticsStatCard
        label="Дохід за місяць"
        :value="formatMoney(stats?.total_income)"
        :loading="loading"
        tone="dark"
      />
      <StatisticsStatCard
        label="Завершені записи"
        :value="stats?.completed_appointments || 0"
        :loading="loading"
        tone="cyan"
      />
      <StatisticsStatCard
        label="Унікальні клієнти"
        :value="stats?.unique_clients || 0"
        :loading="loading"
        :hint="stats ? `Нові: ${stats.clients.new_clients} · Повернулися: ${stats.clients.returning_clients}` : ''"
      />
      <StatisticsStatCard
        label="Середній чек"
        :value="formatMoney(stats?.average_check_per_appointment)"
        :loading="loading"
        :hint="`На клієнта: ${formatMoney(stats?.average_revenue_per_client)}`"
      />
    </div>

    <StatisticsEmptyState
      v-if="!loading && stats && !hasMonthlyData"
      title="За вибраний місяць немає статистики"
      description="Змініть місяць або перевірте, чи є завершені записи у календарі."
    />

    <div class="grid gap-4 md:grid-cols-3">
      <StatisticsStatCard
        label="Нові клієнти"
        :value="stats?.clients.new_clients || 0"
        :loading="loading"
        tone="emerald"
      />
      <StatisticsStatCard
        label="Повернулися"
        :value="stats?.clients.returning_clients || 0"
        :loading="loading"
      />
      <StatisticsStatCard
        label="Скасування / неявки"
        :value="cancellationTotal"
        :loading="loading"
        :hint="`Скасовано: ${stats?.cancelled_appointments || 0} · Неявки: ${stats?.no_show_appointments || 0}`"
        tone="rose"
      />
    </div>

    <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <StatisticsWorkloadChart
        :days="stats?.workload_by_day || []"
        :weeks="stats?.workload_by_week || []"
        :loading="loading"
        title="Завантаження за днями"
      />
      <StatisticsStatCard
        label="Найкращий день за доходом"
        :value="bestRevenueDayLabel"
        :loading="loading"
        :hint="stats?.best_revenue_day ? `${stats.best_revenue_day.completed_appointments} завершені записи` : 'Немає завершених записів'"
        tone="amber"
      />
    </div>

    <div class="grid gap-4 xl:grid-cols-2">
      <StatisticsPopularServicesChart
        :items="stats?.most_popular_services || []"
        :loading="loading"
      />
      <StatisticsRevenueByServiceChart
        :items="stats?.revenue_by_service || []"
        :loading="loading"
      />
    </div>
  </div>
</template>
