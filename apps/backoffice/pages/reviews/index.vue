<script setup lang="ts">
import { ArrowPathIcon, EyeIcon, FunnelIcon } from '@heroicons/vue/24/outline'
import type { Master } from '~/composables/useBackofficeApi'
import type { ReviewFilters } from '~/types/reviews'
import { formatModerationDuration, formatRating, formatReviewConversionRate, reviewModerationLabels, reviewRequestStateLabels, safeBookingReference } from '~/utils/reviews'

definePageMeta({
  middleware: () => {
    const auth = useAuthStore()
    if (!auth.user?.is_superuser && auth.user?.role !== 'admin') return navigateTo('/')
  },
})

const api = useBackofficeApi()
const route = useRoute()
const auth = useAuthStore()
const { apiErrorMessage, formatDateTime, masterName, normalizeItems } = useBookingFormatting()
const isAdmin = computed(() => Boolean(auth.user?.is_superuser || auth.user?.role === 'admin'))
const page = ref(1)
const pageSize = 20
const routeModerationStatus = String(route.query.moderation_status || '')
const routeRequestState = String(route.query.request_state || '')
const filters = reactive<ReviewFilters>({
  moderation_status: ['pending', 'approved', 'rejected'].includes(routeModerationStatus)
    ? routeModerationStatus as ReviewFilters['moderation_status']
    : '',
  master_id: null,
  rating: null,
  submitted_from: '',
  submitted_to: '',
  request_state: ['scheduled', 'sent', 'delivered', 'submitted', 'expired', 'failed'].includes(routeRequestState)
    ? routeRequestState as ReviewFilters['request_state']
    : '',
})
const metricDraft = reactive({
  date_from: '',
  date_to: '',
  master_id: null as number | null,
})
const appliedMetricFilters = ref({ ...metricDraft })
const metricPeriodError = ref('')

const moderationOptions = [
  { value: '', label: 'Усі статуси модерації' },
  ...Object.entries(reviewModerationLabels).map(([value, label]) => ({ value, label })),
]
const requestStateOptions = [
  { value: '', label: 'Усі стани запиту' },
  ...Object.entries(reviewRequestStateLabels).map(([value, label]) => ({ value, label })),
]
const ratingOptions = [
  { value: null, label: 'Будь-яка оцінка' },
  ...[5, 4, 3, 2, 1].map(value => ({ value, label: `${value} з 5` })),
]

const [{ data, pending, error, refresh }, { data: mastersData }, { data: metrics, pending: metricsPending, error: metricsError, refresh: refreshMetrics }] = await Promise.all([
  useAsyncData('admin-booking-reviews', () => isAdmin.value ? api.adminGetReviews(page.value, pageSize, filters) : Promise.resolve({ total: 0, page: 1, page_size: pageSize, items: [] }), { watch: [page] }),
  useAsyncData('admin-review-master-options', () => isAdmin.value ? api.adminGetMasters(1, 200) : Promise.resolve([] as Master[])),
  useAsyncData('admin-review-metrics', () => isAdmin.value
    ? api.adminGetReviewMetrics({
        date_from: appliedMetricFilters.value.date_from || undefined,
        date_to: appliedMetricFilters.value.date_to || undefined,
        master_id: appliedMetricFilters.value.master_id,
      })
    : Promise.resolve(null)),
])

const reviews = computed(() => data.value?.items || [])
const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total || 0) / pageSize)))
const masterOptions = computed(() => [
  { value: null, label: 'Усі майстри' },
  ...normalizeItems(mastersData.value).map(master => ({ value: master.id, label: masterName(master) })),
])
const permissionDenied = computed(() => !isAdmin.value || (typeof error.value === 'object' && error.value && 'response' in error.value && (error.value as { response?: { status?: number } }).response?.status === 403))
const metricsDateFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const formatMetricDate = (value: string) =>
  metricsDateFormatter.format(new Date(`${value}T00:00:00.000Z`))
const metricsTrackingFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Kyiv',
})
const formatMetricTrackingStart = (value: string | null) =>
  value ? metricsTrackingFormatter.format(new Date(value)) : 'невідомого моменту'
