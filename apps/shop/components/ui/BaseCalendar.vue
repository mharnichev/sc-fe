<script setup lang="ts">
import { computed, ref, watch } from 'vue'

interface CalendarDay {
  value: string
  label: string
  day: number
  currentMonth: boolean
  today: boolean
  selected: boolean
  disabled: boolean
}

const props = withDefaults(defineProps<{
  id?: string
  label?: string
  description?: string
  error?: string
  locale?: string
  min?: string
  max?: string
  disabledDates?: string[]
  disabledWeekdays?: number[]
}>(), {
  id: '',
  label: '',
  description: '',
  error: '',
  locale: 'en-US',
  min: '',
  max: '',
  disabledDates: () => [],
  disabledWeekdays: () => [],
})

const model = defineModel<string>({ default: '' })
const { terms } = useShopLocale()

const formatDateInput = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const parseDateInput = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)

  return Number.isNaN(date.getTime()) ? null : date
}

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(date.getDate() + days)

  return next
}

const addMonths = (date: Date, months: number) =>
  new Date(date.getFullYear(), date.getMonth() + months, 1)

const monthStart = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1)

const selectedDate = computed(() => parseDateInput(model.value))
const visibleMonth = ref(monthStart(selectedDate.value ?? new Date()))

const monthLabel = computed(() =>
  new Intl.DateTimeFormat(props.locale, { month: 'long', year: 'numeric' }).format(visibleMonth.value),
)

const weekdayLabels = computed(() =>
  Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(props.locale, { weekday: 'short' }).format(new Date(2026, 0, 5 + index)),
  ),
)

const isDateDisabled = (date: Date) => {
  const value = formatDateInput(date)

  return Boolean(
    (props.min && value < props.min)
    || (props.max && value > props.max)
    || props.disabledDates.includes(value)
    || props.disabledWeekdays.includes(date.getDay()),
  )
}

const calendarDays = computed<CalendarDay[]>(() => {
  const start = monthStart(visibleMonth.value)
  const gridStart = addDays(start, -((start.getDay() + 6) % 7))
  const today = formatDateInput(new Date())

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index)
    const value = formatDateInput(date)
    const disabled = isDateDisabled(date)
    const label = new Intl.DateTimeFormat(props.locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date)

    return {
      value,
      label,
      day: date.getDate(),
      currentMonth: date.getMonth() === visibleMonth.value.getMonth(),
      today: value === today,
      selected: value === model.value,
      disabled,
    }
  })
})

const selectDate = (day: CalendarDay) => {
  if (day.disabled) return
  model.value = day.value
}

watch(model, (value) => {
  const date = parseDateInput(value)
  if (date) visibleMonth.value = monthStart(date)
})
</script>

<template>
  <BaseField
    v-slot="{ id: fieldId, descriptionId, errorId }"
    :id="id"
    :label="label"
    :description="description"
    :error="error"
  >
    <div
      :id="fieldId"
      class="base-calendar"
      role="group"
      :aria-describedby="[descriptionId, errorId].filter(Boolean).join(' ') || undefined"
    >
      <div class="base-calendar__header">
        <button class="base-calendar__nav" type="button" :aria-label="terms.calendar.previousMonth" @click="visibleMonth = addMonths(visibleMonth, -1)">
          ‹
        </button>
        <p class="base-calendar__month">
          {{ monthLabel }}
        </p>
        <button class="base-calendar__nav" type="button" :aria-label="terms.calendar.nextMonth" @click="visibleMonth = addMonths(visibleMonth, 1)">
          ›
        </button>
      </div>

      <div class="base-calendar__weekdays" aria-hidden="true">
        <span v-for="weekday in weekdayLabels" :key="weekday">{{ weekday }}</span>
      </div>

      <div class="base-calendar__grid">
        <button
          v-for="day in calendarDays"
          :key="day.value"
          class="base-calendar__day"
          :class="{
            'base-calendar__day--muted': !day.currentMonth,
            'base-calendar__day--today': day.today,
            'base-calendar__day--selected': day.selected,
          }"
          type="button"
          :disabled="day.disabled"
          :aria-label="day.label"
          :aria-pressed="day.selected"
          :aria-current="day.today ? 'date' : undefined"
          @click="selectDate(day)"
        >
          {{ day.day }}
        </button>
      </div>
    </div>
  </BaseField>
</template>
