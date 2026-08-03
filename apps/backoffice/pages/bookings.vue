<script setup lang="ts">
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  EyeIcon,
  ScissorsIcon,
  UserCircleIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'
import { initials } from '@shared-utils'
import type {
  Booking,
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
const auth = useAuthStore()
const assetUrl = useAssetUrl()
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
  bookingRedirectSourceLabel,
  isRedirectedBooking,
  serviceName,
  bookingServiceIds,
  bookingServicesLabel,
  formatDateTime,
  formatTime,
  toKyivIso,
  normalizeItems,
  normalizeTotal,
  apiErrorMessage,
} = useBookingFormatting()

const pageSize = 200
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
const masterFilterOpen = ref(false)
const serviceFilterOpen = ref(false)
const statusFilterOpen = ref(false)
const masterFilterRef = ref<HTMLElement | null>(null)
const serviceFilterRef = ref<HTMLElement | null>(null)
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
const selectedStatusFilter = computed(() =>
  bookingFilterStatuses.includes(filters.status as BookingStatus) ? filters.status as BookingStatus : '',
)

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
      service_id: filters.service_id ? Number(filters.service_id) : null,
      status: filters.status as BookingStatus | '',
    }
    const availabilityFilters = {
      date_from: toKyivIso(anchorDate.value, calendar.workdayStart),
      date_to: toKyivIso(rangeEnd.value, calendar.workdayEnd),
      master_id: masterId,
    }

    if (isAdmin.value) {
      const [bookings, timeBlocks, availability] = await Promise.all([
        api.adminGetBookings(1, pageSize, bookingFilters),
        api.adminGetTimeBlocks(1, pageSize, {
          date_from: queryDateFrom.value,
          date_to: queryDateTo.value,
          master_id: masterId,
        }),
        masterId ? api.adminGetAvailability(availabilityFilters) : Promise.resolve([] as MasterAvailabilityWindow[]),
      ])
      return { bookings, timeBlocks, availability }
    }

    const [bookings, timeBlocks, availability] = await Promise.all([
      api.getMyBookings({
        date_from: queryDateFrom.value,
        date_to: queryDateTo.value,
        status: filters.status as BookingStatus | '',
      }),
      api.getMyTimeBlocks({
        date_from: queryDateFrom.value,
        date_to: queryDateTo.value,
      }),
      api.getMyAvailability(availabilityFilters),
    ])
    return { bookings, timeBlocks, availability }
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
const availabilityWindows = computed<MasterAvailabilityWindow[]>(() => data.value?.availability || [])

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
const availabilityRanges = computed(() => selectedMasterId.value ? calendar.buildAvailabilityRanges(availabilityWindows.value) : [])
const calendarEntries = computed(() => calendar.buildDisplayEntries(activeBookings.value, visibleBlocks.value, serviceOptions.value))
const total = computed(() => normalizeTotal(data.value?.bookings))

const bookingServiceOptions = computed(() => {
  if (!selectedMasterId.value) return serviceOptions.value
  return serviceOptions.value.filter(service => !service.barber_id || Number(service.barber_id) === selectedMasterId.value)
})
const selectedServiceFilter = computed(() =>
  filters.service_id ? bookingServiceOptions.value.find(service => service.id === Number(filters.service_id)) || null : null,
)
const masterImageUrl = (master: Master) =>
  assetUrl(master.avatar || master.avatar_url || master.photo || master.photo_url)
const masterInitials = (master: Master) => initials(masterName(master)) || 'SC'

const resolveMaster = (booking: Booking) =>
  booking.master || booking.barber || masterOptions.value.find(master => master.id === booking.master_id) || null
const bookingListMeta = (booking: Booking) =>
  [bookingServicesLabel(booking, serviceOptions.value), masterName(resolveMaster(booking)), bookingRedirectSourceLabel(booking), bookingComment(booking) || 'Без коментаря']
    .filter(Boolean)
    .join(' · ')

const allowedStatusActions = (booking: Booking | null) =>
  !booking || booking.status === 'completed' || !canManageBooking(booking.master_id)
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

const applyFilters = async () => {
  actionError.value = ''
  masterFilterOpen.value = false
  serviceFilterOpen.value = false
  statusFilterOpen.value = false
  await refresh()
}

