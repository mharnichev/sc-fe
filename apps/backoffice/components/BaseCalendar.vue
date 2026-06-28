<script setup lang="ts">
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/vue/24/outline'

defineOptions({ inheritAttrs: false })

type CalendarMode = 'date' | 'datetime'

const props = withDefaults(defineProps<{
  modelValue?: string | null
  value?: string | null
  mode?: CalendarMode
  label?: string
  hint?: string
  error?: string
  placeholder?: string
  min?: string
  max?: string
  required?: boolean
  disabled?: boolean
  fieldClass?: string
  inputClass?: string
  menuClass?: string
}>(), {
  mode: 'date',
  placeholder: 'Оберіть дату',
  inputClass: 'w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm',
  menuClass: 'z-[240]',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
}>()

const rootRef = ref<HTMLElement | null>(null)
const attrs = useAttrs()
const open = ref(false)
const today = new Date()
const viewYear = ref(today.getFullYear())
const viewMonth = ref(today.getMonth())
const timeValue = ref('09:00')

const pad = (value: number) => String(value).padStart(2, '0')
const formatDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const parseDate = (value?: string | null) => {
  if (!value) return null
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}

const currentValue = computed(() => props.modelValue ?? props.value ?? '')
const selectedDate = computed(() => parseDate(currentValue.value))
const selectedDateInput = computed(() => selectedDate.value ? formatDate(selectedDate.value) : '')
const minDateInput = computed(() => props.min?.slice(0, 10) || '')
const maxDateInput = computed(() => props.max?.slice(0, 10) || '')

const monthLabel = computed(() =>
  new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric' }).format(new Date(viewYear.value, viewMonth.value, 1)),
)

const displayValue = computed(() => currentValue.value || '')
const resolvedInputClass = computed(() => [props.inputClass, attrs.class])

const weekdayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']

const calendarDays = computed(() => {
  const firstDay = new Date(viewYear.value, viewMonth.value, 1)
  const daysInMonth = new Date(viewYear.value, viewMonth.value + 1, 0).getDate()
  const leadingDays = (firstDay.getDay() + 6) % 7
  const days: Array<{ value: string, label: string, muted: boolean }> = []

  const previousMonthDays = new Date(viewYear.value, viewMonth.value, 0).getDate()
  for (let index = leadingDays - 1; index >= 0; index -= 1) {
    const date = new Date(viewYear.value, viewMonth.value - 1, previousMonthDays - index)
    days.push({ value: formatDate(date), label: String(date.getDate()), muted: true })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(viewYear.value, viewMonth.value, day)
    days.push({ value: formatDate(date), label: String(day), muted: false })
  }

  while (days.length % 7 !== 0) {
    const nextDay = days.length - leadingDays - daysInMonth + 1
    const date = new Date(viewYear.value, viewMonth.value + 1, nextDay)
    days.push({ value: formatDate(date), label: String(date.getDate()), muted: true })
  }

  return days
})

const syncViewFromValue = () => {
  const date = selectedDate.value || today
  viewYear.value = date.getFullYear()
  viewMonth.value = date.getMonth()

  const timePart = currentValue.value?.slice(11, 16)
  if (timePart) timeValue.value = timePart
}

watch(currentValue, syncViewFromValue, { immediate: true })

const dateIsDisabled = (value: string) => {
  if (minDateInput.value && value < minDateInput.value) return true
  if (maxDateInput.value && value > maxDateInput.value) return true
  return false
}

const emitValue = (dateInput: string, close = props.mode === 'date') => {
  const nextValue = props.mode === 'datetime'
    ? `${dateInput}T${timeValue.value || '09:00'}`
    : dateInput
  emit('update:modelValue', nextValue)
  emit('change', nextValue)
  if (close) open.value = false
}

const selectDate = (value: string) => {
  if (dateIsDisabled(value)) return
  emitValue(value)
}

const updateTime = (value: string | number | null) => {
  timeValue.value = String(value || '09:00')
  if (selectedDateInput.value) emitValue(selectedDateInput.value, false)
}

const clearValue = () => {
  emit('update:modelValue', '')
  emit('change', '')
  open.value = false
}

const goToToday = () => {
  const input = formatDate(today)
  viewYear.value = today.getFullYear()
  viewMonth.value = today.getMonth()
  if (!dateIsDisabled(input)) emitValue(input, props.mode === 'date')
}

const changeMonth = (direction: number) => {
  const date = new Date(viewYear.value, viewMonth.value + direction, 1)
  viewYear.value = date.getFullYear()
  viewMonth.value = date.getMonth()
}

const closeOnOutsideClick = (event: PointerEvent) => {
  if (!rootRef.value || rootRef.value.contains(event.target as Node)) return
  open.value = false
}

onMounted(() => document.addEventListener('pointerdown', closeOnOutsideClick))
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOnOutsideClick))
</script>

