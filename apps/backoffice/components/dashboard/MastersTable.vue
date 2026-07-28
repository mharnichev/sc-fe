<script setup lang="ts">
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/vue/24/outline'
import type { DashboardMasterBreakdownItem } from '~/utils/adminDashboardContract'
import {
  compareDashboardMasterRows,
  dashboardReturningClientShare,
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
  { key: 'returning_client_share', label: 'Частка повторних клієнтів', compactLabel: 'Повторні, %' },
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
const averageCheckLabel = (row: DashboardMasterBreakdownItem) =>
  row.completed_visits > 0 ? formatMoneyMetric(row.average_check) : 'Недоступно'
const utilisationLabel = (row: DashboardMasterBreakdownItem) =>
  row.available_minutes > 0 ? formatDashboardRate(row.utilisation_rate) : 'Недоступно'
const revenuePerHourLabel = (row: DashboardMasterBreakdownItem) =>
  row.available_minutes > 0 ? formatMoneyMetric(row.revenue_per_available_hour) : 'Недоступно'
const returningShareLabel = (row: DashboardMasterBreakdownItem) => {
  const share = dashboardReturningClientShare(row)
  if (share === null) return 'Недоступно'
  return `${formatDashboardRate(share)} · ${row.returning_clients}/${row.new_clients + row.returning_clients}`
}
const ratingLabel = (row: DashboardMasterBreakdownItem) =>
  hasDashboardMetric(row.approved_rating)
    ? `${formatRating(Number(row.approved_rating))} ★ · ${row.approved_review_count}`
    : 'Недоступно'
</script>

<template>
  <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="flex items-center gap-1 text-lg font-semibold text-slate-900">
          Майстри
          <DashboardMetricHelp
            title="Як порівнюються майстри"
            summary="Таблиця поєднує обсяг, ефективність доступного часу, повернення клієнтів і лише схвалені оцінки. Початкове сортування — не за загальною виручкою."
            formula="Середній чек = виручка ÷ завершені візити; завантаження = заброньовані ÷ доступні хвилини; виручка/год = виручка × 60 ÷ доступні хвилини; частка повторних = повторні ÷ (нові + повторні)."
            note="Якщо знаменник дорівнює нулю, похідна метрика показується як «Недоступно», а не як нуль."
          />
        </h2>
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
    <BaseTable
      v-else
      caption="Порівняння майстрів"
      wrapper-class="mt-4 rounded-2xl"
      min-width="1120px"
    >
      <template #head>
            <tr>
              <th class="sticky left-0 z-10 bg-ui-subtle">Майстер</th>
              <th v-for="column in columns" :key="column.key">
                <button
                  type="button"
                  class="base-table__sort inline-flex items-center gap-1 rounded-md text-left"
                  :aria-label="sortAriaLabel(column.key, column.label)"
                  @click="toggleSort(column.key)"
                >
                  {{ column.label }}
                  <ChevronUpIcon v-if="sortKey === column.key && sortDirection === 'asc'" class="h-3.5 w-3.5" aria-hidden="true" />
                  <ChevronDownIcon v-else-if="sortKey === column.key" class="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </th>
              <th><span class="sr-only">Дії</span></th>
            </tr>
      </template>
          <tr v-for="row in sortedRows" :key="row.master_id">
            <td class="sticky left-0 bg-ui-surface font-medium text-ui-primary">{{ row.master_name }}</td>
            <td class="text-ui-secondary">{{ formatMoneyMetric(row.gross_revenue) }}</td>
            <td class="text-ui-secondary">{{ formatNumber(row.completed_visits) }}</td>
            <td class="text-ui-secondary">{{ averageCheckLabel(row) }}</td>
            <td class="text-ui-secondary">{{ utilisationLabel(row) }}</td>
            <td class="text-ui-secondary">{{ revenuePerHourLabel(row) }}</td>
            <td class="text-ui-secondary">{{ returningShareLabel(row) }}</td>
            <td><BaseBadge tone="warning">{{ ratingLabel(row) }}</BaseBadge></td>
            <td class="text-right"><NuxtLink :to="`/admin/statistics/barbers/${row.master_id}`" class="font-medium text-ui-accent hover:underline">Деталі</NuxtLink></td>
          </tr>
    </BaseTable>
  </section>
</template>
