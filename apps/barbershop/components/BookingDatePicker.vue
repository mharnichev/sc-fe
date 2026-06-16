<script setup lang="ts">
type LocaleCode = 'uk' | 'en'

type CalendarDay = {
  value: string
  label: string
  day: number
  currentMonth: boolean
  disabled: boolean
  selected: boolean
  today: boolean
}

const props = withDefaults(defineProps<{
  modelValue: string
  min: string
  max: string
  locale: LocaleCode
  disabledWeekdays?: number[]
}>(), {
  disabledWeekdays: () => [],
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isOpen = ref(false)
let previousBodyOverflow = ''

const dateLocale = computed(() => props.locale === 'en' ? 'en-US' : 'uk-UA')

const copy = computed(() => props.locale === 'en'
  ? {
      open: 'Choose date',
      selected: 'Selected date',
      close: 'Close',
      previous: 'Previous month',
      next: 'Next month',
      unavailable: 'Unavailable',
      today: 'Today',
    }
  : {
      open: 'Обрати дату',
      selected: 'Обрана дата',
      close: 'Закрити',
      previous: 'Попередній місяць',
      next: 'Наступний місяць',
      unavailable: 'Недоступно',
      today: 'Сьогодні',
    },
)

const parseDateInput = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null

  return new Date(year, month - 1, day)
}

const formatDateInput = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const addMonths = (date: Date, months: number) =>
  new Date(date.getFullYear(), date.getMonth() + months, 1)

const monthStart = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1)

const compareMonths = (first: Date, second: Date) =>
  first.getFullYear() * 12 + first.getMonth() - (second.getFullYear() * 12 + second.getMonth())

const todayValue = formatDateInput(new Date())
const initialVisibleDate = parseDateInput(props.modelValue) || parseDateInput(props.min) || new Date()
const visibleMonth = ref(monthStart(initialVisibleDate))

const selectedDate = computed(() => parseDateInput(props.modelValue))
const minDate = computed(() => parseDateInput(props.min))
const maxDate = computed(() => parseDateInput(props.max))

const formatFullDate = (date: Date) =>
  new Intl.DateTimeFormat(dateLocale.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)

const formatSelectedDate = (date: Date) =>
  new Intl.DateTimeFormat(dateLocale.value, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  }).format(date)

const selectedDateLabel = computed(() => {
  if (!selectedDate.value) return copy.value.open
  return formatSelectedDate(selectedDate.value)
})

const monthTitle = computed(() =>
  new Intl.DateTimeFormat(dateLocale.value, {
    month: 'long',
    year: 'numeric',
  }).format(visibleMonth.value),
)

const weekdayLabels = computed(() =>
  Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(dateLocale.value, { weekday: 'short' }).format(new Date(2026, 0, 5 + index)),
  ),
)

const isDateDisabled = (date: Date) => {
  const value = formatDateInput(date)
  if (props.min && value < props.min) return true
  if (props.max && value > props.max) return true

  return props.disabledWeekdays.includes(date.getDay())
}

const calendarDays = computed<CalendarDay[]>(() => {
  const firstDay = monthStart(visibleMonth.value)
  const offset = (firstDay.getDay() + 6) % 7
  const gridStart = addDays(firstDay, -offset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index)
    const value = formatDateInput(date)
    const disabled = isDateDisabled(date)

    return {
      value,
      label: `${formatFullDate(date)}${disabled ? `, ${copy.value.unavailable}` : ''}`,
      day: date.getDate(),
      currentMonth: date.getMonth() === visibleMonth.value.getMonth(),
      disabled,
      selected: props.modelValue === value,
      today: value === todayValue,
    }
  })
})

const canGoPrevious = computed(() => {
  if (!minDate.value) return true
  return compareMonths(visibleMonth.value, monthStart(minDate.value)) > 0
})

const canGoNext = computed(() => {
  if (!maxDate.value) return true
  return compareMonths(visibleMonth.value, monthStart(maxDate.value)) < 0
})