const clearFilters = async () => {
  filters.master_id = !isAdmin.value && linkedMaster.value ? String(linkedMaster.value.id) : ''
  filters.service_id = ''
  filters.status = ''
  masterFilterOpen.value = false
  serviceFilterOpen.value = false
  statusFilterOpen.value = false
  anchorDate.value = todayInput()
  viewMode.value = 'week'
  await refresh()
}

const selectMasterFilter = (masterId: string) => {
  filters.master_id = masterId
  filters.service_id = ''
  masterFilterOpen.value = false
}

const selectServiceFilter = (serviceId: string) => {
  filters.service_id = serviceId
  serviceFilterOpen.value = false
}

const selectStatusFilter = (status: BookingStatus | '') => {
  filters.status = status
  statusFilterOpen.value = false
}

const handleFilterClickOutside = (event: MouseEvent) => {
  const target = event.target
  if (!(target instanceof Node)) return
  if (masterFilterOpen.value && !masterFilterRef.value?.contains(target)) {
    masterFilterOpen.value = false
  }
  if (serviceFilterOpen.value && !serviceFilterRef.value?.contains(target)) {
    serviceFilterOpen.value = false
  }
  if (statusFilterOpen.value && !statusFilterRef.value?.contains(target)) {
    statusFilterOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleFilterClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleFilterClickOutside)
})

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
  if (!selected.value || selected.value.status === 'completed' || !canManageBooking(selected.value.master_id)) return
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

    <BaseCard as="section" padding="sm" class="relative z-[140] space-y-3 md:space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2 md:gap-3">
        <BaseSegmentedControl
          :model-value="viewMode"
          :options="calendarViewOptions"
          aria-label="Режим календаря"
          container-class="grid grid-cols-3 gap-1 rounded-2xl bg-ui-subtle p-1"
          option-class="min-h-8 rounded-xl px-2 py-1.5 text-xs font-medium transition md:min-h-10 md:px-3 md:py-2 md:text-sm"
          @update:model-value="handleViewModeUpdate"
        />

        <div class="grid w-full grid-cols-[2.25rem_minmax(0,1fr)_auto_2.25rem] items-center gap-1.5 sm:w-auto md:flex md:flex-wrap md:gap-2">
          <BaseButton
            type="button"
            variant="icon"
            class="h-9 w-9 md:h-10 md:w-10"
            aria-label="Попередній період"
            title="Попередній період"
            @click="moveRange(-1)"
          >
            <ChevronLeftIcon class="h-4 w-4 md:h-5 md:w-5" aria-hidden="true" />
          </BaseButton>
          <BaseCalendar v-model="anchorDate" class="base-control min-h-9 min-w-0 rounded-xl px-2 py-1.5 text-xs md:min-h-10 md:rounded-2xl md:px-3 md:py-2 md:text-sm" />
          <BaseButton type="button" variant="neutral" size="sm" @click="goToToday">
            Сьогодні
          </BaseButton>
          <BaseButton
            type="button"
            variant="icon"
            class="h-9 w-9 md:h-10 md:w-10"
            aria-label="Наступний період"
            title="Наступний період"
            @click="moveRange(1)"
          >
            <ChevronRightIcon class="h-4 w-4 md:h-5 md:w-5" aria-hidden="true" />
          </BaseButton>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2 md:grid-cols-2 md:gap-3 xl:grid-cols-5">
        <div v-if="isAdmin" ref="masterFilterRef" class="relative min-w-0 space-y-1 text-xs text-ui-secondary md:space-y-2 md:text-sm">
          <span class="inline-flex items-center gap-1.5 font-medium">
            <UserCircleIcon class="h-4 w-4 text-ui-muted" aria-hidden="true" />
            Майстер
          </span>
          <BaseButton
            type="button"
            class="base-control flex min-h-9 w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-xl px-2.5 py-2 text-left text-sm md:min-h-12 md:rounded-2xl md:px-4 md:py-3"
            :aria-expanded="masterFilterOpen"
            @click="masterFilterOpen = !masterFilterOpen"
          >
            <span class="flex min-w-0 items-center gap-2">
              <span v-if="selectedMaster" class="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ui bg-ui-subtle text-[0.65rem] font-semibold text-ui-secondary">
                <img v-if="masterImageUrl(selectedMaster)" :src="masterImageUrl(selectedMaster)" :alt="masterName(selectedMaster)" class="h-full w-full object-cover">
                <span v-else>{{ masterInitials(selectedMaster) }}</span>
              </span>
              <span class="min-w-0 truncate" :class="selectedMaster ? 'text-ui-primary' : 'text-ui-muted'">
                {{ selectedMaster ? masterName(selectedMaster) : 'Усі майстри' }}
              </span>
            </span>
            <ChevronDownIcon class="h-4 w-4 shrink-0 text-ui-muted transition" :class="masterFilterOpen ? 'rotate-180' : ''" aria-hidden="true" />
          </BaseButton>
          <div
            v-if="masterFilterOpen"
            class="booking-select-menu base-select__menu absolute z-[180] mt-1 max-h-72 w-full min-w-0 overflow-y-auto rounded-xl p-1 md:rounded-2xl"
          >
            <BaseButton
              type="button"
              class="base-select__option flex w-full min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition"
              :class="!filters.master_id ? 'is-selected' : ''"
              @click="selectMasterFilter('')"
            >
              <span class="h-7 w-7 shrink-0 rounded-full border border-ui bg-ui-subtle" />
              <span class="min-w-0 truncate">Усі майстри</span>
            </BaseButton>
            <BaseButton
              v-for="master in masterOptions"
              :key="master.id"
              type="button"
              class="base-select__option flex w-full min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition"
              :class="filters.master_id === String(master.id) ? 'is-selected' : ''"
              @click="selectMasterFilter(String(master.id))"
            >
              <span class="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ui bg-ui-subtle text-[0.65rem] font-semibold text-ui-secondary">
                <img v-if="masterImageUrl(master)" :src="masterImageUrl(master)" :alt="masterName(master)" class="h-full w-full object-cover">
                <span v-else>{{ masterInitials(master) }}</span>
              </span>
              <span class="min-w-0 truncate">{{ masterName(master) }}</span>
            </BaseButton>
          </div>
        </div>

        <div ref="statusFilterRef" class="relative min-w-0 space-y-1 text-xs text-ui-secondary md:space-y-2 md:text-sm">
          <span class="inline-flex items-center gap-1.5 font-medium">
            <FunnelIcon class="h-4 w-4 text-ui-muted" aria-hidden="true" />
            Статус
          </span>
          <BaseButton
            type="button"
            class="base-control flex min-h-9 w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-xl px-2.5 py-2 text-left text-sm md:min-h-12 md:rounded-2xl md:px-4 md:py-3"
            :aria-expanded="statusFilterOpen"
            @click="statusFilterOpen = !statusFilterOpen"
          >
            <span class="min-w-0 overflow-hidden">
              <BookingStatusBadge v-if="selectedStatusFilter" :status="selectedStatusFilter" />
              <span v-else class="block truncate text-ui-muted">Будь-який статус</span>
            </span>
            <ChevronDownIcon class="h-4 w-4 shrink-0 text-ui-muted transition" :class="statusFilterOpen ? 'rotate-180' : ''" aria-hidden="true" />
          </BaseButton>
          <div
            v-if="statusFilterOpen"
            class="booking-select-menu booking-status-menu base-select__menu absolute z-[180] mt-1 w-full min-w-0 overflow-hidden rounded-xl p-1 md:rounded-2xl"
          >
            <BaseButton
              type="button"
              class="base-select__option flex w-full min-w-0 items-center rounded-lg px-2.5 py-2 text-left text-sm transition"
              :class="!selectedStatusFilter ? 'is-selected' : ''"
              @click="selectStatusFilter('')"
            >
              <span class="min-w-0 truncate">Будь-який статус</span>
            </BaseButton>
            <BaseButton
              v-for="status in bookingFilterStatuses"
              :key="status"
              type="button"
              class="base-select__option flex w-full min-w-0 items-center rounded-lg px-2.5 py-2 text-left transition"
              :class="selectedStatusFilter === status ? 'is-selected' : ''"
              @click="selectStatusFilter(status)"
            >
              <BookingStatusBadge :status="status" />
            </BaseButton>
          </div>
        </div>

        <div ref="serviceFilterRef" class="relative col-span-2 min-w-0 space-y-1 text-xs text-ui-secondary md:col-span-1 md:space-y-2 md:text-sm">
          <span class="inline-flex items-center gap-1.5 font-medium">
            <ScissorsIcon class="h-4 w-4 text-ui-muted" aria-hidden="true" />
            Послуга
          </span>
          <BaseButton
            type="button"
            class="base-control flex min-h-9 w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-xl px-2.5 py-2 text-left text-sm md:min-h-12 md:rounded-2xl md:px-4 md:py-3"
            :aria-expanded="serviceFilterOpen"
            @click="serviceFilterOpen = !serviceFilterOpen"
          >
            <span class="min-w-0 truncate" :class="selectedServiceFilter ? 'text-ui-primary' : 'text-ui-muted'">
              {{ selectedServiceFilter ? serviceName(selectedServiceFilter) : 'Усі послуги' }}
            </span>
            <ChevronDownIcon class="h-4 w-4 shrink-0 text-ui-muted transition" :class="serviceFilterOpen ? 'rotate-180' : ''" aria-hidden="true" />
          </BaseButton>
          <div
            v-if="serviceFilterOpen"
            class="booking-select-menu base-select__menu absolute z-[180] mt-1 max-h-72 w-full min-w-0 overflow-y-auto rounded-xl p-1 md:rounded-2xl"
          >
            <BaseButton
              type="button"
              class="base-select__option flex w-full min-w-0 items-center rounded-lg px-2.5 py-2 text-left text-sm transition"
              :class="!filters.service_id ? 'is-selected' : ''"
              @click="selectServiceFilter('')"
            >
              <span class="min-w-0 truncate">Усі послуги</span>
            </BaseButton>
            <BaseButton
              v-for="service in bookingServiceOptions"
              :key="service.id"
              type="button"
              class="base-select__option flex w-full min-w-0 items-center rounded-lg px-2.5 py-2 text-left text-sm transition"
              :class="filters.service_id === String(service.id) ? 'is-selected' : ''"
              @click="selectServiceFilter(String(service.id))"
            >
              <span class="min-w-0 truncate">{{ serviceName(service) }}</span>
            </BaseButton>
          </div>
        </div>

        <div class="order-last col-span-2 min-w-0 rounded-xl bg-ui-subtle px-3 py-2 text-xs text-ui-secondary md:col-span-2 md:rounded-2xl md:px-4 md:py-3 md:text-sm xl:col-span-5">
          <p class="font-medium text-ui-primary">{{ anchorDate }} - {{ rangeEnd }}</p>
          <p class="mt-0.5 md:mt-1">Бронювань: {{ visibleBookings.length }} · Блокувань: {{ visibleBlocks.length }} · Відкритих інтервалів: {{ availabilityWindows.length }}</p>
        </div>
        <div class="col-span-2 flex min-w-0 items-end gap-2 md:col-span-1 md:gap-3">
          <BaseButton type="button" variant="primary" class="flex-1" @click="applyFilters">
            <FunnelIcon class="h-4 w-4" aria-hidden="true" />
            <span class="truncate">Застосувати</span>
          </BaseButton>
          <BaseButton type="button" variant="neutral" class="flex-1" @click="clearFilters">
            <XMarkIcon class="h-4 w-4" aria-hidden="true" />
            <span class="truncate">Очистити</span>
          </BaseButton>
        </div>
      </div>
    </BaseCard>

    <div class="space-y-2 md:space-y-3">
      <p v-if="error" class="ui-status-danger rounded-xl px-3 py-2 text-xs md:rounded-2xl md:px-4 md:py-3 md:text-sm">
        {{ apiErrorMessage(error, 'Не вдалося завантажити календар бронювань.') }}
      </p>
      <BaseLoader v-if="pending" label="Завантаження календаря…" size="sm" />
      <BaseEmptyState
        v-else-if="!calendarEntries.length"
        compact
        title="У вибраному діапазоні немає бронювань або блокувань"
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
      :can-delete="Boolean(selected && selected.status !== 'completed' && canManageBooking(selected.master_id))"
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
