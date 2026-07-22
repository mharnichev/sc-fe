<script setup lang="ts">
import { ArrowLeftIcon, CheckIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { formatRating, reviewModerationLabels, reviewRequestStateLabels, reviewStatusClass, safeBookingReference } from '~/utils/reviews'

definePageMeta({
  middleware: () => {
    const auth = useAuthStore()
    if (!auth.user?.is_superuser && auth.user?.role !== 'admin') return navigateTo('/')
  },
})

const route = useRoute()
const api = useBackofficeApi()
const auth = useAuthStore()
const toast = useBaseToastNotification()
const { apiErrorMessage, formatDateTime, masterName } = useBookingFormatting()
const reviewId = computed(() => String(route.params.id))
const isAdmin = computed(() => Boolean(auth.user?.is_superuser || auth.user?.role === 'admin'))
const { data: review, pending, error, refresh } = await useAsyncData('admin-booking-review-detail', () => isAdmin.value ? api.adminGetReview(reviewId.value) : Promise.resolve(null), { watch: [reviewId] })
const actionPending = ref(false)
const actionError = ref('')
const rejectOpen = ref(false)
const rejectionReason = ref('')
const permissionDenied = computed(() => !isAdmin.value || (typeof error.value === 'object' && error.value && 'response' in error.value && (error.value as { response?: { status?: number } }).response?.status === 403))

const approve = async () => {
  if (!review.value || review.value.moderation_status !== 'pending') return
  actionPending.value = true
  actionError.value = ''
  try {
    review.value = await api.adminApproveReview(review.value.id)
    toast.success('Відгук схвалено. Публічний рейтинг може врахувати його.')
  }
  catch (cause) { actionError.value = apiErrorMessage(cause, 'Не вдалося схвалити відгук.') }
  finally { actionPending.value = false }
}

const reject = async () => {
  if (!review.value || review.value.moderation_status !== 'pending') return
  actionPending.value = true
  actionError.value = ''
  try {
    review.value = await api.adminRejectReview(review.value.id, rejectionReason.value)
    rejectOpen.value = false
    toast.success('Відгук відхилено й залишено в аудиті.')
  }
  catch (cause) { actionError.value = apiErrorMessage(cause, 'Не вдалося відхилити відгук.') }
  finally { actionPending.value = false }
}
</script>

<template>
  <div class="space-y-6">
    <NuxtLink to="/reviews" class="inline-flex items-center gap-2 text-sm font-medium text-cyan-700"><ArrowLeftIcon class="h-4 w-4" />До відгуків</NuxtLink>
    <p v-if="permissionDenied" class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Для перегляду й модерації відгуку потрібні права адміністратора.</p>
    <div v-else-if="pending" class="h-64 animate-pulse rounded-[1.75rem] bg-slate-100" />
    <p v-else-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{{ apiErrorMessage(error, 'Не вдалося завантажити відгук. Потрібен backend review detail contract.') }} <BaseButton class="font-semibold underline" @click="refresh">Спробувати ще раз</BaseButton></p>
    <template v-else-if="review">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div><p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Модерація</p><h1 class="mt-2 text-3xl font-semibold text-slate-900">Відгук {{ safeBookingReference(review.booking_reference) }}</h1><p class="mt-2 text-sm text-slate-500">{{ masterName(review.master) }} · {{ formatDateTime(review.submitted_at) }}</p></div>
        <span class="rounded-full px-4 py-2 text-sm font-medium" :class="reviewStatusClass(review.moderation_status)">{{ reviewModerationLabels[review.moderation_status] }}</span>
      </div>

      <section class="grid gap-5 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <p class="text-3xl font-semibold text-amber-500">{{ formatRating(review.rating) }} ★</p>
          <p class="mt-4 whitespace-pre-wrap text-base leading-7 text-slate-800">{{ review.text || 'Текст відгуку не додано.' }}</p>
        </div>
        <dl class="space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
          <div><dt class="text-slate-500">Майстер</dt><dd class="mt-1 font-medium text-slate-900">{{ masterName(review.master) }}</dd></div>
          <div><dt class="text-slate-500">Безпечне посилання на запис</dt><dd class="mt-1 font-medium text-slate-900">{{ safeBookingReference(review.booking_reference) }}</dd></div>
          <div><dt class="text-slate-500">Запит створено</dt><dd class="mt-1 font-medium text-slate-900">{{ review.requested_at ? formatDateTime(review.requested_at) : '—' }}</dd></div>
          <div><dt class="text-slate-500">Відгук подано</dt><dd class="mt-1 font-medium text-slate-900">{{ formatDateTime(review.submitted_at) }}</dd></div>
          <div v-if="review.request_state"><dt class="text-slate-500">Стан доставки</dt><dd class="mt-1"><span class="rounded-full px-3 py-1 text-xs font-medium" :class="reviewStatusClass(review.request_state)">{{ reviewRequestStateLabels[review.request_state] }}</span></dd></div>
        </dl>
      </section>

      <p v-if="actionError" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{{ actionError }}</p>
      <section v-if="review.moderation_status === 'pending'" class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="text-lg font-semibold text-slate-900">Рішення модерації</h2>
        <p class="mt-1 text-sm leading-6 text-slate-500">Відхиляйте лише спам, образи, персональні дані, рекламу, видавання себе за іншу особу або нерелевантний вміст. Низька оцінка сама по собі не є причиною.</p>
        <div v-if="rejectOpen" class="mt-4 space-y-3"><BaseTextarea v-model="rejectionReason" class="min-h-24 w-full rounded-2xl border border-slate-300 px-4 py-3" placeholder="Внутрішня причина (необовʼязково)" /><div class="flex flex-wrap gap-2"><BaseButton variant="danger" :loading="actionPending" @click="reject"><XMarkIcon class="h-4 w-4" />Підтвердити відхилення</BaseButton><BaseButton variant="neutral" :disabled="actionPending" @click="rejectOpen = false">Скасувати</BaseButton></div></div>
        <div v-else class="mt-4 flex flex-wrap gap-2"><BaseButton variant="success" :loading="actionPending" @click="approve"><CheckIcon class="h-4 w-4" />Схвалити</BaseButton><BaseButton variant="danger-outline" :disabled="actionPending" @click="rejectOpen = true"><XMarkIcon class="h-4 w-4" />Відхилити</BaseButton></div>
      </section>

      <div class="grid gap-5 lg:grid-cols-2">
        <section class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm"><h2 class="text-lg font-semibold text-slate-900">Історія модерації</h2><p v-if="!review.moderation_history.length" class="mt-4 text-sm text-slate-500">Подій модерації немає.</p><ol v-else class="mt-4 space-y-4"><li v-for="event in review.moderation_history" :key="event.id" class="border-l-2 border-slate-200 pl-4"><p class="font-medium text-slate-900">{{ event.action }}</p><p class="mt-1 text-xs text-slate-500">{{ formatDateTime(event.occurred_at) }} · {{ event.actor_display_name || 'Система' }}</p><p v-if="event.reason" class="mt-2 text-sm text-slate-600">{{ event.reason }}</p></li></ol></section>
        <section class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm"><h2 class="text-lg font-semibold text-slate-900">Історія запиту й доставки</h2><p v-if="!review.request_history.length" class="mt-4 text-sm text-slate-500">API не надав подій доставки.</p><ol v-else class="mt-4 space-y-4"><li v-for="event in review.request_history" :key="event.id" class="border-l-2 border-slate-200 pl-4"><span class="rounded-full px-3 py-1 text-xs font-medium" :class="reviewStatusClass(event.state)">{{ reviewRequestStateLabels[event.state] }}</span><p class="mt-2 text-xs text-slate-500">{{ formatDateTime(event.occurred_at) }}<span v-if="event.channel"> · {{ event.channel }}</span></p><p v-if="event.failure_reason" class="mt-2 text-sm text-rose-600">{{ event.failure_reason }}</p></li></ol></section>
      </div>
    </template>
  </div>
</template>
