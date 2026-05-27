<script setup lang="ts">
import type { BarberComparisonItem } from '~/composables/useBackofficeApi'

defineProps<{
  rows: BarberComparisonItem[]
  loading?: boolean
  selectedBarberId?: number | null
}>()

const { formatMoney } = useBookingFormatting()

const topServiceName = (row: BarberComparisonItem) =>
  row.popular_services[0]?.service_name || '—'
</script>

<template>
  <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold text-slate-900">Порівняння майстрів</h2>
        <p class="mt-1 text-sm text-slate-500">Дохід і завершені записи за вибраний місяць.</p>
      </div>
    </div>

    <div v-if="loading" class="mt-4 space-y-3">
      <div v-for="index in 5" :key="index" class="h-14 animate-pulse rounded-2xl bg-slate-100" />
    </div>
    <StatisticsEmptyState
      v-else-if="!rows.length"
      class="mt-4"
      title="Немає статистики майстрів"
      description="У вибраному місяці немає завершених записів для порівняння."
    />
    <div v-else class="mt-4 overflow-hidden rounded-2xl border border-slate-200">
      <table class="w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Майстер</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Дохід</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Записи</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Клієнти</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Середній чек</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Популярна послуга</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Деталі</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr
            v-for="row in rows"
            :key="row.barber.id"
            :class="selectedBarberId === row.barber.id ? 'bg-cyan-50/70' : ''"
          >
            <td data-label="Майстер" class="px-4 py-3 font-medium text-slate-900">{{ row.barber.full_name }}</td>
            <td data-label="Дохід" class="px-4 py-3 text-slate-700">{{ formatMoney(row.revenue) }}</td>
            <td data-label="Записи" class="px-4 py-3 text-slate-700">{{ row.completed_appointments }}</td>
            <td data-label="Клієнти" class="px-4 py-3 text-slate-700">{{ row.unique_clients }}</td>
            <td data-label="Середній чек" class="px-4 py-3 text-slate-700">{{ formatMoney(row.average_check) }}</td>
            <td data-label="Популярна послуга" class="px-4 py-3 text-slate-700">{{ topServiceName(row) }}</td>
            <td data-label="Деталі" class="px-4 py-3">
              <NuxtLink
                :to="`/admin/statistics/barbers/${row.barber.id}`"
                class="inline-flex rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50"
              >
                Переглянути
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
