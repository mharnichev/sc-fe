<script setup lang="ts">
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LockOpenIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'
import { initials } from '@shared-utils'
import type {
  Booking,
  Master,
  MasterAvailabilityWindow,
  Service,
  TimeBlock,
} from '~/composables/useBackofficeApi'

interface CalendarDayColumn {
  date: string
  dayNumber: number
  weekday: string
  isToday: boolean
}

interface ScheduleEntry<T> {
  item: T
  label: string
}

interface MasterDaySchedule {
  availability: ScheduleEntry<MasterAvailabilityWindow>[]
  blocks: ScheduleEntry<TimeBlock>[]
}

interface MasterScheduleCell {
  day: CalendarDayColumn
  schedule: MasterDaySchedule
}

interface MasterScheduleRow {
  stat: MasterMonthStat
  cells: MasterScheduleCell[]
}

interface SelectedScheduleItem {
  master: Master
  date: string
  startAt: string
  endAt: string
  kind: 'availability' | 'block'
  reason?: string | null
}

interface TimeRange {
  start: number
  end: number
}

interface MasterPresentation {
  master: Master
  displayName: string
  imageUrl: string
  initials: string
  position: string
}

interface MasterMonthStat extends MasterPresentation {
  workDays: number
  scheduledMinutes: number
  bookedMinutes: number
  blockedMinutes: number
  capacityMinutes: number
  freeMinutes: number
  loadPercent: number
}

interface MasterMonthData {
  availability: MasterAvailabilityWindow[]
  blocks: TimeBlock[]
  bookings: Booking[]
  workDates: Set<string>
}

interface CalendarDataIndex {
  schedules: Record<string, MasterDaySchedule>
  byMaster: Map<number, MasterMonthData>
}

const api = useBackofficeApi()
const assetUrl = useAssetUrl()
const auth = useAuthStore()
const toast = useBaseToastNotification()
const {
  todayInput,
  addDaysInput,
  formatTime,
  bookingStart,
  bookingEnd,
  bookingServiceIds,
  bookingRedirectMasterId,
  redirectedFromMasterId,
  masterName,
  normalizeItems,
  apiErrorMessage,
  toKyivIso,
} = useBookingFormatting()
const calendar = useBookingCalendar()

const isAdmin = computed(() => Boolean(auth.user?.is_superuser || auth.user?.role === 'admin'))
const today = todayInput()
const anchorDate = ref(`${today.slice(0, 7)}-01`)
const masterFilterId = ref('')
const selectedMasterId = computed(() => masterFilterId.value ? Number(masterFilterId.value) : null)

const pad = (value: number) => String(value).padStart(2, '0')
const dateInput = (year: number, monthIndex: number, day: number) =>
  `${year}-${pad(monthIndex + 1)}-${pad(day)}`

const monthStart = computed(() => `${anchorDate.value.slice(0, 7)}-01`)
const monthEnd = computed(() => {
  const [year, month] = monthStart.value.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, month, 0, 12)).getUTCDate()
  return `${year}-${pad(month)}-${pad(lastDay)}`
})
const monthFormatter = new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric' })
const monthLabel = computed(() => {
  const [year, month] = monthStart.value.split('-').map(Number)
  return monthFormatter.format(new Date(Date.UTC(year, month - 1, 1, 12)))
})
const weekdayFormatter = new Intl.DateTimeFormat('uk-UA', { weekday: 'short', timeZone: 'Europe/Kyiv' })
const selectedDayFormatter = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', timeZone: 'Europe/Kyiv' })
const monthRangeLabel = computed(() => `${monthStart.value} — ${monthEnd.value}`)

const addMonthsInput = (date: string, offset: number) => {
  const [year, month] = date.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1 + offset, 1, 12))
  return dateInput(next.getUTCFullYear(), next.getUTCMonth(), 1)
}

const moveMonth = (offset: -1 | 1) => {
  anchorDate.value = addMonthsInput(monthStart.value, offset)
}

const goToCurrentMonth = () => {
  anchorDate.value = `${todayInput().slice(0, 7)}-01`
}

