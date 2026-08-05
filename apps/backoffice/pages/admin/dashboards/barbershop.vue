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
  dashboardActionNextSteps,
  dashboardActionLabels,
  dashboardDateRangeError,
  dashboardMetricComparison,
  dashboardSignalTriggerExplanation,
  formatDashboardSignalMetric,
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

const {
  data: bookingRecovery,
  pending: bookingRecoveryPending,
  error: bookingRecoveryError,
  refresh: refreshBookingRecovery,
} = await useAsyncData(
  'admin-booking-recovery-summary',
  () => api.adminGetBookingRecoverySummary({
    date_from: appliedDateFrom.value,
    date_to: appliedDateTo.value,
  }),
  { watch: [appliedDateFrom, appliedDateTo] },
)

const refreshAll = () => Promise.all([refresh(), refreshReviewMetrics(), refreshBookingRecovery()])
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
const reviewTrackingFormatter = new Intl.DateTimeFormat('uk-UA', {
  timeZone: 'Europe/Kyiv',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const formatReviewTrackingStart = (value: string | null) =>
  value ? reviewTrackingFormatter.format(new Date(value)) : 'невідомого моменту'
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
  critical: 'dashboard-action-signal--critical',
  warning: 'dashboard-action-signal--warning',
  info: 'dashboard-action-signal--info',
}
const actionSignalTrigger = (code: keyof typeof dashboardActionLabels) =>
  dashboard.value
    ? dashboardSignalTriggerExplanation(code, dashboard.value.period.signal_thresholds)
    : 'Поріг сигналу недоступний.'
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
      <BaseButton variant="neutral" :loading="pending || reviewMetricsPending || bookingRecoveryPending" @click="refreshAll">
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
          class="dashboard-period-option min-h-10 rounded-full border px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
          :class="selectedPreset === option.value ? 'dashboard-period-option--active' : 'dashboard-period-option--inactive'"
          :aria-pressed="selectedPreset === option.value"
          @click="selectPreset(option.value)"
        >
          {{ option.label }}
        </button>
        <button
          type="button"
          class="dashboard-period-option min-h-10 rounded-full border px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
          :class="selectedPreset === 'custom' ? 'dashboard-period-option--active' : 'dashboard-period-option--inactive'"
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
            <p class="mt-1 text-sm text-slate-500">Виручка, завершені візити та зміни клієнтської бази у вибраному періоді.</p>
          </div>
          <p class="text-xs text-slate-400">Виручка не є прибутком: витрати, зарплати й постійні видатки не враховані.</p>
        </div>
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <DashboardDecisionMetricCard
            label="Виручка"
            kind="money"
            tone="dark"
            :value="dashboard?.executive.gross_revenue.current"
            :comparison="dashboardMetricComparison(dashboard?.executive.gross_revenue)"
            :loading="pending"
            :help="{
              summary: 'Сума за завершеними візитами у вибраному періоді за часовим поясом Europe/Kyiv.',
              formula: 'Σ збережених у записі total_amount; якщо total_amount відсутній, backend використовує subtotal_amount.',
              note: 'Це виручка, не прибуток: собівартість, зарплати та постійні витрати не враховані.',
            }"
          />
          <DashboardDecisionMetricCard
            label="Завершені візити"
            tone="cyan"
            :value="dashboard?.executive.completed_visits.current"
            :comparison="dashboardMetricComparison(dashboard?.executive.completed_visits)"
            :loading="pending"
            :help="{
              summary: 'Кількість записів зі статусом «завершено», час початку яких потрапляє у вибраний період.',
              formula: 'COUNT записів зі статусом completed у межах включних дат Europe/Kyiv.',
              note: 'Скасовані, майбутні та непідтверджені записи сюди не входять.',
            }"
          />
          <DashboardDecisionMetricCard
            label="Середній чек"
            kind="money"
            :value="Number(dashboard?.executive.completed_visits.current || 0) > 0 ? dashboard?.executive.average_check.current : null"
            :comparison="Number(dashboard?.executive.completed_visits.current || 0) > 0 ? dashboardMetricComparison(dashboard?.executive.average_check) : null"
            :loading="pending"
            :help="{
              summary: 'Середня фактично зафіксована виручка на один завершений візит.',
              formula: 'Виручка ÷ кількість завершених візитів.',
              note: 'Знижки вже відображені у total_amount; це не середня прайсова ціна.',
            }"
          />
          <DashboardDecisionMetricCard
            label="Клієнти з завершеним візитом"
            :value="dashboard?.executive.unique_clients.current"
            :comparison="dashboardMetricComparison(dashboard?.executive.unique_clients)"
            :loading="pending"
            :help="{
              summary: 'Кількість різних клієнтів, які мали хоча б один завершений візит у вибраному періоді.',
              formula: 'COUNT DISTINCT за customer_id; для старих незв’язаних записів — за номером, збереженим у записі.',
              note: 'Один клієнт із кількома завершеними візитами рахується один раз.',
            }"
          />
          <DashboardDecisionMetricCard
            label="Нові клієнти в базі"
            tone="emerald"
            :value="dashboard?.executive.new_database_customers.current"
            :comparison="dashboardMetricComparison(dashboard?.executive.new_database_customers)"
            :loading="pending"
            :help="{
              summary: 'Кількість унікальних номерів телефону, для яких запис клієнта вперше створено в базі у вибраному періоді.',
              formula: 'COUNT DISTINCT Customer.phone, де Customer.created_at входить у вибраний період Europe/Kyiv.',
              note: selectedMasterId
                ? 'За фільтра майстра враховуються нові клієнти, для яких у тому самому періоді створено запис до цього майстра.'
                : 'Імпортовані записи також входять у показник у дату їх створення в цій базі.',
            }"
          />
        </div>
      </section>

      <DashboardBookingFunnelSection
        :funnel="dashboard?.booking_funnel"
        :loading="pending"
      />

      <DashboardBookingRecoverySection
        :summary="bookingRecovery"
        :loading="bookingRecoveryPending"
        :unavailable="Boolean(bookingRecoveryError)"
      />

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
            <div class="rounded-2xl bg-slate-50 p-4">
              <dt class="flex items-center gap-1 text-sm text-slate-500">
                Заброньовано годин
                <DashboardMetricHelp
                  title="Заброньовано годин"
                  summary="Час неперервного перетину записів із реально опублікованою доступністю майстрів."
                  formula="Об’єднання інтервалів усіх записів, крім скасованих, ∩ доступність після блокувань часу."
                  note="Перетини записів не подвоюють хвилини."
                />
              </dt>
              <dd class="mt-2 text-2xl font-semibold text-slate-900">{{ formatDashboardMinutesAsHours(dashboard?.capacity_and_leakage.booked_minutes) }}</dd>
            </div>
            <div class="rounded-2xl bg-slate-50 p-4">
              <dt class="flex items-center gap-1 text-sm text-slate-500">
                Доступно годин
                <DashboardMetricHelp
                  title="Доступно годин"
                  summary="Опублікований робочий час активних видимих майстрів у вибраному періоді."
                  formula="Об’єднання вікон доступності ∩ вибраний період − об’єднання блокувань часу."
                  note="Це фактичний знаменник завантаження, а не порівняння з найзавантаженішим днем."
                />
              </dt>
              <dd class="mt-2 text-2xl font-semibold text-slate-900">{{ formatDashboardMinutesAsHours(dashboard?.capacity_and_leakage.available_minutes) }}</dd>
            </div>
            <div class="dashboard-accent-card dashboard-accent-card--cyan rounded-2xl border p-4">
              <dt class="dashboard-accent-card__label flex items-center gap-1 text-sm">
                Завантаження
                <DashboardMetricHelp
                  title="Завантаження"
                  summary="Частка опублікованого доступного часу, зайнята записами."
                  formula="Заброньовані хвилини ÷ доступні хвилини × 100%."
                  note="Якщо доступних хвилин немає, backend зараз повертає 0%; для однозначного «недоступно» контракту бракує статусу знаменника."
                />
              </dt>
              <dd class="dashboard-accent-card__value mt-2 text-2xl font-semibold">
                {{ Number(dashboard?.capacity_and_leakage.available_minutes || 0) > 0 ? formatDashboardRate(dashboard?.capacity_and_leakage.utilisation_rate) : 'Недоступно' }}
              </dd>
            </div>
            <div class="rounded-2xl bg-slate-50 p-4">
              <dt class="flex items-center gap-1 text-sm text-slate-500">
                Скасовані візити
                <DashboardMetricHelp
                  title="Скасування"
                  summary="Кількість записів зі статусом «скасовано», запланованих на вибраний період."
                  formula="Частка скасувань = скасовані записи ÷ усі записи, заплановані на період × 100%."
                  :trigger="dashboard ? dashboardSignalTriggerExplanation('elevated_cancellations', dashboard.period.signal_thresholds) : undefined"
                  note="Пороговий сигнал оцінює зростання у відсоткових пунктах, а не відносну зміну у відсотках."
                />
              </dt>
              <dd class="mt-2 text-2xl font-semibold text-slate-900">{{ formatNumberMetric(dashboard?.capacity_and_leakage.cancelled_visits) }}</dd>
              <p class="mt-1 text-xs text-slate-500">Частка: {{ formatDashboardRate(dashboard?.capacity_and_leakage.cancellation_rate.current) }}</p>
            </div>
            <div class="dashboard-accent-card dashboard-accent-card--amber rounded-2xl border p-4">
              <dt class="dashboard-accent-card__label flex items-center gap-1 text-sm">
                Непідтверджені майбутні записи
                <DashboardMetricHelp
                  title="Непідтверджені майбутні записи"
                  summary="Майбутні записи зі статусом «очікує підтвердження» у межах вибраного періоду."
                  formula="COUNT pending, де start_at ≥ поточний час і start_at входить у період."
                  :trigger="dashboard ? dashboardSignalTriggerExplanation('pending_bookings', dashboard.period.signal_thresholds) : undefined"
                  action="Підтвердьте актуальні записи або скасуйте ті, що не відбудуться."
                />
              </dt>
              <dd class="dashboard-accent-card__value mt-2 text-2xl font-semibold">{{ formatNumberMetric(dashboard?.capacity_and_leakage.pending_unconfirmed_upcoming_bookings) }}</dd>
            </div>
            <div class="rounded-2xl bg-slate-50 p-4">
              <dt class="flex items-center gap-1 text-sm text-slate-500">
                Порожня майбутня потужність
                <DashboardMetricHelp
                  title="Порожня майбутня потужність"
                  summary="Майбутня частина вже опублікованої доступності, яка ще не перекрита жодним активним записом."
                  formula="Майбутня доступність − об’єднання майбутніх записів; частка = порожні хвилини ÷ майбутні доступні хвилини × 100%."
                  :trigger="dashboard ? dashboardSignalTriggerExplanation('unfilled_capacity', dashboard.period.signal_thresholds) : undefined"
                  action="Спочатку перевірте актуальність графіка, потім працюйте з найбільшими та прайм-вікнами."
                />
              </dt>
              <dd class="mt-2 text-xl font-semibold text-slate-900">{{ emptyCapacityLabel }}</dd>
              <p class="mt-1 text-xs text-slate-500">Прайм-час: будні 17:00–20:00, вихідні 10:00–14:00.</p>
            </div>
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
              <h2 id="retention-title" class="flex items-center gap-1 text-lg font-semibold text-slate-900">
                Утримання клієнтів
                <DashboardMetricHelp
                  title="Когорта утримання"
                  summary="Когорта складається з клієнтів, чий перший завершений візит у поточній області майстра потрапив у вибраний період."
                  formula="Repeat N = клієнти з наступним завершеним візитом упродовж N днів ÷ клієнти, для яких повні N днів уже можна спостерігати × 100%."
                  note="Клієнт не входить у знаменник 30/45/60 днів, доки відповідне вікно не минуло повністю. Це захищає метрику від штучного заниження."
                />
              </h2>
              <p class="mt-1 text-sm text-slate-500">
                {{ selectedMasterId ? 'Перший завершений візит і повторні візити відносно обраного майстра.' : 'Перший завершений візит проти клієнтів, які вже відвідували Soul Cuts.' }}
              </p>
            </div>
          </div>
          <div v-if="pending" class="mt-4 space-y-3"><div v-for="index in 3" :key="index" class="h-20 animate-pulse rounded-2xl bg-slate-100" /></div>
          <template v-else>
            <dl class="mt-4 grid grid-cols-2 gap-3">
              <div class="dashboard-accent-card dashboard-accent-card--cyan rounded-2xl border p-4">
                <dt class="dashboard-accent-card__label flex items-center gap-1 text-sm">
                  Клієнти з першим візитом
                  <DashboardMetricHelp
                    title="Клієнти з першим візитом"
                    summary="Унікальні клієнти із завершеним візитом у періоді, для яких це перший завершений візит у поточній області."
                    formula="Дата першого завершеного візиту ≥ початку вибраного періоду."
                    :note="selectedMasterId ? 'За фільтра майстра «новий» означає новий для цього майстра.' : 'Без фільтра «новий» означає перший завершений візит у Soul Cuts.'"
                  />
                </dt>
                <dd class="dashboard-accent-card__value mt-2 text-2xl font-semibold">{{ formatNumberMetric(dashboard?.retention.new_clients) }}</dd>
              </div>
              <div class="dashboard-accent-card dashboard-accent-card--emerald rounded-2xl border p-4">
                <dt class="dashboard-accent-card__label flex items-center gap-1 text-sm">
                  Повторні клієнти
                  <DashboardMetricHelp
                    title="Повторні клієнти"
                    summary="Унікальні клієнти із завершеним візитом у періоді, які вже мали завершений візит у поточній області."
                    formula="Дата першого завершеного візиту < початку вибраного періоду."
                    :note="selectedMasterId ? 'За фільтра майстра історія оцінюється для цього майстра.' : 'Без фільтра враховується історія завершених візитів у Soul Cuts.'"
                  />
                </dt>
                <dd class="dashboard-accent-card__value mt-2 text-2xl font-semibold">{{ formatNumberMetric(dashboard?.retention.returning_clients) }}</dd>
              </div>
            </dl>
            <div class="mt-3 rounded-2xl border border-slate-200 p-4">
              <p class="flex items-center gap-1 text-sm font-medium text-slate-900">
                Повторний візит після завершеного візиту
                <DashboardMetricHelp
                  title="Повторний візит за 30 / 45 / 60 днів"
                  summary="Для кожного вікна показано: повторні клієнти / клієнти, яких уже можна оцінити · частка повтору."
                  formula="repeated_clients ÷ eligible_clients × 100%."
                  note="«Ще не спостережувано» означає, що для жодного клієнта когорти повне вікно ще не завершилося; це не 0%."
                />
              </p>
              <dl class="mt-3 grid grid-cols-3 gap-2 text-center">
                <div><dt class="text-xs text-slate-500">30 днів</dt><dd class="mt-1 font-semibold text-slate-900">{{ repeatMetricLabel(dashboard?.retention.repeat_30_day) }}</dd></div>
                <div><dt class="text-xs text-slate-500">45 днів</dt><dd class="mt-1 font-semibold text-slate-900">{{ repeatMetricLabel(dashboard?.retention.repeat_45_day) }}</dd></div>
                <div><dt class="text-xs text-slate-500">60 днів</dt><dd class="mt-1 font-semibold text-slate-900">{{ repeatMetricLabel(dashboard?.retention.repeat_60_day) }}</dd></div>
              </dl>
            </div>
            <p class="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-500">
              <InformationCircleIcon class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              До знаменника кожного вікна входять лише клієнти, для яких усі 30, 45 або 60 днів уже минули до кінця періоду чи поточного київського часу.
            </p>
          </template>
        </section>
      </div>

      <DashboardMastersTable :rows="dashboard?.masters || []" :loading="pending" />

      <div class="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="services-title">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="services-title" class="flex items-center gap-1 text-lg font-semibold text-slate-900">
                Послуги
                <DashboardMetricHelp
                  title="Ефективність послуг"
                  summary="«Завершено» — кількість різних завершених записів, у яких була послуга. Виручка багатопослугового запису розподіляється між його послугами."
                  formula="Частка послуги = її поточна ціна ÷ суму поточних цін послуг запису; виручка/виконання = розподілена виручка ÷ завершені записи з послугою."
                  note="Це не маржа. Історичних цін на кожну позицію запису немає, тому зміна поточної ціни може змінити розподіл історичної виручки між послугами."
                />
              </h2>
              <p class="mt-1 text-sm text-slate-500">Виручка, завершені виконання та середня виручка за виконання. Маржа не розраховується без витрат.</p>
              <p class="mt-2 max-w-3xl text-xs leading-5 text-amber-700">
                Важливо: для розподілу суми багатопослугового запису backend використовує поточні ціни послуг, бо знімки ціни кожної позиції поки не зберігаються.
              </p>
            </div>
            <div class="inline-flex rounded-full border border-slate-200 p-1" aria-label="Сортування послуг">
              <button type="button" class="rounded-full px-3 py-1.5 text-xs font-medium" :class="serviceSortKey === 'gross_revenue' ? 'bg-slate-950 text-white' : 'text-slate-600'" :aria-pressed="serviceSortKey === 'gross_revenue'" @click="serviceSortKey = 'gross_revenue'">За виручкою</button>
              <button type="button" class="rounded-full px-3 py-1.5 text-xs font-medium" :class="serviceSortKey === 'completed_visits' ? 'bg-slate-950 text-white' : 'text-slate-600'" :aria-pressed="serviceSortKey === 'completed_visits'" @click="serviceSortKey = 'completed_visits'">За візитами</button>
            </div>
          </div>
          <div v-if="pending" class="mt-4 space-y-3"><div v-for="index in 5" :key="index" class="h-16 animate-pulse rounded-2xl bg-slate-100" /></div>
          <StatisticsEmptyState v-else-if="!sortedServices.length" class="mt-4" title="Немає даних про послуги" description="Backend не повернув послуги для вибраного періоду." />
          <BaseTable
            v-else
            caption="Ефективність послуг"
            wrapper-class="mt-4 rounded-2xl"
            min-width="720px"
          >
            <template #head>
              <tr><th>Послуга</th><th>Виручка</th><th>Завершено</th><th>Виручка / виконання</th><th>Знижки</th></tr>
            </template>
                <tr v-for="service in sortedServices" :key="service.service_id">
                  <td class="font-medium text-ui-primary">{{ service.service_name }}</td>
                  <td class="text-ui-secondary">{{ formatMoneyMetric(service.gross_revenue) }}</td>
                  <td class="text-ui-secondary">{{ formatNumberMetric(service.completed_visits) }}</td>
                  <td class="text-ui-secondary">{{ formatMoneyMetric(service.average_realized_revenue_per_completed_service) }}</td>
                  <td class="text-ui-secondary">{{ discountLabel(service) }}</td>
                </tr>
          </BaseTable>
        </section>

        <section class="dashboard-action-center rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="actions-title">
          <div class="flex items-start gap-3">
            <SparklesIcon class="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" aria-hidden="true" />
            <div>
              <h2 id="actions-title" class="dashboard-action-center__title flex items-center gap-1 text-lg font-semibold">
                Центр дій
                <DashboardMetricHelp
                  title="Як формуються сигнали"
                  summary="Backend перевіряє бізнес-показники за явними порогами та повертає лише сигнали, для яких є конкретний екран дії."
                  formula="Критичні сигнали показуються першими, потім попередження і можливості. Значення та пороги надходять одним dashboard-відповіддю."
                  note="Відсутність сигналу означає, що умови порога не виконані; це не гарантує відсутність усіх бізнес-ризиків."
                />
              </h2>
              <p class="mt-1 text-sm text-slate-500">Пріоритетні сигнали, для яких є конкретна наступна дія.</p>
            </div>
          </div>
          <div v-if="pending" class="mt-4 space-y-3"><div v-for="index in 4" :key="index" class="h-20 animate-pulse rounded-2xl bg-slate-100" /></div>
          <div v-else-if="actionSignals.length" class="mt-4 space-y-3">
            <article v-for="signal in actionSignals" :key="signal.code" class="dashboard-action-signal rounded-2xl border p-4" :class="actionSeverityClass[signal.severity]">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-xs font-medium uppercase tracking-[0.12em]">{{ actionSeverityLabel[signal.severity] }}</p>
                  <h3 class="mt-1 flex items-start gap-1 font-semibold">
                    {{ signal.title_uk }}
                    <DashboardMetricHelp
                      :title="signal.title_uk"
                      :summary="signal.explanation_uk"
                      :trigger="actionSignalTrigger(signal.code)"
                      :action="dashboardActionNextSteps[signal.code]"
                      :note="`Поточне значення: ${formatDashboardSignalMetric(signal)}.`"
                    />
                  </h3>
                  <p class="mt-1 text-sm leading-5 opacity-80">{{ signal.explanation_uk }}</p>
                </div>
                <ExclamationTriangleIcon v-if="signal.severity === 'critical' || signal.severity === 'warning'" class="h-5 w-5 shrink-0" aria-hidden="true" />
                <ClockIcon v-else class="h-5 w-5 shrink-0" aria-hidden="true" />
              </div>
              <dl class="mt-3 grid gap-2 text-xs leading-5">
                <div>
                  <dt class="font-semibold">Зараз</dt>
                  <dd class="opacity-80">{{ formatDashboardSignalMetric(signal) }}</dd>
                </div>
                <div>
                  <dt class="font-semibold">Чому спрацювало</dt>
                  <dd class="opacity-80">{{ actionSignalTrigger(signal.code) }}</dd>
                </div>
                <div>
                  <dt class="font-semibold">Що зробити</dt>
                  <dd class="opacity-80">{{ dashboardActionNextSteps[signal.code] }}</dd>
                </div>
              </dl>
              <NuxtLink :to="signal.recommended_backoffice_route" class="mt-3 inline-flex min-h-9 items-center gap-2 rounded-full border border-current px-3 py-2 text-xs font-semibold">
                {{ dashboardActionLabels[signal.code] }}
                <ArrowRightIcon class="h-3.5 w-3.5" aria-hidden="true" />
              </NuxtLink>
            </article>
          </div>
          <div v-else class="dashboard-action-empty mt-4 rounded-2xl border p-5">
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
            <h2 id="reputation-title" class="flex items-center gap-1 text-lg font-semibold text-slate-900">
              Репутація
              <DashboardMetricHelp
                title="Воронка запитів на відгук"
                summary="Усі етапи прив’язані до тих самих завершених записів, запланованих у вибраному включному періоді Europe/Kyiv."
                formula="Конверсія у відгук = надіслані клієнтами відгуки ÷ надіслані запити × 100%."
                note="Оцінки майстрів включають лише схвалені відгуки; очікувані та відхилені не впливають на рейтинг."
              />
            </h2>
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
          <div class="rounded-2xl bg-slate-50 p-3">
            <dt class="flex items-center gap-1 text-xs text-slate-500">
              Доступні візити
              <DashboardMetricHelp title="Доступні для запиту візити" summary="Завершені візити у вибраному періоді, пов’язані з профілем клієнта." formula="COUNT completed bookings, де customer_id заповнений." note="Це базова технічна придатність; окремі правила частоти або виключення можуть не дати створити запит." />
            </dt>
            <dd class="mt-2 text-xl font-semibold text-slate-900">{{ reviewMetrics.eligible_completed_visits }}</dd>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <dt class="flex items-center gap-1 text-xs text-slate-500">
              Надіслано
              <DashboardMetricHelp title="Надіслано запитів" summary="Запити на відгук для записів цієї когорти, у яких зафіксовано час відправлення." formula="COUNT ReviewRequest.sent_at." />
            </dt>
            <dd class="mt-2 text-xl font-semibold text-slate-900">{{ reviewMetrics.requests_sent }}</dd>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <dt class="flex items-center gap-1 text-xs text-slate-500">
              Доставлено
              <DashboardMetricHelp title="Доставлено запитів" summary="Надіслані запити цієї когорти, для яких провайдер підтвердив доставку." formula="COUNT ReviewRequest.delivered_at." note="Відсутність підтвердження доставки не завжди означає, що повідомлення точно не потрапило клієнту." />
            </dt>
            <dd class="mt-2 text-xl font-semibold text-slate-900">{{ reviewMetrics.requests_delivered }}</dd>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <dt class="flex items-center gap-1 text-xs text-slate-500">
              Відкрито форму
              <DashboardMetricHelp title="Унікальні запити з відкритою формою" summary="Кількість запитів вибраної когорти, для яких хоча б раз підтверджено досягнення форми." formula="COUNT DISTINCT ReviewFormOpenEvent.review_request_id." note="Повторні завантаження й автоматичні retry не збільшують показник. Для когорт до початку persisted-трекінгу значення позначається як часткове або недоступне." />
            </dt>
            <dd class="mt-2 text-xl font-semibold text-slate-900">{{ formatNumberMetric(reviewMetrics.review_form_opens) }}</dd>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <dt class="flex items-center gap-1 text-xs text-slate-500">
              Конверсія
              <DashboardMetricHelp title="Конверсія у відгук" summary="Частка надісланих запитів, які мають прив’язаний поданий відгук у тій самій когорті." formula="Запити з sent_at і review_id ÷ запити з sent_at × 100%." note="Знаменник — надіслані, а не доставлені запити; ручні або аномальні відгуки без надісланого запиту виключаються." />
            </dt>
            <dd class="mt-2 text-xl font-semibold text-slate-900">
              {{ reviewMetrics.requests_sent > 0 ? formatReviewConversionRate(reviewMetrics.review_conversion_rate) : 'Недоступно' }}
            </dd>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <dt class="flex items-center gap-1 text-xs text-slate-500">
              Час модерації
              <DashboardMetricHelp title="Середній час модерації" summary="Середній час від надсилання відгуку клієнтом до рішення модератора." formula="AVG(moderated_at − submitted_at) для відгуків із рішенням." note="Якщо жоден відгук ще не модеровано, показник недоступний." />
            </dt>
            <dd class="mt-2 text-xl font-semibold text-slate-900">{{ formatModerationDuration(reviewMetrics.average_moderation_time_minutes) }}</dd>
          </div>
        </dl>
        <p
          v-if="reviewMetrics.review_form_opens_status !== 'available'"
          class="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Збереження відкриттів форми почалося {{ formatReviewTrackingStart(reviewMetrics.review_form_open_tracking_started_at) }}. Для цієї когорти показник {{ reviewMetrics.review_form_opens_status === 'partial' ? 'є підтвердженим мінімумом через старі або змішані посилання' : 'недоступний, бо всі посилання втратили чинність раніше' }}.
        </p>
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

