<script setup lang="ts">
import { CalendarDaysIcon, PhoneIcon, ScissorsIcon, UserIcon } from '@heroicons/vue/24/outline'
import type {
  CalendarAvailabilityRange,
  CalendarBusyRange,
  CalendarDay,
  CalendarDisplayEntry,
  CalendarSelection,
  CalendarSlot,
} from '~/composables/useBookingCalendar'

const props = withDefaults(defineProps<{
  days: CalendarDay[]
  slotsByDay: Record<string, CalendarSlot[]>
  entries: CalendarDisplayEntry[]
  busyRanges: CalendarBusyRange[]
  availabilityRanges?: CalendarAvailabilityRange[]
  selectable?: boolean
  allowPastSelection?: boolean
  loading?: boolean
}>(), {
  availabilityRanges: () => [],
  selectable: true,
  allowPastSelection: false,
  loading: false,
})

const emit = defineEmits<{
  select: [selection: CalendarSelection]
  entryClick: [entry: CalendarDisplayEntry]
  openDay: [day: CalendarDay]
}>()

const calendar = useBookingCalendar()
const { bookingPhone, customerName, todayInput } = useBookingFormatting()
const toast = useBaseToastNotification()
const isCompactViewport = ref(false)
const today = computed(() => todayInput())
const slotHeight = computed(() => isCompactViewport.value ? 54 : 60)
const scrollRef = ref<HTMLElement | null>(null)
const allSlots = computed(() => Object.values(props.slotsByDay).flat())
const busyRangesRef = computed(() => props.busyRanges)
const availabilityRangesRef = computed(() => props.availabilityRanges)
const enabledRef = computed(() => props.selectable && !props.loading)
const allowPastSelectionRef = computed(() => props.allowPastSelection)
const entryTapMoveThreshold = 10
const entryTapMaxDuration = 700
const entryTapCancelWindow = 350
const slotScrollCancelThreshold = 10

const activeEntryTap = ref<{
  id: string
  pointerId: number
  startX: number
  startY: number
  startScrollTop: number
  startedAt: number
  moved: boolean
} | null>(null)
const lastEntryTapCancelAt = ref(0)
const activeSlotGesture = ref<{
  pointerId: number
  startScrollTop: number
  startScrollLeft: number
} | null>(null)

const {
  selectedSlotIds,
  selectionError,
  isSelecting,
  slotById,
  startSelection,
  extendSelection,
  finishSelection,
  clearSelection,
  slotState,
} = useBookingSlotSelection(allSlots, busyRangesRef, enabledRef, allowPastSelectionRef, availabilityRangesRef)

const timeSlots = computed(() => props.days[0] ? props.slotsByDay[props.days[0].date] || [] : [])
const bodyHeight = computed(() => `${timeSlots.value.length * slotHeight.value}px`)
const gridTemplateColumns = computed(() =>
  isCompactViewport.value
    ? `3.25rem repeat(${props.days.length}, minmax(7.75rem, 1fr))`
    : `3.75rem repeat(${props.days.length}, minmax(8.5rem, 1fr))`,
)
const entriesByDay = computed(() => {
  const map: Record<string, CalendarDisplayEntry[]> = {}
  for (const day of props.days) {
    map[day.date] = []
  }
  for (const entry of props.entries) {
    if (map[entry.date]) {
      map[entry.date].push(entry)
    }
  }
  for (const entries of Object.values(map)) {
    entries.sort((first, second) => first.startMinutes - second.startMinutes)
  }
  return map
})

const availabilityRangesByDay = computed(() => {
  const map: Record<string, CalendarAvailabilityRange[]> = {}
  for (const day of props.days) {
    map[day.date] = []
  }
  for (const range of props.availabilityRanges) {
    if (map[range.date]) {
      map[range.date].push(range)
    }
  }
  for (const ranges of Object.values(map)) {
    ranges.sort((first, second) => first.startMinutes - second.startMinutes)
  }
  return map
})

const dayHasAvailability = (day: CalendarDay) =>
  Boolean(availabilityRangesByDay.value[day.date]?.length)