const metricScopeLabel = computed(() => {
  if (!metrics.value?.date_from || !metrics.value.date_to) {
    return 'Фактична когорта: усі завершені візити за весь час · Europe/Kyiv'
  }
  return `Фактична когорта: завершені візити, заплановані з ${formatMetricDate(metrics.value.date_from)} до ${formatMetricDate(metrics.value.date_to)} включно · Europe/Kyiv`
})
const reviewFormOpenValue = computed(() => {
  if (!metrics.value || metrics.value.review_form_opens_status === 'unavailable') return 'Недоступно'
  const value = metrics.value.review_form_opens ?? 0
  return metrics.value.review_form_opens_status === 'partial' ? `${value}*` : value
})
const metricCards = computed(() => [
  { label: 'Завершені візити з клієнтом', value: metrics.value?.eligible_completed_visits ?? '—' },
  { label: 'Запити створено', value: metrics.value?.requests_scheduled ?? '—' },
  { label: 'Запити надіслано', value: metrics.value?.requests_sent ?? '—' },
  { label: 'Підтверджено доставку', value: metrics.value?.requests_delivered ?? '—' },
  { label: 'Унікальні запити з відкритою формою', value: reviewFormOpenValue.value },
  { label: 'Відгуки подано', value: metrics.value?.submitted_reviews ?? '—' },
  { label: 'Відгуки схвалено', value: metrics.value?.approved_reviews ?? '—' },
  { label: 'Конверсія запит → відгук', value: formatReviewConversionRate(metrics.value?.review_conversion_rate) },
  { label: 'Конверсія запит → відкриття', value: formatReviewConversionRate(metrics.value?.sent_to_open_rate) },
  { label: 'Конверсія відкриття → відгук', value: formatReviewConversionRate(metrics.value?.opened_to_submitted_rate) },
  { label: 'Час модерації', value: formatModerationDuration(metrics.value?.average_moderation_time_minutes) },
])

