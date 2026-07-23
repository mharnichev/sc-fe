<script setup lang="ts">
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/vue/24/outline'
import type { DashboardMasterBreakdownItem } from '~/utils/adminDashboardContract'
import {
  compareDashboardMasterRows,
  formatDashboardRate,
  hasDashboardMetric,
  type AdminDashboardMasterSortKey,
  type SortDirection,
} from '~/utils/adminDashboard'
import { formatRating } from '~/utils/reviews'

const props = defineProps<{
  rows: DashboardMasterBreakdownItem[]
  loading?: boolean
}>()

const { formatMoney } = useBookingFormatting()
const sortKey = ref<AdminDashboardMasterSortKey>('revenue_per_available_hour')
const sortDirection = ref<SortDirection>('desc')

const sortedRows = computed(() =>
  [...props.rows].sort((first, second) =>
    compareDashboardMasterRows(first, second, sortKey.value, sortDirection.value)),
)

const columns: Array<{ key: AdminDashboardMasterSortKey, label: string, compactLabel: string }> = [
  { key: 'gross_revenue', label: 'Виручка', compactLabel: 'Виручка' },
  { key: 'completed_visits', label: 'Завершені візити', compactLabel: 'Візити' },
  { key: 'average_check', label: 'Середній чек', compactLabel: 'Сер. чек' },
  { key: 'utilisation_rate', label: 'Завантаження', compactLabel: 'Завант.' },
  { key: 'revenue_per_available_hour', label: 'Виручка / доступну годину', compactLabel: 'Виручка / год' },
  { key: 'returning_clients', label: 'Повторні клієнти', compactLabel: 'Повторні' },
  { key: 'approved_rating', label: 'Схвалений рейтинг', compactLabel: 'Рейтинг' },
]

const toggleSort = (key: AdminDashboardMasterSortKey) => {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc'
    return
  }
  sortKey.value = key
  sortDirection.value = 'desc'
}

const sortAriaLabel = (key: AdminDashboardMasterSortKey, label: string) =>
  sortKey.value === key
    ? `${label}. Сортування ${sortDirection.value === 'desc' ? 'за спаданням' : 'за зростанням'}`
    : `Сортувати: ${label}`

const formatNumber = (value: number | null) =>
  hasDashboardMetric(value) ? Number(value).toLocaleString('uk-UA') : 'Недоступно'
const formatMoneyMetric = (value: string | number | null) =>
  hasDashboardMetric(value) ? formatMoney(value) : 'Недоступно'
const ratingLabel = (row: DashboardMasterBreakdownItem) =>
  hasDashboardMetric(row.approved_rating)
    ? `${formatRating(Number(row.approved_rating))} ★ · ${row.approved_review_count}`
    : 'Недоступно'
</script>

