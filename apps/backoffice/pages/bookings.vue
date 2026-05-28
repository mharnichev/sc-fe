<script setup lang="ts">
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  TrashIcon,
} from '@heroicons/vue/24/outline'
import type {
  Booking,
  BookingSchedulePayload,
  BookingStatus,
  ManualBookingPayload,
  Master,
  Service,
  TimeBlock,
} from '~/composables/useBackofficeApi'
import type {
  CalendarActionPayload,
  CalendarDisplayEntry,
  CalendarSelection,
  CalendarViewMode,
} from '~/composables/useBookingCalendar'

const api = useBackofficeApi()
const auth = useAuthStore()
const calendar = useBookingCalendar()
const {
  statuses,
  todayInput,
  addDaysInput,
  bookingStart,
  bookingEnd,
  bookingComment,
  bookingPhone,
  customerName,
  masterName,
  serviceName,
  bookingServiceIds,
  bookingServicesLabel,
  formatDateTime,
  formatTime,
  normalizeItems,
  normalizeTotal,
  apiErrorMessage,
} = useBookingFormatting()

const pageSize = 200
const today = todayInput()
const viewMode = ref<CalendarViewMode>('week')
const anchorDate = ref(today)
const filters = reactive({
  master_id: '',
  service_id: '',
  status: '',
})

const selected = ref<Booking | null>(null)
const selectedBlock = ref<TimeBlock | null>(null)
const selectedSelection = ref<CalendarSelection | null>(null)
const actionModalOpen = ref(false)
const actionError = ref('')
const actionSuccess = ref('')
const pendingStatus = ref<BookingStatus | ''>('')
const pendingSchedule = ref(false)
const pendingDelete = ref(false)
const actionPending = ref(false)
const deletingBlock = ref(false)
const statusFilterOpen = ref(false)
const statusFilterRef = ref<HTMLElement | null>(null)

const [{ data: masters }, { data: services }] = await Promise.all([
  useAsyncData('booking-calendar-master-options', () =>
    auth.user?.is_superuser || auth.user?.role === 'admin' ? api.adminGetMasters(1, 200) : api.getPublicMasters(),
  ),
  useAsyncData('booking-calendar-service-options', () => api.getServices()),
])

const masterOptions = computed<Master[]>(() => normalizeItems(masters.value))
const serviceOptions = computed<Service[]>(() => normalizeItems(services.value))
const { isAdmin, isBarber, linkedMaster, roleLabel, canManageBooking } = useBackofficeAccess(masterOptions)

watch(
  linkedMaster,
  master => {
    if (!isAdmin.value && master && filters.master_id !== String(master.id)) {
      filters.master_id = String(master.id)
    }
  },
  { immediate: true },
)

const selectedMasterId = computed(() => {
  if (filters.master_id) return Number(filters.master_id)
  if (!isAdmin.value && linkedMaster.value) return linkedMaster.value.id
  if (!isAdmin.value && auth.user?.master_id) return auth.user.master_id
  return null
})

const selectedMaster = computed(() =>
  masterOptions.value.find(master => master.id === selectedMasterId.value) || linkedMaster.value || null,
)

const selectedMasterLabel = computed(() =>
  selectedMaster.value ? masterName(selectedMaster.value) : selectedMasterId.value ? `Майстер #${selectedMasterId.value}` : 'Майстра не вибрано',
)
const selectedStatusFilter = computed(() =>
  statuses.includes(filters.status as BookingStatus) ? filters.status as BookingStatus : '',
)

const rangeEnd = computed(() => addDaysInput(anchorDate.value, calendar.daysInView(viewMode.value) - 1))
const calendarDays = computed(() => calendar.buildDays(anchorDate.value, viewMode.value))
const slotsByDay = computed(() => calendar.buildSlotsByDay(calendarDays.value))
const canSelectSlots = computed(() => Boolean(selectedMasterId.value && (isAdmin.value || isBarber.value || linkedMaster.value || auth.user?.master_id)))

