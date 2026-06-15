import type { Booking, MasterAvailabilityWindow, Service, TimeBlock } from '~/composables/useBackofficeApi'

export type CalendarViewMode = 'today' | 'week' | 'month'
export type CalendarEntryKind = 'booking' | 'block'
export type CalendarActionType = 'booking' | 'block' | 'availability'

export interface CalendarDay {
  date: string
  label: string
  weekday: string
  isToday: boolean
  isMonday: boolean
  isPast: boolean
}

export interface CalendarSlot {
  id: string
  date: string
  startTime: string
  endTime: string
  startAt: string
  endAt: string
  startMinutes: number
  endMinutes: number
  isMonday: boolean
  isPast: boolean
  disabled: boolean
}

export interface CalendarBusyRange {
  id: string
  kind: CalendarEntryKind
  date: string
  startAt: string
  endAt: string
  startMinutes: number
  endMinutes: number
}

export interface CalendarAvailabilityRange {
  id: string
  date: string
  startAt: string
  endAt: string
  startMinutes: number
  endMinutes: number
  window: MasterAvailabilityWindow
}

export interface CalendarDisplayEntry extends CalendarBusyRange {
  title: string
  subtitle: string
  meta: string
  booking?: Booking
  block?: TimeBlock
}

export interface CalendarSelection {
  date: string
  startTime: string
  endTime: string
  startAt: string
  endAt: string
  slotIds: string[]
}

export interface CalendarActionPayload {
  action: CalendarActionType
  service_id: number | null
  service_ids: number[]
  duration_minutes?: number
  customer_name: string
  customer_phone: string
  customer_email: string
  note: string
  start_at: string
  end_at: string
}

export const calendarViewLabels: Record<CalendarViewMode, string> = {
  today: 'Сьогодні',
  week: '7 днів',
  month: '30 днів',
}

const workdayStart = '09:00'
const workdayEnd = '20:00'
const slotMinutes = 30
const workdayStartMinutes = 9 * 60
const workdayEndMinutes = 20 * 60

const pad = (value: number) => String(value).padStart(2, '0')

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

const minutesToTime = (minutes: number) =>
  `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`

const hasValidDate = (value: Date) => !Number.isNaN(value.getTime())