const dayCanOpen = (day: CalendarDay) =>
  props.selectable && !props.loading && !day.isMonday && (props.allowPastSelection || !day.isPast)

const slotClass = (slot: CalendarSlot) => {
  const state = slotState(slot)
  const isPastDay = slot.date < today.value
  return {
    selected: 'border-white/35 bg-white/18 shadow-inner',
    'day-off': 'cursor-not-allowed border-white/8 bg-white/[0.025]',
    past: isPastDay
      ? 'cursor-not-allowed border-white/8 bg-white/[0.025] opacity-50'
      : 'cursor-not-allowed border-white/8 bg-white/[0.035]',
    busy: 'cursor-not-allowed border-white/10 bg-white/[0.045]',
    open: 'border-emerald-300/18 bg-emerald-500/[0.145] hover:border-emerald-200/32 hover:bg-emerald-500/[0.22]',
    closed: 'border-white/[0.055] bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.075]',
    disabled: 'cursor-not-allowed border-white/8 bg-white/[0.03] opacity-55',
  }[state]
}

const slotIsInteractive = (slot: CalendarSlot) => {
  const state = slotState(slot)
  return state === 'open' || state === 'closed' || state === 'selected'
}

const bookingEntryClass = (entry: CalendarDisplayEntry) => {
  switch (entry.booking?.status) {
    case 'completed':
      return 'calendar-entry-completed border-slate-100/28 text-white shadow-black/25 hover:border-slate-50/50'
    case 'confirmed':
    default:
      return 'calendar-entry-confirmed border-emerald-100/42 text-white shadow-black/25 hover:border-emerald-50/65'
  }
}

const entryIsInteractive = (entry: CalendarDisplayEntry) => entry.kind !== 'waitlist_hold'

const entryClass = (entry: CalendarDisplayEntry) => {
  if (entry.kind === 'booking') return `${bookingEntryClass(entry)} hover:scale-[1.01]`
  if (entry.kind === 'waitlist_hold') {
    return 'calendar-entry-hold cursor-default border-amber-200/24 text-amber-50 shadow-black/20'
  }
  return 'blocked-entry border-white/16 bg-white/10 text-white shadow-black/20 hover:scale-[1.01] hover:border-white/28'
}

const entryCustomerName = (entry: CalendarDisplayEntry) =>
  entry.booking ? customerName(entry.booking) : ''

const entryPhone = (entry: CalendarDisplayEntry) =>
  entry.booking ? bookingPhone(entry.booking) : ''

const entryStyle = (entry: CalendarDisplayEntry) => {
  const visibleStart = Math.max(calendar.workdayStartMinutes, entry.startMinutes)
  const visibleEnd = Math.min(calendar.workdayEndMinutes, entry.endMinutes)
  const top = ((visibleStart - calendar.workdayStartMinutes) / calendar.slotMinutes) * slotHeight.value
  const height = Math.max(34, ((visibleEnd - visibleStart) / calendar.slotMinutes) * slotHeight.value - 6)

  return {
    top: `${top + 3}px`,
    height: `${height}px`,
    width: 'calc(100% - 0.5rem)',
  }
}

const beginSlotSelection = (slot: CalendarSlot, event: PointerEvent) => {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  if (event.pointerType === 'mouse') {
    event.preventDefault()
  }
  activeSlotGesture.value = {
    pointerId: event.pointerId,
    startScrollTop: scrollRef.value?.scrollTop || 0,
    startScrollLeft: scrollRef.value?.scrollLeft || 0,
  }
  if (!startSelection(slot)) {
    activeSlotGesture.value = null
  }
}

const extendSlotSelection = (slot: CalendarSlot) => {
  extendSelection(slot)
}

const endSlotSelection = () => {
  const gesture = activeSlotGesture.value
  activeSlotGesture.value = null

  if (gesture && slotGestureScrolled(gesture)) {
    clearSelection()
    return
  }

  const selection = finishSelection()
  if (selection) {
    emit('select', selection)
  }
}

const cancelSlotSelection = (event?: PointerEvent) => {
  if (event && activeSlotGesture.value?.pointerId !== event.pointerId) return
  activeSlotGesture.value = null
  clearSelection()
}