const { data, pending, error, refresh } = await useAsyncData(
  'booking-calendar-data',
  async () => {
    const masterId = selectedMasterId.value
    const bookingFilters = {
      date_from: anchorDate.value,
      date_to: rangeEnd.value,
      master_id: masterId,
      service_id: filters.service_id ? Number(filters.service_id) : null,
      status: filters.status as BookingStatus | '',
    }

    if (isAdmin.value) {
      const [bookings, timeBlocks] = await Promise.all([
        api.adminGetBookings(1, pageSize, bookingFilters),
        api.adminGetTimeBlocks(1, pageSize, {
          date_from: anchorDate.value,
          date_to: rangeEnd.value,
          master_id: masterId,
        }),
      ])
      return { bookings, timeBlocks }
    }

    const [bookings, timeBlocks] = await Promise.all([
      api.getMyBookings({
        date_from: anchorDate.value,
        date_to: rangeEnd.value,
        status: filters.status as BookingStatus | '',
      }),
      api.getMyTimeBlocks({
        date_from: anchorDate.value,
        date_to: rangeEnd.value,
      }),
    ])
    return { bookings, timeBlocks }
  },
  {
    watch: [
      viewMode,
      anchorDate,
      selectedMasterId,
      () => filters.service_id,
      () => filters.status,
      isAdmin,
    ],
  },
)

const bookings = computed<Booking[]>(() => normalizeItems(data.value?.bookings))
const timeBlocks = computed<TimeBlock[]>(() => normalizeItems(data.value?.timeBlocks))

const visibleBookings = computed(() => {
  const selectedServiceId = filters.service_id ? Number(filters.service_id) : null
  return bookings.value.filter(booking => {
    if (selectedServiceId && !bookingServiceIds(booking).includes(selectedServiceId)) return false
    if (filters.status && booking.status !== filters.status) return false
    return true
  })
})

const visibleBlocks = computed(() =>
  timeBlocks.value.filter(block => !selectedMasterId.value || Number(block.master_id) === selectedMasterId.value),
)

const activeBookings = computed(() => visibleBookings.value.filter(booking => booking.status !== 'cancelled'))
const busyRanges = computed(() => calendar.buildBusyRanges(activeBookings.value, visibleBlocks.value, serviceOptions.value))
const calendarEntries = computed(() => calendar.buildDisplayEntries(activeBookings.value, visibleBlocks.value, serviceOptions.value))
const total = computed(() => normalizeTotal(data.value?.bookings))

const bookingServiceOptions = computed(() => {
  if (!selectedMasterId.value) return serviceOptions.value
  return serviceOptions.value.filter(service => !service.barber_id || Number(service.barber_id) === selectedMasterId.value)
})

const resolveMaster = (booking: Booking) =>
  booking.master || booking.barber || masterOptions.value.find(master => master.id === booking.master_id) || null

const allowedStatusActions = (booking: Booking | null) =>
  !booking || booking.status === 'completed' || !canManageBooking(booking.master_id)
    ? []
    : statuses.filter(status => status !== booking.status)

const setViewMode = (mode: CalendarViewMode) => {
  viewMode.value = mode
  if (mode === 'today') {
    anchorDate.value = todayInput()
  }
}

const moveRange = (direction: -1 | 1) => {
  anchorDate.value = addDaysInput(anchorDate.value, direction * calendar.daysInView(viewMode.value))
}

const goToToday = () => {
  anchorDate.value = todayInput()
}

const applyFilters = async () => {
  actionError.value = ''
  actionSuccess.value = ''
  statusFilterOpen.value = false
  await refresh()
}

const clearFilters = async () => {
  filters.master_id = !isAdmin.value && linkedMaster.value ? String(linkedMaster.value.id) : ''
  filters.service_id = ''
  filters.status = ''
  statusFilterOpen.value = false
  anchorDate.value = todayInput()
  viewMode.value = 'week'
  await refresh()
}

const selectStatusFilter = (status: BookingStatus | '') => {
  filters.status = status
  statusFilterOpen.value = false
}

const handleStatusFilterClickOutside = (event: MouseEvent) => {
  if (!statusFilterOpen.value) return
  const target = event.target
  if (target instanceof Node && !statusFilterRef.value?.contains(target)) {
    statusFilterOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleStatusFilterClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleStatusFilterClickOutside)
})

const openActionModal = (selection: CalendarSelection) => {
  actionError.value = ''
  actionSuccess.value = ''
  if (!canSelectSlots.value) {
    actionError.value = 'Виберіть майстра, щоб створювати бронювання або блокування часу.'
    return
  }
  selectedSelection.value = selection
  actionModalOpen.value = true
}

const handleEntryClick = (entry: CalendarDisplayEntry) => {
  if (entry.booking) {
    selected.value = entry.booking
    return
  }
  if (entry.block) {
    selectedBlock.value = entry.block
  }
}

