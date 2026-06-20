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
    <template v-else>
      <div class="mt-3 space-y-2 md:hidden">
        <article
          v-for="row in rows"
          :key="row.barber.id"
          class="statistics-comparison-card rounded-xl border p-3"
          :class="{ 'is-selected': selectedBarberId === row.barber.id }"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h3 class="truncate text-sm font-semibold">{{ barberName(row.barber) }}</h3>
              <p class="mt-0.5 truncate text-xs">{{ topServiceName(row) }}</p>
            </div>
            <p class="shrink-0 text-sm font-semibold">{{ formatMoney(row.revenue) }}</p>
          </div>
          <div class="mt-2 grid grid-cols-3 gap-1.5 text-center text-xs">
            <div class="statistics-comparison-metric rounded-lg px-2 py-1.5">
              <span class="block font-semibold">{{ row.completed_appointments }}</span>
              <span class="block">записи</span>
            </div>
            <div class="statistics-comparison-metric rounded-lg px-2 py-1.5">
              <span class="block font-semibold">{{ row.unique_clients }}</span>
              <span class="block">клієнти</span>
            </div>
            <div class="statistics-comparison-metric rounded-lg px-2 py-1.5">
              <span class="block truncate font-semibold">{{ formatMoney(row.average_check) }}</span>
              <span class="block">чек</span>
            </div>
          </div>
          <NuxtLink
            :to="`/admin/statistics/barbers/${row.barber.id}`"
            class="statistics-comparison-link mt-2 inline-flex w-full justify-center rounded-full border px-3 py-1.5 text-xs font-medium transition"
          >
            Переглянути
          </NuxtLink>
        </article>
      </div>
      <div class="statistics-comparison-table mt-4 hidden overflow-hidden rounded-2xl border md:block">
        <table class="w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr>
              <th class="px-4 py-3 text-left font-medium">Майстер</th>
              <th class="px-4 py-3 text-left font-medium">Дохід</th>
              <th class="px-4 py-3 text-left font-medium">Записи</th>
              <th class="px-4 py-3 text-left font-medium">Клієнти</th>
              <th class="px-4 py-3 text-left font-medium">Середній чек</th>
              <th class="px-4 py-3 text-left font-medium">Популярна послуга</th>
              <th class="px-4 py-3 text-left font-medium">Деталі</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row.barber.id"
              :class="{ 'is-selected': selectedBarberId === row.barber.id }"
            >
              <td data-label="Майстер" class="px-4 py-3 font-medium">{{ barberName(row.barber) }}</td>
              <td data-label="Дохід" class="px-4 py-3">{{ formatMoney(row.revenue) }}</td>
              <td data-label="Записи" class="px-4 py-3">{{ row.completed_appointments }}</td>
              <td data-label="Клієнти" class="px-4 py-3">{{ row.unique_clients }}</td>
              <td data-label="Середній чек" class="px-4 py-3">{{ formatMoney(row.average_check) }}</td>
              <td data-label="Популярна послуга" class="px-4 py-3">{{ topServiceName(row) }}</td>
              <td data-label="Деталі" class="px-4 py-3">
                <NuxtLink
                  :to="`/admin/statistics/barbers/${row.barber.id}`"
                  class="statistics-comparison-link inline-flex rounded-full border px-3 py-1.5 text-sm font-medium transition"
                >
                  Переглянути
                </NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
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

.statistics-comparison-table tbody tr {
  background: color-mix(in srgb, var(--text-primary) 5%, transparent) !important;
}

.statistics-comparison-table tbody tr.is-selected,
.statistics-comparison-card.is-selected {
  border-color: color-mix(in srgb, var(--accent-text) 55%, transparent);
  background: color-mix(in srgb, var(--accent-text) 14%, transparent) !important;
}

.statistics-comparison-card {
  border-color: var(--border);
  background: color-mix(in srgb, var(--text-primary) 5%, transparent);
}

.statistics-comparison-skeleton {
  background: color-mix(in srgb, var(--text-primary) 10%, transparent);
}

.statistics-comparison-card h3,
.statistics-comparison-card > div:first-child > p {
  color: var(--text-primary);
}

.statistics-comparison-card > div:first-child div p {
  color: var(--text-secondary);
}

.statistics-comparison-metric {
  background: color-mix(in srgb, var(--text-primary) 8%, transparent);
  color: var(--text-secondary);
}

.statistics-comparison-metric span:first-child {
  color: var(--text-primary);
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
