<script setup lang="ts">
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
} from '@heroicons/vue/24/outline'
import type {
  Booking,
  CalendarCapacityBooking,
  CalendarHold,
  BookingPricingPayload,
  BookingSchedulePayload,
  BookingStatus,
  ManualBookingPayload,
  Master,
  MasterAvailabilityWindow,
  Promotion,
  Service,
  TimeBlock,
} from '~/composables/useBackofficeApi'
import type {
  CalendarActionPayload,
  CalendarActionType,
  CalendarDay,
  CalendarDisplayEntry,
  CalendarSelection,
  CalendarViewMode,
} from '~/composables/useBookingCalendar'

const api = useBackofficeApi()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const calendar = useBookingCalendar()
const toastNotification = useBaseToastNotification()
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
  redirectedFromMasterId,
  bookingRedirectSourceLabel,
  isRedirectedBooking,
  serviceName,
  bookingServiceIds,
  bookingServicesLabel,
  formatBookingStatus,
  formatDateTime,
  formatTime,
  toKyivIso,
  normalizeItems,
  normalizeTotal,
  apiErrorMessage,
} = useBookingFormatting()

const today = todayInput()
const bookingFilterStatuses: BookingStatus[] = ['pending', ...statuses]
const routeStatus = String(route.query.status || '')
const initialStatus: BookingStatus | '' = bookingFilterStatuses.includes(routeStatus as BookingStatus)
  ? routeStatus as BookingStatus
  : ''
const viewMode = ref<CalendarViewMode>('week')
const calendarViewOptions = (['today', 'week', 'month'] as CalendarViewMode[])
  .map(mode => ({ value: mode, label: calendarViewLabels[mode] }))
const anchorDate = ref(today)
const filters = reactive({
  master_id: '',
  service_id: '',
  status: initialStatus,
})

const selected = ref<Booking | null>(null)
const selectedBlock = ref<TimeBlock | null>(null)
const selectedSelection = ref<CalendarSelection | null>(null)
const selectedDefaultAction = ref<CalendarActionType>('availability')
const actionModalOpen = ref(false)
const actionError = ref('')
const pendingStatus = ref<BookingStatus | ''>('')
const pendingSchedule = ref(false)
const pendingPricing = ref(false)
const pendingDelete = ref(false)
const actionPending = ref(false)
const deletingBlock = ref(false)

const [{ data: masters }, { data: services }] = await Promise.all([
  useAsyncData('booking-calendar-master-options', () =>
    auth.user?.is_superuser || auth.user?.role === 'admin' ? api.adminGetMasters(1, 200) : api.getPublicMasters(),
  ),
  useAsyncData('booking-calendar-service-options', () => api.getServices()),
])

const masterOptions = computed<Master[]>(() => normalizeItems(masters.value))
const serviceOptions = computed<Service[]>(() => normalizeItems(services.value))
const { isAdmin, isBarber, linkedMaster, roleLabel, canManageBooking } = useBackofficeAccess(masterOptions)

const { data: promotionData } = await useAsyncData(
  'booking-calendar-active-promotions',
  () => isAdmin.value
    ? api.adminGetPromotions(1, 100, { is_active: true })
    : Promise.resolve({ total: 0, page: 1, page_size: 100, items: [] as Promotion[] }),
  { watch: [isAdmin] },
)

const activePromotions = computed<Promotion[]>(() => normalizeItems(promotionData.value))

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
const activeFilterCount = computed(() => {
  const defaultMasterId = !isAdmin.value && linkedMaster.value ? String(linkedMaster.value.id) : ''
  return [
    filters.master_id !== defaultMasterId ? filters.master_id : '',
    filters.service_id,
    filters.status,
    anchorDate.value !== todayInput() ? anchorDate.value : '',
    viewMode.value !== 'week' ? viewMode.value : '',
  ].filter(Boolean).length
})
const statusFilterOptions = computed(() => [
  { value: '', label: 'Будь-який статус', meta: null },
  ...bookingFilterStatuses.map(status => ({ value: status, label: formatBookingStatus(status), meta: status })),
])

