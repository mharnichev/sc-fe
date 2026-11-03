<script setup lang="ts">
import {
  ChartBarSquareIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  LockOpenIcon,
  PlusIcon,
  UserIcon,
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
import {
  clipScheduleItems,
  scheduleOccupancy,
  physicalCalendarId,
  intersectRanges,
  mergeRanges,
  minutesInRanges,
  rangesFromItems,
  subtractRanges,
  timestamp,
  type TimeRange,
} from '~/utils/scheduleIntervals'

interface CalendarDayColumn {
  date: string
  dayNumber: number
  weekday: string
  isToday: boolean
}

interface MasterDaySchedule {
  availability: MasterAvailabilityWindow[]
  availabilitySummary: AvailabilityDaySummary | null
  blocks: TimeBlock[]
  blockSummary: BlockDaySummary | null
}

interface AvailabilityDaySummary {
  items: MasterAvailabilityWindow[]
  scheduledRanges: TimeRange[]
  ranges: TimeRange[]
  scheduledIntervalsLabel: string
  intervalsLabel: string
  totalMinutes: number
}

interface BlockDaySummary {
  items: TimeBlock[]
  ranges: TimeRange[]
  intervalsLabel: string
  reasonsLabel: string
  totalMinutes: number
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
  intervalsLabel?: string
  kind: 'availability' | 'block'
  reason?: string | null
  totalMinutes?: number
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
  aliases: string
  loadPercent: number | null
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
  formatDateTime,
  bookingStart,
  bookingEnd,
  bookingServiceIds,
  bookingRedirectMasterId,
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
const bookingStatus = ref('all')
const statusLabels: Record<string, string> = { all: 'Усі нескасовані', pending: 'Очікують', confirmed: 'Підтверджені', completed: 'Завершені', no_show: 'Не з’явились' }
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
const activeFilterCount = computed(() => [
  masterFilterId.value,
  bookingStatus.value !== 'all' ? bookingStatus.value : '',
  monthStart.value !== `${todayInput().slice(0, 7)}-01` ? monthStart.value : '',
].filter(Boolean).length)

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

const [{ data, pending, error, refresh }, { data: masters, pending: mastersPending, error: mastersError, refresh: refreshMasters }, { data: services, pending: servicesPending, error: servicesError, refresh: refreshServices }] = await Promise.all([
  useAsyncData(
    'admin-time-blocks-month',
    async () => {
      const requestedMonth = monthStart.value
      const range = {
        date_from: toKyivIso(monthStart.value, '00:00'),
        date_to: toKyivIso(addDaysInput(monthEnd.value, 1), '00:00'),

      }
      const availabilityRange = {
        date_from: toKyivIso(monthStart.value, '00:00'),
        date_to: toKyivIso(addDaysInput(monthEnd.value, 1), '00:00'),

      }
      const [timeBlocks, availability, bookings] = await Promise.all([
        api.adminGetCalendarTimeBlocks(range),
        api.adminGetAvailability(availabilityRange),
        api.adminGetCalendarBookings(range),
      ])
      return { timeBlocks, availability, bookings, month: requestedMonth }
    },
    { watch: [monthStart], lazy: true },
  ),
  useAsyncData('time-block-master-options', () => api.adminGetMasters(1, 200), { lazy: true }),
  useAsyncData('time-block-service-options', () => api.getServices(), { lazy: true }),
])

const loadingSchedule = computed(() => pending.value || mastersPending.value || servicesPending.value)
const loadError = computed(() => error.value || mastersError.value || servicesError.value)
const refreshSchedule = () => Promise.all([refresh(), refreshMasters(), refreshServices()])
const currentData = computed(() => !loadingSchedule.value && !loadError.value && data.value?.month === monthStart.value ? data.value : null)
const blocks = computed<TimeBlock[]>(() => normalizeItems(currentData.value?.timeBlocks))
const availabilityWindows = computed<MasterAvailabilityWindow[]>(() => normalizeItems(currentData.value?.availability))
const bookings = computed<Booking[]>(() => normalizeItems(currentData.value?.bookings))
const masterOptions = computed<Master[]>(() => normalizeItems(masters.value))
const serviceOptions = computed<Service[]>(() => normalizeItems(services.value))
const servicesById = computed(() => new Map(serviceOptions.value.map(service => [Number(service.id), service])))
const deletingBlockIds = ref<number[]>([])
const deletingAvailabilityId = ref<number | null>(null)
const timeBlockModalOpen = ref(false)
const availabilityModalOpen = ref(false)
const availabilityToDelete = ref<MasterAvailabilityWindow | null>(null)
const blockSummaryToDelete = ref<BlockDaySummary | null>(null)
const selectedScheduleItem = ref<SelectedScheduleItem | null>(null)
const selectedMasterIdentity = ref<MasterMonthStat | null>(null)

const masterDisplayName = (master?: Master | null) => {
  if (!master) return 'Усі майстри'
  const firstName = master.first_name_uk || ''
  const lastName = master.last_name_uk || master.last_name || ''
  return [lastName, firstName].filter(Boolean).join(' ') || master.full_name_uk || master.full_name || master.name || masterName(master)
}

const masterImageUrl = (master?: Master | null) =>
  master ? assetUrl(master.avatar || master.avatar_url || master.photo || master.photo_url) : ''

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

const sourceIntervalLabel = (window: MasterAvailabilityWindow) => `#${window.id}: ${formatDateTime(window.start_at)} — ${formatDateTime(window.end_at)}`

const intervalLabel = (startAt: string, endAt: string) => `${formatTime(startAt)}–${formatTime(endAt)}`

const rangeLabel = (range: TimeRange) => intervalLabel(
  new Date(range.start).toISOString(),
  new Date(range.end).toISOString(),
)

const summarizeDayBlocks = (dayBlocks: TimeBlock[]): BlockDaySummary | null => {
  const items = [...new Map(dayBlocks.map(block => [block.id, block])).values()]
  const ranges = mergeRanges(rangesFromItems(items))
  if (!ranges.length) return null

  const totalMinutes = minutesInRanges(ranges)
  const intervalsLabel = ranges.map(rangeLabel).join(', ')
  const reasons = [...new Set(items.map(block => block.reason?.trim()).filter((reason): reason is string => Boolean(reason)))]
  return {
    items: items.map(item => blocks.value.find(source => source.id === item.id) || item),
    ranges,
    intervalsLabel,
    reasonsLabel: reasons.join(', ') || 'Блокування',
    totalMinutes,
  }
}

const summarizeDayAvailability = (
  availability: MasterAvailabilityWindow[],
  blocks: TimeBlock[],
): AvailabilityDaySummary | null => {
  const items = [...new Map(availability.map(window => [window.id, window])).values()]
  const scheduledRanges = mergeRanges(rangesFromItems(items))
  if (!scheduledRanges.length) return null

  const blockedRanges = intersectRanges(scheduledRanges, rangesFromItems(blocks))
  const ranges = subtractRanges(scheduledRanges, blockedRanges)
  return {
    items: items.map(item => availabilityWindows.value.find(source => source.id === item.id) || item),
    scheduledRanges,
    ranges,
    scheduledIntervalsLabel: scheduledRanges.map(rangeLabel).join(', '),
    intervalsLabel: ranges.length ? ranges.map(rangeLabel).join(', ') : 'Немає доступного часу',
    totalMinutes: minutesInRanges(ranges),
  }
}

const calendarDataIndex = computed<CalendarDataIndex>(() => {
  const schedules: Record<string, MasterDaySchedule> = {}
  const byMaster = new Map<number, MasterMonthData>()
  const ensureSchedule = (masterId: number, date: string) => {
    const key = `${masterId}:${date}`
    schedules[key] ||= { availability: [], availabilitySummary: null, blocks: [], blockSummary: null }
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

  for (const rawWindow of availabilityWindows.value) {
    const window = { ...rawWindow, master_id: resolveCalendarId(rawWindow.master_id) }
    const masterData = dataForMaster(window.master_id)
    masterData.availability.push(window)
    for (const day of monthDays.value) {
      const clipped = clipScheduleItems([window], dayBounds(day.date))
      if (!clipped.length) continue
      masterData.workDates.add(day.date)
      ensureSchedule(window.master_id, day.date).availability.push(...clipped)
    }
  }
  for (const rawBlock of blocks.value) {
    const block = { ...rawBlock, master_id: resolveCalendarId(rawBlock.master_id) }
    dataForMaster(block.master_id).blocks.push(block)
    for (const day of monthDays.value) {
      const clipped = clipScheduleItems([block], dayBounds(day.date))
      if (clipped.length) ensureSchedule(block.master_id, day.date).blocks.push(...clipped)
    }
  }
  for (const booking of bookings.value) {
    const resourceId = booking.master_id != null ? resolveCalendarId(booking.master_id) : null
    if (resourceId != null && ['pending', 'confirmed', 'completed', 'no_show'].includes(booking.status)
      && (bookingStatus.value === 'all' || booking.status === bookingStatus.value)) {
      dataForMaster(resourceId).bookings.push(booking)
    }
  }

  for (const schedule of Object.values(schedules)) {
    schedule.availability.sort((first, second) => first.start_at.localeCompare(second.start_at))
    schedule.blocks.sort((first, second) => first.start_at.localeCompare(second.start_at))
    schedule.availabilitySummary = summarizeDayAvailability(schedule.availability, schedule.blocks)
    schedule.blockSummary = summarizeDayBlocks(schedule.blocks)
  }
  return { schedules, byMaster }
})

const emptyDaySchedule: MasterDaySchedule = { availability: [], availabilitySummary: null, blocks: [], blockSummary: null }

const selectBlockSummary = (master: Master, date: string, summary: BlockDaySummary) => {
  const firstRange = summary.ranges[0]
  const lastRange = summary.ranges.at(-1) || firstRange
  selectedScheduleItem.value = {
    master,
    date,
    startAt: new Date(firstRange.start).toISOString(),
    endAt: new Date(lastRange.end).toISOString(),
    intervalsLabel: summary.intervalsLabel,
    kind: 'block',
    reason: summary.reasonsLabel,
    totalMinutes: summary.totalMinutes,
  }
}

const selectAvailabilitySummary = (master: Master, date: string, summary: AvailabilityDaySummary) => {
  const firstRange = summary.ranges[0] || summary.scheduledRanges[0]
  const lastRange = summary.ranges.at(-1) || summary.scheduledRanges.at(-1) || firstRange
  selectedScheduleItem.value = {
    master,
    date,
    startAt: new Date(firstRange.start).toISOString(),
    endAt: new Date(lastRange.end).toISOString(),
    intervalsLabel: summary.intervalsLabel,
    kind: 'availability',
    totalMinutes: summary.totalMinutes,
  }
}

const selectedScheduleLabel = computed(() => {
  const selected = selectedScheduleItem.value
  if (!selected) return 'Натисніть робочий інтервал або блокування в таблиці.'
  const kindLabel = selected.kind === 'block' ? selected.reason || 'блокування' : 'доступно'
  const dateLabel = selectedDayFormatter.format(new Date(toKyivIso(selected.date, '12:00')))
  const intervals = selected.intervalsLabel || intervalLabel(selected.startAt, selected.endAt)
  const duration = selected.totalMinutes != null ? ` · ${formatHours(selected.totalMinutes)}` : ''
  return `${dateLabel} · ${masterDisplayName(selected.master)} · ${kindLabel} ${intervals}${duration}`
})

watch([monthStart, selectedMasterId], () => {
  selectedScheduleItem.value = null
})

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

const formatHours = (minutes: number) => {
  const hours = minutes / 60
  return Number.isInteger(hours)
    ? `${hours.toLocaleString('uk-UA')} год`
    : `${hours.toLocaleString('uk-UA', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} год`
}

const redirects = computed(() => new Map(masterOptions.value.flatMap(master => {
  const target = bookingRedirectMasterId(master)
  return target ? [[master.id, target] as [number, number]] : []
})))
const resolveCalendarId = (id: number) => physicalCalendarId(id, redirects.value)
const calendarMasterId = (master: Master) => resolveCalendarId(master.id)
const dayBounds = (date: string): TimeRange => ({
  start: new Date(toKyivIso(date, '00:00')).getTime(),
  end: new Date(toKyivIso(addDaysInput(date, 1), '00:00')).getTime(),
})
const monthBounds = computed<TimeRange>(() => ({ start: dayBounds(monthStart.value).start, end: dayBounds(monthEnd.value).end }))
const visibleMasterPresentations = computed(() => {
  const candidates = selectedMasterId.value != null
    ? masterPresentations.value.filter(item => calendarMasterId(item.master) === resolveCalendarId(selectedMasterId.value!))
    : masterPresentations.value.filter(item => item.master.is_active !== false)
  const resources = new Map<number, MasterPresentation>()
  for (const item of candidates) {
    const id = calendarMasterId(item.master)
    if (!resources.has(id) || item.master.id === id) resources.set(id, item)
  }
  return [...resources.values()]
})
const masterStats = computed<MasterMonthStat[]>(() => visibleMasterPresentations.value.map(presentation => {
  const resourceId = calendarMasterId(presentation.master)
  const resource = calendarDataIndex.value.byMaster.get(resourceId)
  const occupancy = scheduleOccupancy(
    rangesFromItems(resource?.availability || []), rangesFromItems(resource?.blocks || []),
    (resource?.bookings || []).map(bookingRange).filter((range): range is TimeRange => Boolean(range)), monthBounds.value,
  )
  const aliases = masterPresentations.value.filter(item => calendarMasterId(item.master) === resourceId)
    .map(item => item.displayName).join(' / ')
  return { ...presentation, ...occupancy, aliases, workDays: resource?.workDates.size || 0 }
}).sort((a, b) => (b.loadPercent ?? -1) - (a.loadPercent ?? -1) || a.displayName.localeCompare(b.displayName, 'uk')))

const scheduleRows = computed<MasterScheduleRow[]>(() => masterStats.value.map(stat => ({
  stat,
  cells: monthDays.value.map(day => ({
    day,
    schedule: calendarDataIndex.value.schedules[`${calendarMasterId(stat.master)}:${day.date}`] || emptyDaySchedule,
  })),
})))

const totalScheduledMinutes = computed(() => {
  const countedCalendarIds = new Set<number>()
  return masterStats.value.reduce((total, stat) => {
    const calendarId = calendarMasterId(stat.master)
    if (countedCalendarIds.has(calendarId)) return total
    countedCalendarIds.add(calendarId)
    return total + stat.scheduledMinutes
  }, 0)
})
const totalCapacityMinutes = computed(() => {
  const countedCalendarIds = new Set<number>()
  return masterStats.value.reduce((total, stat) => {
    const calendarId = calendarMasterId(stat.master)
    if (countedCalendarIds.has(calendarId)) return total
    countedCalendarIds.add(calendarId)
    return total + stat.capacityMinutes
  }, 0)
})
const totalBookedMinutes = computed(() => masterStats.value.reduce((total, stat) => total + stat.bookedMinutes, 0))

const openCreateBlock = () => {
  timeBlockModalOpen.value = true
}

const openCreateAvailability = () => {
  availabilityModalOpen.value = true
}

const openMasterIdentity = (stat: MasterMonthStat) => {
  selectedMasterIdentity.value = stat
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
    { label: 'Повний інтервал', value: `${formatDateTime(window.start_at)} — ${formatDateTime(window.end_at)}` },
    { label: 'Вплив', value: 'Буде видалено весь інтервал на всіх його датах, а не лише показаний день.' },
  ]
})

const openDeleteAvailabilityConfirm = (window: MasterAvailabilityWindow) => {
  if (!isAdmin.value || deletingAvailabilityId.value != null) return
  availabilityToDelete.value = window
}

const handleAvailabilityDeleteConfirmUpdate = (value: boolean) => {
  if (!value && deletingAvailabilityId.value == null) availabilityToDelete.value = null
}

const blockDeleteContextItems = computed(() => {
  const summary = blockSummaryToDelete.value
  if (!summary) return []
  const firstBlock = summary.items[0]
  const master = firstBlock.master || masterOptions.value.find(option => option.id === firstBlock.master_id)
  return [
    { label: 'Майстер', value: masterDisplayName(master) },
    { label: 'Повні інтервали', value: summary.items.map(block => `#${block.id}: ${formatDateTime(block.start_at)} — ${formatDateTime(block.end_at)}`).join('; ') },
    { label: 'Вплив', value: 'Буде видалено всі вибрані інтервали повністю на всіх їхніх датах.' },
  ]
})

const blockDeleteMessage = computed(() => {
  const count = blockSummaryToDelete.value?.items.length || 0
  return count > 1
    ? `Буде повністю видалено ${count} початкових інтервалів блокування, включно з частинами поза показаним днем або місяцем.`
    : 'Початковий інтервал блокування буде видалено повністю, включно з частинами поза показаним днем або місяцем.'
})

const openDeleteBlockConfirm = (summary: BlockDaySummary) => {
  if (!isAdmin.value || deletingBlockIds.value.length) return
  blockSummaryToDelete.value = summary
}

const handleBlockDeleteConfirmUpdate = (value: boolean) => {
  if (!value && !deletingBlockIds.value.length) blockSummaryToDelete.value = null
}

const confirmDeleteBlockSummary = async () => {
  const summary = blockSummaryToDelete.value
  if (!summary || deletingBlockIds.value.length) return

  deletingBlockIds.value = summary.items.map(block => block.id)
  const results = await Promise.allSettled(summary.items.map(block => api.adminDeleteTimeBlock(block.id)))
  const deletedCount = results.filter(result => result.status === 'fulfilled').length
  const failedResult = results.find(result => result.status === 'rejected')

  try {
    await refresh()
    blockSummaryToDelete.value = null
    selectedScheduleItem.value = null
    if (!failedResult) {
      toast.success(summary.items.length > 1 ? 'Блокування дня видалено.' : 'Блокування часу видалено.')
    }
    else {
      const fallback = deletedCount
        ? `Видалено ${deletedCount} з ${summary.items.length} записів. Оновіть і повторіть спробу.`
        : 'Не вдалося видалити блокування часу.'
      toast.error(apiErrorMessage(failedResult.reason, fallback))
    }
  }
  finally {
    deletingBlockIds.value = []
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

    <BaseFilterPanel
      padding="sm"
      :active-count="activeFilterCount"
      mobile-title="Фільтри графіка майстрів"
      card-class="relative z-30"
      fields-class="!block"
      actions-class="justify-stretch xl:justify-end"
      :loading="pending"
      :show-clear="false"
      aria-label="Фільтри графіка майстрів"
      @apply="refreshSchedule"
    >
      <MasterSelect
        v-model="masterFilterId"
        :masters="masterOptions"
        label="Майстер"
        all-label="Усі майстри"
        value-type="string"
        compact
        menu-class="z-[260]"
      />

      <BaseSelect v-model="bookingStatus" label="Статус записів" aria-label="Статус записів"
        :options="Object.entries(statusLabels).map(([value, label]) => ({ value, label }))" />
      <template #actions>
        <div class="w-full space-y-3 sm:w-auto">
          <div class="grid w-full grid-cols-[2.25rem_minmax(0,1fr)_auto_2.25rem] items-center gap-1.5 md:flex md:gap-2">
            <BaseButton type="button" variant="icon" class="h-9 w-9" aria-label="Попередній місяць" title="Попередній місяць" @click="moveMonth(-1)">
              <ChevronLeftIcon class="h-5 w-5" aria-hidden="true" />
            </BaseButton>
            <p class="min-w-0 text-center text-base font-semibold capitalize text-ui-primary md:min-w-48 md:text-left md:text-lg">{{ monthLabel }}</p>
            <BaseButton type="button" variant="neutral" size="sm" @click="goToCurrentMonth">Цей місяць</BaseButton>
            <BaseButton type="button" variant="icon" class="h-9 w-9" aria-label="Наступний місяць" title="Наступний місяць" @click="moveMonth(1)">
              <ChevronRightIcon class="h-5 w-5" aria-hidden="true" />
            </BaseButton>
          </div>
          <BaseButton type="submit" variant="primary" block class="md:hidden">Застосувати</BaseButton>
        </div>
      </template>

      <template #summary>
        <div class="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-ui-subtle px-3 py-2 text-xs text-ui-secondary md:px-4 md:py-3 md:text-sm">
          <p class="font-medium text-ui-primary">{{ monthRangeLabel }}</p>
          <p v-if="currentData">У графіку {{ formatHours(totalScheduledMinutes) }} · Доступно після блокувань {{ formatHours(totalCapacityMinutes) }} · Заброньовано {{ formatHours(totalBookedMinutes) }}</p>
        </div>
      </template>

    </BaseFilterPanel>

    <div v-if="loadingSchedule" class="rounded-2xl bg-ui-subtle px-4 py-3">
      <BaseLoader label="Оновлюємо розрахунок…" size="sm" />
    </div>
    <div v-else-if="!currentData" class="ui-status-danger rounded-2xl px-4 py-3 text-sm" role="alert">
      <p>Розрахунок недоступний. {{ loadError ? apiErrorMessage(loadError, 'Не вдалося завантажити графік майстрів.') : 'Спробуйте завантажити графік ще раз.' }}</p>
      <BaseButton type="button" variant="neutral" size="sm" class="mt-2" @click="refreshSchedule">Спробувати ще раз</BaseButton>
    </div>

    <BaseCard v-if="currentData" as="section" padding="none" class="overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-ui px-3 py-3 md:px-4">
        <div class="flex flex-wrap items-center gap-2 text-xs text-ui-secondary">
          <BaseBadge tone="success" dot>Доступно після блокувань</BaseBadge>
          <BaseBadge tone="danger" dot>Заблокований час</BaseBadge>
          <BaseBadge tone="neutral" dot>Вихідний</BaseBadge>
        </div>
        <p class="text-xs text-ui-muted">Майстри закріплені зліва, дні прокручуються горизонтально</p>
      </div>

      <div class="flex min-h-11 items-center gap-2 border-b border-ui bg-ui-subtle px-3 py-2 text-xs md:px-4 md:text-sm">
        <span class="shrink-0 font-medium text-ui-muted">Вибрано</span>
        <span class="min-w-0 truncate text-ui-primary">{{ selectedScheduleLabel }}</span>
      </div>

      <BaseEmptyState v-if="!masterStats.length" compact title="Немає майстрів для відображення" />
      <ScheduleMatrixTable
        v-else
        caption="Графік робочого часу майстрів за днями місяця"
        :days="monthDays"
        leading-size="compact"
      >
        <template #leading-header>
          <span class="inline-flex md:hidden">
            <UserIcon class="h-5 w-5" aria-hidden="true" />
            <span class="sr-only">Майстер</span>
          </span>
          <span class="hidden md:inline">Майстер</span>
        </template>
        <template #day-header="{ day }">
          <span class="block text-[0.65rem] font-medium uppercase tracking-[0.1em] text-ui-muted">{{ day.weekday }}</span>
          <span class="mt-0.5 block text-sm font-semibold text-ui-primary">{{ day.dayNumber }}</span>
        </template>
        <template #trailing-header>
          <span class="inline-flex md:hidden">
            <ChartBarSquareIcon class="h-5 w-5" aria-hidden="true" />
            <span class="sr-only">Завантаження</span>
          </span>
          <span class="hidden md:inline">Завантаження</span>
        </template>

        <template #default="{ leadingCellClass, dayCellClass, trailingCellClass, todayCellClass }">
          <tr v-for="{ stat, cells } in scheduleRows" :key="stat.master.id" class="group">
          <th scope="row" :class="leadingCellClass">
            <div class="flex min-w-0 flex-col items-center gap-0.5 md:items-start md:gap-1">
              <div class="flex flex-col items-center gap-0.5 md:flex-row md:gap-1.5">
              <span class="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ui bg-ui-subtle text-[0.6rem] font-semibold text-ui-secondary md:h-9 md:w-9 md:text-[0.65rem]">
                <img v-if="stat.imageUrl" :src="stat.imageUrl" alt="" class="h-full w-full object-cover">
                <span v-else>{{ stat.initials }}</span>
              </span>
              <BaseButton
                type="button"
                variant="unstyled"
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ui-muted transition hover:bg-ui-subtle hover:text-ui-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary md:h-7 md:w-7"
                :aria-label="`Показати майстра ${stat.displayName}`"
                :title="`Показати майстра ${stat.displayName}`"
                @click="openMasterIdentity(stat)"
              >
                <EyeIcon class="h-4 w-4" aria-hidden="true" />
              </BaseButton>
              </div>
              <span class="hidden w-full truncate text-[0.62rem] font-normal leading-tight text-ui-muted md:block">{{ stat.position }}</span>
            </div>
          </th>

          <td
            v-for="{ day, schedule } in cells"
            :key="`${stat.master.id}-${day.date}`"
            :class="[dayCellClass, day.isToday ? todayCellClass : '']"
          >
            <div v-if="schedule.availabilitySummary || schedule.blockSummary" class="space-y-1">
              <div
                v-if="schedule.availabilitySummary"
                class="flex min-h-10 items-start gap-1 rounded-lg border px-1.5 py-1.5"
                :class="schedule.availabilitySummary.ranges.length
                  ? 'border-emerald-500/20 bg-emerald-500/12'
                  : 'border-amber-500/25 bg-amber-500/10'"
              >
                <BaseButton
                  type="button"
                  variant="unstyled"
                  class="min-w-0 flex-1 text-left"
                  :class="schedule.availabilitySummary.ranges.length ? 'text-emerald-700' : 'text-amber-700'"
                  :aria-label="`${stat.displayName}, ${day.date}, доступно ${schedule.availabilitySummary.intervalsLabel}`"
                  :title="schedule.availabilitySummary.intervalsLabel"
                  @click="selectAvailabilitySummary(stat.master, day.date, schedule.availabilitySummary)"
                >
                  <span class="block text-[0.58rem] font-semibold uppercase tracking-[0.08em] opacity-75">
                    {{ schedule.availabilitySummary.ranges.length ? `Доступно · ${formatHours(schedule.availabilitySummary.totalMinutes)}` : 'Доступного часу немає' }}
                  </span>
                  <span v-if="schedule.availabilitySummary.ranges.length" class="mt-0.5 block space-y-0.5 text-[0.68rem] font-semibold leading-tight">
                    <span v-for="range in schedule.availabilitySummary.ranges" :key="`${range.start}-${range.end}`" class="block whitespace-nowrap">
                      {{ rangeLabel(range) }}
                    </span>
                  </span>
                  <span v-else class="mt-0.5 block text-[0.68rem] font-semibold leading-tight">Заблоковано повністю</span>
                </BaseButton>
                <details v-if="isAdmin" class="group/manage relative shrink-0 text-[0.62rem] text-ui-muted">
                  <summary class="flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-full transition hover:bg-emerald-500/10 hover:text-emerald-700 md:h-5 md:w-5" title="Керувати відкритим часом">
                    <span class="sr-only">Керувати відкритим часом</span>
                    <ChevronDownIcon class="h-3.5 w-3.5 transition group-open/manage:rotate-180" aria-hidden="true" />
                  </summary>
                  <div class="absolute right-0 top-6 z-50 w-36 space-y-1 rounded-lg border border-ui bg-ui-surface p-1.5 shadow-lg">
                    <p class="px-1 text-[0.56rem] font-semibold uppercase tracking-[0.08em] text-ui-muted">Записи графіка</p>
                    <div v-for="window in schedule.availabilitySummary.items" :key="`availability-source-${window.id}`" class="flex items-center gap-1 rounded-md bg-ui-subtle px-1 py-0.5">
                      <span class="min-w-0 flex-1 whitespace-normal text-ui-secondary">{{ sourceIntervalLabel(window) }}</span>
                      <BaseButton
                        type="button"
                        variant="unstyled"
                        class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ui-muted transition hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-40 md:h-5 md:w-5"
                        :disabled="deletingAvailabilityId === window.id"
                        :aria-label="`Закрити весь інтервал ${sourceIntervalLabel(window)}`"
                        title="Закрити робочий інтервал"
                        @click="openDeleteAvailabilityConfirm(window)"
                      >
                        <XMarkIcon class="h-3.5 w-3.5" aria-hidden="true" />
                      </BaseButton>
                    </div>
                  </div>
                </details>
              </div>

              <div
                v-if="schedule.blockSummary"
                class="flex min-h-8 items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-1.5 py-1"
              >
                <BaseButton
                  type="button"
                  variant="unstyled"
                  class="min-w-0 flex-1 text-left text-rose-600"
                  :aria-label="`${stat.displayName}, ${day.date}, блокування ${schedule.blockSummary.intervalsLabel}`"
                  :title="`${schedule.blockSummary.intervalsLabel} · ${schedule.blockSummary.reasonsLabel}`"
                  @click="selectBlockSummary(stat.master, day.date, schedule.blockSummary)"
                >
                  <span class="block text-[0.58rem] font-semibold uppercase tracking-[0.08em] opacity-75">Заблоковано · {{ formatHours(schedule.blockSummary.totalMinutes) }}</span>
                  <span class="mt-0.5 block space-y-0.5 text-[0.68rem] font-semibold leading-tight">
                    <span v-for="range in schedule.blockSummary.ranges" :key="`${range.start}-${range.end}`" class="block whitespace-nowrap">
                      {{ rangeLabel(range) }}
                    </span>
                  </span>
                </BaseButton>
                <BaseButton
                  type="button"
                  variant="unstyled"
                  class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-rose-600/65 transition hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-40 md:h-5 md:w-5"
                  :disabled="!isAdmin || deletingBlockIds.length > 0"
                  :aria-label="`Видалити блокування ${schedule.blockSummary.intervalsLabel}`"
                  title="Видалити блокування дня"
                  @click="openDeleteBlockConfirm(schedule.blockSummary)"
                >
                  <XMarkIcon class="h-3.5 w-3.5" aria-hidden="true" />
                </BaseButton>
              </div>
            </div>
            <span v-else class="flex min-h-8 items-center justify-center text-sm text-ui-muted">—</span>
          </td>

          <td :class="trailingCellClass">
            <span class="flex min-h-10 items-center justify-center text-sm font-semibold text-ui-primary md:hidden">{{ stat.loadPercent === null ? 'Немає графіка' : `${stat.loadPercent}%` }}</span>
            <div class="hidden items-center justify-between gap-2 text-xs md:flex">
              <span class="font-semibold text-ui-primary">{{ stat.loadPercent === null ? 'Немає графіка' : `${stat.loadPercent}%` }}</span>
              <span class="text-ui-muted">{{ formatHours(stat.bookedMinutes) }}</span>
            </div>
            <div class="mt-2 hidden h-1.5 overflow-hidden rounded-full bg-ui-subtle md:block">
              <div
                class="h-full rounded-full transition-all"
                :class="(stat.loadPercent ?? 0) >= 80 ? 'bg-emerald-500' : (stat.loadPercent ?? 0) >= 50 ? 'bg-amber-500' : 'bg-cyan-500'"
                :style="{ width: `${Math.min(100, stat.loadPercent ?? 0)}%` }"
              />
            </div>
            <p class="mt-1 hidden text-[0.62rem] text-ui-muted md:block">{{ stat.workDays }} дн. · {{ formatHours(stat.scheduledMinutes) }}</p>
          </td>
          </tr>
        </template>
      </ScheduleMatrixTable>
    </BaseCard>

    <BaseCard v-if="currentData" as="section" padding="none">
      <div class="border-b border-ui px-4 py-3 md:px-5 md:py-4">
        <h2 class="text-lg font-semibold text-ui-primary md:text-xl">Завантаження майстрів за місяць</h2>
        <p class="mt-1 text-xs text-ui-muted md:text-sm">Повний вибраний місяць, включно з минулим часом. Один рядок на фізичний календар; спільні профілі об’єднані. Статус записів: {{ statusLabels[bookingStatus] }}. Очікують, підтверджені, завершені та неявки враховуються; скасовані — ні. Залишок після блокувань і записів не є живою доступністю для клієнта: утримання слотів та інші правила запису тут не враховані.</p>
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
              <p class="text-xs text-ui-muted">Спільний календар: {{ stat.aliases }}</p>
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
              <span class="font-semibold" :class="(stat.loadPercent ?? 0) >= 80 ? 'text-emerald-600' : (stat.loadPercent ?? 0) >= 50 ? 'text-amber-600' : 'text-ui-primary'">{{ stat.loadPercent === null ? 'Немає графіка' : `${stat.loadPercent}%` }}</span>
            </div>
            <div class="mt-2 h-2 overflow-hidden rounded-full bg-ui-subtle">
              <div class="h-full rounded-full transition-all" :class="(stat.loadPercent ?? 0) >= 80 ? 'bg-emerald-500' : (stat.loadPercent ?? 0) >= 50 ? 'bg-amber-500' : 'bg-cyan-500'" :style="{ width: `${Math.min(100, stat.loadPercent ?? 0)}%` }" />
            </div>
            <p class="mt-1.5 text-[0.68rem] text-ui-muted">{{ stat.capacityMinutes ? `Залишок ${formatHours(stat.freeMinutes)} з ${formatHours(stat.capacityMinutes)}` : 'Немає місткості для розрахунку' }}</p>
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
    <BaseModal
      :model-value="Boolean(selectedMasterIdentity)"
      max-width-class="max-w-sm"
      aria-label="Деталі майстра"
      @update:model-value="selectedMasterIdentity = null"
    >
      <template #head="{ close, titleId }">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="ui-eyebrow text-sm uppercase tracking-[0.25em]">Майстер</p>
            <h2 :id="titleId" class="mt-2 text-2xl font-semibold text-ui-primary">Деталі майстра</h2>
          </div>
          <ModalCloseButton @click="close" />
        </div>
      </template>
      <template #body>
        <div v-if="selectedMasterIdentity" class="flex items-center gap-3">
          <span class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ui bg-ui-subtle text-sm font-semibold text-ui-secondary">
            <img v-if="selectedMasterIdentity.imageUrl" :src="selectedMasterIdentity.imageUrl" :alt="selectedMasterIdentity.displayName" class="h-full w-full object-cover">
            <span v-else>{{ selectedMasterIdentity.initials }}</span>
          </span>
          <div class="min-w-0">
            <p class="break-words text-lg font-semibold text-ui-primary">{{ selectedMasterIdentity.displayName }}</p>
            <p class="mt-1 text-sm text-ui-muted">{{ selectedMasterIdentity.position }}</p>
          </div>
        </div>
      </template>
    </BaseModal>
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
    <ConfirmActionModal
      :model-value="Boolean(blockSummaryToDelete)"
      title="Видалити блокування?"
      :message="blockDeleteMessage"
      confirm-label="Так, видалити"
      :context-items="blockDeleteContextItems"
      :pending="deletingBlockIds.length > 0"
      destructive
      @confirm="confirmDeleteBlockSummary"
      @update:model-value="handleBlockDeleteConfirmUpdate"
    />
  </div>
</template>
