<script setup lang="ts">
import { EyeIcon } from '@heroicons/vue/24/outline'
import type { Booking, BookingPricingPayload, BookingSchedulePayload, BookingStatus } from '~/composables/useBackofficeApi'

const api = useBackofficeApi()
const toast = useBaseToastNotification()
const {
  statuses,
  todayInput,
  addDaysInput,
  bookingStart,
  bookingEnd,
  bookingComment,
  bookingPhone,
  customerName,
  bookingRedirectSourceLabel,
  isRedirectedBooking,
  bookingServicesLabel,
  formatDateTime,
  formatTime,
  formatBookingStatus,
  normalizeItems,
  normalizeTotal,
  apiErrorMessage,
  toKyivIso,
} = useBookingFormatting()

const filters = reactive({
  date_from: todayInput(),
  date_to: addDaysInput(todayInput(), 14),
  status: '',
})
const activeFilterCount = computed(() => [
  filters.date_from !== todayInput() ? filters.date_from : '',
  filters.date_to !== addDaysInput(todayInput(), 14) ? filters.date_to : '',
  filters.status,
].filter(Boolean).length)

const { data, pending, error, refresh } = await useAsyncData(
  'my-bookings',
  () => api.getMyBookings({
    date_from: filters.date_from,
    date_to: filters.date_to,
    status: filters.status as BookingStatus | '',
  }),
)

const { data: services } = await useAsyncData('my-booking-service-options', () => api.getServices())

const selected = ref<Booking | null>(null)
const actionError = ref('')
const pendingStatus = ref<BookingStatus | ''>('')
const pendingDelete = ref(false)
const pendingSchedule = ref(false)
const pendingPricing = ref(false)
const statusOptions = computed(() => [
  { value: '', label: 'Будь-який статус' },
  ...statuses.map(status => ({ value: status, label: formatBookingStatus(status) })),
])

const replaceBooking = (booking: Booking) => {
  if (!data.value) return
  const previous = normalizeItems(data.value)
  const inFilters = (!filters.status || booking.status === filters.status)
    && (!filters.date_from || Date.parse(bookingEnd(booking)) > Date.parse(toKyivIso(filters.date_from, '00:00')))
    && (!filters.date_to || Date.parse(bookingStart(booking)) < Date.parse(toKyivIso(filters.date_to, '00:00')))
  const items = previous.flatMap(item => item.id === booking.id ? (inFilters ? [booking] : []) : [item])
  if (Array.isArray(data.value)) data.value = items
  else { data.value.items = items; data.value.total = Math.max(0, data.value.total - (previous.length - items.length)) }
}
const removeBooking = (id: number) => {
  if (!data.value) return
  const previous = normalizeItems(data.value)
  const items = previous.filter(item => item.id !== id)
  if (Array.isArray(data.value)) data.value = items
  else { data.value.items = items; data.value.total = Math.max(0, data.value.total - (previous.length - items.length)) }
}
const reconciliation = useBookingReconciliation(selected, {
  load: api.getMyBooking,
  onUpdated: replaceBooking,
  onDeleted: removeBooking,
  refreshList: refresh,
})
const { busy: bookingBusy, checking: bookingChecking, needsRefresh: bookingNeedsRefresh, notice: bookingNotice, error: bookingError } = reconciliation

const bookings = computed(() => normalizeItems(data.value))
const serviceOptions = computed(() => normalizeItems(services.value))
const total = computed(() => normalizeTotal(data.value))
const todayБронювання = computed(() => bookings.value.filter(booking => bookingStart(booking).slice(0, 10) === filters.date_from))
const upcomingБронювання = computed(() => bookings.value.filter(booking => bookingStart(booking).slice(0, 10) !== filters.date_from))
const bookingSecondaryLabel = (booking: Booking) =>
  [bookingServicesLabel(booking, serviceOptions.value), bookingRedirectSourceLabel(booking), bookingComment(booking) || 'Без коментаря']
    .filter(Boolean)
    .join(' · ')

const applyFilters = async () => {
  await refresh()
}

const clearFilters = async () => {
  filters.date_from = todayInput()
  filters.date_to = addDaysInput(todayInput(), 14)
  filters.status = ''
  await refresh()
}

const allowedStatusActions = (booking: Booking | null) =>
  booking && booking.status !== 'completed' ? statuses.filter(status => status !== booking.status) : []

const updateStatus = async (status: BookingStatus) => {
  if (!selected.value || selected.value.status === 'completed' || bookingBusy.value) return
  pendingStatus.value = status
  try {
    if (await reconciliation.mutate(booking => api.updateMyBookingStatus(booking.id, status), 'Не вдалося оновити статус запису. Спробуйте ще раз.')) {
      toast.success('Статус бронювання оновлено.')
      await refresh()
    }
  } finally { pendingStatus.value = '' }
}