const isMissingCreateEndpoint = (cause: unknown) => {
  if (typeof cause !== 'object' || !cause || !('response' in cause)) return false
  const status = (cause as { response?: { status?: number } }).response?.status
  return status === 404 || status === 405
}

const validateCalendarPayload = (payload: CalendarActionPayload) => {
  if (!selectedMasterId.value) return 'Виберіть майстра.'
  const date = calendar.dateInputFromDateTime(payload.start_at)
  const startTime = formatTime(payload.start_at)
  const endTime = formatTime(payload.end_at)
  if (!date || startTime === '-' || endTime === '-') return 'Некоректний час інтервалу.'
  if (calendar.isMonday(date)) return 'Понеділок — вихідний день.'
  if (startTime < calendar.workdayStart || endTime > calendar.workdayEnd || startTime >= endTime) {
    return `Інтервал має бути в межах ${calendar.workdayStart}-${calendar.workdayEnd}.`
  }
  if (new Date(payload.end_at).getTime() <= Date.now()) return 'Минулі часові слоти недоступні.'
  if (calendar.rangeOverlapsBusy(payload.start_at, payload.end_at, busyRanges.value)) {
    return payload.action === 'booking'
      ? 'Бронювання не може перетинатися з іншим бронюванням або блокуванням.'
      : 'Блокування не може перетинатися з бронюванням або іншим блокуванням.'
  }
  if (payload.action === 'booking' && !payload.service_ids.length) return 'Виберіть хоча б одну послугу.'
  return ''
}

const createManualBooking = async (payload: CalendarActionPayload) => {
  const body: ManualBookingPayload = {
    master_id: selectedMasterId.value as number,
    service_id: payload.service_id as number,
    service_ids: payload.service_ids,
    customer_name: payload.customer_name,
    customer_phone: payload.customer_phone,
    customer_email: payload.customer_email || null,
    customer_comment: payload.note || null,
    note: payload.note || null,
    start_at: payload.start_at,
    end_at: payload.end_at,
    status: 'confirmed',
  }

  try {
    if (isAdmin.value) {
      await api.adminCreateBooking(body)
    }
    else {
      await api.createMyManualBooking(body)
    }
  }
  catch (cause) {
    if (!isMissingCreateEndpoint(cause)) throw cause
    await api.createPublicBooking({
      master_id: body.master_id,
      service_id: body.service_id,
      service_ids: body.service_ids,
      customer_name: body.customer_name,
      customer_phone: body.customer_phone,
      customer_email: body.customer_email,
      customer_comment: body.customer_comment,
      duration_minutes: payload.duration_minutes,
      start_at: body.start_at,
    })
  }
}

const createTimeBlock = async (payload: CalendarActionPayload) => {
  if (isAdmin.value) {
    await api.adminCreateTimeBlock({
      master_id: selectedMasterId.value as number,
      start_at: payload.start_at,
      end_at: payload.end_at,
      reason: payload.note || null,
    })
    return
  }

  await api.createMyTimeBlock({
    start_at: payload.start_at,
    end_at: payload.end_at,
    reason: payload.note || null,
  })
}

const submitCalendarAction = async (payload: CalendarActionPayload) => {
  actionError.value = validateCalendarPayload(payload)
  actionSuccess.value = ''
  if (actionError.value) return

  actionPending.value = true
  try {
    if (payload.action === 'booking') {
      await createManualBooking(payload)
      actionSuccess.value = 'Бронювання створено.'
    }
    else {
      await createTimeBlock(payload)
      actionSuccess.value = 'Блокування часу створено.'
    }
    actionModalOpen.value = false
    selectedSelection.value = null
    await refresh()
  }
  catch (cause) {
    actionError.value = apiErrorMessage(
      cause,
      payload.action === 'booking'
        ? 'Не вдалося створити бронювання.'
        : 'Не вдалося створити блокування часу.',
    )
  }
  finally {
    actionPending.value = false
  }
}