const rangeEnd = computed(() => addDaysInput(anchorDate.value, calendar.daysInView(viewMode.value) - 1))
const queryDateFrom = computed(() => toKyivIso(anchorDate.value, '00:00'))
const queryDateTo = computed(() => toKyivIso(addDaysInput(rangeEnd.value, 1), '00:00'))
const calendarDays = computed(() => calendar.buildDays(anchorDate.value, viewMode.value))
const slotsByDay = computed(() => calendar.buildSlotsByDay(calendarDays.value))
const canSelectSlots = computed(() => Boolean(selectedMasterId.value && (isAdmin.value || isBarber.value || linkedMaster.value || auth.user?.master_id)))
const canSelectPastSlots = computed(() => isAdmin.value)

const { data, pending, error, refresh } = await useAsyncData(
  'booking-calendar-data',
  async () => {
    const masterId = selectedMasterId.value
    const bookingFilters = {
      date_from: queryDateFrom.value,
      date_to: queryDateTo.value,
      master_id: masterId,
    }
    const availabilityFilters = {
      date_from: toKyivIso(anchorDate.value, calendar.workdayStart),
      date_to: toKyivIso(rangeEnd.value, calendar.workdayEnd),
      master_id: masterId,
    }

    if (isAdmin.value) {
      const [bookings, timeBlocks, holds, availability] = await Promise.all([
        api.adminGetCalendarBookings(bookingFilters),
        api.adminGetCalendarTimeBlocks({
          date_from: queryDateFrom.value,
          date_to: queryDateTo.value,
          master_id: masterId,
        }),
        api.adminGetCalendarHolds({
          date_from: queryDateFrom.value,
          date_to: queryDateTo.value,
          master_id: masterId,
        }),
        masterId ? api.adminGetAvailability(availabilityFilters) : Promise.resolve([] as MasterAvailabilityWindow[]),
      ])
      return { bookings, timeBlocks, capacity: [] as CalendarCapacityBooking[], holds, availability }
    }

    const [bookings, timeBlocks, capacity, holds, availability] = await Promise.all([
      api.getMyCalendar({
        date_from: queryDateFrom.value,
        date_to: queryDateTo.value,
      }),
      api.getMyTimeBlocks({
        date_from: queryDateFrom.value,
        date_to: queryDateTo.value,
      }),
      api.getMyCalendarCapacity({
        date_from: queryDateFrom.value,
        date_to: queryDateTo.value,
      }),
      api.getMyCalendarHolds({
        date_from: queryDateFrom.value,
        date_to: queryDateTo.value,
      }),
      api.getMyAvailability(availabilityFilters),
    ])
    return { bookings, timeBlocks, capacity, holds, availability }
  },
  {
    watch: [
      viewMode,
      anchorDate,
      selectedMasterId,
      isAdmin,
    ],
  },
)

const bookings = computed<Booking[]>(() => normalizeItems(data.value?.bookings))
const timeBlocks = computed<TimeBlock[]>(() => normalizeItems(data.value?.timeBlocks))
const calendarCapacityBookings = computed<CalendarCapacityBooking[]>(() => normalizeItems(data.value?.capacity))
const calendarHoldRecords = computed<CalendarHold[]>(() => normalizeItems(data.value?.holds))
const calendarClockMs = ref(Date.now())
const calendarHolds = computed(() => calendar.activeCalendarHoldsAt(calendarHoldRecords.value, calendarClockMs.value))
const availabilityWindows = computed<MasterAvailabilityWindow[]>(() => data.value?.availability || [])

let calendarHoldExpiryTimer: ReturnType<typeof setTimeout> | null = null
let stopCalendarHoldExpiryWatch: (() => void) | null = null
let calendarHoldExpiryMounted = false

const clearCalendarHoldExpiryTimer = () => {
  if (calendarHoldExpiryTimer == null) return
  clearTimeout(calendarHoldExpiryTimer)
  calendarHoldExpiryTimer = null
}

const scheduleCalendarHoldExpiryRefresh = () => {
  clearCalendarHoldExpiryTimer()
  if (!calendarHoldExpiryMounted) return
  const nowMs = Date.now()
  calendarClockMs.value = nowMs
  const nearestExpiry = calendar.nearestCalendarHoldExpiryAt(calendarHoldRecords.value, nowMs)
  if (nearestExpiry == null) return

  calendarHoldExpiryTimer = setTimeout(() => {
    calendarHoldExpiryTimer = null
    calendarClockMs.value = Date.now()
    void refresh().finally(scheduleCalendarHoldExpiryRefresh)
  }, Math.max(0, nearestExpiry - nowMs) + 100)
}

