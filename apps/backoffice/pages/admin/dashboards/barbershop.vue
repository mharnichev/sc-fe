<script setup lang="ts">
import {
  ArrowPathIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  ChartBarSquareIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserGroupIcon,
} from '@heroicons/vue/24/outline'
import type { Master } from '~/composables/useBackofficeApi'
import {
  dashboardActionLabels,
  dashboardDateRangeError,
  dashboardMetricComparison,
  formatDashboardMinutesAsHours,
  formatDashboardRate,
  hasDashboardMetric,
  resolveDashboardPreset,
  resolveDashboardRange,
  type AdminDashboardPreset,
} from '~/utils/adminDashboard'
import type {
  DashboardActionSeverity,
  DashboardRepeatMetric,
  DashboardServiceBreakdownItem,
} from '~/utils/adminDashboardContract'
import { formatModerationDuration, formatRating, formatReviewConversionRate } from '~/utils/reviews'

definePageMeta({
  middleware: () => {
    const auth = useAuthStore()
    if (!auth.user?.is_superuser && auth.user?.role !== 'admin') {
      return navigateTo('/dashboard')
    }
  },
})

const api = useBackofficeApi()
const route = useRoute()
const router = useRouter()
const { apiErrorMessage, formatMoney, normalizeItems, todayInput } = useBookingFormatting()
const { barberName, statisticsErrorMessage } = useStatisticsFormatting()

const presetOptions: Array<{ value: Exclude<AdminDashboardPreset, 'custom'>, label: string }> = [
  { value: 'today', label: 'Сьогодні' },
  { value: '7d', label: '7 днів' },
  { value: '30d', label: '30 днів' },
  { value: 'mtd', label: 'Від початку місяця' },
]
const today = todayInput()
const initialRange = resolveDashboardRange({
  preset: route.query.preset,
  dateFrom: route.query.date_from,
  dateTo: route.query.date_to,
}, today)

const selectedPreset = ref<AdminDashboardPreset>(initialRange.preset)
const customDateFrom = ref(initialRange.dateFrom)
const customDateTo = ref(initialRange.dateTo)
const appliedDateFrom = ref(initialRange.dateFrom)
const appliedDateTo = ref(initialRange.dateTo)
const compareToPrevious = ref(route.query.compare_to_previous !== 'false')
const queryMasterId = Number(route.query.master_id)
const selectedMasterId = ref<number | null>(
  Number.isInteger(queryMasterId) && queryMasterId > 0 ? queryMasterId : null,
)
const rangeError = ref('')

const persistRange = () => router.replace({
  query: {
    ...route.query,
    preset: selectedPreset.value,
    date_from: appliedDateFrom.value,
    date_to: appliedDateTo.value,
    compare_to_previous: String(compareToPrevious.value),
    master_id: selectedMasterId.value || undefined,
  },
})

const applyRange = async () => {
  const validationError = dashboardDateRangeError(customDateFrom.value, customDateTo.value)
  if (validationError) {
    rangeError.value = validationError
    return
  }

  rangeError.value = ''
  appliedDateFrom.value = customDateFrom.value
  appliedDateTo.value = customDateTo.value
  await persistRange()
}

const selectPreset = async (preset: Exclude<AdminDashboardPreset, 'custom'>) => {
  const range = resolveDashboardPreset(preset, today)
  selectedPreset.value = preset
  customDateFrom.value = range.dateFrom
  customDateTo.value = range.dateTo
  await applyRange()
}

const selectCustom = () => {
  selectedPreset.value = 'custom'
  rangeError.value = ''
}

const updateComparison = () => persistRange()

const { data: mastersData } = await useAsyncData(
  'admin-dashboard-master-options',
  () => api.adminGetMasters(1, 200, { is_active: true }),
)
const masterOptions = computed(() => [
  { value: null, label: 'Усі майстри' },
  ...normalizeItems<Master>(mastersData.value).map(master => ({
    value: master.id,
    label: barberName(master),
  })),
])
watch(selectedMasterId, () => persistRange())

