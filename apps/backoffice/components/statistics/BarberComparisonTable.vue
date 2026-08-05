<script setup lang="ts">
import type { BarberComparisonItem } from '~/composables/useBackofficeApi'

defineProps<{
  rows: BarberComparisonItem[]
  loading?: boolean
  selectedBarberId?: number | null
}>()

const { formatMoney } = useBookingFormatting()
const { barberName } = useStatisticsFormatting()

const topServiceName = (row: BarberComparisonItem) =>
  row.popular_services[0]?.service_name || '—'
</script>

<template>
  <section class="statistics-comparison rounded-[1.25rem] border p-3 shadow-sm xl:rounded-[1.75rem] xl:p-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-base font-semibold xl:text-lg">Порівняння майстрів</h2>
        <p class="mt-0.5 text-xs xl:mt-1 xl:text-sm">Дохід і завершені записи за вибраний місяць.</p>
      </div>
    </div>

    <div v-if="loading" class="mt-3 space-y-2 xl:mt-4 xl:space-y-3">
      <div v-for="index in 5" :key="index" class="statistics-comparison-skeleton h-12 animate-pulse rounded-xl xl:h-14 xl:rounded-2xl" />
    </div>
    <StatisticsEmptyState
      v-else-if="!rows.length"
      class="mt-3 xl:mt-4"
      title="Немає статистики майстрів"
      description="У вибраному місяці немає завершених записів для порівняння."
    />
    <BaseTable
      v-else
      caption="Порівняння майстрів за місяць"
      wrapper-class="statistics-comparison-table mt-4 rounded-2xl"
      min-width="64rem"
    >
      <template #head>
            <tr>
              <th>Майстер</th>
              <th>Дохід</th>
              <th>Записи</th>
              <th>Клієнти з візитом</th>
              <th>Середній чек</th>
              <th>Популярна послуга</th>
              <th>Деталі</th>
            </tr>
      </template>
            <tr
              v-for="row in rows"
              :key="row.barber.id"
              :class="{ 'is-selected': selectedBarberId === row.barber.id }"
            >
              <td class="font-medium text-ui-primary">{{ barberName(row.barber) }}</td>
              <td class="text-ui-secondary">{{ formatMoney(row.revenue) }}</td>
              <td class="text-ui-secondary">{{ row.completed_appointments }}</td>
              <td class="text-ui-secondary">{{ row.unique_clients }}</td>
              <td class="text-ui-secondary">{{ formatMoney(row.average_check) }}</td>
              <td class="text-ui-secondary">{{ topServiceName(row) }}</td>
              <td>
                <NuxtLink
                  :to="`/admin/statistics/barbers/${row.barber.id}`"
                  class="base-button base-button--neutral min-h-9 px-3 py-1.5 text-sm"
                >
                  Переглянути
                </NuxtLink>
              </td>
            </tr>
    </BaseTable>
  </section>
</template>

<style scoped>
.statistics-comparison {
  border-color: var(--border);
  background: var(--glass);
  color: var(--text-primary);
  box-shadow: var(--surface-shadow);
  backdrop-filter: blur(32px);
}

.statistics-comparison p,
.statistics-comparison td {
  color: var(--text-secondary);
}

.statistics-comparison h2,
.statistics-comparison h3,
.statistics-comparison td:first-child {
  color: var(--text-primary);
}

.statistics-comparison-table {
  border-color: var(--border);
}

.statistics-comparison-table thead {
  background: color-mix(in srgb, var(--text-primary) 8%, transparent);
}

.statistics-comparison-table th {
  color: var(--text-secondary);
}

.statistics-comparison-skeleton {
  background: color-mix(in srgb, var(--text-primary) 10%, transparent);
}

.statistics-comparison-link {
  border-color: var(--input-border);
  background: var(--solid-control);
  color: var(--text-primary);
}

.statistics-comparison-link:hover {
  border-color: var(--focus-border);
  background: var(--solid-control-hover);
}
</style>