const [{ data, pending, error, refresh }, { data: masters }, { data: services }] = await Promise.all([
  useAsyncData(
    'admin-time-blocks-month',
    async () => {
      const range = {
        date_from: toKyivIso(monthStart.value, '00:00'),
        date_to: toKyivIso(addDaysInput(monthEnd.value, 1), '00:00'),
        master_id: selectedMasterId.value,
      }
      const availabilityRange = {
        date_from: toKyivIso(monthStart.value, calendar.workdayStart),
        date_to: toKyivIso(monthEnd.value, calendar.workdayEnd),
        master_id: selectedMasterId.value,
      }
      const [timeBlocks, availability, bookings] = await Promise.all([
        api.adminGetCalendarTimeBlocks(range),
        api.adminGetAvailability(availabilityRange),
        api.adminGetCalendarBookings(range),
      ])
      return { timeBlocks, availability, bookings }
    },
    { watch: [monthStart, selectedMasterId] },
  ),
  useAsyncData('time-block-master-options', () => api.adminGetMasters(1, 200)),
  useAsyncData('time-block-service-options', () => api.getServices()),
])

const blocks = computed<TimeBlock[]>(() => normalizeItems(data.value?.timeBlocks))
const availabilityWindows = computed<MasterAvailabilityWindow[]>(() => normalizeItems(data.value?.availability))
const bookings = computed<Booking[]>(() => normalizeItems(data.value?.bookings))
const masterOptions = computed<Master[]>(() => normalizeItems(masters.value))
const serviceOptions = computed<Service[]>(() => normalizeItems(services.value))
const servicesById = computed(() => new Map(serviceOptions.value.map(service => [Number(service.id), service])))
const selectedMaster = computed(() => masterOptions.value.find(master => master.id === selectedMasterId.value) || null)
const deletingId = ref<number | null>(null)
const deletingAvailabilityId = ref<number | null>(null)
const timeBlockModalOpen = ref(false)
const availabilityModalOpen = ref(false)
const availabilityToDelete = ref<MasterAvailabilityWindow | null>(null)
const masterFilterOpen = ref(false)
const masterFilterRef = ref<HTMLElement | null>(null)
const selectedScheduleItem = ref<SelectedScheduleItem | null>(null)

const masterDisplayName = (master?: Master | null) => {
  if (!master) return 'Усі майстри'
  const firstName = master.first_name_uk || ''
  const lastName = master.last_name_uk || master.last_name || ''
  return [lastName, firstName].filter(Boolean).join(' ') || master.full_name_uk || master.full_name || master.name || masterName(master)
}

const masterImageUrl = (master?: Master | null) =>
  master ? assetUrl(master.avatar || master.avatar_url || master.photo || master.photo_url) : ''

const masterInitials = (master?: Master | null) => initials(masterDisplayName(master)) || 'SC'

const masterPresentations = computed<MasterPresentation[]>(() => masterOptions.value.map(master => {
  const displayName = masterDisplayName(master)
  return {
    master,
    displayName,
    imageUrl: masterImageUrl(master),
    initials: initials(displayName) || 'SC',
    position: master.position_uk || 'Майстер',
  }
}))

const selectMasterFilter = (masterId: string) => {
  masterFilterId.value = masterId
  masterFilterOpen.value = false
}

const monthDays = computed<CalendarDayColumn[]>(() => {
  const [year, month] = monthStart.value.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, month, 0, 12)).getUTCDate()
  return Array.from({ length: lastDay }, (_, index) => {
    const date = addDaysInput(monthStart.value, index)
    return {
      date,
      dayNumber: Number(date.slice(8, 10)),
      weekday: weekdayFormatter.format(new Date(toKyivIso(date, '12:00'))).replace('.', ''),
      isToday: date === today,
    }
  })
})

const intervalLabel = (startAt: string, endAt: string) => `${formatTime(startAt)}–${formatTime(endAt)}`

const calendarDataIndex = computed<CalendarDataIndex>(() => {
  const schedules: Record<string, MasterDaySchedule> = {}
  const byMaster = new Map<number, MasterMonthData>()
  const ensureSchedule = (masterId: number, date: string) => {
    const key = `${masterId}:${date}`
    schedules[key] ||= { availability: [], blocks: [] }
    return schedules[key]
  }
  const dataForMaster = (masterId: number) => {
    let masterData = byMaster.get(masterId)
    if (!masterData) {
      masterData = { availability: [], blocks: [], bookings: [], workDates: new Set<string>() }
      byMaster.set(masterId, masterData)
    }
    return masterData
  }

  for (const window of availabilityWindows.value) {
    const masterData = dataForMaster(window.master_id)
    masterData.availability.push(window)
    const date = calendar.dateInputFromDateTime(window.start_at)
    if (date) {
      masterData.workDates.add(date)
      ensureSchedule(window.master_id, date).availability.push({
        item: window,
        label: intervalLabel(window.start_at, window.end_at),
      })
    }
  }
  for (const block of blocks.value) {
    dataForMaster(block.master_id).blocks.push(block)
    const date = calendar.dateInputFromDateTime(block.start_at)
    if (date) {
      ensureSchedule(block.master_id, date).blocks.push({
        item: block,
        label: intervalLabel(block.start_at, block.end_at),
      })
    }
  }
  for (const booking of bookings.value) {
    const ownerMasterId = redirectedFromMasterId(booking) ?? booking.master_id
    if (booking.status !== 'cancelled' && ownerMasterId != null) {
      dataForMaster(ownerMasterId).bookings.push(booking)
    }
  }

  for (const schedule of Object.values(schedules)) {
    schedule.availability.sort((first, second) => first.item.start_at.localeCompare(second.item.start_at))
    schedule.blocks.sort((first, second) => first.item.start_at.localeCompare(second.item.start_at))
  }
  return { schedules, byMaster }
})