export const useBookingCalendar = () => {
  const {
    timeZone,
    addDaysInput,
    todayInput,
    toKyivIso,
    formatTime,
    bookingStart,
    bookingEnd,
    bookingPhone,
    customerName,
    bookingRedirectSourceLabel,
    bookingServices,
    bookingServicesLabel,
  } = useBookingFormatting()

  const dateInputFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const dayHeaderFormatter = new Intl.DateTimeFormat('uk-UA', {
    timeZone,
    day: '2-digit',
    month: 'short',
  })

  const weekdayFormatter = new Intl.DateTimeFormat('uk-UA', {
    timeZone,
    weekday: 'short',
  })

  const dateInputFromDateTime = (value?: string | null) => {
    if (!value) return ''
    const date = new Date(value)
    if (!hasValidDate(date)) return ''
    const parts = Object.fromEntries(dateInputFormatter.formatToParts(date).map(part => [part.type, part.value]))
    return `${parts.year}-${parts.month}-${parts.day}`
  }

  const timeInputFromDateTime = (value?: string | null) => {
    const formatted = formatTime(value)
    return formatted === '-' ? '' : formatted
  }

  const isMonday = (dateInput: string) => {
    const [year, month, day] = dateInput.split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay() === 1
  }

  const formatDayLabel = (dateInput: string) =>
    dayHeaderFormatter.format(new Date(toKyivIso(dateInput, '12:00')))

  const formatWeekday = (dateInput: string) =>
    weekdayFormatter.format(new Date(toKyivIso(dateInput, '12:00')))

  const daysInView = (mode: CalendarViewMode) => {
    if (mode === 'today') return 1
    if (mode === 'week') return 7
    return 30
  }

  const buildDays = (anchorDate: string, mode: CalendarViewMode): CalendarDay[] => {
    const today = todayInput()
    return Array.from({ length: daysInView(mode) }, (_, index) => {
      const date = addDaysInput(anchorDate, index)
      return {
        date,
        label: formatDayLabel(date),
        weekday: formatWeekday(date),
        isToday: date === today,
        isMonday: isMonday(date),
        isPast: date < today,
      }
    })
  }

  const buildDaySlots = (day: CalendarDay, now = new Date()): CalendarSlot[] => {
    const nowTime = now.getTime()
    const slots: CalendarSlot[] = []

    for (let minutes = workdayStartMinutes; minutes < workdayEndMinutes; minutes += slotMinutes) {
      const startTime = minutesToTime(minutes)
      const endTime = minutesToTime(minutes + slotMinutes)
      const startAt = toKyivIso(day.date, startTime)
      const endAt = toKyivIso(day.date, endTime)
      const isPast = new Date(endAt).getTime() <= nowTime

      slots.push({
        id: `${day.date}-${startTime}`,
        date: day.date,
        startTime,
        endTime,
        startAt,
        endAt,
        startMinutes: minutes,
        endMinutes: minutes + slotMinutes,
        isMonday: day.isMonday,
        isPast,
        disabled: day.isMonday || isPast,
      })
    }

    return slots
  }

  const buildSlotsByDay = (days: CalendarDay[]) => {
    const now = new Date()
    return Object.fromEntries(days.map(day => [day.date, buildDaySlots(day, now)])) as Record<string, CalendarSlot[]>
  }

  const rangesOverlap = (firstStart: string, firstEnd: string, secondStart: string, secondEnd: string) => {
    const firstStartTime = new Date(firstStart).getTime()
    const firstEndTime = new Date(firstEnd).getTime()
    const secondStartTime = new Date(secondStart).getTime()
    const secondEndTime = new Date(secondEnd).getTime()

    if ([firstStartTime, firstEndTime, secondStartTime, secondEndTime].some(Number.isNaN)) return false
    return firstStartTime < secondEndTime && secondStartTime < firstEndTime
  }

  const rangeOverlapsBusy = (startAt: string, endAt: string, busyRanges: CalendarBusyRange[]) =>
    busyRanges.some(range => rangesOverlap(startAt, endAt, range.startAt, range.endAt))

  const serviceDuration = (booking: Booking, services: Service[]) => {
    const duration = bookingServices(booking, services).reduce((total, service) => total + Number(service.duration_minutes || 0), 0)
    return duration || 30
  }

  const bookingRange = (booking: Booking, services: Service[]): CalendarBusyRange | null => {
    const startAt = bookingStart(booking)
    const rawEnd = bookingEnd(booking)
    if (!startAt || booking.status === 'cancelled') return null

    const startDate = new Date(startAt)
    if (!hasValidDate(startDate)) return null

    const endAt = rawEnd || new Date(startDate.getTime() + serviceDuration(booking, services) * 60000).toISOString()
    const date = dateInputFromDateTime(startAt)
    const startTime = timeInputFromDateTime(startAt)
    const endTime = timeInputFromDateTime(endAt)
    if (!date || !startTime || !endTime) return null

    return {
      id: `booking-${booking.id}`,
      kind: 'booking',
      date,
      startAt,
      endAt,
      startMinutes: toMinutes(startTime),
      endMinutes: toMinutes(endTime),
    }
  }

  const blockRange = (block: TimeBlock): CalendarBusyRange | null => {
    const date = dateInputFromDateTime(block.start_at)
    const startTime = timeInputFromDateTime(block.start_at)
    const endTime = timeInputFromDateTime(block.end_at)
    if (!date || !startTime || !endTime) return null

    return {
      id: `block-${block.id}`,
      kind: 'block',
      date,
      startAt: block.start_at,
      endAt: block.end_at,
      startMinutes: toMinutes(startTime),
      endMinutes: toMinutes(endTime),
    }
  }

  const availabilityRange = (window: MasterAvailabilityWindow): CalendarAvailabilityRange | null => {
    const date = dateInputFromDateTime(window.start_at)
    const startTime = timeInputFromDateTime(window.start_at)
    const endTime = timeInputFromDateTime(window.end_at)
    if (!date || !startTime || !endTime) return null

    return {
      id: `availability-${window.id}`,
      date,
      startAt: window.start_at,
      endAt: window.end_at,
      startMinutes: toMinutes(startTime),
      endMinutes: toMinutes(endTime),
      window,
    }
  }

  const buildBusyRanges = (bookings: Booking[], blocks: TimeBlock[], services: Service[]) => [
    ...bookings.map(booking => bookingRange(booking, services)).filter(Boolean) as CalendarBusyRange[],
    ...blocks.map(blockRange).filter(Boolean) as CalendarBusyRange[],
  ]

  const buildAvailabilityRanges = (windows: MasterAvailabilityWindow[]) =>
    windows.map(availabilityRange).filter(Boolean) as CalendarAvailabilityRange[]

  const rangeWithinAvailability = (startAt: string, endAt: string, availabilityRanges: CalendarAvailabilityRange[]) => {
    const startTime = new Date(startAt).getTime()
    const endTime = new Date(endAt).getTime()
    if ([startTime, endTime].some(Number.isNaN)) return false

    return availabilityRanges.some(range => {
      const rangeStart = new Date(range.startAt).getTime()
      const rangeEnd = new Date(range.endAt).getTime()
      if ([rangeStart, rangeEnd].some(Number.isNaN)) return false
      return rangeStart <= startTime && rangeEnd >= endTime
    })
  }

  const rangeOverlapsAvailability = (startAt: string, endAt: string, availabilityRanges: CalendarAvailabilityRange[]) =>
    availabilityRanges.some(range => rangesOverlap(startAt, endAt, range.startAt, range.endAt))

  const buildDisplayEntries = (bookings: Booking[], blocks: TimeBlock[], services: Service[]): CalendarDisplayEntry[] => {
    const bookingEntries = bookings
      .map(booking => {
        const range = bookingRange(booking, services)
        if (!range) return null
        return {
          ...range,
          title: bookingServicesLabel(booking, services),
          subtitle: [customerName(booking), bookingPhone(booking) || 'Без телефону', bookingRedirectSourceLabel(booking)].filter(Boolean).join(' · '),
          meta: `${formatTime(range.startAt)}-${formatTime(range.endAt)}`,
          booking,
        }
      })
      .filter(Boolean) as CalendarDisplayEntry[]

    const blockEntries = blocks
      .map(block => {
        const range = blockRange(block)
        if (!range) return null
        return {
          ...range,
          title: 'Заблоковано',
          subtitle: block.reason || 'Без причини',
          meta: `${formatTime(range.startAt)}-${formatTime(range.endAt)}`,
          block,
        }
      })
      .filter(Boolean) as CalendarDisplayEntry[]

    return [...bookingEntries, ...blockEntries]
  }

  const selectionFromSlots = (slots: CalendarSlot[]): CalendarSelection | null => {
    if (!slots.length) return null
    const sorted = [...slots].sort((first, second) => first.startMinutes - second.startMinutes)
    return {
      date: sorted[0].date,
      startTime: sorted[0].startTime,
      endTime: sorted[sorted.length - 1].endTime,
      startAt: sorted[0].startAt,
      endAt: sorted[sorted.length - 1].endAt,
      slotIds: sorted.map(slot => slot.id),
    }
  }

  return {
    workdayStart,
    workdayEnd,
    slotMinutes,
    workdayStartMinutes,
    workdayEndMinutes,
    toMinutes,
    minutesToTime,
    daysInView,
    buildDays,
    buildSlotsByDay,
    buildBusyRanges,
    buildAvailabilityRanges,
    buildDisplayEntries,
    dateInputFromDateTime,
    isMonday,
    rangeOverlapsBusy,
    rangeWithinAvailability,
    rangeOverlapsAvailability,
    rangesOverlap,
    selectionFromSlots,
  }
}

