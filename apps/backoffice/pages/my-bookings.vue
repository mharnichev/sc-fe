<script setup lang="ts">
import { EyeIcon } from '@heroicons/vue/24/outline'
import type { Booking, BookingStatus } from '~/composables/useBackofficeApi'

const api = useBackofficeApi()
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
} = useBookingFormatting()

const filters = reactive({
  date_from: todayInput(),
  date_to: addDaysInput(todayInput(), 14),
  status: '',
})

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
const actionSuccess = ref('')
const pendingStatus = ref<BookingStatus | ''>('')
const pendingDelete = ref(false)

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
  if (!selected.value || selected.value.status === 'completed') return
  pendingStatus.value = status
  actionError.value = ''
  actionSuccess.value = ''
  try {
    const updated = await api.updateMyBookingStatus(selected.value.id, status)
    selected.value = { ...selected.value, ...updated }
    await refresh()
  }
  catch (cause) {
    actionError.value = apiErrorMessage(cause, 'Не вдалося оновити статус бронювання.')
  }
  finally {
    pendingStatus.value = ''
  }
}

const deleteSelectedBooking = async () => {
  if (!selected.value || selected.value.status === 'completed') return
  pendingDelete.value = true
  actionError.value = ''
  actionSuccess.value = ''
  try {
    await api.deleteMyBooking(selected.value.id)
    selected.value = null
    actionSuccess.value = 'Бронювання видалено.'
    await refresh()
  }
  catch (cause) {
    actionError.value = apiErrorMessage(cause, 'Не вдалося видалити бронювання.')
  }
  finally {
    pendingDelete.value = false
  }
}
</script>

<template>
  <div class="space-y-3 xl:space-y-6">
    <div>
      <p class="text-xs uppercase tracking-[0.22em] text-cyan-700 xl:text-sm xl:tracking-[0.3em]">Особистий календар</p>
      <h1 class="mt-1 text-2xl font-semibold text-slate-900 xl:mt-2 xl:text-3xl">Мої бронювання</h1>
      <p class="mt-1 text-xs text-slate-500 xl:mt-2 xl:text-sm">Ваш список записів у часовому поясі Europe/Kyiv.</p>
    </div>

    <section class="grid gap-2 rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-2 xl:grid-cols-4 xl:gap-4 xl:rounded-[1.75rem] xl:p-5">
      <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
        <span class="font-medium">Від</span>
        <input v-model="filters.date_from" type="date" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3">
      </label>
      <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
        <span class="font-medium">До</span>
        <input v-model="filters.date_to" type="date" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3">
      </label>
      <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
        <span class="font-medium">Статус</span>
        <select v-model="filters.status" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3">
          <option value="">Будь-який статус</option>
          <option v-for="status in statuses" :key="status" :value="status">{{ formatBookingStatus(status) }}</option>
        </select>
      </label>
      <div class="flex items-end gap-2 xl:gap-3">
        <button class="flex-1 rounded-full bg-slate-950 px-3 py-2 text-xs font-medium text-white xl:px-4 xl:py-3 xl:text-sm" @click="applyFilters">Застосувати</button>
        <button class="flex-1 rounded-full border border-slate-300 px-3 py-2 text-xs xl:px-4 xl:py-3 xl:text-sm" @click="clearFilters">Очистити</button>
      </div>
    </section>

    <p v-if="error" class="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600 xl:rounded-2xl xl:px-4 xl:py-3 xl:text-sm">
      {{ apiErrorMessage(error, 'Не вдалося завантажити ваші бронювання. TODO: підтвердити підтримку endpoint /masters/me/bookings у бекенді.') }}
    </p>
    <p v-if="actionError" class="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600 xl:rounded-2xl xl:px-4 xl:py-3 xl:text-sm">{{ actionError }}</p>
    <p v-if="actionSuccess" class="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700 xl:rounded-2xl xl:px-4 xl:py-3 xl:text-sm">{{ actionSuccess }}</p>

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
            <button
              class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50 xl:h-8 xl:w-8"
              aria-label="Переглянути бронювання"
              title="Переглянути"
              @click="selected = booking"
            >
              <EyeIcon class="h-3.5 w-3.5 xl:h-4 xl:w-4" aria-hidden="true" />
              <span class="sr-only">Переглянути</span>
            </button>
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
            <button
              class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50 xl:h-8 xl:w-8"
              aria-label="Переглянути бронювання"
              title="Переглянути"
              @click="selected = booking"
            >
              <EyeIcon class="h-3.5 w-3.5 xl:h-4 xl:w-4" aria-hidden="true" />
              <span class="sr-only">Переглянути</span>
            </button>
          </div>
        </article>
      </div>
    </section>

    <BookingDetailsModal
      :booking="selected"
      :allowed-statuses="allowedStatusActions(selected)"
      :pending-status="pendingStatus"
      :pending-delete="pendingDelete"
      :can-edit="false"
      :can-delete="Boolean(selected && selected.status !== 'completed')"
      :error="actionError"
      :services="serviceOptions"
      @close="selected = null"
      @update-status="updateStatus"
      @delete="deleteSelectedBooking"
    />
  </div>
</template>