const updateStatus = async (status: BookingStatus) => {
  if (!selected.value || selected.value.status === 'completed') return
  pendingStatus.value = status
  actionError.value = ''
  try {
    const updated = isAdmin.value
      ? await api.adminUpdateBookingStatus(selected.value.id, status)
      : await api.updateMyBookingStatus(selected.value.id, status)
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
  if (!selected.value || selected.value.status === 'completed') return
  pendingSchedule.value = true
  actionError.value = ''
  actionSuccess.value = ''
  try {
    const updated = isAdmin.value
      ? await api.adminUpdateBookingSchedule(selected.value.id, payload)
      : await api.updateMyBookingSchedule(selected.value.id, payload)
    selected.value = { ...selected.value, ...updated }
    actionSuccess.value = 'Час бронювання оновлено.'
    await refresh()
  }
  catch (cause) {
    actionError.value = apiErrorMessage(cause, 'Не вдалося оновити час бронювання.')
  }
  finally {
    pendingSchedule.value = false
  }
}

const deleteSelectedBooking = async () => {
  if (!selected.value || selected.value.status === 'completed' || !canManageBooking(selected.value.master_id)) return
  pendingDelete.value = true
  actionError.value = ''
  actionSuccess.value = ''
  try {
    if (isAdmin.value) {
      await api.adminDeleteBooking(selected.value.id)
    }
    else {
      await api.deleteMyBooking(selected.value.id)
    }
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

const deleteSelectedBlock = async () => {
  if (!selectedBlock.value) return
  deletingBlock.value = true
  actionError.value = ''
  actionSuccess.value = ''
  try {
    if (isAdmin.value) {
      await api.adminDeleteTimeBlock(selectedBlock.value.id)
    }
    else {
      await api.deleteMyTimeBlock(selectedBlock.value.id)
    }
    selectedBlock.value = null
    actionSuccess.value = 'Блокування часу видалено.'
    await refresh()
  }
  catch (cause) {
    actionError.value = apiErrorMessage(cause, 'Не вдалося видалити блокування часу.')
  }
  finally {
    deletingBlock.value = false
  }
}
</script>

<template>
  <div class="space-y-4 md:space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3 md:gap-4">
      <div>
        <p class="text-xs uppercase tracking-[0.22em] text-cyan-700 md:text-sm md:tracking-[0.3em]">Календар</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900 md:mt-2 md:text-3xl">Бронювання</h1>
      </div>
      <div class="flex w-full flex-wrap gap-2 sm:w-auto md:gap-3">
        <NuxtLink to="/my-bookings" class="inline-flex min-h-9 flex-1 items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 sm:flex-none md:min-h-11 md:px-5 md:py-3 md:text-sm">
          Мої бронювання
        </NuxtLink>
      </div>
    </div>

    <section class="space-y-3 rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm md:space-y-4 md:p-4">
      <div class="flex flex-wrap items-center justify-between gap-2 md:gap-3">
        <div class="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1">
          <button
            v-for="mode in (['today', 'week', 'month'] as CalendarViewMode[])"
            :key="mode"
            type="button"
            class="min-h-8 rounded-xl px-2 py-1.5 text-xs font-medium transition md:min-h-10 md:px-3 md:py-2 md:text-sm"
            :class="viewMode === mode ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-950'"
            @click="setViewMode(mode)"
          >
            {{ calendarViewLabels[mode] }}
          </button>
        </div>

        <div class="grid w-full grid-cols-[2.25rem_minmax(0,1fr)_auto_2.25rem] items-center gap-1.5 sm:w-auto md:flex md:flex-wrap md:gap-2">
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50 md:h-10 md:w-10"
            aria-label="Попередній період"
            title="Попередній період"
            @click="moveRange(-1)"
          >
            <ChevronLeftIcon class="h-4 w-4 md:h-5 md:w-5" aria-hidden="true" />
          </button>
          <input v-model="anchorDate" type="date" class="min-h-9 min-w-0 rounded-xl border border-slate-300 px-2 py-1.5 text-xs md:min-h-10 md:rounded-2xl md:px-3 md:py-2 md:text-sm">
          <button type="button" class="min-h-9 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 md:min-h-10 md:px-4 md:py-2 md:text-sm" @click="goToToday">
            Сьогодні
          </button>
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50 md:h-10 md:w-10"
            aria-label="Наступний період"
            title="Наступний період"
            @click="moveRange(1)"
          >
            <ChevronRightIcon class="h-4 w-4 md:h-5 md:w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div class="grid gap-2 md:grid-cols-2 md:gap-3 xl:grid-cols-5">
        <label v-if="isAdmin" class="space-y-1 text-xs text-slate-700 md:space-y-2 md:text-sm">
          <span class="font-medium">Майстер</span>
          <select v-model="filters.master_id" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm md:rounded-2xl md:px-4 md:py-3" :disabled="!isAdmin">
            <option value="">{{ isAdmin ? 'Усі майстри' : selectedMasterLabel }}</option>
            <option v-for="master in masterOptions" :key="master.id" :value="String(master.id)">
              {{ masterName(master) }}
            </option>
          </select>
        </label>
        <label class="space-y-1 text-xs text-slate-700 md:space-y-2 md:text-sm">
          <span class="font-medium">Послуга</span>
          <select v-model="filters.service_id" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm md:rounded-2xl md:px-4 md:py-3">
            <option value="">Усі послуги</option>
            <option v-for="service in bookingServiceOptions" :key="service.id" :value="String(service.id)">
              {{ serviceName(service) }}
            </option>
          </select>
        </label>
        <div ref="statusFilterRef" class="relative space-y-1 text-xs text-slate-700 md:space-y-2 md:text-sm">
          <span class="font-medium">Статус</span>
          <button
            type="button"
            class="flex min-h-9 w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 md:min-h-12 md:rounded-2xl md:px-4 md:py-3"
            :aria-expanded="statusFilterOpen"
            @click="statusFilterOpen = !statusFilterOpen"
          >
            <span class="min-w-0">
              <BookingStatusBadge v-if="selectedStatusFilter" :status="selectedStatusFilter" />
              <span v-else class="text-slate-500">Будь-який статус</span>
            </span>
            <ChevronDownIcon class="h-4 w-4 shrink-0 text-slate-400 transition" :class="statusFilterOpen ? 'rotate-180' : ''" aria-hidden="true" />
          </button>
          <div
            v-if="statusFilterOpen"
            class="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl md:rounded-2xl"
          >
            <button
              type="button"
              class="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm text-slate-500 transition hover:bg-slate-50"
              :class="!selectedStatusFilter ? 'bg-slate-50' : ''"
              @click="selectStatusFilter('')"
            >
              Будь-який статус
            </button>
            <button
              v-for="status in statuses"
              :key="status"
              type="button"
              class="flex w-full items-center rounded-lg px-2.5 py-2 text-left transition hover:bg-slate-50"
              :class="selectedStatusFilter === status ? 'bg-slate-50' : ''"
              @click="selectStatusFilter(status)"
            >
              <BookingStatusBadge :status="status" />
            </button>
          </div>
        </div>
        <div class="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 md:rounded-2xl md:px-4 md:py-3 md:text-sm">
          <p class="font-medium text-slate-900">{{ anchorDate }} - {{ rangeEnd }}</p>
          <p class="mt-0.5 md:mt-1">Бронювань: {{ visibleBookings.length }} · Блокувань: {{ visibleBlocks.length }}</p>
        </div>
        <div class="flex items-end gap-2 md:gap-3">
          <button class="flex-1 rounded-full bg-slate-950 px-3 py-2 text-xs font-medium text-white md:px-4 md:py-3 md:text-sm" @click="applyFilters">Застосувати</button>
          <button class="flex-1 rounded-full border border-slate-300 px-3 py-2 text-xs md:px-4 md:py-3 md:text-sm" @click="clearFilters">Очистити</button>
        </div>
      </div>
    </section>

    <div class="space-y-2 md:space-y-3">
      <p v-if="error" class="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600 md:rounded-2xl md:px-4 md:py-3 md:text-sm">
        {{ apiErrorMessage(error, 'Не вдалося завантажити календар бронювань.') }}
      </p>
      <p v-if="actionError" class="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600 md:rounded-2xl md:px-4 md:py-3 md:text-sm">{{ actionError }}</p>
      <p v-if="actionSuccess" class="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700 md:rounded-2xl md:px-4 md:py-3 md:text-sm">{{ actionSuccess }}</p>
      <p v-if="pending" class="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500 md:rounded-2xl md:px-4 md:py-3 md:text-sm">Завантаження календаря...</p>
      <p v-else-if="!calendarEntries.length" class="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500 md:rounded-2xl md:px-4 md:py-3 md:text-sm">
        У вибраному діапазоні немає бронювань або блокувань. Вільні слоти можна вибирати прямо в календарі.
      </p>
    </div>

    <BookingCalendarGrid
      :days="calendarDays"
      :slots-by-day="slotsByDay"
      :entries="calendarEntries"
      :busy-ranges="busyRanges"
      :selectable="canSelectSlots"
      :loading="pending"
      @select="openActionModal"
      @entry-click="handleEntryClick"
    />

    <section class="rounded-[1.25rem] border border-slate-200 bg-white shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 md:gap-3 md:px-4 md:py-3">
        <div>
          <h2 class="text-base font-semibold text-slate-900 md:text-lg">Список бронювань</h2>
          <p class="mt-0.5 text-xs text-slate-500 md:mt-1 md:text-sm">Поточний діапазон: {{ anchorDate }} - {{ rangeEnd }} · Total: {{ total }}</p>
        </div>
      </div>
      <div v-if="!visibleBookings.length" class="p-3 text-sm text-slate-500 md:p-4">Бронювань за цими фільтрами немає.</div>
      <div v-else class="divide-y divide-slate-100">
        <article v-for="booking in visibleBookings" :key="booking.id" class="grid gap-2 px-3 py-2 text-left md:grid-cols-[160px_1fr_auto] md:items-center md:gap-3 md:px-4 md:py-3">
          <div class="min-w-0 md:min-w-max">
            <p class="truncate text-sm font-semibold text-slate-900 md:text-base">{{ formatTime(bookingStart(booking)) }} - {{ formatTime(bookingEnd(booking)) }}</p>
            <p class="truncate text-[0.68rem] text-slate-500 md:text-xs">{{ formatDateTime(bookingStart(booking)) }}</p>
          </div>
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-slate-900 md:text-base">{{ customerName(booking) }} · {{ bookingPhone(booking) || 'Без телефону' }}</p>
            <p class="mt-0.5 truncate text-xs text-slate-500 md:mt-1 md:text-sm">
              {{ bookingServicesLabel(booking, serviceOptions) }} · {{ masterName(resolveMaster(booking)) }} · {{ bookingComment(booking) || 'Без коментаря' }}
            </p>
          </div>
          <div class="flex items-center justify-start gap-2 md:flex-wrap md:justify-end md:gap-3">
            <BookingStatusBadge :status="booking.status" />
            <button
              class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50 md:h-8 md:w-8"
              aria-label="Переглянути бронювання"
              title="Переглянути"
              @click="selected = booking"
            >
              <EyeIcon class="h-3.5 w-3.5 md:h-4 md:w-4" aria-hidden="true" />
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
      :pending-delete="pendingDelete"
      :can-edit="Boolean(selected && selected.status !== 'completed' && canManageBooking(selected.master_id))"
      :can-delete="Boolean(selected && selected.status !== 'completed' && canManageBooking(selected.master_id))"
      :error="actionError"
      :masters="masterOptions"
      :services="serviceOptions"
      @close="selected = null"
      @update-status="updateStatus"
      @update-schedule="updateSchedule"
      @delete="deleteSelectedBooking"
    />

    <BookingCalendarActionModal
      v-model="actionModalOpen"
      :selection="selectedSelection"
      :services="bookingServiceOptions"
      :master-name="selectedMasterLabel"
      :pending="actionPending"
      :error="actionError"
      @submit="submitCalendarAction"
    />

    <BaseModal :model-value="Boolean(selectedBlock)" max-width-class="max-w-xl" @update:model-value="selectedBlock = null">
      <template #head="{ close }">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-sm uppercase tracking-[0.25em] text-cyan-700">Блокування</p>
            <h2 class="mt-2 text-2xl font-semibold text-slate-900">Недоступний час</h2>
          </div>
          <button type="button" class="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700" @click="close">
            Закрити
          </button>
        </div>
      </template>
      <template #body>
        <div v-if="selectedBlock" class="space-y-4">
          <div class="rounded-2xl bg-slate-50 px-4 py-3">
            <p class="font-medium text-slate-900">{{ formatDateTime(selectedBlock.start_at) }} - {{ formatDateTime(selectedBlock.end_at) }}</p>
            <p class="mt-1 text-sm text-slate-500">{{ selectedBlock.reason || 'Без причини' }}</p>
          </div>
          <button
            type="button"
            :disabled="deletingBlock"
            class="inline-flex items-center justify-center gap-2 rounded-full border border-rose-300 px-5 py-3 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
            @click="deleteSelectedBlock"
          >
            <TrashIcon class="h-4 w-4" aria-hidden="true" />
            {{ deletingBlock ? 'Видалення...' : 'Видалити блокування' }}
          </button>
        </div>
      </template>
    </BaseModal>
  </div>
</template>