export const useBookingSlotSelection = (
  slots: Ref<CalendarSlot[]>,
  busyRanges: Ref<CalendarBusyRange[]>,
  enabled: Ref<boolean>,
  allowPastSelection: Ref<boolean> = ref(false),
  availabilityRanges: Ref<CalendarAvailabilityRange[]> = ref([]),
) => {
  const calendar = useBookingCalendar()
  const anchorSlot = ref<CalendarSlot | null>(null)
  const selectedSlots = ref<CalendarSlot[]>([])
  const isSelecting = ref(false)
  const selectionError = ref('')

  const selectedSlotIds = computed(() => new Set(selectedSlots.value.map(slot => slot.id)))
  const selectedRange = computed(() => calendar.selectionFromSlots(selectedSlots.value))

  const slotById = computed(() => {
    const map = new Map<string, CalendarSlot>()
    for (const slot of slots.value) {
      map.set(slot.id, slot)
    }
    return map
  })

  const slotHasConflict = (slot: CalendarSlot) =>
    busyRanges.value.some(range => range.date === slot.date && calendar.rangesOverlap(slot.startAt, slot.endAt, range.startAt, range.endAt))

  const slotIsOpen = (slot: CalendarSlot) =>
    calendar.rangeWithinAvailability(slot.startAt, slot.endAt, availabilityRanges.value)

  const slotIsSelectable = (slot: CalendarSlot) =>
    enabled.value && !slot.isMonday && (allowPastSelection.value || !slot.isPast) && !slotHasConflict(slot)

  const describeBlockedSlot = (slot: CalendarSlot) => {
    if (!enabled.value) return 'Виберіть майстра, щоб керувати календарем.'
    if (slot.isMonday) return 'Понеділок — вихідний день.'
    if (slot.isPast && !allowPastSelection.value) return 'Минулі часові слоти недоступні.'
    if (slotHasConflict(slot)) return 'Цей час уже має бронювання або блокування.'
    return ''
  }

  const slotsBetween = (start: CalendarSlot, end: CalendarSlot) => {
    if (start.date !== end.date) return []
    const from = Math.min(start.startMinutes, end.startMinutes)
    const to = Math.max(start.startMinutes, end.startMinutes)
    return slots.value
      .filter(slot => slot.date === start.date && slot.startMinutes >= from && slot.startMinutes <= to)
      .sort((first, second) => first.startMinutes - second.startMinutes)
  }

  const applySelection = (target: CalendarSlot) => {
    const anchor = anchorSlot.value
    if (!anchor) return false
    const nextSlots = slotsBetween(anchor, target)
    if (!nextSlots.length) {
      selectionError.value = 'Виберіть безперервний час в межах одного дня.'
      return false
    }

    const blockedSlot = nextSlots.find(slot => !slotIsSelectable(slot))
    if (blockedSlot) {
      selectionError.value = describeBlockedSlot(blockedSlot)
      return false
    }

    selectedSlots.value = nextSlots
    selectionError.value = ''
    return true
  }

  const startSelection = (slot: CalendarSlot) => {
    selectionError.value = ''
    if (!slotIsSelectable(slot)) {
      selectedSlots.value = []
      anchorSlot.value = null
      isSelecting.value = false
      selectionError.value = describeBlockedSlot(slot)
      return false
    }

    anchorSlot.value = slot
    selectedSlots.value = [slot]
    isSelecting.value = true
    return true
  }

  const extendSelection = (slot: CalendarSlot) => {
    if (!isSelecting.value) return false
    return applySelection(slot)
  }

  const finishSelection = () => {
    if (!isSelecting.value) return null
    isSelecting.value = false
    return selectedRange.value
  }

  const clearSelection = () => {
    anchorSlot.value = null
    selectedSlots.value = []
    isSelecting.value = false
    selectionError.value = ''
  }

  const slotState = (slot: CalendarSlot) => {
    if (selectedSlotIds.value.has(slot.id)) return 'selected'
    if (slot.isMonday) return 'day-off'
    if (slot.isPast && !allowPastSelection.value) return 'past'
    if (slotHasConflict(slot)) return 'busy'
    if (!enabled.value) return 'disabled'
    return slotIsOpen(slot) ? 'open' : 'closed'
  }

  return {
    selectedSlotIds,
    selectedRange,
    selectionError,
    isSelecting,
    slotById,
    slotHasConflict,
    slotIsOpen,
    slotIsSelectable,
    startSelection,
    extendSelection,
    finishSelection,
    clearSelection,
    slotState,
  }
}