const emptyDaySchedule: MasterDaySchedule = { availability: [], blocks: [] }

const selectSchedule = (
  master: Master,
  date: string,
  item: MasterAvailabilityWindow | TimeBlock,
  kind: SelectedScheduleItem['kind'],
) => {
  selectedScheduleItem.value = {
    master,
    date,
    startAt: item.start_at,
    endAt: item.end_at,
    kind,
    reason: 'reason' in item ? item.reason : null,
  }
}

const selectedScheduleLabel = computed(() => {
  const selected = selectedScheduleItem.value
  if (!selected) return 'Натисніть робочий інтервал або блокування в таблиці.'
  const kindLabel = selected.kind === 'block' ? selected.reason || 'блокування' : 'робочий час'
  const dateLabel = selectedDayFormatter.format(new Date(toKyivIso(selected.date, '12:00')))
  return `${dateLabel} · ${masterDisplayName(selected.master)} · ${intervalLabel(selected.startAt, selected.endAt)} · ${kindLabel}`
})

watch([monthStart, selectedMasterId], () => {
  selectedScheduleItem.value = null
})

const timestamp = (value?: string | null) => {
  const time = value ? new Date(value).getTime() : Number.NaN
  return Number.isFinite(time) ? time : null
}

const mergeRanges = (ranges: TimeRange[]) => {
  const sorted = ranges
    .filter(range => range.end > range.start)
    .sort((first, second) => first.start - second.start)
  if (!sorted.length) return []

  const merged: TimeRange[] = []
  let current = { ...sorted[0] }
  for (const range of sorted.slice(1)) {
    if (range.start <= current.end) {
      current.end = Math.max(current.end, range.end)
      continue
    }
    merged.push(current)
    current = { ...range }
  }
  merged.push(current)
  return merged
}

const minutesInRanges = (ranges: TimeRange[]) =>
  Math.round(ranges.reduce((total, range) => total + range.end - range.start, 0) / 60000)

const rangesFromItems = (items: Array<{ start_at?: string, end_at?: string }>) =>
  items.map(item => ({ start: timestamp(item.start_at), end: timestamp(item.end_at) }))
    .filter((range): range is TimeRange => range.start != null && range.end != null && range.end > range.start)

const serviceDurationMinutes = (booking: Booking) => {
  const ids = bookingServiceIds(booking)
  const duration = ids.reduce((total, id) => total + Number(servicesById.value.get(id)?.duration_minutes || 0), 0)
  return duration || Number(booking.service?.duration_minutes || 30)
}

const bookingRange = (booking: Booking): TimeRange | null => {
  const start = timestamp(bookingStart(booking))
  if (start == null || booking.status === 'cancelled') return null
  const explicitEnd = timestamp(bookingEnd(booking))
  return { start, end: explicitEnd && explicitEnd > start ? explicitEnd : start + serviceDurationMinutes(booking) * 60000 }
}

const overlapMinutes = (firstRanges: TimeRange[], secondRanges: TimeRange[]) => {
  let firstIndex = 0
  let secondIndex = 0
  let overlapMilliseconds = 0

  while (firstIndex < firstRanges.length && secondIndex < secondRanges.length) {
    const first = firstRanges[firstIndex]
    const second = secondRanges[secondIndex]
    overlapMilliseconds += Math.max(0, Math.min(first.end, second.end) - Math.max(first.start, second.start))

    if (first.end <= second.end) firstIndex += 1
    else secondIndex += 1
  }
  return Math.round(overlapMilliseconds / 60000)
}

const formatHours = (minutes: number) => {
  const hours = minutes / 60
  return Number.isInteger(hours)
    ? `${hours.toLocaleString('uk-UA')} год`
    : `${hours.toLocaleString('uk-UA', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} год`
}