const updateSchedule = async (payload: BookingSchedulePayload) => {
  if (!selected.value || bookingBusy.value || selected.value.status === 'completed') return
  pendingSchedule.value = true
  try {
    if (await reconciliation.mutate(booking => api.updateMyBookingSchedule(booking.id, payload), 'Не вдалося зберегти час та послуги бронювання.')) {
      toast.success('Час та послуги бронювання оновлено.')
      await refresh()
    }
  } finally { pendingSchedule.value = false }
}

const updatePricing = async (payload: BookingPricingPayload) => {
  if (!selected.value || bookingBusy.value || selected.value.status === 'completed') return
  pendingPricing.value = true
  try {
    if (await reconciliation.mutate(booking => api.updateMyBookingPricing(booking.id, payload), 'Не вдалося зберегти ціну бронювання.')) {
      toast.success('Ціну бронювання оновлено.')
      await refresh()
    }
  } finally { pendingPricing.value = false }
}

const deleteSelectedBooking = async () => {
  if (!selected.value || bookingBusy.value) return
  pendingDelete.value = true
  try {
    if (await reconciliation.mutate(async booking => { await api.deleteMyBooking(booking.id) }, 'Не вдалося видалити запис. Спробуйте ще раз.', true)) {
      toast.success('Бронювання видалено.')
      await refresh()
    }
  } finally { pendingDelete.value = false }
}

</script>