const openSheet = () => {
  isOpen.value = true
}

const closeSheet = () => {
  isOpen.value = false
}

const goToPreviousMonth = () => {
  if (!canGoPrevious.value) return
  visibleMonth.value = addMonths(visibleMonth.value, -1)
}

const goToNextMonth = () => {
  if (!canGoNext.value) return
  visibleMonth.value = addMonths(visibleMonth.value, 1)
}

const selectDate = (day: CalendarDay) => {
  if (day.disabled) return

  emit('update:modelValue', day.value)
  closeSheet()
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeSheet()
  }
}

watch(
  () => props.modelValue,
  (value) => {
    const date = parseDateInput(value)
    if (date) {
      visibleMonth.value = monthStart(date)
    }
  },
)

watch(
  () => isOpen.value,
  (open) => {
    if (!import.meta.client) return

    if (open) {
      previousBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return
    }

    document.body.style.overflow = previousBodyOverflow
  },
  { flush: 'post' },
)

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)

  if (import.meta.client && isOpen.value) {
    document.body.style.overflow = previousBodyOverflow
  }
})
</script>

<template>
  <div class="booking-date-picker mt-4">
    <button
      type="button"
      class="flex min-h-14 w-full items-center justify-between gap-3 border border-white/15 bg-white/[0.04] px-4 py-3 text-left text-white transition hover:border-white/40 hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/55 md:hidden"
      :aria-expanded="isOpen"
      aria-controls="booking-calendar-mobile"
      @click="openSheet"
    >
      <span>
        <span class="block text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/45">{{ copy.selected }}</span>
        <span class="mt-1 block text-base font-semibold leading-tight">{{ selectedDateLabel }}</span>
      </span>
      <svg class="h-5 w-5 shrink-0 text-white/60" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M5 4.5h10A1.5 1.5 0 0 1 16.5 6v9A1.5 1.5 0 0 1 15 16.5H5A1.5 1.5 0 0 1 3.5 15V6A1.5 1.5 0 0 1 5 4.5Z" stroke="currentColor" stroke-width="1.5" />
        <path d="M6.5 3.5v3M13.5 3.5v3M3.8 8.2h12.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </button>

    <div class="hidden border border-white/15 bg-white/[0.04] p-3 md:block">
      <div class="flex items-center justify-between gap-3">
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center border border-white/15 text-white/75 transition hover:border-white/45 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          :disabled="!canGoPrevious"
          :aria-label="copy.previous"
          @click="goToPreviousMonth"
        >
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <p class="text-sm font-semibold capitalize text-white">{{ monthTitle }}</p>
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center border border-white/15 text-white/75 transition hover:border-white/45 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          :disabled="!canGoNext"
          :aria-label="copy.next"
          @click="goToNextMonth"
        >
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M7.5 4.5 13 10l-5.5 5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>

      <div class="mt-4 grid grid-cols-7 gap-1 text-center text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-white/40">
        <span v-for="weekday in weekdayLabels" :key="weekday">{{ weekday }}</span>
      </div>

      <div class="mt-2 grid grid-cols-7 gap-1">
        <button
          v-for="day in calendarDays"
          :key="day.value"
          type="button"
          class="relative flex aspect-square min-h-9 items-center justify-center border text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          :class="[
            day.selected
              ? 'border-white bg-white text-neutral-950'
              : day.disabled
                ? 'cursor-not-allowed border-transparent text-white/18'
                : day.currentMonth
                  ? 'border-white/10 text-white/78 hover:border-white/45 hover:bg-white/[0.07] hover:text-white'
                  : 'border-transparent text-white/30 hover:border-white/20 hover:text-white/60',
          ]"
          :disabled="day.disabled"
          :aria-label="day.label"
          :aria-current="day.today ? 'date' : undefined"
          @click="selectDate(day)"
        >
          <span>{{ day.day }}</span>
          <span v-if="day.today && !day.selected" class="absolute bottom-1 h-0.5 w-3 bg-red-700" aria-hidden="true" />
        </button>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="booking-calendar-overlay">
        <div
          v-if="isOpen"
          class="booking-calendar-overlay fixed inset-0 z-[80] flex items-end bg-black/65 px-0 md:hidden"
          @click.self="closeSheet"
        >
          <Transition name="booking-calendar-sheet" appear>
            <div
              id="booking-calendar-mobile"
              class="booking-calendar-sheet w-full rounded-t-lg border border-white/15 bg-neutral-950 p-4 text-white shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="booking-calendar-title"
            >
              <div class="mx-auto mb-4 h-1 w-11 rounded-full bg-white/25" aria-hidden="true" />
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-white/45">{{ copy.selected }}</p>
                  <h3 id="booking-calendar-title" class="mt-1 text-xl font-semibold leading-tight">{{ selectedDateLabel }}</h3>
                </div>
                <button
                  type="button"
                  class="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-white/15 text-white/75 transition hover:border-white/45 hover:text-white"
                  :aria-label="copy.close"
                  @click="closeSheet"
                >
                  <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                  </svg>
                </button>
              </div>

              <div class="mt-5 flex items-center justify-between gap-3">
                <button
                  type="button"
                  class="inline-flex h-10 w-10 items-center justify-center border border-white/15 text-white/75 transition hover:border-white/45 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  :disabled="!canGoPrevious"
                  :aria-label="copy.previous"
                  @click="goToPreviousMonth"
                >
                  <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
                <p class="text-base font-semibold capitalize">{{ monthTitle }}</p>
                <button
                  type="button"
                  class="inline-flex h-10 w-10 items-center justify-center border border-white/15 text-white/75 transition hover:border-white/45 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  :disabled="!canGoNext"
                  :aria-label="copy.next"
                  @click="goToNextMonth"
                >
                  <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M7.5 4.5 13 10l-5.5 5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
              </div>

              <div class="mt-5 grid grid-cols-7 gap-1 text-center text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-white/40">
                <span v-for="weekday in weekdayLabels" :key="weekday">{{ weekday }}</span>
              </div>

              <div class="mt-2 grid grid-cols-7 gap-1">
                <button
                  v-for="day in calendarDays"
                  :key="day.value"
                  type="button"
                  class="relative flex h-11 items-center justify-center border text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  :class="[
                    day.selected
                      ? 'border-white bg-white text-neutral-950'
                      : day.disabled
                        ? 'cursor-not-allowed border-transparent text-white/18'
                        : day.currentMonth
                          ? 'border-white/10 text-white/80 hover:border-white/45 hover:bg-white/[0.07] hover:text-white'
                          : 'border-transparent text-white/30 hover:border-white/20 hover:text-white/60',
                  ]"
                  :disabled="day.disabled"
                  :aria-label="day.label"
                  :aria-current="day.today ? 'date' : undefined"
                  @click="selectDate(day)"
                >
                  <span>{{ day.day }}</span>
                  <span v-if="day.today && !day.selected" class="absolute bottom-1 h-0.5 w-3 bg-red-700" aria-hidden="true" />
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.booking-calendar-sheet {
  max-height: min(82svh, 38rem);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}

.booking-calendar-overlay-enter-active,
.booking-calendar-overlay-leave-active {
  transition: opacity 180ms ease;
}

.booking-calendar-overlay-enter-from,
.booking-calendar-overlay-leave-to {
  opacity: 0;
}

.booking-calendar-sheet-enter-active,
.booking-calendar-sheet-leave-active {
  transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.booking-calendar-sheet-enter-from,
.booking-calendar-sheet-leave-to {
  transform: translateY(100%);
}

@media (prefers-reduced-motion: reduce) {
  .booking-calendar-overlay-enter-active,
  .booking-calendar-overlay-leave-active,
  .booking-calendar-sheet-enter-active,
  .booking-calendar-sheet-leave-active {
    transition: none;
  }
}
</style>