onMounted(() => {
  calendarHoldExpiryMounted = true
  stopCalendarHoldExpiryWatch = watch(calendarHoldRecords, scheduleCalendarHoldExpiryRefresh, { immediate: true })
})

onBeforeUnmount(() => {
  calendarHoldExpiryMounted = false
  stopCalendarHoldExpiryWatch?.()
  stopCalendarHoldExpiryWatch = null
  clearCalendarHoldExpiryTimer()
})

const visibleBookings = computed(() => {
  const selectedServiceId = filters.service_id ? Number(filters.service_id) : null
  return bookings.value.filter(booking => {
    if (selectedServiceId && !bookingServiceIds(booking).includes(selectedServiceId)) return false
    if (filters.status && booking.status !== filters.status) return false
    return true
  })
})

// The API resolves booking redirects before filtering time blocks. A block can
// therefore belong to the redirect target rather than the selected public master.
const visibleBlocks = computed<TimeBlock[]>(() => timeBlocks.value)

const capacityBookings = computed(() => isAdmin.value ? calendar.capacityBlockingBookings(bookings.value) : [])
const redactedCapacityBookings = computed(() => isAdmin.value ? [] : calendarCapacityBookings.value)
const busyRanges = computed(() => calendar.buildBusyRanges(
  capacityBookings.value,
  visibleBlocks.value,
  serviceOptions.value,
  calendarHolds.value,
  redactedCapacityBookings.value,
))
const availabilityRanges = computed(() => selectedMasterId.value ? calendar.buildAvailabilityRanges(availabilityWindows.value) : [])
const calendarEntries = computed(() => calendar.buildDisplayEntries(visibleBookings.value, visibleBlocks.value, serviceOptions.value, calendarHolds.value))
const total = computed(() => normalizeTotal(data.value?.bookings))

const bookingServiceOptions = computed(() => {
  if (!selectedMasterId.value) return serviceOptions.value
  return serviceOptions.value.filter(service => !service.barber_id || Number(service.barber_id) === selectedMasterId.value)
})
const bookingServiceFilterOptions = computed(() => [
  { value: '', label: 'Усі послуги' },
  ...bookingServiceOptions.value.map(service => ({ value: String(service.id), label: serviceName(service) })),
])

const resolveMaster = (booking: Booking) =>
  booking.master || booking.barber || masterOptions.value.find(master => master.id === booking.master_id) || null
const bookingListMeta = (booking: Booking) =>
  [bookingServicesLabel(booking, serviceOptions.value), masterName(resolveMaster(booking)), bookingRedirectSourceLabel(booking), bookingComment(booking) || 'Без коментаря']
    .filter(Boolean)
    .join(' · ')
const canManageCalendarBooking = (booking?: Booking | null) =>
  Boolean(booking && canManageBooking(booking.master_id, redirectedFromMasterId(booking)))

const allowedStatusActions = (booking: Booking | null) =>
  !booking || booking.status === 'completed' || !canManageCalendarBooking(booking)
    ? []
    : statuses.filter(status => status !== booking.status)