<template>
  <div class="space-y-3 xl:space-y-6">
    <div>
      <p class="text-xs uppercase tracking-[0.22em] text-cyan-700 xl:text-sm xl:tracking-[0.3em]">Особистий календар</p>
      <h1 class="mt-1 text-2xl font-semibold text-slate-900 xl:mt-2 xl:text-3xl">Мої бронювання</h1>
      <p class="mt-1 text-xs text-slate-500 xl:mt-2 xl:text-sm">Ваш список записів у часовому поясі Europe/Kyiv.</p>
    </div>

    <BaseFilterPanel
      :loading="pending"
      :active-count="activeFilterCount"
      mobile-title="Фільтри моїх бронювань"
      padding="sm"
      fields-class="md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
      @apply="applyFilters"
      @clear="clearFilters"
    >
      <BaseDateRange
        v-model:date-from="filters.date_from"
        v-model:date-to="filters.date_to"
        from-label="Від"
        to-label="До"
        field-class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm"
        input-class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3"
      />
      <BaseSelect v-model="filters.status" :options="statusOptions" label="Статус" aria-label="Статус бронювання" />
    </BaseFilterPanel>

    <p v-if="error" class="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600 xl:rounded-2xl xl:px-4 xl:py-3 xl:text-sm">
      {{ apiErrorMessage(error, 'Не вдалося завантажити ваші бронювання. TODO: підтвердити підтримку endpoint /masters/me/bookings у бекенді.') }}
    </p>
    <div class="grid grid-cols-3 gap-2 xl:gap-4">
      <div class="rounded-xl bg-slate-50 px-2 py-2 text-xs text-slate-600 xl:rounded-[1.25rem] xl:px-4 xl:py-3 xl:text-sm">Total: {{ total }}</div>
      <div class="rounded-xl bg-slate-50 px-2 py-2 text-xs text-slate-600 xl:rounded-[1.25rem] xl:px-4 xl:py-3 xl:text-sm">Сьогодні: {{ todayБронювання.length }}</div>
      <div class="rounded-xl bg-slate-50 px-2 py-2 text-xs text-slate-600 xl:rounded-[1.25rem] xl:px-4 xl:py-3 xl:text-sm">Майбутні: {{ upcomingБронювання.length }}</div>
    </div>

    <section class="rounded-[1.25rem] border border-slate-200 bg-white shadow-sm xl:rounded-[1.75rem]">
      <div class="border-b border-slate-200 px-3 py-2 xl:px-5 xl:py-4">
        <h2 class="text-base font-semibold text-slate-900 xl:text-lg">Сьогодні</h2>
      </div>
      <div v-if="pending" class="p-3 text-xs text-slate-500 xl:p-5 xl:text-sm">Завантаження бронювань...</div>
      <div v-else-if="!todayБронювання.length" class="p-3 text-xs text-slate-500 xl:p-5 xl:text-sm">На сьогодні бронювань немає.</div>
      <div v-else class="divide-y divide-slate-100">
        <article v-for="booking in todayБронювання" :key="booking.id" class="grid gap-2 px-3 py-2 text-left md:grid-cols-[160px_1fr_auto] md:items-center xl:gap-3 xl:px-5 xl:py-4">
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-slate-900 xl:text-base">{{ formatTime(bookingStart(booking)) }} - {{ formatTime(bookingEnd(booking)) }}</p>
            <p class="truncate text-[0.68rem] text-slate-500 xl:text-xs">{{ formatDateTime(bookingStart(booking)) }}</p>
          </div>
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-slate-900 xl:text-base">{{ customerName(booking) }} · {{ bookingPhone(booking) || 'Без телефону' }}</p>
            <p class="mt-0.5 truncate text-xs text-slate-500 xl:text-sm">{{ bookingSecondaryLabel(booking) }}</p>
          </div>
          <div class="flex flex-wrap items-center justify-start gap-2 xl:gap-3">
            <BookingStatusBadge :status="booking.status" />
            <span
              v-if="isRedirectedBooking(booking)"
              class="inline-flex h-7 items-center rounded-full border border-amber-300 bg-amber-50 px-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-amber-700 xl:h-8"
            >
              Редирект
            </span>
            <BaseButton
              class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50 xl:h-8 xl:w-8"
              aria-label="Переглянути бронювання"
              title="Переглянути"
              @click="selected = booking"
            >
              <EyeIcon class="h-3.5 w-3.5 xl:h-4 xl:w-4" aria-hidden="true" />
              <span class="sr-only">Переглянути</span>
            </BaseButton>
          </div>
        </article>
      </div>
    </section>

    <section class="rounded-[1.25rem] border border-slate-200 bg-white shadow-sm xl:rounded-[1.75rem]">
      <div class="border-b border-slate-200 px-3 py-2 xl:px-5 xl:py-4">
        <h2 class="text-base font-semibold text-slate-900 xl:text-lg">Майбутні</h2>
      </div>
      <div v-if="!upcomingБронювання.length" class="p-3 text-xs text-slate-500 xl:p-5 xl:text-sm">У цьому діапазоні майбутніх бронювань немає.</div>
      <div v-else class="divide-y divide-slate-100">
        <article v-for="booking in upcomingБронювання" :key="booking.id" class="grid gap-2 px-3 py-2 text-left md:grid-cols-[220px_1fr_auto] md:items-center xl:gap-3 xl:px-5 xl:py-4">
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-slate-900 xl:text-base">{{ formatDateTime(bookingStart(booking)) }}</p>
            <p class="truncate text-[0.68rem] text-slate-500 xl:text-xs">{{ formatTime(bookingStart(booking)) }} - {{ formatTime(bookingEnd(booking)) }}</p>
          </div>
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-slate-900 xl:text-base">{{ customerName(booking) }} · {{ bookingPhone(booking) || 'Без телефону' }}</p>
            <p class="mt-0.5 truncate text-xs text-slate-500 xl:text-sm">{{ bookingSecondaryLabel(booking) }}</p>
          </div>
          <div class="flex flex-wrap items-center justify-start gap-2 xl:gap-3">
            <BookingStatusBadge :status="booking.status" />
            <span
              v-if="isRedirectedBooking(booking)"
              class="inline-flex h-7 items-center rounded-full border border-amber-300 bg-amber-50 px-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-amber-700 xl:h-8"
            >
              Редирект
            </span>
            <BaseButton
              class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50 xl:h-8 xl:w-8"
              aria-label="Переглянути бронювання"
              title="Переглянути"
              @click="selected = booking"
            >
              <EyeIcon class="h-3.5 w-3.5 xl:h-4 xl:w-4" aria-hidden="true" />
              <span class="sr-only">Переглянути</span>
            </BaseButton>
          </div>
        </article>
      </div>
    </section>

    <BookingDetailsModal
      :busy="bookingBusy"
      :checking="bookingChecking"
      :needs-refresh="bookingNeedsRefresh"
      :notice="bookingNotice"
      :action-error="bookingError"
      @refresh="reconciliation.refreshSelected"
      :booking="selected"
      :allowed-statuses="allowedStatusActions(selected)"
      :pending-status="pendingStatus"
      :pending-delete="pendingDelete"
      :can-edit="Boolean(selected && selected.status !== 'completed')"
      :can-edit-pricing="Boolean(selected && selected.status !== 'completed')"
      :pending-schedule="pendingSchedule"
      :pending-pricing="pendingPricing"
      :can-delete="Boolean(selected)"
      :services="serviceOptions"
      @close="selected = null"
      @update-status="updateStatus"
      @update-schedule="updateSchedule"
      @update-pricing="updatePricing"
      @delete="deleteSelectedBooking"
    />
  </div>
</template>