<template>
  <BaseField
    :label="label"
    :hint="hint"
    :error="error"
    :required="required"
    :disabled="disabled"
    :root-class="fieldClass || 'space-y-1.5 text-sm text-slate-700'"
    as="div"
  >
    <template v-if="$slots.icon" #icon>
      <slot name="icon" />
    </template>
    <template v-if="$slots.label" #label>
      <slot name="label" />
    </template>

    <div
      ref="rootRef"
      class="relative min-w-0"
      :style="open ? { zIndex: 50000 } : undefined"
    >
      <div class="relative">
        <CalendarDaysIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <BaseInput
          :model-value="displayValue"
          readonly
          :disabled="disabled"
          :required="required"
          :placeholder="placeholder"
          :input-class="resolvedInputClass"
          field-class=""
          style="padding-left: 2.5rem;"
          @focus="open = true"
          @click="open = true"
          @keydown.esc="open = false"
        />
      </div>

      <div
        v-if="open && !disabled"
        class="booking-select-menu absolute mt-2 w-full min-w-[18rem] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
        :class="menuClass"
        style="z-index: 50010;"
      >
        <div class="mb-3 flex items-center justify-between gap-2">
          <BaseButton type="button" variant="unstyled" class="rounded-full p-2 text-slate-600 hover:bg-slate-100" aria-label="Попередній місяць" @click="changeMonth(-1)">
            <ChevronLeftIcon class="h-4 w-4" aria-hidden="true" />
          </BaseButton>
          <p class="text-sm font-semibold capitalize text-slate-900">{{ monthLabel }}</p>
          <BaseButton type="button" variant="unstyled" class="rounded-full p-2 text-slate-600 hover:bg-slate-100" aria-label="Наступний місяць" @click="changeMonth(1)">
            <ChevronRightIcon class="h-4 w-4" aria-hidden="true" />
          </BaseButton>
        </div>

        <div class="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-500">
          <span v-for="day in weekdayLabels" :key="day">{{ day }}</span>
        </div>
        <div class="mt-1 grid grid-cols-7 gap-1">
          <BaseButton
            v-for="day in calendarDays"
            :key="day.value"
            type="button"
            variant="unstyled"
            class="min-h-9 rounded-xl px-1 text-sm transition"
            :class="[
              day.value === selectedDateInput ? 'bg-cyan-600 text-white' : 'text-slate-700 hover:bg-slate-100',
              day.muted ? 'opacity-45' : '',
              dateIsDisabled(day.value) ? 'cursor-not-allowed opacity-30' : '',
            ]"
            :disabled="dateIsDisabled(day.value)"
            @click="selectDate(day.value)"
          >
            {{ day.label }}
          </BaseButton>
        </div>

        <div v-if="mode === 'datetime'" class="mt-3 border-t border-slate-100 pt-3">
          <BaseInput
            :model-value="timeValue"
            type="time"
            label="Час"
            input-class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            @update:model-value="updateTime"
          />
        </div>

        <div class="mt-3 flex justify-between gap-2 border-t border-slate-100 pt-3">
          <BaseButton type="button" variant="neutral" size="sm" @click="clearValue">
            <XMarkIcon class="h-4 w-4" aria-hidden="true" />
            Очистити
          </BaseButton>
          <BaseButton type="button" variant="primary" size="sm" @click="goToToday">
            Сьогодні
          </BaseButton>
        </div>
      </div>
    </div>
  </BaseField>
</template>