const slotGestureScrolled = (gesture: NonNullable<typeof activeSlotGesture.value>) => {
  const scrollTopDelta = Math.abs((scrollRef.value?.scrollTop || 0) - gesture.startScrollTop)
  const scrollLeftDelta = Math.abs((scrollRef.value?.scrollLeft || 0) - gesture.startScrollLeft)
  return scrollTopDelta > slotScrollCancelThreshold || scrollLeftDelta > slotScrollCancelThreshold
}

const handlePointerMove = (event: PointerEvent) => {
  if (!isSelecting.value) return
  const gesture = activeSlotGesture.value
  if (gesture?.pointerId === event.pointerId && slotGestureScrolled(gesture)) {
    cancelSlotSelection(event)
    return
  }

  const element = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-slot-id]')
  const slotId = element?.dataset.slotId
  const slot = slotId ? slotById.value.get(slotId) : null
  if (slot) {
    extendSelection(slot)
  }
}

const beginEntryTap = (entry: CalendarDisplayEntry, event: PointerEvent) => {
  if (!entryIsInteractive(entry)) return
  if (event.pointerType === 'mouse' && event.button !== 0) return
  activeEntryTap.value = {
    id: entry.id,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startScrollTop: scrollRef.value?.scrollTop || 0,
    startedAt: performance.now(),
    moved: false,
  }
}

const updateEntryTap = (event: PointerEvent) => {
  const tap = activeEntryTap.value
  if (!tap || tap.pointerId !== event.pointerId) return
  const movedByPointer = Math.hypot(event.clientX - tap.startX, event.clientY - tap.startY)
  const movedByScroll = Math.abs((scrollRef.value?.scrollTop || 0) - tap.startScrollTop)
  if (movedByPointer > entryTapMoveThreshold || movedByScroll > entryTapMoveThreshold) {
    tap.moved = true
  }
}

const cancelEntryTap = (event?: PointerEvent) => {
  if (event && activeEntryTap.value?.pointerId !== event.pointerId) return
  activeEntryTap.value = null
  lastEntryTapCancelAt.value = performance.now()
}

const handleEntryClick = (entry: CalendarDisplayEntry, event: MouseEvent) => {
  if (!entryIsInteractive(entry)) return
  const tap = activeEntryTap.value
  const isKeyboardClick = event.detail === 0
  const cancelledRecently = performance.now() - lastEntryTapCancelAt.value < entryTapCancelWindow

  if (!isKeyboardClick) {
    if (!tap || tap.id !== entry.id || tap.moved || cancelledRecently || performance.now() - tap.startedAt > entryTapMaxDuration) {
      activeEntryTap.value = null
      return
    }
  }

  activeEntryTap.value = null
  emit('entryClick', entry)
}

onMounted(() => {
  isCompactViewport.value = window.matchMedia('(max-width: 767px)').matches
  window.addEventListener('pointerup', endSlotSelection)
  window.addEventListener('pointercancel', cancelSlotSelection)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerup', endSlotSelection)
  window.removeEventListener('pointercancel', cancelSlotSelection)
})

watch(
  () => [props.days, props.busyRanges, props.selectable],
  () => clearSelection(),
)

watch(selectionError, value => {
  if (value) toast.warning(value)
})
</script>