const visibleMasterPresentations = computed(() => selectedMasterId.value != null
  ? masterPresentations.value.filter(presentation => presentation.master.id === selectedMasterId.value)
  : masterPresentations.value.filter(presentation => presentation.master.is_active !== false))

const calendarMasterId = (master: Master) => bookingRedirectMasterId(master) ?? master.id

const masterStats = computed<MasterMonthStat[]>(() => {
  return visibleMasterPresentations.value.map((presentation) => {
    const { master } = presentation
    const calendarMasterData = calendarDataIndex.value.byMaster.get(calendarMasterId(master))
    const bookingMasterData = calendarDataIndex.value.byMaster.get(master.id)
    const masterAvailability = calendarMasterData?.availability || []
    const availabilityRanges = mergeRanges(rangesFromItems(masterAvailability))
    const blockRanges = mergeRanges(rangesFromItems(calendarMasterData?.blocks || []))
    const bookingRanges = mergeRanges((bookingMasterData?.bookings || []).map(bookingRange).filter((range): range is TimeRange => Boolean(range)))
    const scheduledMinutes = minutesInRanges(availabilityRanges)
    const blockedMinutes = overlapMinutes(availabilityRanges, blockRanges)
    const capacityMinutes = Math.max(0, scheduledMinutes - blockedMinutes)
    const bookedMinutes = minutesInRanges(bookingRanges)
    const workDays = calendarMasterData?.workDates.size || 0
    const loadPercent = capacityMinutes ? Math.round((bookedMinutes / capacityMinutes) * 100) : bookedMinutes ? 100 : 0

    return {
      ...presentation,
      workDays,
      scheduledMinutes,
      bookedMinutes,
      blockedMinutes,
      capacityMinutes,
      freeMinutes: Math.max(0, capacityMinutes - bookedMinutes),
      loadPercent,
    }
  }).sort((first, second) => {
    if (second.loadPercent !== first.loadPercent) return second.loadPercent - first.loadPercent
    return first.displayName.localeCompare(second.displayName, 'uk')
  })
})

const scheduleRows = computed<MasterScheduleRow[]>(() => masterStats.value.map(stat => ({
  stat,
  cells: monthDays.value.map(day => ({
    day,
    schedule: calendarDataIndex.value.schedules[`${calendarMasterId(stat.master)}:${day.date}`] || emptyDaySchedule,
  })),
})))

const totalScheduledMinutes = computed(() => masterStats.value.reduce((total, stat) => total + stat.scheduledMinutes, 0))
const totalBookedMinutes = computed(() => masterStats.value.reduce((total, stat) => total + stat.bookedMinutes, 0))

const openCreateBlock = () => {
  timeBlockModalOpen.value = true
}

const openCreateAvailability = () => {
  availabilityModalOpen.value = true
}

const handleSaved = async (message: string) => {
  toast.success(message)
  await refresh()
}

const availabilityDeleteContextItems = computed(() => {
  const window = availabilityToDelete.value
  if (!window) return []
  const master = window.master || masterOptions.value.find(option => option.id === window.master_id)
  return [
    { label: 'Майстер', value: masterDisplayName(master) },
    { label: 'Дата', value: selectedDayFormatter.format(new Date(window.start_at)) },
    { label: 'Робочий час', value: intervalLabel(window.start_at, window.end_at) },
  ]
})

const openDeleteAvailabilityConfirm = (window: MasterAvailabilityWindow) => {
  if (!isAdmin.value || deletingAvailabilityId.value != null) return
  availabilityToDelete.value = window
}

const handleAvailabilityDeleteConfirmUpdate = (value: boolean) => {
  if (!value && deletingAvailabilityId.value == null) availabilityToDelete.value = null
}

const deleteBlock = async (block: TimeBlock) => {
  if (!confirm(`Видалити блокування ${intervalLabel(block.start_at, block.end_at)}?`)) return
  deletingId.value = block.id
  try {
    await api.adminDeleteTimeBlock(block.id)
    toast.success('Блокування часу видалено.')
    await refresh()
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося видалити блокування часу.'))
  }
  finally {
    deletingId.value = null
  }
}

const confirmDeleteAvailability = async () => {
  const window = availabilityToDelete.value
  if (!window || deletingAvailabilityId.value != null) return
  deletingAvailabilityId.value = window.id
  try {
    await api.adminDeleteAvailabilityWindow(window.id)
    toast.success('Робочий інтервал видалено.')
    availabilityToDelete.value = null
    await refresh()
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося видалити робочий інтервал.'))
  }
  finally {
    deletingAvailabilityId.value = null
  }
}