const {
  data: dashboard,
  pending,
  error,
  refresh,
} = await useAsyncData(
  'admin-decision-dashboard',
  () => api.adminGetDashboard({
    date_from: appliedDateFrom.value,
    date_to: appliedDateTo.value,
    compare_to_previous: compareToPrevious.value,
    master_id: selectedMasterId.value,
  }),
  { watch: [appliedDateFrom, appliedDateTo, compareToPrevious, selectedMasterId] },
)

const {
  data: reviewMetrics,
  pending: reviewMetricsPending,
  error: reviewMetricsError,
  refresh: refreshReviewMetrics,
} = await useAsyncData(
  'admin-barbershop-review-metrics',
  () => api.adminGetReviewMetrics({
    date_from: appliedDateFrom.value,
    date_to: appliedDateTo.value,
    master_id: selectedMasterId.value,
  }),
  { watch: [appliedDateFrom, appliedDateTo, selectedMasterId] },
)

const refreshAll = () => Promise.all([refresh(), refreshReviewMetrics()])
const errorStatus = computed(() => {
  if (typeof error.value !== 'object' || !error.value) return undefined
  if ('statusCode' in error.value) return Number((error.value as { statusCode?: number }).statusCode)
  if ('response' in error.value) return Number((error.value as { response?: { status?: number } }).response?.status)
  return undefined
})
const dashboardEndpointUnavailable = computed(() => [404, 405, 501].includes(errorStatus.value || 0))

const periodFormatter = new Intl.DateTimeFormat('uk-UA', {
  timeZone: 'Europe/Kyiv',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
const formatInputDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return periodFormatter.format(new Date(Date.UTC(year, month - 1, day, 12)))
}
const periodLabel = computed(() =>
  appliedDateFrom.value === appliedDateTo.value
    ? formatInputDate(appliedDateFrom.value)
    : `${formatInputDate(appliedDateFrom.value)} — ${formatInputDate(appliedDateTo.value)}`,
)
const comparisonPeriodLabel = computed(() =>
  dashboard.value?.period.previous
    ? `${formatInputDate(dashboard.value.period.previous.date_from)} — ${formatInputDate(dashboard.value.period.previous.date_to)}`
    : '',
)

const formatNumberMetric = (value: number | null | undefined) =>
  hasDashboardMetric(value) ? Number(value).toLocaleString('uk-UA', { maximumFractionDigits: 1 }) : 'Недоступно'
const formatMoneyMetric = (value: string | number | null | undefined) =>
  hasDashboardMetric(value) ? formatMoney(value) : 'Недоступно'
const emptyCapacityLabel = computed(() => {
  const capacity = dashboard.value?.capacity_and_leakage
  if (!capacity) return 'Недоступно'
  const parts = [
    formatDashboardMinutesAsHours(capacity.empty_upcoming_capacity_minutes),
    formatDashboardRate(capacity.empty_upcoming_capacity_rate),
    `${capacity.prime_time_empty_windows.length} прайм-вікон`,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Недоступно'
})
const primeTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  timeZone: 'Europe/Kyiv',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})
const formatPrimeTimeWindow = (startAt: string, endAt: string) =>
  `${primeTimeFormatter.format(new Date(startAt))} — ${primeTimeFormatter.format(new Date(endAt))}`
const repeatMetricLabel = (metric: DashboardRepeatMetric | null | undefined) => {
  if (!metric) return 'Недоступно'
  const rate = metric.repeat_rate === null ? 'ще не спостережувано' : formatDashboardRate(metric.repeat_rate)
  return `${metric.repeated_clients}/${metric.eligible_clients} · ${rate}`
}

const serviceSortKey = ref<'gross_revenue' | 'completed_visits'>('gross_revenue')
const sortedServices = computed(() => [...(dashboard.value?.services || [])].sort((first, second) => {
  const firstValue = first[serviceSortKey.value]
  const secondValue = second[serviceSortKey.value]
  const firstAvailable = hasDashboardMetric(firstValue)
  const secondAvailable = hasDashboardMetric(secondValue)
  if (firstAvailable !== secondAvailable) return firstAvailable ? -1 : 1
  return Number(secondValue || 0) - Number(firstValue || 0)
}))
const discountLabel = (service: DashboardServiceBreakdownItem) => formatMoney(service.discounts)