<template>
  <section class="booking-calendar-grid liquid-glass overflow-hidden rounded-[1.5rem]">
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-white/[0.025] px-3 py-2">
      <div class="flex flex-wrap items-center gap-2 text-xs text-white/55">
        <span class="inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-100">
          <span class="h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-emerald-100/20" /> Відкрито
        </span>
        <span class="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
          <span class="h-2 w-2 rounded-full bg-white/30 ring-1 ring-white/20" /> Закрито
        </span>
        <span class="inline-flex items-center gap-1 rounded-full border border-emerald-300/15 bg-emerald-400/10 px-2 py-0.5 text-emerald-100">
          <span class="h-2 w-2 rounded-full bg-[var(--success)]" /> Забукано
        </span>
        <span class="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-white/80">
          <span class="h-2 w-2 rounded-full bg-white/75" /> Виконано
        </span>
        <span class="inline-flex items-center gap-1 rounded-full blocked-entry px-2 py-0.5 text-white/80 ring-1 ring-white/10">
          <span class="h-2 w-2 rounded-full bg-white/50" /> Блокування
        </span>
        <span class="calendar-entry-hold inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-amber-50 ring-1 ring-amber-100/15">
          <span class="h-2 w-2 rounded-full bg-amber-300/85" /> Утримання
        </span>
        <span class="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.035] px-2 py-0.5 text-white/42">
          <span class="h-2 w-2 rounded-full bg-white/25" /> Вихідний
        </span>
      </div>
    </div>

    <div
      ref="scrollRef"
      class="calendar-scroll max-h-[72dvh] overflow-auto"
      @pointermove="handlePointerMove"
    >
      <div class="isolate grid min-w-max" :style="{ gridTemplateColumns }">
        <div class="sticky left-0 top-0 z-[70] border-b border-r border-white/10 bg-black/70 px-2 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-white/42 backdrop-blur-2xl">
          Час
        </div>

        <div
          v-for="day in days"
          :key="day.date"
          class="sticky top-0 z-[60] min-w-0 border-b border-r border-white/10 bg-black/64 px-2 py-3 backdrop-blur-2xl"
          :class="day.isMonday ? 'text-white/35' : day.isToday ? 'text-white' : 'text-white/82'"
        >
          <div class="flex min-w-0 items-start justify-between gap-1.5">
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold capitalize">{{ day.weekday }}</p>
              <p class="mt-0.5 truncate text-xs" :class="day.isToday ? 'text-white/68' : 'text-white/42'">
                {{ day.label }}<span v-if="day.isMonday"> · вихідний</span>
              </p>
            </div>
            <BaseButton
              v-if="dayCanOpen(day)"
              type="button"
              class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-white/82 transition hover:text-white"
              :class="dayHasAvailability(day) ? 'border-emerald-300/30 bg-emerald-400/15 hover:bg-emerald-400/25' : 'border-white/12 bg-white/7 hover:bg-white/12'"
              aria-label="Відкрити день для запису"
              title="Відкрити день"
              @click.stop="emit('openDay', day)"
            >
              <CalendarDaysIcon class="h-4 w-4" aria-hidden="true" />
            </BaseButton>
          </div>
        </div>

        <div class="sticky left-0 z-40 border-r border-white/10 bg-[var(--calendar-time-rail-bg)] backdrop-blur-xl" :style="{ height: bodyHeight }">
          <div
            v-for="slot in timeSlots"
            :key="slot.id"
            class="flex items-start justify-end border-t border-white/[0.055] px-1.5 pt-1.5 text-[0.7rem] font-medium text-white/35"
            :style="{ height: `${slotHeight}px` }"
          >
            {{ slot.startTime }}
          </div>
        </div>

        <div
          v-for="day in days"
          :key="`${day.date}-body`"
          class="relative z-0 border-r border-white/10"
          :class="day.isMonday ? 'bg-white/[0.025]' : day.isPast ? 'bg-white/[0.018]' : 'bg-white/[0.035]'"
          :style="{ height: bodyHeight }"
        >
          <div
            v-for="slot in slotsByDay[day.date]"
            :key="slot.id"
            class="relative border-t"
            :class="slotClass(slot)"
            :style="{ height: `${slotHeight}px` }"
          >
            <BaseButton
              type="button"
              class="absolute inset-0 h-full w-full touch-auto px-2 py-1 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-white/30"
              :class="selectedSlotIds.has(slot.id) ? 'bg-white/14' : ''"
              :data-slot-id="slot.id"
              :disabled="!slotIsInteractive(slot)"
              :aria-label="`${slot.startTime}-${slot.endTime}`"
              @pointerdown="beginSlotSelection(slot, $event)"
              @pointerenter="extendSlotSelection(slot)"
            >
              <span v-if="selectedSlotIds.has(slot.id)" class="sr-only">Вибрано</span>
            </BaseButton>
          </div>

          <BaseButton
            v-for="entry in entriesByDay[day.date]"
            :key="entry.id"
            type="button"
            class="absolute left-1 z-[1] flex items-start overflow-hidden rounded-xl border px-2 py-1.5 text-left text-xs shadow-sm backdrop-blur-xl transition"
            :class="entryClass(entry)"
            :style="entryStyle(entry)"
            :disabled="!entryIsInteractive(entry)"
            :aria-label="`${entry.title}. ${entry.subtitle}`"
            @pointerdown="beginEntryTap(entry, $event)"
            @pointermove="updateEntryTap"
            @pointercancel="cancelEntryTap"
            @click.stop="handleEntryClick(entry, $event)"
          >
            <span v-if="entry.kind === 'booking'" class="w-full space-y-1">
              <span class="block truncate font-semibold">{{ entry.meta }}</span>
              <span class="calendar-service-chip mt-0.5 flex items-center gap-1.5 truncate">
                <ScissorsIcon class="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden="true" />
                <span class="min-w-0 truncate">{{ entry.title }}</span>
              </span>
              <span class="flex items-center gap-1.5 rounded-md bg-black/22 px-1.5 py-0.5 shadow-sm ring-1 ring-white/10">
                <UserIcon class="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
                <span class="min-w-0 truncate">{{ entryCustomerName(entry) }}</span>
              </span>
              <span class="flex items-center gap-1.5 rounded-md bg-black/22 px-1.5 py-0.5 shadow-sm ring-1 ring-white/10">
                <PhoneIcon class="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
                <span class="min-w-0 truncate">{{ entryPhone(entry) || 'Без телефону' }}</span>
              </span>
            </span>
            <span v-else class="w-full blocked-entry-label">
              <span class="block truncate font-semibold">{{ entry.meta }}</span>
              <span class="mt-0.5 block truncate">{{ entry.title }}</span>
              <span class="mt-0.5 block truncate opacity-80">{{ entry.subtitle }}</span>
            </span>
          </BaseButton>

          <div v-if="day.isMonday" class="pointer-events-none absolute inset-0 z-0 flex items-center justify-center bg-black/12 px-4 text-center">
            <span class="rounded-full border border-white/10 bg-black/45 px-3 py-1 text-xs font-medium text-white/48 backdrop-blur-xl">
              Понеділок недоступний
            </span>
          </div>
          <div v-else-if="day.isPast" class="pointer-events-none absolute inset-0 z-0 flex items-center justify-center bg-black/10 px-4 text-center">
            <span class="rounded-full border border-white/10 bg-black/45 px-3 py-1 text-xs font-medium text-white/48 backdrop-blur-xl">
              Минулий день
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.calendar-scroll {
  overscroll-behavior: contain;
}

