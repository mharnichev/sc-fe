<script setup lang="ts">
import type {
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
  selectable?: boolean
  loading?: boolean
}>(), {
  selectable: true,
  loading: false,
})

const emit = defineEmits<{
  select: [selection: CalendarSelection]
  entryClick: [entry: CalendarDisplayEntry]
}>()

const calendar = useBookingCalendar()
const slotHeight = 68
const scrollRef = ref<HTMLElement | null>(null)
const allSlots = computed(() => Object.values(props.slotsByDay).flat())
const busyRangesRef = computed(() => props.busyRanges)
const enabledRef = computed(() => props.selectable && !props.loading)
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
} = useBookingSlotSelection(allSlots, busyRangesRef, enabledRef)

const timeSlots = computed(() => props.days[0] ? props.slotsByDay[props.days[0].date] || [] : [])
const bodyHeight = computed(() => `${timeSlots.value.length * slotHeight}px`)
const gridTemplateColumns = computed(() => `4.75rem repeat(${props.days.length}, minmax(11.5rem, 1fr))`)
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

const slotClass = (slot: CalendarSlot) => {
  const state = slotState(slot)
  return {
    selected: 'border-cyan-400 bg-cyan-100/85 shadow-inner',
    'day-off': 'cursor-not-allowed border-slate-200 bg-slate-100',
    past: 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-70',
    busy: 'cursor-not-allowed border-rose-100 bg-rose-50/60',
    free: 'border-slate-100 bg-white hover:border-cyan-200 hover:bg-cyan-50/70',
    disabled: 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-75',
  }[state]
}

const bookingEntryClass = (entry: CalendarDisplayEntry) => {
  switch (entry.booking?.status) {
    case 'completed':
      return 'border-indigo-200 bg-indigo-50 text-indigo-950 shadow-indigo-950/5 hover:border-indigo-300'
    case 'pending':
      return 'border-amber-200 bg-amber-50 text-amber-950 shadow-amber-950/5 hover:border-amber-300'
    case 'confirmed':
    default:
      return 'border-emerald-200 bg-emerald-50 text-emerald-950 shadow-emerald-950/5 hover:border-emerald-300'
  }
}

const entryClass = (entry: CalendarDisplayEntry) =>
  entry.kind === 'booking'
    ? bookingEntryClass(entry)
    : 'blocked-entry border-slate-400 bg-slate-100 text-slate-800 shadow-slate-950/5 hover:border-slate-500'