<style scoped>
.dashboard-period-option {
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text-primary) 8%, transparent);
}

.dashboard-period-option--inactive {
  border-color: var(--border) !important;
  background: var(--solid-control) !important;
  color: var(--text-secondary) !important;
}

.dashboard-period-option--inactive:hover {
  border-color: var(--focus-border) !important;
  background: var(--solid-control-hover) !important;
  color: var(--interactive-hover-text) !important;
}

.dashboard-period-option--active,
.dashboard-period-option--active:hover {
  border-color: color-mix(in srgb, var(--accent-text) 58%, transparent) !important;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--accent-text) 22%, var(--input-bg)),
      color-mix(in srgb, var(--accent-text) 13%, var(--glass))
    ) !important;
  color: color-mix(in srgb, var(--accent-text) 82%, var(--text-primary)) !important;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--text-primary) 12%, transparent),
    0 0 0 1px color-mix(in srgb, var(--accent-text) 18%, transparent),
    0 8px 22px color-mix(in srgb, var(--accent-text) 12%, transparent) !important;
}

.dashboard-accent-card {
  --dashboard-card-tone: var(--accent-text);
  border-color: color-mix(in srgb, var(--dashboard-card-tone) 28%, var(--border)) !important;
  background: color-mix(in srgb, var(--dashboard-card-tone) 13%, var(--glass)) !important;
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text-primary) 8%, transparent);
}

