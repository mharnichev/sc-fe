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
        date_from: filters.submitted_from && filters.submitted_to ? filters.submitted_from : undefined,
        date_to: filters.submitted_from && filters.submitted_to ? filters.submitted_to : undefined,
        master_id: filters.master_id,
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
const metricCards = computed(() => [
  { label: 'Доступні завершені візити', value: metrics.value?.eligible_completed_visits ?? '—' },
  { label: 'Заплановано / надіслано', value: metrics.value ? `${metrics.value.requests_scheduled} / ${metrics.value.requests_sent}` : '—' },
  { label: 'Доставлено', value: metrics.value?.requests_delivered ?? '—' },
  { label: 'Відкрито форму', value: metrics.value?.review_form_opens ?? '—' },
  { label: 'Надіслано / схвалено', value: metrics.value ? `${metrics.value.submitted_reviews} / ${metrics.value.approved_reviews}` : '—' },
  { label: 'Конверсія', value: metrics.value ? formatReviewConversionRate(metrics.value.review_conversion_rate) : '—' },
  { label: 'Час модерації', value: formatModerationDuration(metrics.value?.average_moderation_time_minutes) },
])

const applyFilters = async () => {
  page.value = 1
  await Promise.all([refresh(), refreshMetrics()])
}
const resetFilters = async () => {
  Object.assign(filters, { moderation_status: '', master_id: null, rating: null, submitted_from: '', submitted_to: '', request_state: '' })
  await applyFilters()
}
const refreshAll = () => Promise.all([refresh(), refreshMetrics()])
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
        <div v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatisticsStatCard v-for="card in metricCards" :key="card.label" :label="card.label" :value="card.value" />
        </div>
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