const addCalendarMonthsInput = (dateInput: string, months: number) => {
  const [year, month, day] = dateInput.split('-').map(Number)
  const monthIndex = month - 1 + months
  const nextYear = year + Math.floor(monthIndex / 12)
  const nextMonthIndex = ((monthIndex % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(nextYear, nextMonthIndex + 1, 0, 12)).getUTCDate()
  return `${nextYear}-${String(nextMonthIndex + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

const availabilityHorizonEnd = computed(() => addCalendarMonthsInput(todayInput(), 2))

const availabilityOverlapsExisting = (startAt: string, endAt: string) =>
  calendar.rangeOverlapsAvailability(startAt, endAt, availabilityRanges.value)

const selectionDefaultAction = (selection: CalendarSelection): CalendarActionType =>
  calendar.rangeWithinAvailability(selection.startAt, selection.endAt, availabilityRanges.value) ? 'booking' : 'availability'

const setViewMode = (mode: CalendarViewMode) => {
  viewMode.value = mode
  if (mode === 'today') {
    anchorDate.value = todayInput()
  }
}
const handleViewModeUpdate = (mode: string | number | boolean) => setViewMode(mode as CalendarViewMode)

const moveRange = (direction: -1 | 1) => {
  anchorDate.value = addDaysInput(anchorDate.value, direction * calendar.daysInView(viewMode.value))
}

const goToToday = () => {
  anchorDate.value = todayInput()
}

const persistStatusQuery = () => {
  const query = { ...route.query }
  if (filters.status) query.status = filters.status
  else delete query.status
  return router.replace({ query })
}

const applyFilters = async () => {
  actionError.value = ''
  await persistStatusQuery()
  await refresh()
}

const clearFilters = async () => {
  const defaultMasterId = !isAdmin.value && linkedMaster.value ? String(linkedMaster.value.id) : ''
  const watchedFilterChanged = filters.master_id !== defaultMasterId
    || anchorDate.value !== todayInput()
    || viewMode.value !== 'week'
  filters.master_id = defaultMasterId
  filters.service_id = ''
  filters.status = ''
  anchorDate.value = todayInput()
  viewMode.value = 'week'
  await persistStatusQuery()
  if (watchedFilterChanged) await nextTick()
  else await refresh()
}

const openActionModal = (selection: CalendarSelection) => {
  actionError.value = ''
  if (!canSelectSlots.value) {
    actionError.value = 'Виберіть майстра, щоб керувати бронюваннями, блокуваннями або доступністю.'
    toastNotification.warning(actionError.value)
    return
  }
  selectedSelection.value = selection
  selectedDefaultAction.value = selectionDefaultAction(selection)
  actionModalOpen.value = true
}

const openDayAvailability = async (day: CalendarDay) => {
  const payload: CalendarActionPayload = {
    action: 'availability',
    service_id: null,
    service_ids: [],
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    note: '',
    start_at: toKyivIso(day.date, calendar.workdayStart),
    end_at: toKyivIso(day.date, calendar.workdayEnd),
  }

  actionError.value = validateCalendarPayload(payload)
  if (actionError.value) {
    toastNotification.warning(actionError.value)
    return
  }

  actionPending.value = true
  try {
    await createAvailabilityWindow(payload)
    toastNotification.success('День відкрито для запису.')
    await refresh()
  }
  catch (cause) {
    actionError.value = apiErrorMessage(cause, 'Не вдалося відкрити день для запису.')
    toastNotification.error(actionError.value)
  }
  finally {
    actionPending.value = false
  }
}

const handleEntryClick = (entry: CalendarDisplayEntry) => {
  if (entry.kind === 'waitlist_hold') return
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

const validateCalendarPayload = (payload: CalendarActionPayload): string => {
  if (!selectedMasterId.value) return 'Виберіть майстра.'
  if (payload.action === 'availability' && payload.availability_windows?.length) {
    for (const window of payload.availability_windows) {
      const error: string = validateCalendarPayload({
        ...payload,
        start_at: window.start_at,
        end_at: window.end_at,
        availability_windows: undefined,
      })
      if (error) return error
    }
    return ''
  }
  const date = calendar.dateInputFromDateTime(payload.start_at)
  const startTime = formatTime(payload.start_at)
  const endTime = formatTime(payload.end_at)
  if (!date || startTime === '-' || endTime === '-') return 'Некоректний час інтервалу.'
  if (calendar.isMonday(date)) return 'Понеділок — вихідний день.'
  if (startTime < calendar.workdayStart || endTime > calendar.workdayEnd || startTime >= endTime) {
    return `Інтервал має бути в межах ${calendar.workdayStart}-${calendar.workdayEnd}.`
  }
  if (payload.action === 'availability') {
    if (date < todayInput()) return 'Минулі дні не можна відкривати для запису.'
    if (date > availabilityHorizonEnd.value) return 'Доступність можна відкривати лише на найближчі 2 місяці.'
    if (new Date(payload.end_at).getTime() <= Date.now()) return 'Минулий час не можна відкривати для запису.'
    if (availabilityOverlapsExisting(payload.start_at, payload.end_at)) return 'Цей інтервал уже перетинається з відкритою доступністю.'
    return ''
  }
  if (!isAdmin.value && new Date(payload.end_at).getTime() <= Date.now()) return 'Минулі часові слоти недоступні.'
  if (calendar.rangeOverlapsBusy(payload.start_at, payload.end_at, busyRanges.value)) {
    return payload.action === 'booking'
      ? 'Бронювання не може перетинатися з іншим бронюванням або блокуванням.'
      : 'Блокування не може перетинатися з бронюванням або іншим блокуванням.'
  }
  if (payload.action === 'booking' && !payload.service_ids.length) return 'Виберіть хоча б одну послугу.'
  if (payload.action === 'booking' && !isAdmin.value && !calendar.rangeWithinAvailability(payload.start_at, payload.end_at, availabilityRanges.value)) {
    return 'Спочатку відкрийте цей інтервал для запису.'
  }
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
    promotion_code: isAdmin.value ? payload.promotion_code || null : null,
    start_at: payload.start_at,
    end_at: payload.end_at,
    status: 'confirmed',
  }

  try {
    if (isAdmin.value) {
      return await api.adminCreateBooking(body)
    }
    else {
      return await api.createMyManualBooking(body)
    }
  }
  catch (cause) {
    if (!isMissingCreateEndpoint(cause)) throw cause
    return await api.createPublicBooking({
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

const focusCreatedBooking = (booking: Booking | undefined, requestedMasterId: number | null = selectedMasterId.value) => {
  if (!booking) return
  const bookingDate = calendar.dateInputFromDateTime(bookingStart(booking))
  if (bookingDate) anchorDate.value = bookingDate
  if (isAdmin.value) {
    const nextMasterId = requestedMasterId || booking.master_id
    if (nextMasterId) filters.master_id = String(nextMasterId)
  }

  const selectedServiceId = filters.service_id ? Number(filters.service_id) : null
  if (selectedServiceId && !bookingServiceIds(booking).includes(selectedServiceId)) {
    filters.service_id = ''
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

const createAvailabilityWindow = async (payload: CalendarActionPayload) => {
  if (payload.availability_windows?.length) {
    for (const window of payload.availability_windows) {
      await createAvailabilityWindow({
        ...payload,
        start_at: window.start_at,
        end_at: window.end_at,
        availability_windows: undefined,
      })
    }
    return
  }

  if (isAdmin.value) {
    await api.adminCreateAvailabilityWindow({
      master_id: selectedMasterId.value as number,
      start_at: payload.start_at,
      end_at: payload.end_at,
    })
    return
  }

  await api.createMyAvailabilityWindow({
    start_at: payload.start_at,
    end_at: payload.end_at,
  })
}

const submitCalendarAction = async (payload: CalendarActionPayload) => {
  actionError.value = validateCalendarPayload(payload)
  if (actionError.value) {
    toastNotification.warning(actionError.value)
    return
  }

  actionPending.value = true
  try {
    if (payload.action === 'booking') {
      const requestedMasterId = selectedMasterId.value
      const createdBooking = await createManualBooking(payload)
      focusCreatedBooking(createdBooking, requestedMasterId)
      toastNotification.bookingCreated()
    }
    else if (payload.action === 'block') {
      await createTimeBlock(payload)
      toastNotification.success('Блокування часу створено.')
    }
    else {
      await createAvailabilityWindow(payload)
      toastNotification.success('Доступність відкрито для запису.')
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
        : payload.action === 'block'
          ? 'Не вдалося створити блокування часу.'
          : 'Не вдалося відкрити доступність.',
    )
    toastNotification.error(actionError.value)
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
    toastNotification.success('Статус бронювання оновлено.')
    await refresh()
  }
  catch (cause) {
    actionError.value = apiErrorMessage(cause, 'Не вдалося оновити статус бронювання.')
    toastNotification.error(actionError.value)
  }
  finally {
    pendingStatus.value = ''
  }
}

const updateSchedule = async (payload: BookingSchedulePayload) => {
  if (!selected.value || selected.value.status === 'completed') return
  if (!isAdmin.value) {
    actionError.value = 'Лише адміністратор може редагувати час або послуги бронювання.'
    toastNotification.warning(actionError.value)
    return
  }
  pendingSchedule.value = true
  actionError.value = ''
  try {
    const updated = await api.adminUpdateBookingSchedule(selected.value.id, payload)
    selected.value = { ...selected.value, ...updated }
    toastNotification.success('Час бронювання оновлено.')
    await refresh()
  }
  catch (cause) {
    actionError.value = apiErrorMessage(cause, 'Не вдалося оновити час бронювання.')
    toastNotification.error(actionError.value)
  }
  finally {
    pendingSchedule.value = false
  }
}

const updatePricing = async (payload: BookingPricingPayload) => {
  if (!selected.value) return
  if (!isAdmin.value) {
    actionError.value = 'Лише адміністратор може редагувати ціни та акцію бронювання.'
    toastNotification.warning(actionError.value)
    return
  }
  pendingPricing.value = true
  actionError.value = ''
  try {
    const updated = await api.adminUpdateBookingPricing(selected.value.id, payload)
    selected.value = { ...selected.value, ...updated }
    toastNotification.success('Ціни та акцію бронювання оновлено.')
    await refresh()
  }
  catch (cause) {
    actionError.value = apiErrorMessage(cause, 'Не вдалося оновити ціни та акцію бронювання.')
    toastNotification.error(actionError.value)
  }
  finally {
    pendingPricing.value = false
  }
}

const deleteSelectedBooking = async () => {
  if (!selected.value || selected.value.status === 'completed' || !canManageCalendarBooking(selected.value)) return
  pendingDelete.value = true
  actionError.value = ''
  try {
    if (isAdmin.value) {
      await api.adminDeleteBooking(selected.value.id)
    }
    else {
      await api.deleteMyBooking(selected.value.id)
    }
    selected.value = null
    toastNotification.success('Бронювання видалено.')
    await refresh()
  }
  catch (cause) {
    actionError.value = apiErrorMessage(cause, 'Не вдалося видалити бронювання.')
    toastNotification.error(actionError.value)
  }
  finally {
    pendingDelete.value = false
  }
}

const deleteSelectedBlock = async () => {
  if (!selectedBlock.value) return
  deletingBlock.value = true
  actionError.value = ''
  try {
    if (isAdmin.value) {
      await api.adminDeleteTimeBlock(selectedBlock.value.id)
    }
    else {
      await api.deleteMyTimeBlock(selectedBlock.value.id)
    }
    selectedBlock.value = null
    toastNotification.success('Блокування часу видалено.')
    await refresh()
  }
  catch (cause) {
    actionError.value = apiErrorMessage(cause, 'Не вдалося видалити блокування часу.')
    toastNotification.error(actionError.value)
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
        <p class="type-eyebrow ui-eyebrow text-xs md:text-sm">Календар</p>
        <h1 class="type-page-title mt-1 text-2xl text-ui-primary md:mt-2 md:text-3xl">Бронювання</h1>
      </div>
      <div v-if="!isAdmin" class="flex w-full flex-wrap gap-2 sm:w-auto md:gap-3">
        <NuxtLink to="/my-bookings" class="base-button base-button--neutral min-h-9 flex-1 px-3 py-2 text-xs sm:flex-none md:min-h-11 md:px-5 md:py-3 md:text-sm">
          Мої бронювання
        </NuxtLink>
      </div>
    </div>

    <BaseFilterPanel
      padding="sm"
      :active-count="activeFilterCount"
      mobile-title="Фільтри календаря"
      card-class="relative z-[140]"
      layout-class="booking-filter-layout"
      fields-class="!grid-cols-1 md:!contents"
      actions-class="booking-filter-actions"
      :loading="pending"
      @apply="applyFilters"
      @clear="clearFilters"
    >
      <div class="booking-filter-period">
        <BaseSegmentedControl
          :model-value="viewMode"
          :options="calendarViewOptions"
          aria-label="Режим календаря"
          container-class="booking-filter-modes grid grid-cols-3 gap-1 rounded-2xl bg-ui-subtle p-1"
          option-class="min-h-9 rounded-xl px-3 py-2 text-sm font-medium transition"
          @update:model-value="handleViewModeUpdate"
        />
        <div class="booking-filter-date">
          <BaseButton type="button" variant="icon" class="!h-11 !w-11" aria-label="Попередній період" title="Попередній період" @click="moveRange(-1)">
            <ChevronLeftIcon class="h-5 w-5" aria-hidden="true" />
          </BaseButton>
          <BaseCalendar v-model="anchorDate" label="Опорна дата" field-class="booking-filter-date-input min-w-0" input-class="w-full min-h-11 min-w-0 rounded-xl px-3 py-2 text-sm" />
          <BaseButton type="button" variant="icon" class="!h-11 !w-11" aria-label="Наступний період" title="Наступний період" @click="moveRange(1)">
            <ChevronRightIcon class="h-5 w-5" aria-hidden="true" />
          </BaseButton>
          <BaseButton type="button" variant="neutral" size="sm" class="!h-11 !min-h-11 !px-3 !py-2" @click="goToToday">Сьогодні</BaseButton>
        </div>
      </div>

      <MasterSelect
        v-if="isAdmin"
        v-model="filters.master_id"
        :masters="masterOptions"
        label="Майстер"
        all-label="Усі майстри"
        value-type="string"
        compact
        @update:model-value="filters.service_id = ''"
      />
      <BaseSelect v-model="filters.status" :options="statusFilterOptions" label="Статус">
        <template #selected="{ option, label }">
          <BookingStatusBadge v-if="option?.meta" :status="option.meta" />
          <span v-else>{{ label }}</span>
        </template>
        <template #option="{ option }">
          <BookingStatusBadge v-if="option.meta" :status="option.meta" />
          <span v-else>{{ option.label }}</span>
        </template>
      </BaseSelect>
      <BaseSelect v-model="filters.service_id" :options="bookingServiceFilterOptions" label="Послуга" />

      <template #summary>
        <div class="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-ui pt-3 text-xs text-ui-secondary">
          <p class="font-medium text-ui-primary">{{ anchorDate }} — {{ rangeEnd }}</p>
          <div class="flex flex-wrap gap-x-4 gap-y-1">
            <span>Бронювань: <strong class="font-semibold text-ui-primary">{{ visibleBookings.length }}</strong></span>
            <span>Блокувань: <strong class="font-semibold text-ui-primary">{{ visibleBlocks.length }}</strong></span>
            <span>Відкритих інтервалів: <strong class="font-semibold text-ui-primary">{{ availabilityWindows.length }}</strong></span>
          </div>
        </div>
      </template>
    </BaseFilterPanel>

    <div class="space-y-2 md:space-y-3">
      <p v-if="error" class="ui-status-danger rounded-xl px-3 py-2 text-xs md:rounded-2xl md:px-4 md:py-3 md:text-sm">
        {{ apiErrorMessage(error, 'Не вдалося завантажити календар бронювань.') }}
      </p>
      <BaseLoader v-if="pending" label="Завантаження календаря…" size="sm" />
      <BaseEmptyState
        v-else-if="!calendarEntries.length"
        compact
        title="У вибраному діапазоні немає бронювань, блокувань або утримань"
        description="Вільні слоти можна вибирати прямо в календарі."
      />
    </div>

    <BookingCalendarGrid
      :days="calendarDays"
      :slots-by-day="slotsByDay"
      :entries="calendarEntries"
      :busy-ranges="busyRanges"
      :availability-ranges="availabilityRanges"
      :selectable="canSelectSlots"
      :allow-past-selection="canSelectPastSlots"
      :loading="pending || actionPending"
      @select="openActionModal"
      @open-day="openDayAvailability"
      @entry-click="handleEntryClick"
    />

    <BaseCard as="section" padding="none">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-ui px-3 py-2 md:gap-3 md:px-4 md:py-3">
        <div>
          <h2 class="text-base font-semibold text-ui-primary md:text-lg">Список бронювань</h2>
          <p class="mt-0.5 text-xs text-ui-muted md:mt-1 md:text-sm">Поточний діапазон: {{ anchorDate }} - {{ rangeEnd }} · Total: {{ total }}</p>
        </div>
      </div>
      <BaseEmptyState v-if="!visibleBookings.length" compact title="Бронювань за цими фільтрами немає" />
      <div v-else class="divide-y divide-ui">
        <article v-for="booking in visibleBookings" :key="booking.id" class="grid gap-2 px-3 py-2 text-left md:grid-cols-[160px_1fr_auto] md:items-center md:gap-3 md:px-4 md:py-3">
          <div class="min-w-0 md:min-w-max">
            <p class="truncate text-sm font-semibold text-ui-primary md:text-base">{{ formatTime(bookingStart(booking)) }} - {{ formatTime(bookingEnd(booking)) }}</p>
            <p class="truncate text-[0.68rem] text-ui-muted md:text-xs">{{ formatDateTime(bookingStart(booking)) }}</p>
          </div>
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-ui-primary md:text-base">{{ customerName(booking) }} · {{ bookingPhone(booking) || 'Без телефону' }}</p>
            <p class="mt-0.5 truncate text-xs text-ui-muted md:mt-1 md:text-sm">
              {{ bookingListMeta(booking) }}
            </p>
          </div>
          <div class="flex items-center justify-start gap-2 md:flex-wrap md:justify-end md:gap-3">
            <BookingStatusBadge :status="booking.status" />
            <BaseBadge
              v-if="isRedirectedBooking(booking)"
              tone="warning"
              class="h-7 px-2 text-[0.68rem] uppercase tracking-[0.12em] md:h-8"
            >
              Редирект
            </BaseBadge>
            <BaseButton
              variant="icon"
              class="h-7 w-7 shrink-0 md:h-8 md:w-8"
              aria-label="Переглянути бронювання"
              title="Переглянути"
              @click="selected = booking"
            >
              <EyeIcon class="h-3.5 w-3.5 md:h-4 md:w-4" aria-hidden="true" />
              <span class="sr-only">Переглянути</span>
            </BaseButton>
          </div>
        </article>
      </div>
    </BaseCard>

    <BookingDetailsModal
      :booking="selected"
      :allowed-statuses="allowedStatusActions(selected)"
      :pending-status="pendingStatus"
      :pending-schedule="pendingSchedule"
      :pending-pricing="pendingPricing"
      :pending-delete="pendingDelete"
      :can-edit="Boolean(selected && selected.status !== 'completed' && isAdmin)"
      :can-edit-pricing="isAdmin"
      :can-delete="Boolean(selected && selected.status !== 'completed' && canManageCalendarBooking(selected))"
      :masters="masterOptions"
      :services="serviceOptions"
      :promotions="activePromotions"
      @close="selected = null"
      @update-status="updateStatus"
      @update-schedule="updateSchedule"
      @update-pricing="updatePricing"
      @delete="deleteSelectedBooking"
    />

    <BookingCalendarActionModal
      v-model="actionModalOpen"
      :selection="selectedSelection"
      :services="bookingServiceOptions"
      :promotions="activePromotions"
      :can-use-promotions="isAdmin"
      :master-name="selectedMasterLabel"
      :default-action="selectedDefaultAction"
      :pending="actionPending"
      @submit="submitCalendarAction"
    />

    <BaseModal :model-value="Boolean(selectedBlock)" max-width-class="max-w-xl" @update:model-value="selectedBlock = null">
      <template #head="{ close }">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="ui-eyebrow text-sm uppercase tracking-[0.25em]">Блокування</p>
            <h2 class="mt-2 text-2xl font-semibold text-ui-primary">Недоступний час</h2>
          </div>
          <ModalCloseButton @click="close" />
        </div>
      </template>
      <template #body>
        <div v-if="selectedBlock" class="space-y-4">
          <BaseCard variant="subtle" padding="sm" class="rounded-2xl">
            <p class="font-medium text-ui-primary">{{ formatDateTime(selectedBlock.start_at) }} - {{ formatDateTime(selectedBlock.end_at) }}</p>
            <p class="mt-1 text-sm text-ui-muted">{{ selectedBlock.reason || 'Без причини' }}</p>
          </BaseCard>
          <div class="backoffice-modal-actions">
            <BaseButton
              type="button"
              variant="danger"
              :loading="deletingBlock"
              :disabled="deletingBlock"
              @click="deleteSelectedBlock"
            >
              <TrashIcon class="h-4 w-4" aria-hidden="true" />
              {{ deletingBlock ? 'Видалення...' : 'Видалити блокування' }}
            </BaseButton>
          </div>
        </div>
      </template>
    </BaseModal>
  </div>
</template>


<style scoped>
:deep(.booking-filter-layout) {
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  align-items: end;
}

.booking-filter-period {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.5rem;
}

.booking-filter-modes {
  width: 100%;
}

.booking-filter-date {
  display: grid;
  grid-template-columns: 2.75rem minmax(0, 1fr) 2.75rem auto;
  align-items: center;
  gap: 0.375rem;
  width: 100%;
}

/* Keep the date label available without adding a second toolbar baseline. */
:deep(.booking-filter-date-input > .base-field__label) {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

@media (min-width: 768px) {
  :deep(.booking-filter-layout) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .booking-filter-modes {
    width: 18rem;
  }

  .booking-filter-date {
    width: 23rem;
  }

  :deep(.booking-filter-actions) {
    grid-column: 1 / -1;
    justify-content: flex-end;
  }
}

@media (min-width: 1536px) {
  :deep(.booking-filter-layout) {
    grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
  }

  :deep(.booking-filter-actions) {
    grid-column: auto;
  }
}
</style>
