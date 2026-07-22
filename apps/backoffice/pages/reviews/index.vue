<script setup lang="ts">
import { ArrowPathIcon, EyeIcon, FunnelIcon } from '@heroicons/vue/24/outline'
import type { Master } from '~/composables/useBackofficeApi'
import type { ReviewFilters } from '~/types/reviews'
import { formatModerationDuration, formatRating, formatReviewConversionRate, reviewModerationLabels, reviewRequestStateLabels, reviewStatusClass, safeBookingReference } from '~/utils/reviews'

definePageMeta({
  middleware: () => {
    const auth = useAuthStore()
    if (!auth.user?.is_superuser && auth.user?.role !== 'admin') return navigateTo('/')
  },
})

const api = useBackofficeApi()
const auth = useAuthStore()
const { apiErrorMessage, formatDateTime, masterName, normalizeItems } = useBookingFormatting()
const isAdmin = computed(() => Boolean(auth.user?.is_superuser || auth.user?.role === 'admin'))
const page = ref(1)
const pageSize = 20
const filters = reactive<ReviewFilters>({ moderation_status: '', master_id: null, rating: null, submitted_from: '', submitted_to: '', request_state: '' })

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
  useAsyncData('admin-review-metrics', () => isAdmin.value ? api.adminGetReviewMetrics({ date_from: filters.submitted_from, date_to: filters.submitted_to }) : Promise.resolve(null)),
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
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Адмін · якість</p>
        <h1 class="mt-2 text-3xl font-semibold text-slate-900">Відгуки після візиту</h1>
        <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Модерація відгуків, привʼязаних до підтверджених завершених записів, та спостереження за доставкою запитів.</p>
      </div>
      <BaseButton variant="neutral" :loading="pending || metricsPending" @click="refreshAll"><ArrowPathIcon class="h-4 w-4" />Оновити</BaseButton>
    </div>

    <p v-if="permissionDenied" class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Для перегляду й модерації відгуків потрібні права адміністратора.</p>

    <template v-else>
      <section>
        <div v-if="metricsPending" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div v-for="index in 7" :key="index" class="h-24 animate-pulse rounded-[1.25rem] bg-slate-100" /></div>
        <p v-else-if="metricsError" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{{ apiErrorMessage(metricsError, 'Метрики відгуків недоступні: потрібен backend metrics contract.') }}</p>
        <div v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatisticsStatCard v-for="card in metricCards" :key="card.label" :label="card.label" :value="card.value" />
        </div>
      </section>

      <section class="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <BaseSelect v-model="filters.moderation_status" :options="moderationOptions" />
          <BaseSelect v-model="filters.master_id" :options="masterOptions" />
          <BaseSelect v-model="filters.rating" :options="ratingOptions" />
          <BaseSelect v-model="filters.request_state" :options="requestStateOptions" />
          <BaseInput v-model="filters.submitted_from" type="date" aria-label="Дата подання від" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
          <BaseInput v-model="filters.submitted_to" type="date" aria-label="Дата подання до" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
          <BaseButton variant="primary" @click="applyFilters"><FunnelIcon class="h-4 w-4" />Застосувати</BaseButton>
          <BaseButton variant="neutral" @click="resetFilters">Очистити</BaseButton>
        </div>

        <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{{ apiErrorMessage(error, 'Не вдалося завантажити відгуки. Потрібен backend review list contract.') }}</p>
        <div v-if="pending" class="space-y-3"><div v-for="index in 6" :key="index" class="h-16 animate-pulse rounded-2xl bg-slate-100" /></div>
        <div v-else-if="!reviews.length && !error" class="rounded-2xl bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">За вибраними фільтрами відгуків немає.</div>
        <div v-else class="overflow-x-auto rounded-2xl border border-slate-200">
          <table class="min-w-[900px] w-full divide-y divide-slate-200 text-sm">
            <thead class="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500"><tr><th class="px-4 py-3">Майстер</th><th class="px-4 py-3">Запис</th><th class="px-4 py-3">Оцінка</th><th class="px-4 py-3">Модерація</th><th class="px-4 py-3">Запит</th><th class="px-4 py-3">Подано</th><th class="px-4 py-3"><span class="sr-only">Дії</span></th></tr></thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="review in reviews" :key="review.id">
                <td class="px-4 py-3 font-medium text-slate-900">{{ masterName(review.master) }}</td>
                <td class="px-4 py-3 text-slate-600">{{ safeBookingReference(review.booking_reference) }}</td>
                <td class="px-4 py-3 font-semibold text-amber-600">{{ formatRating(review.rating) }} ★</td>
                <td class="px-4 py-3"><span class="rounded-full px-3 py-1 text-xs font-medium" :class="reviewStatusClass(review.moderation_status)">{{ reviewModerationLabels[review.moderation_status] }}</span></td>
                <td class="px-4 py-3"><span v-if="review.request_state" class="rounded-full px-3 py-1 text-xs font-medium" :class="reviewStatusClass(review.request_state)">{{ reviewRequestStateLabels[review.request_state] }}</span><span v-else class="text-slate-400">—</span></td>
                <td class="px-4 py-3 text-slate-600">{{ formatDateTime(review.submitted_at) }}</td>
                <td class="px-4 py-3 text-right"><NuxtLink :to="`/reviews/${review.id}`" class="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"><EyeIcon class="h-4 w-4" />Деталі</NuxtLink></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="totalPages > 1" class="flex items-center justify-between gap-3">
          <BaseButton variant="neutral" :disabled="page <= 1" @click="page -= 1">Назад</BaseButton><span class="text-sm text-slate-500">Сторінка {{ page }} з {{ totalPages }}</span><BaseButton variant="neutral" :disabled="page >= totalPages" @click="page += 1">Далі</BaseButton>
        </div>
      </section>
    </template>
  </div>
</template>