const applyFilters = async () => {
  page.value = 1
  await refresh()
}
const resetFilters = async () => {
  Object.assign(filters, { moderation_status: '', master_id: null, rating: null, submitted_from: '', submitted_to: '', request_state: '' })
  Object.assign(metricDraft, { date_from: '', date_to: '', master_id: null })
  appliedMetricFilters.value = { ...metricDraft }
  metricPeriodError.value = ''
  page.value = 1
  await Promise.all([refresh(), refreshMetrics()])
}
const refreshAll = () => Promise.all([refresh(), refreshMetrics()])
const validIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
const applyMetricPeriod = async () => {
  const { date_from: dateFrom, date_to: dateTo } = metricDraft
  metricPeriodError.value = ''
  if (Boolean(dateFrom) !== Boolean(dateTo)) {
    metricPeriodError.value = 'Вкажіть обидві межі періоду або залиште обидві порожніми.'
    return
  }
  if (dateFrom && dateTo) {
    if (!validIsoDate(dateFrom) || !validIsoDate(dateTo)) {
      metricPeriodError.value = 'Перевірте коректність дат періоду.'
      return
    }
    const start = new Date(`${dateFrom}T00:00:00.000Z`)
    const end = new Date(`${dateTo}T00:00:00.000Z`)
    const inclusiveDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
    if (inclusiveDays <= 0) {
      metricPeriodError.value = 'Дата початку не може бути пізнішою за дату завершення.'
      return
    }
    if (inclusiveDays > 366) {
      metricPeriodError.value = 'Період метрик не може перевищувати 366 днів.'
      return
    }
  }
  appliedMetricFilters.value = { ...metricDraft }
  await refreshMetrics()
}
type ReviewBadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'
const reviewStatusTone = (status: string): ReviewBadgeTone => {
  if (['approved', 'sent', 'delivered', 'submitted'].includes(status)) return 'success'
  if (['rejected', 'failed', 'expired'].includes(status)) return 'danger'
  if (['pending', 'scheduled'].includes(status)) return 'warning'
  return 'neutral'
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="ui-eyebrow text-sm uppercase tracking-[0.3em]">Адмін · якість</p>
        <h1 class="mt-2 text-3xl font-semibold text-ui-primary">Відгуки після візиту</h1>
        <p class="mt-2 max-w-3xl text-sm leading-6 text-ui-muted">Модерація відгуків, привʼязаних до підтверджених завершених записів, та спостереження за доставкою запитів.</p>
      </div>
      <BaseButton variant="neutral" :loading="pending || metricsPending" @click="refreshAll"><ArrowPathIcon class="h-4 w-4" />Оновити</BaseButton>
    </div>

    <p v-if="permissionDenied" class="ui-status-warning rounded-2xl px-4 py-3 text-sm">Для перегляду й модерації відгуків потрібні права адміністратора.</p>

    <template v-else>
      <section>
        <BaseLoader v-if="metricsPending" label="Завантаження метрик відгуків…" />
        <p v-else-if="metricsError" class="ui-status-danger rounded-2xl px-4 py-3 text-sm">{{ apiErrorMessage(metricsError, 'Метрики відгуків недоступні: потрібен backend metrics contract.') }}</p>
        <template v-else>
          <div class="mb-3 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,14rem)_minmax(0,14rem)_minmax(0,16rem)_auto]">
            <BaseInput v-model="metricDraft.date_from" type="date" aria-label="Дата запланованого візиту для метрик від" />
            <BaseInput v-model="metricDraft.date_to" type="date" aria-label="Дата запланованого візиту для метрик до" />
            <BaseSelect v-model="metricDraft.master_id" :options="masterOptions" aria-label="Майстер для метрик" />
            <BaseButton variant="neutral" :disabled="metricsPending" @click="applyMetricPeriod">Застосувати до метрик</BaseButton>
          </div>
          <p v-if="metricPeriodError" class="ui-status-danger mb-3 rounded-2xl px-4 py-3 text-sm" role="alert">{{ metricPeriodError }}</p>
          <p class="mb-3 text-xs leading-5 text-ui-muted">
            {{ metricScopeLabel }}. Поля вище є чернеткою до натискання кнопки. Фільтри дати подання нижче застосовуються лише до списку вже поданих відгуків.
          </p>
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatisticsStatCard v-for="card in metricCards" :key="card.label" :label="card.label" :value="card.value" />
          </div>
          <p
            v-if="metrics?.review_form_opens_status === 'partial'"
            class="ui-status-warning mt-3 rounded-2xl px-4 py-3 text-sm"
          >
            * Відкриття форми зберігаються з {{ formatMetricTrackingStart(metrics.review_form_open_tracking_started_at) }}. У цій когорті є посилання, чий період дії почався раніше, тому показано лише підтверджений мінімум, а конверсії через відкриття навмисне недоступні.
          </p>
          <p
            v-else-if="metrics?.review_form_opens_status === 'unavailable'"
            class="ui-status-warning mt-3 rounded-2xl px-4 py-3 text-sm"
          >
            Усі надіслані посилання цієї когорти вже втратили чинність до початку збереження відкриттів {{ formatMetricTrackingStart(metrics.review_form_open_tracking_started_at) }}; нуль не підставляється.
          </p>
          <p
            v-if="metrics?.submitted_without_sent_count"
            class="ui-status-warning mt-3 rounded-2xl px-4 py-3 text-sm"
          >
            {{ metrics.submitted_without_sent_count }} відгуків у когорті не мають надісланого запиту й виключені з конверсії «запит → відгук».
          </p>
        </template>
      </section>

      <BaseCard as="section" class="space-y-5">
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <BaseSelect v-model="filters.moderation_status" :options="moderationOptions" />
          <BaseSelect v-model="filters.master_id" :options="masterOptions" />
          <BaseSelect v-model="filters.rating" :options="ratingOptions" />
          <BaseSelect v-model="filters.request_state" :options="requestStateOptions" />
          <BaseInput v-model="filters.submitted_from" type="date" aria-label="Дата подання від" />
          <BaseInput v-model="filters.submitted_to" type="date" aria-label="Дата подання до" />
          <BaseButton variant="primary" @click="applyFilters"><FunnelIcon class="h-4 w-4" />Застосувати</BaseButton>
          <BaseButton variant="neutral" @click="resetFilters">Очистити</BaseButton>
        </div>

        <p v-if="error" class="ui-status-danger rounded-2xl px-4 py-3 text-sm">{{ apiErrorMessage(error, 'Не вдалося завантажити відгуки. Потрібен backend review list contract.') }}</p>
        <BaseTable
          caption="Відгуки після візиту"
          min-width="900px"
          :loading="pending"
          loading-label="Завантаження відгуків…"
          :empty="!reviews.length && !error"
          empty-title="За вибраними фільтрами відгуків немає"
        >
          <template #head>
            <tr class="text-xs uppercase tracking-[0.12em]">
              <th>Майстер</th><th>Запис</th><th>Оцінка</th><th>Модерація</th><th>Запит</th><th>Подано</th><th><span class="sr-only">Дії</span></th>
            </tr>
          </template>
              <tr v-for="review in reviews" :key="review.id">
                <td class="font-medium text-ui-primary">{{ masterName(review.master) }}</td>
                <td class="text-ui-secondary">{{ safeBookingReference(review.booking_reference) }}</td>
                <td><BaseBadge tone="warning">{{ formatRating(review.rating) }} ★</BaseBadge></td>
                <td><BaseBadge :tone="reviewStatusTone(review.moderation_status)">{{ reviewModerationLabels[review.moderation_status] }}</BaseBadge></td>
                <td><BaseBadge v-if="review.request_state" :tone="reviewStatusTone(review.request_state)">{{ reviewRequestStateLabels[review.request_state] }}</BaseBadge><span v-else class="text-ui-muted">—</span></td>
                <td class="text-ui-secondary">{{ formatDateTime(review.submitted_at) }}</td>
                <td class="text-right"><NuxtLink :to="`/reviews/${review.id}`" class="base-button base-button--neutral min-h-9 gap-2 px-3 py-2 text-xs"><EyeIcon class="h-4 w-4" />Деталі</NuxtLink></td>
              </tr>
        </BaseTable>

        <div v-if="totalPages > 1" class="flex items-center justify-between gap-3">
          <BaseButton variant="neutral" :disabled="page <= 1" @click="page -= 1">Назад</BaseButton><span class="text-sm text-ui-muted">Сторінка {{ page }} з {{ totalPages }}</span><BaseButton variant="neutral" :disabled="page >= totalPages" @click="page += 1">Далі</BaseButton>
        </div>
      </BaseCard>
    </template>
  </div>
</template>