const closeMasterFilterOnOutsideClick = (event: MouseEvent) => {
  const target = event.target
  if (!(target instanceof Node) || masterFilterRef.value?.contains(target)) return
  masterFilterOpen.value = false
}

onMounted(() => document.addEventListener('click', closeMasterFilterOnOutsideClick))
onBeforeUnmount(() => document.removeEventListener('click', closeMasterFilterOnOutsideClick))
</script>

<template>
  <div class="space-y-4 md:space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3 md:gap-4">
      <div>
        <p class="type-eyebrow ui-eyebrow text-xs md:text-sm">Календар</p>
        <h1 class="type-page-title mt-1 text-2xl text-ui-primary md:mt-2 md:text-3xl">Графік майстрів</h1>
        <p class="mt-1 text-sm text-ui-muted">Робочі дні, години та місячна завантаженість команди.</p>
      </div>
      <div class="flex w-full gap-2 sm:w-auto">
        <BaseButton
          type="button"
          variant="success"
          size="lg"
          class="flex-1 sm:flex-none"
          :disabled="!isAdmin"
          @click="openCreateAvailability"
        >
          <LockOpenIcon class="h-4 w-4" aria-hidden="true" />
          Відкрити час
        </BaseButton>
        <BaseButton
          type="button"
          variant="create"
          size="lg"
          class="flex-1 sm:flex-none"
          :disabled="!isAdmin"
          @click="openCreateBlock"
        >
          <PlusIcon class="h-4 w-4" aria-hidden="true" />
          Блокування
        </BaseButton>
      </div>
    </div>

    <p v-if="!isAdmin" class="ui-status-warning rounded-2xl px-4 py-3 text-sm">
      Для керування графіком майстрів потрібен доступ адміністратора.
    </p>

    <BaseCard as="section" padding="sm" class="relative z-30 space-y-3 md:space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="grid w-full grid-cols-[2.25rem_minmax(0,1fr)_auto_2.25rem] items-center gap-1.5 sm:w-auto md:flex md:gap-2">
          <BaseButton type="button" variant="icon" class="h-9 w-9" aria-label="Попередній місяць" title="Попередній місяць" @click="moveMonth(-1)">
            <ChevronLeftIcon class="h-5 w-5" aria-hidden="true" />
          </BaseButton>
          <p class="min-w-0 text-center text-base font-semibold capitalize text-ui-primary md:min-w-48 md:text-left md:text-lg">{{ monthLabel }}</p>
          <BaseButton type="button" variant="neutral" size="sm" @click="goToCurrentMonth">Цей місяць</BaseButton>
          <BaseButton type="button" variant="icon" class="h-9 w-9" aria-label="Наступний місяць" title="Наступний місяць" @click="moveMonth(1)">
            <ChevronRightIcon class="h-5 w-5" aria-hidden="true" />
          </BaseButton>
        </div>

        <div ref="masterFilterRef" class="relative w-full sm:w-72">
          <BaseButton
            type="button"
            class="base-control flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left text-sm"
            :aria-expanded="masterFilterOpen"
            aria-haspopup="listbox"
            @click="masterFilterOpen = !masterFilterOpen"
          >
            <span class="flex min-w-0 items-center gap-2">
              <span class="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ui bg-ui-subtle text-[0.65rem] font-semibold text-ui-secondary">
                <img v-if="masterImageUrl(selectedMaster)" :src="masterImageUrl(selectedMaster)" :alt="masterDisplayName(selectedMaster)" class="h-full w-full object-cover">
                <span v-else>{{ selectedMaster ? masterInitials(selectedMaster) : 'SC' }}</span>
              </span>
              <span class="min-w-0 truncate font-medium text-ui-primary">{{ masterDisplayName(selectedMaster) }}</span>
            </span>
            <ChevronDownIcon class="h-4 w-4 shrink-0 text-ui-muted transition" :class="masterFilterOpen ? 'rotate-180' : ''" aria-hidden="true" />
          </BaseButton>
          <div v-if="masterFilterOpen" class="booking-select-menu base-select__menu absolute z-[180] mt-1 max-h-72 w-full overflow-y-auto rounded-2xl p-1" role="listbox">
            <BaseButton type="button" class="base-select__option flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm" :class="!masterFilterId ? 'is-selected' : ''" @click="selectMasterFilter('')">
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ui bg-ui-subtle text-xs font-semibold text-ui-secondary">SC</span>
              <span class="min-w-0 truncate font-medium">Усі майстри</span>
            </BaseButton>
            <BaseButton
              v-for="presentation in masterPresentations"
              :key="presentation.master.id"
              type="button"
              class="base-select__option flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm"
              :class="masterFilterId === String(presentation.master.id) ? 'is-selected' : ''"
              @click="selectMasterFilter(String(presentation.master.id))"
            >
              <span class="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ui bg-ui-subtle text-xs font-semibold text-ui-secondary">
                <img v-if="presentation.imageUrl" :src="presentation.imageUrl" :alt="presentation.displayName" class="h-full w-full object-cover">
                <span v-else>{{ presentation.initials }}</span>
              </span>
              <span class="min-w-0">
                <span class="block truncate font-medium">{{ presentation.displayName }}</span>
                <span v-if="presentation.master.position_uk" class="block truncate text-xs text-ui-muted">{{ presentation.position }}</span>
              </span>
            </BaseButton>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-ui-subtle px-3 py-2 text-xs text-ui-secondary md:px-4 md:py-3 md:text-sm">
        <p class="font-medium text-ui-primary">{{ monthRangeLabel }}</p>
        <p>У графіку {{ formatHours(totalScheduledMinutes) }} · Заброньовано {{ formatHours(totalBookedMinutes) }}</p>
      </div>

      <p v-if="error" class="ui-status-danger rounded-2xl px-4 py-3 text-sm">
        {{ apiErrorMessage(error, 'Не вдалося завантажити графік майстрів.') }}
      </p>
      <BaseLoader v-if="pending" label="Завантаження графіка…" size="sm" />
    </BaseCard>

    <BaseCard as="section" padding="none" class="overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-ui px-3 py-3 md:px-4">
        <div class="flex flex-wrap items-center gap-2 text-xs text-ui-secondary">
          <BaseBadge tone="success" dot>Робочий час</BaseBadge>
          <BaseBadge tone="danger" dot>Блокування</BaseBadge>
          <BaseBadge tone="neutral" dot>Вихідний</BaseBadge>
        </div>
        <p class="text-xs text-ui-muted">Майстри закріплені зліва, дні прокручуються горизонтально</p>
      </div>

      <div class="flex min-h-11 items-center gap-2 border-b border-ui bg-ui-subtle px-3 py-2 text-xs md:px-4 md:text-sm">
        <span class="shrink-0 font-medium text-ui-muted">Вибрано</span>
        <span class="min-w-0 truncate text-ui-primary">{{ selectedScheduleLabel }}</span>
      </div>

      <BaseEmptyState v-if="!masterStats.length" compact title="Немає майстрів для відображення" />
      <BaseTable
        v-else
        caption="Графік робочого часу майстрів за днями місяця"
        wrapper-class="rounded-none border-0"
        scroll-class="max-h-[72dvh] overflow-auto"
        min-width="max-content"
        table-class="!border-separate border-spacing-0 text-left"
      >
        <template #head>
          <tr>
            <th class="schedule-matrix__header sticky left-0 top-0 z-[80] min-w-44 border-b border-r border-ui !px-3 !py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ui-muted md:min-w-56 md:!px-4">
              Майстер
            </th>
            <th
              v-for="day in monthDays"
              :key="day.date"
              class="schedule-matrix__header sticky top-0 z-[60] min-w-36 border-b border-r border-ui !px-2 !py-2 !text-center"
              :class="day.isToday ? 'schedule-matrix__today' : ''"
            >
              <span class="block text-[0.65rem] font-medium uppercase tracking-[0.1em] text-ui-muted">{{ day.weekday }}</span>
              <span class="mt-0.5 block text-sm font-semibold text-ui-primary">{{ day.dayNumber }}</span>
            </th>
            <th class="schedule-matrix__header sticky right-0 top-0 z-[80] min-w-44 border-b border-ui !px-3 !py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ui-muted">
              Завантаження
            </th>
          </tr>
        </template>
        <tr v-for="{ stat, cells } in scheduleRows" :key="stat.master.id" class="group">
          <th scope="row" class="sticky left-0 z-40 min-w-44 border-b border-r border-ui bg-ui-surface px-3 py-2 text-left md:min-w-56 md:px-4">
            <div class="flex min-w-0 items-center gap-2.5">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ui bg-ui-subtle text-[0.65rem] font-semibold text-ui-secondary">
                <img v-if="stat.imageUrl" :src="stat.imageUrl" :alt="stat.displayName" class="h-full w-full object-cover">
                <span v-else>{{ stat.initials }}</span>
              </span>
              <span class="min-w-0">
                <span class="block truncate text-sm font-semibold text-ui-primary">{{ stat.displayName }}</span>
                <span class="mt-0.5 block truncate text-[0.68rem] font-normal text-ui-muted">{{ stat.position }}</span>
              </span>
            </div>
          </th>

          <td
            v-for="{ day, schedule } in cells"
            :key="`${stat.master.id}-${day.date}`"
            class="min-w-36 border-b border-r border-ui bg-ui-surface !p-1.5 !align-top"
            :class="day.isToday ? 'schedule-matrix__today' : ''"
          >
            <div v-if="schedule.availability.length || schedule.blocks.length" class="space-y-1">
              <div
                v-for="{ item: window, label } in schedule.availability"
                :key="`availability-${window.id}`"
                class="flex min-h-8 items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/12 px-1.5 py-1"
              >
                <BaseButton
                  type="button"
                  variant="unstyled"
                  class="min-w-0 flex-1 whitespace-nowrap text-left text-[0.68rem] font-semibold text-emerald-700"
                  :aria-label="`${stat.displayName}, ${day.date}, робочий час ${label}`"
                  @click="selectSchedule(stat.master, day.date, window, 'availability')"
                >
                  {{ label }}
                </BaseButton>
                <BaseButton
                  type="button"
                  variant="unstyled"
                  class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-emerald-700/65 transition hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-40"
                  :disabled="!isAdmin || deletingAvailabilityId === window.id"
                  :aria-label="`Закрити інтервал ${label}`"
                  title="Закрити робочий інтервал"
                  @click="openDeleteAvailabilityConfirm(window)"
                >
                  <XMarkIcon class="h-3.5 w-3.5" aria-hidden="true" />
                </BaseButton>
              </div>

              <div
                v-for="{ item: block, label } in schedule.blocks"
                :key="`block-${block.id}`"
                class="flex min-h-8 items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-1.5 py-1"
              >
                <BaseButton
                  type="button"
                  variant="unstyled"
                  class="min-w-0 flex-1 text-left text-[0.68rem] font-semibold text-rose-600"
                  :aria-label="`${stat.displayName}, ${day.date}, блокування ${label}`"
                  @click="selectSchedule(stat.master, day.date, block, 'block')"
                >
                  <span class="block whitespace-nowrap">{{ label }}</span>
                  <span class="mt-0.5 block truncate text-[0.62rem] font-normal text-rose-500">{{ block.reason || 'Блокування' }}</span>
                </BaseButton>
                <BaseButton
                  type="button"
                  variant="unstyled"
                  class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-rose-600/65 transition hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-40"
                  :disabled="!isAdmin || deletingId === block.id"
                  :aria-label="`Видалити блокування ${label}`"
                  title="Видалити блокування"
                  @click="deleteBlock(block)"
                >
                  <XMarkIcon class="h-3.5 w-3.5" aria-hidden="true" />
                </BaseButton>
              </div>
            </div>
            <span v-else class="flex min-h-8 items-center justify-center text-sm text-ui-muted">—</span>
          </td>

          <td class="sticky right-0 z-40 min-w-44 border-b border-ui bg-ui-surface px-3 py-2">
            <div class="flex items-center justify-between gap-2 text-xs">
              <span class="font-semibold text-ui-primary">{{ stat.loadPercent }}%</span>
              <span class="text-ui-muted">{{ formatHours(stat.bookedMinutes) }}</span>
            </div>
            <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-ui-subtle">
              <div
                class="h-full rounded-full transition-all"
                :class="stat.loadPercent >= 80 ? 'bg-emerald-500' : stat.loadPercent >= 50 ? 'bg-amber-500' : 'bg-cyan-500'"
                :style="{ width: `${Math.min(100, stat.loadPercent)}%` }"
              />
            </div>
            <p class="mt-1 text-[0.62rem] text-ui-muted">{{ stat.workDays }} дн. · {{ formatHours(stat.scheduledMinutes) }}</p>
          </td>
        </tr>
      </BaseTable>
    </BaseCard>

    <BaseCard as="section" padding="none">
      <div class="border-b border-ui px-4 py-3 md:px-5 md:py-4">
        <h2 class="text-lg font-semibold text-ui-primary md:text-xl">Завантаження майстрів за місяць</h2>
        <p class="mt-1 text-xs text-ui-muted md:text-sm">Завантаження = заброньований час / робочий час після блокувань. Скасовані записи не враховуються.</p>
      </div>

      <BaseEmptyState v-if="!masterStats.length" compact title="Немає майстрів для статистики" />
      <div v-else class="divide-y divide-ui">
        <article v-for="stat in masterStats" :key="stat.master.id" class="grid gap-3 px-4 py-4 md:grid-cols-[minmax(190px,1.2fr)_repeat(4,minmax(90px,0.65fr))_minmax(190px,1fr)] md:items-center md:px-5">
          <div class="flex min-w-0 items-center gap-3">
            <span class="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ui bg-ui-subtle text-xs font-semibold text-ui-secondary">
              <img v-if="stat.imageUrl" :src="stat.imageUrl" :alt="stat.displayName" class="h-full w-full object-cover">
              <span v-else>{{ stat.initials }}</span>
            </span>
            <div class="min-w-0">
              <p class="truncate font-semibold text-ui-primary">{{ stat.displayName }}</p>
              <p class="truncate text-xs text-ui-muted">{{ stat.position }}</p>
            </div>
          </div>

          <div>
            <p class="text-[0.65rem] uppercase tracking-[0.1em] text-ui-muted">Днів у графіку</p>
            <p class="mt-1 font-semibold text-ui-primary">{{ stat.workDays }}</p>
          </div>
          <div>
            <p class="text-[0.65rem] uppercase tracking-[0.1em] text-ui-muted">Годин у графіку</p>
            <p class="mt-1 font-semibold text-ui-primary">{{ formatHours(stat.scheduledMinutes) }}</p>
          </div>
          <div>
            <p class="text-[0.65rem] uppercase tracking-[0.1em] text-ui-muted">Заброньовано</p>
            <p class="mt-1 font-semibold text-ui-primary">{{ formatHours(stat.bookedMinutes) }}</p>
          </div>
          <div>
            <p class="text-[0.65rem] uppercase tracking-[0.1em] text-ui-muted">Блокування</p>
            <p class="mt-1 font-semibold text-ui-primary">{{ formatHours(stat.blockedMinutes) }}</p>
          </div>

          <div class="min-w-0">
            <div class="flex items-center justify-between gap-2 text-xs">
              <span class="font-medium text-ui-secondary">Завантаження</span>
              <span class="font-semibold" :class="stat.loadPercent >= 80 ? 'text-emerald-600' : stat.loadPercent >= 50 ? 'text-amber-600' : 'text-ui-primary'">{{ stat.loadPercent }}%</span>
            </div>
            <div class="mt-2 h-2 overflow-hidden rounded-full bg-ui-subtle">
              <div class="h-full rounded-full transition-all" :class="stat.loadPercent >= 80 ? 'bg-emerald-500' : stat.loadPercent >= 50 ? 'bg-amber-500' : 'bg-cyan-500'" :style="{ width: `${Math.min(100, stat.loadPercent)}%` }" />
            </div>
            <p class="mt-1.5 text-[0.68rem] text-ui-muted">Вільно {{ formatHours(stat.freeMinutes) }} з {{ formatHours(stat.capacityMinutes) }}</p>
          </div>
        </article>
      </div>
    </BaseCard>

    <AvailabilityWindowFormModal
      :model-value="availabilityModalOpen"
      admin
      :masters="masterOptions"
      :disabled="!isAdmin"
      @saved="handleSaved"
      @update:model-value="availabilityModalOpen = $event"
    />
    <TimeBlockFormModal
      :model-value="timeBlockModalOpen"
      :masters="masterOptions"
      :disabled="!isAdmin"
      @saved="handleSaved"
      @update:model-value="timeBlockModalOpen = $event"
    />
    <ConfirmActionModal
      :model-value="Boolean(availabilityToDelete)"
      title="Видалити робочий час?"
      message="Цей робочий інтервал буде видалено з графіка майстра. Після підтвердження дія набуде чинності одразу."
      confirm-label="Так, видалити"
      :context-items="availabilityDeleteContextItems"
      :pending="deletingAvailabilityId != null"
      destructive
      @confirm="confirmDeleteAvailability"
      @update:model-value="handleAvailabilityDeleteConfirmUpdate"
    />
  </div>
</template>

<style scoped>
.schedule-matrix__header {
  background: color-mix(in srgb, var(--bo-surface) 93%, var(--bo-text-primary) 7%);
}

.schedule-matrix__today {
  background: color-mix(in srgb, var(--bo-surface) 88%, var(--bo-accent) 12%) !important;
}
</style>