.calendar-entry-confirmed {
  background:
    linear-gradient(135deg, rgb(16 185 129 / 0.46), rgb(4 120 87 / 0.34)),
    rgb(6 78 59 / 0.56);
}

.calendar-entry-completed {
  background:
    linear-gradient(135deg, rgb(148 163 184 / 0.32), rgb(71 85 105 / 0.34)),
    rgb(15 23 42 / 0.54);
}

.calendar-entry-hold {
  background:
    repeating-linear-gradient(
      135deg,
      rgb(251 191 36 / 0.16) 0,
      rgb(251 191 36 / 0.16) 8px,
      rgb(120 53 15 / 0.18) 8px,
      rgb(120 53 15 / 0.18) 16px
    ),
    rgb(120 53 15 / 0.42);
}

.calendar-service-chip {
  border-radius: 9999px;
  border: 1px solid rgb(255 255 255 / 0.18);
  background: rgb(0 0 0 / 0.34);
  padding: 0.125rem 0.375rem;
  color: rgb(255 255 255 / 0.94);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.08),
    0 1px 2px rgb(0 0 0 / 0.22);
}

.blocked-entry {
  background-color: rgb(255 255 255 / 0.08);
  background-image: repeating-linear-gradient(
    45deg,
    rgb(255 255 255 / 0.10) 0,
    rgb(255 255 255 / 0.10) 7px,
    transparent 7px,
    transparent 14px
  );
}

.blocked-entry-label {
  display: block;
  border-radius: 0.375rem;
  background: rgb(0 0 0 / 0.24);
  padding: 0.125rem 0.25rem;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.2);
}
</style>