<template>
  <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold text-slate-900">Майстри</h2>
        <p class="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
          Порівняння якості виручки, завантаження та повернення клієнтів. Початкове сортування — за виручкою на доступну годину.
        </p>
      </div>
      <NuxtLink to="/admin/statistics" class="text-sm font-medium text-cyan-700 hover:text-cyan-900">Повна статистика</NuxtLink>
    </div>

    <div v-if="loading" class="mt-4 space-y-3">
      <div v-for="index in 5" :key="index" class="h-16 animate-pulse rounded-2xl bg-slate-100" />
    </div>
    <StatisticsEmptyState
      v-else-if="!rows.length"
      class="mt-4"
      title="Немає даних про майстрів"
      description="Backend не повернув майстрів для вибраного періоду."
    />
    <template v-else>
      <div class="mt-4 flex gap-2 overflow-x-auto pb-2 lg:hidden" aria-label="Сортування майстрів">
        <button
          v-for="column in columns"
          :key="column.key"
          type="button"
          class="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border px-3 py-2 text-xs font-medium"
          :class="sortKey === column.key ? 'border-cyan-300 bg-cyan-50 text-cyan-900' : 'border-slate-300 text-slate-600'"
          :aria-label="sortAriaLabel(column.key, column.label)"
          @click="toggleSort(column.key)"
        >
          {{ column.compactLabel }}
          <ChevronUpIcon v-if="sortKey === column.key && sortDirection === 'asc'" class="h-3.5 w-3.5" aria-hidden="true" />
          <ChevronDownIcon v-else-if="sortKey === column.key" class="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <div class="mt-2 space-y-3 lg:hidden">
        <article v-for="row in sortedRows" :key="row.master_id" class="rounded-2xl border border-slate-200 p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h3 class="truncate font-semibold text-slate-900">{{ row.master_name }}</h3>
              <p class="mt-1 text-sm text-slate-500">{{ formatNumber(row.completed_visits) }} завершених візитів</p>
            </div>
            <NuxtLink :to="`/admin/statistics/barbers/${row.master_id}`" class="shrink-0 text-sm font-medium text-cyan-700">Деталі</NuxtLink>
          </div>
          <dl class="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt class="text-xs text-slate-500">Виручка</dt><dd class="mt-1 font-medium text-slate-900">{{ formatMoneyMetric(row.gross_revenue) }}</dd></div>
            <div><dt class="text-xs text-slate-500">Середній чек</dt><dd class="mt-1 font-medium text-slate-900">{{ formatMoneyMetric(row.average_check) }}</dd></div>
            <div><dt class="text-xs text-slate-500">Завантаження</dt><dd class="mt-1 font-medium text-slate-900">{{ formatDashboardRate(row.utilisation_rate) }}</dd></div>
            <div><dt class="text-xs text-slate-500">Виручка / год</dt><dd class="mt-1 font-medium text-slate-900">{{ formatMoneyMetric(row.revenue_per_available_hour) }}</dd></div>
            <div><dt class="text-xs text-slate-500">Нові / повторні</dt><dd class="mt-1 font-medium text-slate-900">{{ row.new_clients }} / {{ row.returning_clients }}</dd></div>
            <div><dt class="text-xs text-slate-500">Схвалений рейтинг</dt><dd class="mt-1 font-medium text-amber-600">{{ ratingLabel(row) }}</dd></div>
          </dl>
        </article>
      </div>

      <div class="mt-4 hidden overflow-x-auto rounded-2xl border border-slate-200 lg:block">
        <table class="min-w-[1120px] w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th class="sticky left-0 z-10 bg-slate-50 px-4 py-3 font-medium">Майстер</th>
              <th v-for="column in columns" :key="column.key" class="px-4 py-3 font-medium">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 text-left hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
                  :aria-label="sortAriaLabel(column.key, column.label)"
                  @click="toggleSort(column.key)"
                >
                  {{ column.label }}
                  <ChevronUpIcon v-if="sortKey === column.key && sortDirection === 'asc'" class="h-3.5 w-3.5" aria-hidden="true" />
                  <ChevronDownIcon v-else-if="sortKey === column.key" class="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </th>
              <th class="px-4 py-3 font-medium"><span class="sr-only">Дії</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="row in sortedRows" :key="row.master_id" class="hover:bg-slate-50">
              <td class="sticky left-0 bg-white px-4 py-3 font-medium text-slate-900">{{ row.master_name }}</td>
              <td class="px-4 py-3 text-slate-700">{{ formatMoneyMetric(row.gross_revenue) }}</td>
              <td class="px-4 py-3 text-slate-700">{{ formatNumber(row.completed_visits) }}</td>
              <td class="px-4 py-3 text-slate-700">{{ formatMoneyMetric(row.average_check) }}</td>
              <td class="px-4 py-3 text-slate-700">{{ formatDashboardRate(row.utilisation_rate) }}</td>
              <td class="px-4 py-3 text-slate-700">{{ formatMoneyMetric(row.revenue_per_available_hour) }}</td>
              <td class="px-4 py-3 text-slate-700">{{ row.returning_clients }}</td>
              <td class="px-4 py-3 font-medium text-amber-600">{{ ratingLabel(row) }}</td>
              <td class="px-4 py-3 text-right"><NuxtLink :to="`/admin/statistics/barbers/${row.master_id}`" class="text-sm font-medium text-cyan-700">Деталі</NuxtLink></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>