const actionSeverityOrder: Record<DashboardActionSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
}
const actionSignals = computed(() =>
  [...(dashboard.value?.actionable_signals || [])].sort((first, second) =>
    actionSeverityOrder[first.severity] - actionSeverityOrder[second.severity]),
)
const actionSeverityLabel: Record<DashboardActionSeverity, string> = {
  critical: 'Критично',
  warning: 'Потребує уваги',
  info: 'Можливість',
}
const actionSeverityClass: Record<DashboardActionSeverity, string> = {
  critical: 'border-rose-200 bg-rose-50 text-rose-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-cyan-200 bg-cyan-50 text-cyan-800',
}
</script>

<template>
  <div class="space-y-5">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.24em] text-cyan-700">Soul Cuts · бізнес-огляд</p>
        <h1 class="mt-2 text-3xl font-semibold text-slate-900">Дашборд барбершопу</h1>
        <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Рішення для якісної виручки, завантаження команди та повернення клієнтів.
        </p>
      </div>
      <BaseButton variant="neutral" :loading="pending || reviewMetricsPending" @click="refreshAll">
        <ArrowPathIcon class="h-4 w-4" aria-hidden="true" />
        Оновити
      </BaseButton>
    </header>

    <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="dashboard-period-title">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="dashboard-period-title" class="flex items-center gap-2 text-base font-semibold text-slate-900">
            <CalendarDaysIcon class="h-5 w-5 text-cyan-700" aria-hidden="true" />
            Період аналізу
          </h2>
          <p class="mt-1 text-sm text-slate-500">{{ periodLabel }} · часовий пояс Europe/Kyiv</p>
          <p v-if="comparisonPeriodLabel" class="mt-1 text-xs text-slate-400">Порівняння: {{ comparisonPeriodLabel }}</p>
        </div>
        <label class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700">
          <input v-model="compareToPrevious" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-600" @change="updateComparison">
          Попередній рівний період
        </label>
      </div>

      <div class="mt-4 flex flex-wrap gap-2" aria-label="Швидкий вибір періоду">
        <button
          v-for="option in presetOptions"
          :key="option.value"
          type="button"
          class="min-h-10 rounded-full border px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
          :class="selectedPreset === option.value ? 'border-cyan-300 bg-cyan-50 text-cyan-900' : 'border-slate-300 text-slate-600 hover:bg-slate-50'"
          :aria-pressed="selectedPreset === option.value"
          @click="selectPreset(option.value)"
        >
          {{ option.label }}
        </button>
        <button
          type="button"
          class="min-h-10 rounded-full border px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
          :class="selectedPreset === 'custom' ? 'border-cyan-300 bg-cyan-50 text-cyan-900' : 'border-slate-300 text-slate-600 hover:bg-slate-50'"
          :aria-pressed="selectedPreset === 'custom'"
          @click="selectCustom"
        >
          Власний період
        </button>
      </div>

      <form v-if="selectedPreset === 'custom'" class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,14rem)_minmax(0,14rem)_auto] lg:items-end" @submit.prevent="applyRange">
        <BaseInput v-model="customDateFrom" type="date" label="Дата від" :max="customDateTo || undefined" />
        <BaseInput v-model="customDateTo" type="date" label="Дата до" :min="customDateFrom || undefined" />
        <BaseButton type="submit" variant="primary">Застосувати</BaseButton>
      </form>
      <div class="mt-4 max-w-sm">
        <BaseSelect
          v-model="selectedMasterId"
          label="Майстер"
          :options="masterOptions"
          placeholder="Усі майстри"
        />
      </div>
      <p v-if="rangeError" class="mt-3 text-sm text-rose-600" role="alert">{{ rangeError }}</p>
    </section>

    <section
      v-if="error"
      class="rounded-[1.75rem] border p-6"
      :class="dashboardEndpointUnavailable ? 'border-amber-200 bg-amber-50' : 'border-rose-200 bg-rose-50'"
      role="status"
    >
      <div class="flex items-start gap-3">
        <InformationCircleIcon v-if="dashboardEndpointUnavailable" class="mt-0.5 h-6 w-6 shrink-0 text-amber-700" aria-hidden="true" />
        <ExclamationTriangleIcon v-else class="mt-0.5 h-6 w-6 shrink-0 text-rose-700" aria-hidden="true" />
        <div>
          <h2 class="font-semibold" :class="dashboardEndpointUnavailable ? 'text-amber-900' : 'text-rose-900'">
            {{ dashboardEndpointUnavailable ? 'Бізнес-метрики тимчасово недоступні' : 'Не вдалося завантажити бізнес-дашборд' }}
          </h2>
          <p class="mt-1 max-w-3xl text-sm leading-6" :class="dashboardEndpointUnavailable ? 'text-amber-800' : 'text-rose-700'">
            {{ dashboardEndpointUnavailable
              ? 'Backend ще не реалізував GET /backoffice/statistics/admin/dashboard. Значення не замінюються місячними підсумками або приблизними розрахунками.'
              : statisticsErrorMessage(error, apiErrorMessage(error, 'Спробуйте оновити сторінку. Жодні показники не були підмінені локальними розрахунками.')) }}
          </p>
          <BaseButton class="mt-4" variant="neutral" @click="refresh">Повторити</BaseButton>
        </div>
      </div>
    </section>

    <template v-else>
      <section aria-labelledby="executive-kpi-title">
        <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="executive-kpi-title" class="text-lg font-semibold text-slate-900">Ключовий результат</h2>
            <p class="mt-1 text-sm text-slate-500">Лише завершені візити у вибраному періоді.</p>
          </div>
          <p class="text-xs text-slate-400">Виручка не є прибутком: витрати, зарплати й постійні видатки не враховані.</p>
        </div>
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardDecisionMetricCard
            label="Виручка"
            kind="money"
            tone="dark"
            :value="dashboard?.executive.gross_revenue.current"
            :comparison="dashboardMetricComparison(dashboard?.executive.gross_revenue)"
            :loading="pending"
          />
          <DashboardDecisionMetricCard
            label="Завершені візити"
            tone="cyan"
            :value="dashboard?.executive.completed_visits.current"
            :comparison="dashboardMetricComparison(dashboard?.executive.completed_visits)"
            :loading="pending"
          />
          <DashboardDecisionMetricCard
            label="Середній чек"
            kind="money"
            :value="dashboard?.executive.average_check.current"
            :comparison="dashboardMetricComparison(dashboard?.executive.average_check)"
            :loading="pending"
          />
          <DashboardDecisionMetricCard
            label="Унікальні клієнти"
            tone="emerald"
            :value="dashboard?.executive.unique_clients.current"
            :comparison="dashboardMetricComparison(dashboard?.executive.unique_clients)"
            :loading="pending"
          />
        </div>
      </section>

      <div class="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(21rem,0.75fr)]">
        <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="capacity-title">
          <div class="flex items-start gap-3">
            <ChartBarSquareIcon class="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" aria-hidden="true" />
            <div>
              <h2 id="capacity-title" class="text-lg font-semibold text-slate-900">Потужність і втрати</h2>
              <p class="mt-1 text-sm text-slate-500">Завантаження рахується від підтвердженої доступності, а не від найзавантаженішого дня.</p>
            </div>
          </div>
          <div v-if="pending" class="mt-4 grid gap-3 sm:grid-cols-2"><div v-for="index in 6" :key="index" class="h-24 animate-pulse rounded-2xl bg-slate-100" /></div>
          <dl v-else class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div class="rounded-2xl bg-slate-50 p-4"><dt class="text-sm text-slate-500">Заброньовано годин</dt><dd class="mt-2 text-2xl font-semibold text-slate-900">{{ formatDashboardMinutesAsHours(dashboard?.capacity_and_leakage.booked_minutes) }}</dd></div>
            <div class="rounded-2xl bg-slate-50 p-4"><dt class="text-sm text-slate-500">Доступно годин</dt><dd class="mt-2 text-2xl font-semibold text-slate-900">{{ formatDashboardMinutesAsHours(dashboard?.capacity_and_leakage.available_minutes) }}</dd></div>
            <div class="rounded-2xl bg-cyan-50 p-4"><dt class="text-sm text-cyan-700">Завантаження</dt><dd class="mt-2 text-2xl font-semibold text-cyan-950">{{ formatDashboardRate(dashboard?.capacity_and_leakage.utilisation_rate) }}</dd></div>
            <div class="rounded-2xl bg-slate-50 p-4"><dt class="text-sm text-slate-500">Скасовані візити</dt><dd class="mt-2 text-2xl font-semibold text-slate-900">{{ formatNumberMetric(dashboard?.capacity_and_leakage.cancelled_visits) }}</dd><p class="mt-1 text-xs text-slate-500">Частка: {{ formatDashboardRate(dashboard?.capacity_and_leakage.cancellation_rate.current) }}</p></div>
            <div class="rounded-2xl bg-amber-50 p-4"><dt class="text-sm text-amber-700">Непідтверджені майбутні записи</dt><dd class="mt-2 text-2xl font-semibold text-amber-900">{{ formatNumberMetric(dashboard?.capacity_and_leakage.pending_unconfirmed_upcoming_bookings) }}</dd></div>
            <div class="rounded-2xl bg-slate-50 p-4"><dt class="text-sm text-slate-500">Порожня майбутня потужність</dt><dd class="mt-2 text-xl font-semibold text-slate-900">{{ emptyCapacityLabel }}</dd><p class="mt-1 text-xs text-slate-500">Прайм-час: будні 17:00–20:00, вихідні 10:00–14:00.</p></div>
          </dl>
          <ul v-if="dashboard?.capacity_and_leakage.prime_time_empty_windows.length" class="mt-3 grid gap-2 sm:grid-cols-2">
            <li v-for="window in dashboard.capacity_and_leakage.prime_time_empty_windows" :key="`${window.master_id}-${window.start_at}`" class="rounded-2xl border border-slate-200 px-4 py-3 text-sm">
              <p class="font-medium text-slate-900">{{ window.master_name }}</p>
              <p class="mt-1 text-slate-500">{{ formatPrimeTimeWindow(window.start_at, window.end_at) }} · {{ formatDashboardMinutesAsHours(window.available_minutes) }}</p>
            </li>
          </ul>
        </section>

        <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="retention-title">
          <div class="flex items-start gap-3">
            <UserGroupIcon class="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" aria-hidden="true" />
            <div>
              <h2 id="retention-title" class="text-lg font-semibold text-slate-900">Утримання клієнтів</h2>
              <p class="mt-1 text-sm text-slate-500">Нові проти тих, хто вже відвідував Soul Cuts.</p>
            </div>
          </div>
          <div v-if="pending" class="mt-4 space-y-3"><div v-for="index in 3" :key="index" class="h-20 animate-pulse rounded-2xl bg-slate-100" /></div>
          <template v-else>
            <dl class="mt-4 grid grid-cols-2 gap-3">
              <div class="rounded-2xl bg-cyan-50 p-4"><dt class="text-sm text-cyan-700">Нові клієнти</dt><dd class="mt-2 text-2xl font-semibold text-cyan-950">{{ formatNumberMetric(dashboard?.retention.new_clients) }}</dd></div>
              <div class="rounded-2xl bg-emerald-50 p-4"><dt class="text-sm text-emerald-700">Повторні клієнти</dt><dd class="mt-2 text-2xl font-semibold text-emerald-950">{{ formatNumberMetric(dashboard?.retention.returning_clients) }}</dd></div>
            </dl>
            <div class="mt-3 rounded-2xl border border-slate-200 p-4">
              <p class="text-sm font-medium text-slate-900">Повторний візит після завершеного візиту</p>
              <dl class="mt-3 grid grid-cols-3 gap-2 text-center">
                <div><dt class="text-xs text-slate-500">30 днів</dt><dd class="mt-1 font-semibold text-slate-900">{{ repeatMetricLabel(dashboard?.retention.repeat_30_day) }}</dd></div>
                <div><dt class="text-xs text-slate-500">45 днів</dt><dd class="mt-1 font-semibold text-slate-900">{{ repeatMetricLabel(dashboard?.retention.repeat_45_day) }}</dd></div>
                <div><dt class="text-xs text-slate-500">60 днів</dt><dd class="mt-1 font-semibold text-slate-900">{{ repeatMetricLabel(dashboard?.retention.repeat_60_day) }}</dd></div>
              </dl>
            </div>
            <p class="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-500">
              <InformationCircleIcon class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {{ dashboard?.period.definitions.retention_cohort || 'Визначення когорти недоступне.' }}
            </p>
          </template>
        </section>
      </div>

      <DashboardMastersTable :rows="dashboard?.masters || []" :loading="pending" />

      <div class="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="services-title">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="services-title" class="text-lg font-semibold text-slate-900">Послуги</h2>
              <p class="mt-1 text-sm text-slate-500">Виручка, завершені виконання та середня виручка за виконання. Маржа не розраховується без витрат.</p>
            </div>
            <div class="inline-flex rounded-full border border-slate-200 p-1" aria-label="Сортування послуг">
              <button type="button" class="rounded-full px-3 py-1.5 text-xs font-medium" :class="serviceSortKey === 'gross_revenue' ? 'bg-slate-950 text-white' : 'text-slate-600'" :aria-pressed="serviceSortKey === 'gross_revenue'" @click="serviceSortKey = 'gross_revenue'">За виручкою</button>
              <button type="button" class="rounded-full px-3 py-1.5 text-xs font-medium" :class="serviceSortKey === 'completed_visits' ? 'bg-slate-950 text-white' : 'text-slate-600'" :aria-pressed="serviceSortKey === 'completed_visits'" @click="serviceSortKey = 'completed_visits'">За візитами</button>
            </div>
          </div>
          <div v-if="pending" class="mt-4 space-y-3"><div v-for="index in 5" :key="index" class="h-16 animate-pulse rounded-2xl bg-slate-100" /></div>
          <StatisticsEmptyState v-else-if="!sortedServices.length" class="mt-4" title="Немає даних про послуги" description="Backend не повернув послуги для вибраного періоду." />
          <div v-else class="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table class="min-w-[720px] w-full divide-y divide-slate-200 text-sm">
              <thead class="bg-slate-50 text-left text-xs text-slate-500"><tr><th class="px-4 py-3 font-medium">Послуга</th><th class="px-4 py-3 font-medium">Виручка</th><th class="px-4 py-3 font-medium">Завершено</th><th class="px-4 py-3 font-medium">Виручка / виконання</th><th class="px-4 py-3 font-medium">Знижки</th></tr></thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="service in sortedServices" :key="service.service_id">
                  <td class="px-4 py-3 font-medium text-slate-900">{{ service.service_name }}</td>
                  <td class="px-4 py-3 text-slate-700">{{ formatMoneyMetric(service.gross_revenue) }}</td>
                  <td class="px-4 py-3 text-slate-700">{{ formatNumberMetric(service.completed_visits) }}</td>
                  <td class="px-4 py-3 text-slate-700">{{ formatMoneyMetric(service.average_realized_revenue_per_completed_service) }}</td>
                  <td class="px-4 py-3 text-slate-700">{{ discountLabel(service) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="actions-title">
          <div class="flex items-start gap-3">
            <SparklesIcon class="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" aria-hidden="true" />
            <div>
              <h2 id="actions-title" class="text-lg font-semibold text-slate-900">Центр дій</h2>
              <p class="mt-1 text-sm text-slate-500">Пріоритетні сигнали, для яких є конкретна наступна дія.</p>
            </div>
          </div>
          <div v-if="pending" class="mt-4 space-y-3"><div v-for="index in 4" :key="index" class="h-20 animate-pulse rounded-2xl bg-slate-100" /></div>
          <div v-else-if="actionSignals.length" class="mt-4 space-y-3">
            <article v-for="signal in actionSignals" :key="signal.code" class="rounded-2xl border p-4" :class="actionSeverityClass[signal.severity]">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-xs font-medium uppercase tracking-[0.12em]">{{ actionSeverityLabel[signal.severity] }}</p>
                  <h3 class="mt-1 font-semibold">{{ signal.title_uk }}</h3>
                  <p class="mt-1 text-sm leading-5 opacity-80">{{ signal.explanation_uk }}</p>
                </div>
                <ExclamationTriangleIcon v-if="signal.severity === 'critical' || signal.severity === 'warning'" class="h-5 w-5 shrink-0" aria-hidden="true" />
                <ClockIcon v-else class="h-5 w-5 shrink-0" aria-hidden="true" />
              </div>
              <NuxtLink :to="signal.recommended_backoffice_route" class="mt-3 inline-flex min-h-9 items-center gap-2 rounded-full border border-current px-3 py-2 text-xs font-semibold">
                {{ dashboardActionLabels[signal.code] }}
                <ArrowRightIcon class="h-3.5 w-3.5" aria-hidden="true" />
              </NuxtLink>
            </article>
          </div>
          <div v-else class="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
            <CheckCircleIcon class="h-6 w-6" aria-hidden="true" />
            <p class="mt-2 font-semibold">Термінових дій не потрібно</p>
            <p class="mt-1 text-sm">Backend не повернув пріоритетних сигналів для вибраного періоду.</p>
          </div>
        </section>
      </div>
    </template>

    <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="reputation-title">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex items-start gap-3">
          <ShieldCheckIcon class="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <h2 id="reputation-title" class="text-lg font-semibold text-slate-900">Репутація</h2>
            <p class="mt-1 text-sm text-slate-500">Воронка запитів відгуку та схвалені оцінки майстрів за вибраний період.</p>
          </div>
        </div>
        <NuxtLink to="/reviews" class="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">
          Модерація
          <ArrowRightIcon class="h-4 w-4" aria-hidden="true" />
        </NuxtLink>
      </div>
      <div v-if="reviewMetricsPending" class="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-6"><div v-for="index in 6" :key="index" class="h-20 animate-pulse rounded-2xl bg-slate-100" /></div>
      <p v-else-if="reviewMetricsError" class="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Метрики репутації недоступні: потрібен backend review metrics contract.</p>
      <template v-else-if="reviewMetrics">
        <dl class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div class="rounded-2xl bg-slate-50 p-3"><dt class="text-xs text-slate-500">Доступні візити</dt><dd class="mt-2 text-xl font-semibold text-slate-900">{{ reviewMetrics.eligible_completed_visits }}</dd></div>
          <div class="rounded-2xl bg-slate-50 p-3"><dt class="text-xs text-slate-500">Надіслано</dt><dd class="mt-2 text-xl font-semibold text-slate-900">{{ reviewMetrics.requests_sent }}</dd></div>
          <div class="rounded-2xl bg-slate-50 p-3"><dt class="text-xs text-slate-500">Доставлено</dt><dd class="mt-2 text-xl font-semibold text-slate-900">{{ reviewMetrics.requests_delivered }}</dd></div>
          <div class="rounded-2xl bg-slate-50 p-3"><dt class="text-xs text-slate-500">Відкрито форму</dt><dd class="mt-2 text-xl font-semibold text-slate-900">{{ formatNumberMetric(reviewMetrics.review_form_opens) }}</dd></div>
          <div class="rounded-2xl bg-slate-50 p-3"><dt class="text-xs text-slate-500">Конверсія</dt><dd class="mt-2 text-xl font-semibold text-slate-900">{{ formatReviewConversionRate(reviewMetrics.review_conversion_rate) }}</dd></div>
          <div class="rounded-2xl bg-slate-50 p-3"><dt class="text-xs text-slate-500">Час модерації</dt><dd class="mt-2 text-xl font-semibold text-slate-900">{{ formatModerationDuration(reviewMetrics.average_moderation_time_minutes) }}</dd></div>
        </dl>
        <div v-if="reviewMetrics.average_rating_by_master.length" class="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          <NuxtLink v-for="rating in reviewMetrics.average_rating_by_master" :key="rating.master_id" :to="`/admin/statistics/barbers/${rating.master_id}`" class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 transition hover:border-amber-300 hover:bg-amber-50">
            <span class="truncate text-sm font-medium text-slate-900">{{ barberName(rating.master) || `Майстер #${rating.master_id}` }}</span>
            <span class="shrink-0 text-sm font-semibold text-amber-600">{{ formatRating(rating.approved_average_rating) }} ★ · {{ rating.approved_review_count }}</span>
          </NuxtLink>
        </div>
        <p v-else class="mt-4 text-sm text-slate-500">Схвалених оцінок майстрів за цей період немає.</p>
      </template>
    </section>
  </div>
</template>
