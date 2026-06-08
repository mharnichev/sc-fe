<script setup lang="ts">
import { ArrowPathIcon, CalendarDaysIcon, ChatBubbleLeftEllipsisIcon, ClockIcon, NoSymbolIcon, PlusIcon, PhoneIcon, ScissorsIcon, UserIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import type { CalendarActionPayload, CalendarActionType, CalendarSelection } from '~/composables/useBookingCalendar'
import type { Service } from '~/composables/useBackofficeApi'

const props = defineProps<{
  modelValue: boolean
  selection: CalendarSelection | null
  services: Service[]
  masterName: string
  pending?: boolean
  error?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: CalendarActionPayload]
}>()

const {
  toKyivIso,
} = useBookingFormatting()
const calendar = useBookingCalendar()
const { formatPhone, normalizePhone, isCompletePhone } = useUkrainianPhoneMask()

const form = reactive({
  action: 'booking' as CalendarActionType,
  service_ids: [] as string[],
  date: '',
  start_time: '',
  end_time: '',
  duration_minutes: 30,
  customer_name: '',
  customer_phone: '',
  note: '',
})
const localError = ref('')
const durationEdited = ref(false)
const syncingEndTime = ref(false)
const customerPhoneFocused = ref(false)

const maskedCustomerPhone = computed({
  get: () => formatPhone(form.customer_phone, customerPhoneFocused.value),
  set: value => {
    form.customer_phone = formatPhone(value, true)
  },
})

const selectedServices = computed(() => {
  const selected = new Set(form.service_ids.map(Number))
  return props.services.filter(service => selected.has(Number(service.id)))
})

const selectedServicesDuration = computed(() =>
  selectedServices.value.reduce((total, service) => total + Number(service.duration_minutes || 0), 0),
)

const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

