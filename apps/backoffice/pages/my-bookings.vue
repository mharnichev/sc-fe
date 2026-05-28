<script setup lang="ts">
import { EyeIcon } from '@heroicons/vue/24/outline'
import type { Booking, BookingSchedulePayload, BookingStatus } from '~/composables/useBackofficeApi'

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
  serviceName,
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
const pendingStatus = ref<BookingStatus | ''>('')
const pendingSchedule = ref(false)

const bookings = computed(() => normalizeItems(data.value))
const serviceOptions = computed(() => normalizeItems(services.value))
const total = computed(() => normalizeTotal(data.value))
const todayБронювання = computed(() => bookings.value.filter(booking => bookingStart(booking).slice(0, 10) === filters.date_from))
const upcomingБронювання = computed(() => bookings.value.filter(booking => bookingStart(booking).slice(0, 10) !== filters.date_from))

const resolveService = (booking: Booking) =>
  booking.service || serviceOptions.value.find(service => service.id === booking.service_id) || null

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
  booking ? statuses.filter(status => status !== booking.status) : []

const updateStatus = async (status: BookingStatus) => {
  if (!selected.value) return
  pendingStatus.value = status
  actionError.value = ''
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

const updateSchedule = async (payload: BookingSchedulePayload) => {
  if (!selected.value) return
  pendingSchedule.value = true
  actionError.value = ''
  try {
    const updated = await api.updateMyBookingSchedule(selected.value.id, payload)
    selected.value = { ...selected.value, ...updated }
    await refresh()
  }
  catch (cause) {
    actionError.value = apiErrorMessage(cause, 'Не вдалося оновити час бронювання.')
  }
  finally {
    pendingSchedule.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Особистий календар</p>
      <h1 class="mt-2 text-3xl font-semibold text-slate-900">Мої бронювання</h1>
      <p class="mt-2 text-sm text-slate-500">Ваш список записів у часовому поясі Europe/Kyiv.</p>
    </div>

    <section class="grid gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-4">
      <label class="space-y-2 text-sm text-slate-700">
        <span class="font-medium">Від</span>
        <input v-model="filters.date_from" type="date" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
      </label>
      <label class="space-y-2 text-sm text-slate-700">
        <span class="font-medium">До</span>
        <input v-model="filters.date_to" type="date" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
      </label>
      <label class="space-y-2 text-sm text-slate-700">
        <span class="font-medium">Статус</span>
        <select v-model="filters.status" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
          <option value="">Будь-який статус</option>
          <option v-for="status in statuses" :key="status" :value="status">{{ formatBookingStatus(status) }}</option>
        </select>
      </label>
      <div class="flex items-end gap-3">
        <button class="flex-1 rounded-full bg-slate-950 px-4 py-3 text-sm font-medium text-white" @click="applyFilters">Застосувати</button>
        <button class="flex-1 rounded-full border border-slate-300 px-4 py-3 text-sm" @click="clearFilters">Очистити</button>
      </div>
    </section>

    <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
      {{ apiErrorMessage(error, 'Не вдалося завантажити ваші бронювання. TODO: підтвердити підтримку endpoint /masters/me/bookings у бекенді.') }}
    </p>

    <div class="grid gap-4 md:grid-cols-3">
      <div class="rounded-[1.25rem] bg-slate-50 px-4 py-3 text-sm text-slate-600">Total: {{ total }}</div>
      <div class="rounded-[1.25rem] bg-slate-50 px-4 py-3 text-sm text-slate-600">Сьогодні: {{ todayБронювання.length }}</div>
      <div class="rounded-[1.25rem] bg-slate-50 px-4 py-3 text-sm text-slate-600">Майбутні: {{ upcomingБронювання.length }}</div>
    </div>

    <section class="rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
      <div class="border-b border-slate-200 px-5 py-4">
        <h2 class="text-lg font-semibold text-slate-900">Сьогодні</h2>
      </div>
      <div v-if="pending" class="p-5 text-sm text-slate-500">Завантаження бронювань...</div>
      <div v-else-if="!todayБронювання.length" class="p-5 text-sm text-slate-500">На сьогодні бронювань немає.</div>
      <div v-else class="divide-y divide-slate-100">
        <article v-for="booking in todayБронювання" :key="booking.id" class="grid gap-3 px-5 py-4 md:grid-cols-[160px_1fr_auto] md:items-center">
          <div>
            <p class="font-semibold text-slate-900">{{ formatTime(bookingStart(booking)) }} - {{ formatTime(bookingEnd(booking)) }}</p>
            <p class="text-xs text-slate-500">{{ formatDateTime(bookingStart(booking)) }}</p>
          </div>
          <div>
            <p class="font-medium text-slate-900">{{ customerName(booking) }} · {{ bookingPhone(booking) || 'Без телефону' }}</p>
            <p class="text-sm text-slate-500">{{ serviceName(resolveService(booking)) }} · {{ bookingComment(booking) || 'Без коментаря' }}</p>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <BookingStatusBadge :status="booking.status" />
            <button
              class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50"
              aria-label="Переглянути бронювання"
              title="Переглянути"
              @click="selected = booking"
            >
              <EyeIcon class="h-4 w-4" aria-hidden="true" />
              <span class="sr-only">Переглянути</span>
            </button>
          </div>
        </article>
      </div>
    </section>

    <section class="rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
      <div class="border-b border-slate-200 px-5 py-4">
        <h2 class="text-lg font-semibold text-slate-900">Майбутні</h2>
      </div>
      <div v-if="!upcomingБронювання.length" class="p-5 text-sm text-slate-500">У цьому діапазоні майбутніх бронювань немає.</div>
      <div v-else class="divide-y divide-slate-100">
        <article v-for="booking in upcomingБронювання" :key="booking.id" class="grid gap-3 px-5 py-4 md:grid-cols-[220px_1fr_auto] md:items-center">
          <div>
            <p class="font-semibold text-slate-900">{{ formatDateTime(bookingStart(booking)) }}</p>
            <p class="text-xs text-slate-500">{{ formatTime(bookingStart(booking)) }} - {{ formatTime(bookingEnd(booking)) }}</p>
          </div>
          <div>
            <p class="font-medium text-slate-900">{{ customerName(booking) }} · {{ bookingPhone(booking) || 'Без телефону' }}</p>
            <p class="text-sm text-slate-500">{{ serviceName(resolveService(booking)) }} · {{ bookingComment(booking) || 'Без коментаря' }}</p>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <BookingStatusBadge :status="booking.status" />
            <button
              class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50"
              aria-label="Переглянути бронювання"
              title="Переглянути"
              @click="selected = booking"
            >
              <EyeIcon class="h-4 w-4" aria-hidden="true" />
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
      :pending-schedule="pendingSchedule"
      :error="actionError"
      :services="serviceOptions"
      @close="selected = null"
      @update-status="updateStatus"
      @update-schedule="updateSchedule"
    />
  </div>
</template>