const entryStyle = (entry: CalendarDisplayEntry) => {
  const visibleStart = Math.max(calendar.workdayStartMinutes, entry.startMinutes)
  const visibleEnd = Math.min(calendar.workdayEndMinutes, entry.endMinutes)
  const top = ((visibleStart - calendar.workdayStartMinutes) / calendar.slotMinutes) * slotHeight
  const height = Math.max(38, ((visibleEnd - visibleStart) / calendar.slotMinutes) * slotHeight - 6)

  return {
    top: `${top + 3}px`,
    height: `${height}px`,
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
</script>

<template>
  <section class="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-sm">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
      <div class="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span class="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">
          <span class="h-2 w-2 rounded-full bg-white ring-1 ring-slate-300" /> Вільно
        </span>
        <span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800 ring-1 ring-emerald-100">
          <span class="h-2 w-2 rounded-full bg-emerald-500" /> Забукано
        </span>
        <span class="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-800 ring-1 ring-indigo-100">
          <span class="h-2 w-2 rounded-full bg-indigo-500" /> Виконано
        </span>
        <span class="inline-flex items-center gap-1 rounded-full blocked-entry px-2.5 py-1 text-slate-800 ring-1 ring-slate-300">
          <span class="h-2 w-2 rounded-full bg-slate-600" /> Блокування
        </span>
        <span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-500 ring-1 ring-slate-200">
          <span class="h-2 w-2 rounded-full bg-slate-300" /> Вихідний
        </span>
      </div>
      <p v-if="selectionError" class="text-sm font-medium text-rose-600">{{ selectionError }}</p>
    </div>

    <div
      ref="scrollRef"
      class="calendar-scroll max-h-[72dvh] overflow-auto"
      @pointermove="handlePointerMove"
    >
      <div class="grid min-w-max" :style="{ gridTemplateColumns }">
        <div class="sticky left-0 top-0 z-30 border-b border-r border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
          Час
        </div>

        <div
          v-for="day in days"
          :key="day.date"
          class="sticky top-0 z-20 min-w-0 border-b border-r border-slate-200 px-3 py-3"
          :class="day.isMonday ? 'bg-slate-100 text-slate-500' : day.isToday ? 'bg-cyan-50 text-cyan-950' : 'bg-white text-slate-900'"
        >
          <p class="truncate text-sm font-semibold capitalize">{{ day.weekday }}</p>
          <p class="mt-0.5 truncate text-xs" :class="day.isToday ? 'text-cyan-700' : 'text-slate-500'">
            {{ day.label }}<span v-if="day.isMonday"> · вихідний</span>
          </p>
        </div>

        <div class="sticky left-0 z-10 border-r border-slate-200 bg-white" :style="{ height: bodyHeight }">
          <div
            v-for="slot in timeSlots"
            :key="slot.id"
            class="flex items-start justify-end border-t border-slate-100 px-2 pt-2 text-xs font-medium text-slate-400"
            :style="{ height: `${slotHeight}px` }"
          >
            {{ slot.startTime }}
          </div>
        </div>

        <div
          v-for="day in days"
          :key="`${day.date}-body`"
          class="relative border-r border-slate-200"
          :class="day.isMonday ? 'bg-slate-100/80' : 'bg-white'"
          :style="{ height: bodyHeight }"
        >
          <div
            v-for="slot in slotsByDay[day.date]"
            :key="slot.id"
            class="relative border-t"
            :class="slotClass(slot)"
            :style="{ height: `${slotHeight}px` }"
          >
            <button
              type="button"
              class="absolute inset-0 h-full w-full touch-auto px-2 py-1 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-500"
              :class="selectedSlotIds.has(slot.id) ? 'bg-cyan-100/80' : ''"
              :data-slot-id="slot.id"
              :disabled="slotState(slot) !== 'free' && slotState(slot) !== 'selected'"
              :aria-label="`${slot.startTime}-${slot.endTime}`"
              @pointerdown="beginSlotSelection(slot, $event)"
              @pointerenter="extendSlotSelection(slot)"
            >
              <span v-if="selectedSlotIds.has(slot.id)" class="sr-only">Вибрано</span>
            </button>
          </div>

          <button
            v-for="entry in entriesByDay[day.date]"
            :key="entry.id"
            type="button"
            class="absolute left-1 right-1 z-10 flex items-start overflow-hidden rounded-lg border px-2 py-1.5 text-left text-xs shadow-sm transition"
            :class="entryClass(entry)"
            :style="entryStyle(entry)"
            @pointerdown="beginEntryTap(entry, $event)"
            @pointermove="updateEntryTap"
            @pointercancel="cancelEntryTap"
            @click.stop="handleEntryClick(entry, $event)"
          >
            <span class="w-full" :class="entry.kind === 'block' ? 'blocked-entry-label' : ''">
              <span class="block truncate font-semibold">{{ entry.meta }}</span>
              <span class="mt-0.5 block truncate">{{ entry.title }}</span>
              <span class="mt-0.5 block truncate opacity-80">{{ entry.subtitle }}</span>
            </span>
          </button>

          <div v-if="day.isMonday" class="pointer-events-none absolute inset-0 z-0 flex items-center justify-center bg-slate-100/35 px-4 text-center">
            <span class="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
              Понеділок недоступний
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

.blocked-entry {
  background-color: #f1f5f9;
  background-image: repeating-linear-gradient(
    45deg,
    rgb(100 116 139 / 0.18) 0,
    rgb(100 116 139 / 0.18) 7px,
    transparent 7px,
    transparent 14px
  );
}

.blocked-entry-label {
  display: block;
  border-radius: 0.375rem;
  background: rgb(255 255 255 / 0.86);
  padding: 0.125rem 0.25rem;
  box-shadow: 0 1px 2px rgb(15 23 42 / 0.08);
}
</style>