const minutesToTime = (minutes: number) => {
  const normalized = Math.max(0, minutes)
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`
}

const rangeDurationMinutes = (startTime: string, endTime: string) => {
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = timeToMinutes(endTime)
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return 0
  return endMinutes - startMinutes
}

const selectionDurationMinutes = () =>
  props.selection ? rangeDurationMinutes(props.selection.startTime, props.selection.endTime) : 0

const defaultDurationMinutes = () =>
  selectedServicesDuration.value || selectionDurationMinutes() || calendar.slotMinutes

const syncEndTimeFromDuration = () => {
  const startMinutes = timeToMinutes(form.start_time)
  const duration = Number(form.duration_minutes)
  if (startMinutes === null || !Number.isFinite(duration) || duration < 1) return
  syncingEndTime.value = true
  form.end_time = minutesToTime(startMinutes + Math.round(duration))
  nextTick(() => {
    syncingEndTime.value = false
  })
}

const setDurationFromRange = () => {
  const duration = rangeDurationMinutes(form.start_time, form.end_time)
  if (duration > 0) {
    form.duration_minutes = duration
  }
}

const resetForm = () => {
  form.action = 'booking'
  form.service_ids = []
  form.date = props.selection?.date || ''
  form.start_time = props.selection?.startTime || ''
  form.end_time = props.selection?.endTime || ''
  form.duration_minutes = selectionDurationMinutes() || calendar.slotMinutes
  form.customer_name = ''
  form.customer_phone = ''
  form.note = ''
  durationEdited.value = false
  localError.value = ''
}

const focusCustomerPhone = () => {
  customerPhoneFocused.value = true
  form.customer_phone = formatPhone(form.customer_phone, true)
}

const blurCustomerPhone = () => {
  customerPhoneFocused.value = false
  form.customer_phone = formatPhone(form.customer_phone)
}

const close = () => {
  emit('update:modelValue', false)
}

const validate = () => {
  if (!form.date || !form.start_time || !form.end_time) return 'Виберіть початок і завершення інтервалу.'
  if (calendar.isMonday(form.date)) return 'Понеділок — вихідний день.'
  if (form.start_time >= form.end_time) return 'Час початку має бути раніше часу завершення.'
  if (form.start_time < calendar.workdayStart || form.end_time > calendar.workdayEnd) {
    return `Інтервал має бути в межах ${calendar.workdayStart}-${calendar.workdayEnd}.`
  }
  if (form.action === 'booking') {
    if (!form.service_ids.length) return 'Виберіть хоча б одну послугу для ручного бронювання.'
    if (!Number.isFinite(Number(form.duration_minutes)) || Number(form.duration_minutes) < 1) return 'Тривалість має бути більше 0 хвилин.'
    if (!form.customer_name.trim()) return 'Ім’я клієнта обов’язкове.'
    if (!form.customer_phone.trim()) return 'Телефон клієнта обов’язковий.'
    if (!isCompletePhone(form.customer_phone)) return 'Введіть повний український номер у форматі +380 XX XXX XX XX.'
  }
  return ''
}

const submit = () => {
  localError.value = validate()
  if (localError.value) return
  const serviceIds = form.action === 'booking' ? form.service_ids.map(Number).filter(Number.isFinite) : []

  emit('submit', {
    action: form.action,
    service_id: serviceIds[0] || null,
    service_ids: serviceIds,
    duration_minutes: form.action === 'booking' ? Number(form.duration_minutes) : undefined,
    customer_name: form.customer_name.trim(),
    customer_phone: normalizePhone(form.customer_phone),
    customer_email: '',
    note: form.note.trim(),
    start_at: toKyivIso(form.date, form.start_time),
    end_at: toKyivIso(form.date, form.end_time),
  })
}

watch(
  () => props.modelValue,
  open => {
    if (open) resetForm()
  },
)

watch(
  () => props.selection,
  () => {
    if (props.modelValue) resetForm()
  },
)

watch(
  () => form.service_ids.slice(),
  () => {
    if (form.action !== 'booking') return
    const nextDuration = defaultDurationMinutes()
    if (!durationEdited.value || form.duration_minutes <= calendar.slotMinutes) {
      form.duration_minutes = nextDuration
      durationEdited.value = false
      syncEndTimeFromDuration()
    }
  },
)

watch(
  () => [form.start_time, form.duration_minutes, form.action] as const,
  () => {
    if (form.action === 'booking') syncEndTimeFromDuration()
  },
)

watch(
  () => form.end_time,
  () => {
    if (syncingEndTime.value || form.action !== 'booking') return
    setDurationFromRange()
  },
)

const markDurationEdited = () => {
  durationEdited.value = true
}
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    max-width-class="max-w-3xl"
    @update:model-value="emit('update:modelValue', $event)"
    @close="localError = ''"
  >
    <template #head="{ close: closeModal }">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-cyan-700 xl:text-sm xl:tracking-[0.25em]">Календар</p>
          <h2 class="mt-1 truncate text-xl font-semibold text-slate-900 xl:mt-2 xl:text-2xl">Новий інтервал</h2>
        </div>
        <button type="button" class="shrink-0 rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-700 xl:px-4 xl:py-2 xl:text-sm" @click="closeModal">
          Закрити
        </button>
      </div>
    </template>

    <template #body>
      <form class="space-y-3 xl:space-y-5" @submit.prevent="submit">
        <div class="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 xl:gap-2 xl:rounded-2xl">
          <button
            type="button"
            class="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-xs font-medium leading-tight transition xl:min-h-11 xl:gap-2 xl:rounded-xl xl:px-3 xl:py-2 xl:text-sm"
            :class="form.action === 'booking' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-950'"
            @click="form.action = 'booking'"
          >
            <PlusIcon class="h-4 w-4" aria-hidden="true" />
            Ручне бронювання
          </button>
          <button
            type="button"
            class="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-xs font-medium leading-tight transition xl:min-h-11 xl:gap-2 xl:rounded-xl xl:px-3 xl:py-2 xl:text-sm"
            :class="form.action === 'block' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-950'"
            @click="form.action = 'block'"
          >
            <NoSymbolIcon class="h-4 w-4" aria-hidden="true" />
            Блокування часу
          </button>
        </div>

        <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 md:grid-cols-3 xl:gap-4">
          <label class="col-span-2 min-w-0 space-y-1 text-xs text-slate-700 md:col-span-1 xl:space-y-2 xl:text-sm">
            <span class="inline-flex items-center gap-1.5 font-medium">
              <CalendarDaysIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
              Дата
            </span>
            <input v-model="form.date" required type="date" class="min-w-0 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3">
          </label>
          <label class="min-w-0 space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="inline-flex items-center gap-1.5 font-medium">
              <ClockIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
              Початок
            </span>
            <input v-model="form.start_time" required type="time" :min="calendar.workdayStart" :max="calendar.workdayEnd" class="min-w-0 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3">
          </label>
          <label class="min-w-0 space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="inline-flex items-center gap-1.5 font-medium">
              <ClockIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
              Завершення
            </span>
            <input v-model="form.end_time" required type="time" :min="calendar.workdayStart" :max="calendar.workdayEnd" class="min-w-0 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3">
          </label>
        </div>

        <div v-if="form.action === 'booking'" class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
          <span class="inline-flex items-center gap-1.5 font-medium">
            <ScissorsIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
            Послуги
          </span>
          <ServiceMultiSelect v-model="form.service_ids" :services="services" />
        </div>

        <div v-if="form.action === 'booking'" class="grid gap-2 md:grid-cols-[9rem_minmax(0,1fr)] xl:gap-4">
          <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="inline-flex items-center gap-1.5 font-medium">
              <ClockIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
              Тривалість, хв
            </span>
            <input
              v-model.number="form.duration_minutes"
              required
              type="number"
              min="1"
              step="1"
              class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3"
              @input="markDurationEdited"
            >
          </label>
        </div>

        <div v-if="form.action === 'booking'" class="grid grid-cols-2 gap-2 xl:gap-4">
          <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="inline-flex items-center gap-1.5 font-medium">
              <UserIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
              Ім’я клієнта
            </span>
            <input v-model="form.customer_name" required class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3">
          </label>
          <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="inline-flex items-center gap-1.5 font-medium">
              <PhoneIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
              Телефон клієнта
            </span>
            <input
              v-model="maskedCustomerPhone"
              required
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              placeholder="+380 XX XXX XX XX"
              maxlength="17"
              class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3"
              @focus="focusCustomerPhone"
              @blur="blurCustomerPhone"
            >
          </label>
        </div>

        <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
          <span class="inline-flex items-center gap-1.5 font-medium">
            <ChatBubbleLeftEllipsisIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
            {{ form.action === 'booking' ? 'Коментар' : 'Причина' }}
          </span>
          <textarea v-model="form.note" rows="2" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3" />
        </label>

        <p v-if="localError || error" class="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600 xl:rounded-2xl xl:px-4 xl:py-3 xl:text-sm">
          {{ localError || error }}
        </p>

        <div class="grid grid-cols-2 gap-2 border-t border-slate-200 pt-3 sm:grid-cols-3 xl:gap-3 xl:pt-5">
          <button
            type="submit"
            :disabled="pending"
            class="col-span-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium disabled:opacity-60 sm:col-span-1 xl:gap-2 xl:px-5 xl:py-3 xl:text-sm"
            :class="form.action === 'booking' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100' : 'bg-slate-100 text-slate-800 ring-1 ring-slate-400 hover:bg-slate-200'"
          >
            <component :is="form.action === 'booking' ? PlusIcon : NoSymbolIcon" v-if="!pending" class="h-4 w-4" aria-hidden="true" />
            {{ pending ? 'Збереження...' : form.action === 'booking' ? 'Створити бронювання' : 'Заблокувати час' }}
          </button>
          <button type="button" class="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 xl:gap-2 xl:px-5 xl:py-3 xl:text-sm" @click="resetForm">
            <ArrowPathIcon class="h-4 w-4" aria-hidden="true" />
            Скинути
          </button>
          <button type="button" class="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-rose-300 px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-50 xl:gap-2 xl:px-5 xl:py-3 xl:text-sm" @click="close">
            <XMarkIcon class="h-4 w-4" aria-hidden="true" />
            Скасувати
          </button>
        </div>
      </form>
    </template>
  </BaseModal>
</template>