.dashboard-accent-card--emerald {
  --dashboard-card-tone: var(--success);
}

.dashboard-accent-card--amber {
  --dashboard-card-tone: var(--warning);
}

.dashboard-accent-card__label {
  color: color-mix(in srgb, var(--dashboard-card-tone) 76%, var(--text-primary)) !important;
}

.dashboard-accent-card__value {
  color: var(--text-primary) !important;
}

.dashboard-action-center {
  background: color-mix(in srgb, var(--accent-text) 4%, var(--glass)) !important;
  border-color: color-mix(in srgb, var(--accent-text) 16%, var(--border)) !important;
}

.dashboard-action-center__title {
  color: var(--text-primary) !important;
}

.dashboard-action-signal,
.dashboard-action-empty {
  --dashboard-action-tone: var(--accent-text);
  border-color: color-mix(in srgb, var(--dashboard-action-tone) 30%, var(--border)) !important;
  background: color-mix(in srgb, var(--dashboard-action-tone) 12%, var(--glass)) !important;
  color: color-mix(in srgb, var(--dashboard-action-tone) 72%, var(--text-primary)) !important;
}

.dashboard-action-signal--critical {
  --dashboard-action-tone: var(--danger);
}

.dashboard-action-signal--warning {
  --dashboard-action-tone: var(--warning);
}

.dashboard-action-empty {
  --dashboard-action-tone: var(--success);
}
</style>
