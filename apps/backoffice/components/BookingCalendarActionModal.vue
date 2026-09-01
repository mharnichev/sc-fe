<script setup lang="ts">
import { ArrowPathIcon, CalendarDaysIcon, ChatBubbleLeftEllipsisIcon, ClockIcon, LockOpenIcon, NoSymbolIcon, PlusIcon, ReceiptPercentIcon, ScissorsIcon, SunIcon, UserIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import type { CalendarActionPayload, CalendarActionType, CalendarSelection } from '~/composables/useBookingCalendar'
import type { CustomerSummary, Promotion, Service } from '~/composables/useBackofficeApi'

type AvailabilityPreset = 'interval' | 'day' | 'week' | 'month'

const props = defineProps<{
  modelValue: boolean
  selection: CalendarSelection | null
  services: Service[]
  promotions?: Promotion[]
  canUsePromotions?: boolean
  masterName: string
  defaultAction?: CalendarActionType
  pending?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: CalendarActionPayload]
}>()

const {
  toKyivIso,
} = useBookingFormatting()
const calendar = useBookingCalendar()
const toast = useBaseToastNotification()
const { normalizePhone, isCompletePhone } = useUkrainianPhoneMask()

const form = reactive({
  action: 'booking' as CalendarActionType,
  availability_preset: 'interval' as AvailabilityPreset,
  service_ids: [] as string[],
  promotion_code: '',
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

const availabilityPresetOptions: Array<{ value: AvailabilityPreset, label: string, description: string, icon: typeof ClockIcon }> = [
  { value: 'interval', label: 'Інтервал', description: 'Вибраний час', icon: ClockIcon },
  { value: 'day', label: 'День', description: `${calendar.workdayStart}-${calendar.workdayEnd}`, icon: SunIcon },
  { value: 'week', label: 'Тиждень', description: 'Робочі дні', icon: CalendarDaysIcon },
  { value: 'month', label: 'Місяць', description: 'До 2 місяців', icon: CalendarDaysIcon },
]

const calendarActionOptions: Array<{ value: CalendarActionType, label: string, icon: typeof LockOpenIcon }> = [
  { value: 'availability', label: 'Відкрити', icon: LockOpenIcon },
  { value: 'booking', label: 'Ручне бронювання', icon: PlusIcon },
  { value: 'block', label: 'Блокування часу', icon: NoSymbolIcon },
]

const promotionOptions = computed(() => [
  { value: '', label: 'Без акції' },
  ...(props.promotions || []).map(promotion => ({
    value: promotion.code,
    label: `${promotion.code} · ${promotion.discount_percent}%`,
  })),
])

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

const dateFromInput = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

const inputFromDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const addDaysInput = (value: string, days: number) => {
  const date = dateFromInput(value)
  if (!date) return value
  date.setDate(date.getDate() + days)
  return inputFromDate(date)
}

const addCalendarMonthsInput = (value: string, months: number) => {
  const date = dateFromInput(value)
  if (!date) return value
  const day = date.getDate()
  date.setMonth(date.getMonth() + months)
  if (date.getDate() !== day) date.setDate(0)
  return inputFromDate(date)
}

const availabilityEndDate = computed(() => {
  if (!form.date) return ''
  if (form.availability_preset === 'week') return addDaysInput(form.date, 6)
  if (form.availability_preset === 'month') return addCalendarMonthsInput(form.date, 1)
  return form.date
})

const availabilityWindowDates = computed(() => {
  if (!form.date) return []
  if (form.availability_preset === 'interval') return [form.date]

  const start = dateFromInput(form.date)
  const end = dateFromInput(availabilityEndDate.value)
  if (!start || !end) return []

  const dates: string[] = []
  const current = new Date(start)
  while (current <= end) {
    const input = inputFromDate(current)
    if (!calendar.isMonday(input)) dates.push(input)
    current.setDate(current.getDate() + 1)
  }
  return dates
})

const availabilityWindowCount = computed(() =>
  form.action === 'availability' && form.availability_preset !== 'interval'
    ? availabilityWindowDates.value.length
    : 1,
)

const setAvailabilityPreset = (preset: AvailabilityPreset) => {
  form.availability_preset = preset
  if (preset === 'interval') {
    form.start_time = props.selection?.startTime || form.start_time || calendar.workdayStart
    form.end_time = props.selection?.endTime || form.end_time || calendar.workdayEnd
    return
  }
  form.start_time = calendar.workdayStart
  form.end_time = calendar.workdayEnd
}

const setCalendarAction = (value: string | number | boolean) => {
  form.action = value as CalendarActionType
}

const handleAvailabilityPresetUpdate = (value: string | number | boolean) => {
  setAvailabilityPreset(value as AvailabilityPreset)
}

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
  form.action = props.defaultAction || 'availability'
  form.availability_preset = 'interval'
  form.service_ids = []
  form.promotion_code = ''
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

const close = () => {
  emit('update:modelValue', false)
}

const validate = () => {
  if (!form.date || !form.start_time || !form.end_time) return 'Виберіть початок і завершення інтервалу.'
  if (form.action !== 'availability' || form.availability_preset === 'interval') {
    if (calendar.isMonday(form.date)) return 'Понеділок — вихідний день.'
  }
  else if (!availabilityWindowDates.value.length) {
    return 'У діапазоні немає робочих днів для відкриття.'
  }
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
  if (localError.value) {
    toast.warning(localError.value)
    return
  }
  const serviceIds = form.action === 'booking' ? form.service_ids.map(Number).filter(Number.isFinite) : []
  const availabilityWindows = form.action === 'availability' && form.availability_preset !== 'interval'
    ? availabilityWindowDates.value.map(date => ({
        start_at: toKyivIso(date, calendar.workdayStart),
        end_at: toKyivIso(date, calendar.workdayEnd),
      }))
    : undefined

  emit('submit', {
    action: form.action,
    service_id: serviceIds[0] || null,
    service_ids: serviceIds,
    duration_minutes: form.action === 'booking' ? Number(form.duration_minutes) : undefined,
    customer_name: form.customer_name.trim(),
    customer_phone: normalizePhone(form.customer_phone),
    customer_email: '',
    promotion_code: form.action === 'booking' && props.canUsePromotions ? form.promotion_code || null : null,
    note: form.note.trim(),
    start_at: availabilityWindows?.[0]?.start_at || toKyivIso(form.date, form.start_time),
    end_at: availabilityWindows?.[0]?.end_at || toKyivIso(form.date, form.end_time),
    availability_windows: availabilityWindows,
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

const selectCustomer = (customer: CustomerSummary) => {
  form.customer_phone = customer.phone
  form.customer_name = [customer.name, customer.surname].filter(Boolean).join(' ').trim() || `Клієнт #${customer.id}`
}

const submitIcon = computed(() => {
  if (form.action === 'booking') return PlusIcon
  if (form.action === 'block') return NoSymbolIcon
  return LockOpenIcon
})

const submitClass = computed(() => {
  if (form.action === 'booking') return 'backoffice-modal-action-primary'
  if (form.action === 'block') return 'backoffice-modal-action-danger'
  return 'backoffice-modal-action-success'
})

const submitLabel = computed(() => {
  if (form.action === 'booking') return 'Створити бронювання'
  if (form.action === 'block') return 'Заблокувати час'
  return 'Відкрити для запису'
})
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
        <ModalCloseButton @click="closeModal" />
      </div>
    </template>

    <template #body>
      <form class="space-y-3 xl:space-y-5" @submit.prevent="submit">
        <BaseSegmentedControl
          :model-value="form.action"
          :options="calendarActionOptions"
          container-class="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 xl:gap-2 xl:rounded-2xl"
          option-class="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-xs font-medium leading-tight transition xl:min-h-11 xl:gap-2 xl:rounded-xl xl:px-3 xl:py-2 xl:text-sm"
          active-class="bg-white text-slate-950 shadow-sm"
          inactive-class="text-slate-600 hover:text-slate-950"
          @update:model-value="setCalendarAction"
        />

        <div v-if="form.action === 'availability'" class="availability-preset-panel space-y-2 rounded-xl border p-2.5 xl:rounded-2xl xl:p-4">
          <BaseSegmentedControl
            :model-value="form.availability_preset"
            :options="availabilityPresetOptions"
            container-class="grid grid-cols-2 gap-2 md:grid-cols-4"
            option-class="availability-preset-option relative inline-flex min-h-14 items-center gap-2 rounded-xl border px-2.5 py-2 pr-8 text-left transition xl:min-h-16 xl:px-3 xl:pr-9"
            active-class="is-active"
            inactive-class=""
            @update:model-value="handleAvailabilityPresetUpdate"
          >
            <template #option="{ option, active }">
              <span class="availability-preset-icon">
                <component :is="option.icon" class="h-4 w-4 shrink-0" aria-hidden="true" />
              </span>
              <span class="min-w-0">
                <span class="block truncate text-xs font-semibold xl:text-sm">{{ option.label }}</span>
                <span class="availability-preset-description block truncate text-[11px]">{{ option.description }}</span>
              </span>
              <span v-if="active" class="availability-preset-check" aria-hidden="true" />
            </template>
          </BaseSegmentedControl>
          <p class="availability-preset-summary inline-flex items-center gap-1.5 text-xs xl:text-sm">
            <LockOpenIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
            <span v-if="form.availability_preset === 'interval'">Буде відкрито вибраний інтервал.</span>
            <span v-else>
              Буде відкрито {{ availabilityWindowCount }} робочих {{ availabilityWindowCount === 1 ? 'день' : 'днів' }} з {{ form.date || 'дати старту' }} до {{ availabilityEndDate || 'дати завершення' }}, {{ calendar.workdayStart }}-{{ calendar.workdayEnd }}.
            </span>
          </p>
        </div>

        <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 md:grid-cols-3 xl:gap-4">
          <label class="col-span-2 min-w-0 space-y-1 text-xs text-slate-700 md:col-span-1 xl:space-y-2 xl:text-sm">
            <span class="inline-flex items-center gap-1.5 font-medium">
              <CalendarDaysIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
              {{ form.action === 'availability' && form.availability_preset !== 'interval' ? 'Початок періоду' : 'Дата' }}
            </span>
            <BaseCalendar v-model="form.date" required class="min-w-0 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3" />
          </label>
          <label class="min-w-0 space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="inline-flex items-center gap-1.5 font-medium">
              <ClockIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
              Початок
            </span>
            <BaseInput v-model="form.start_time" required type="time" :min="calendar.workdayStart" :max="calendar.workdayEnd" :disabled="form.action === 'availability' && form.availability_preset !== 'interval'" class="min-w-0 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500 xl:rounded-2xl xl:px-4 xl:py-3" />
          </label>
          <label class="min-w-0 space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="inline-flex items-center gap-1.5 font-medium">
              <ClockIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
              Завершення
            </span>
            <BaseInput v-model="form.end_time" required type="time" :min="calendar.workdayStart" :max="calendar.workdayEnd" :disabled="form.action === 'availability' && form.availability_preset !== 'interval'" class="min-w-0 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500 xl:rounded-2xl xl:px-4 xl:py-3" />
          </label>
        </div>

        <div
          v-if="form.action === 'booking'"
          class="grid gap-2 xl:gap-4"
          :class="canUsePromotions ? 'md:grid-cols-[minmax(0,1fr)_9rem_minmax(12rem,0.75fr)]' : 'md:grid-cols-[minmax(0,1fr)_9rem]'"
        >
          <div class="min-w-0 space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="inline-flex items-center gap-1.5 font-medium">
              <ScissorsIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
              Послуги
            </span>
            <ServiceMultiSelect v-model="form.service_ids" :services="services" />
          </div>
          <label class="min-w-0 space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="inline-flex items-center gap-1.5 font-medium">
              <ClockIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
              Тривалість, хв
            </span>
            <BaseInput v-model.number="form.duration_minutes"
              required
              type="number"
              min="1"
              step="1"
              class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3"
              @input="markDurationEdited" />
          </label>
          <label v-if="canUsePromotions" class="min-w-0 space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="inline-flex items-center gap-1.5 font-medium">
              <ReceiptPercentIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
              Акція
            </span>
            <BaseSelect
              :model-value="form.promotion_code"
              :options="promotionOptions"
              placeholder="Без акції"
              menu-class="z-[260]"
              aria-label="Акція"
              @update:model-value="form.promotion_code = String($event || '')"
            />
          </label>
        </div>

        <div v-if="form.action === 'booking'" class="grid grid-cols-1 gap-2 min-[676px]:grid-cols-2 xl:gap-4">
          <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="inline-flex items-center gap-1.5 font-medium">
              <UserIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
              Ім’я клієнта
            </span>
            <BaseInput v-model="form.customer_name" required class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3" />
          </label>
          <BaseCustomerPhoneInput
            v-model="form.customer_phone"
            required
            label="Телефон клієнта"
            label-class="text-xs text-slate-700 xl:text-sm"
            label-content-class="inline-flex items-center gap-1.5 font-medium"
            icon-class="h-4 w-4 text-slate-500"
            input-class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3"
            @select="selectCustomer"
          />
        </div>

        <label v-if="form.action !== 'availability'" class="block mt-2 space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
          <span class="inline-flex items-center gap-1.5 font-medium">
            <ChatBubbleLeftEllipsisIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
            {{ form.action === 'booking' ? 'Коментар' : 'Причина' }}
          </span>
          <BaseTextarea v-model="form.note" rows="2" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3" />
        </label>

        <div class="backoffice-modal-actions pt-3 xl:pt-5">
          <BaseButton
            type="submit"
            :disabled="pending"
            class="backoffice-modal-action-button"
            :class="submitClass"
          >
            <component :is="submitIcon" v-if="!pending" class="h-4 w-4" aria-hidden="true" />
            {{ pending ? 'Збереження...' : submitLabel }}
          </BaseButton>
          <BaseButton type="button" class="backoffice-modal-action-button backoffice-modal-action-secondary" @click="resetForm">
            <ArrowPathIcon class="h-4 w-4" aria-hidden="true" />
            Скинути
          </BaseButton>
          <BaseButton type="button" class="backoffice-modal-action-button backoffice-modal-action-neutral" @click="close">
            <XMarkIcon class="h-4 w-4" aria-hidden="true" />
            Скасувати
          </BaseButton>
        </div>
      </form>
    </template>
  </BaseModal>
</template>

<style scoped>
.availability-preset-panel {
  background: var(--bo-success-surface);
  border-color: color-mix(in srgb, var(--bo-success) 28%, transparent);
}

.availability-preset-option {
  background: color-mix(in srgb, var(--input-bg) 76%, transparent);
  border-color: color-mix(in srgb, var(--success) 22%, var(--border));
  color: var(--text-primary);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text-primary) 8%, transparent);
}

.availability-preset-icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 9999px;
  background: color-mix(in srgb, var(--text-primary) 8%, transparent);
}

.availability-preset-icon svg {
  color: color-mix(in srgb, var(--success) 76%, var(--text-primary));
}

.availability-preset-option:hover {
  background: color-mix(in srgb, var(--success) 18%, var(--input-bg));
  border-color: color-mix(in srgb, var(--success) 58%, var(--focus-border));
  color: var(--interactive-hover-text) !important;
}

.availability-preset-option.is-active {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--success) 30%, var(--input-bg)), color-mix(in srgb, var(--success) 20%, var(--input-bg)));
  border-color: var(--success);
  color: var(--interactive-hover-text);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--text-primary) 16%, transparent),
    0 0 0 1px color-mix(in srgb, var(--success) 38%, transparent),
    0 12px 30px color-mix(in srgb, var(--success) 18%, transparent);
}

.availability-preset-option.is-active .availability-preset-icon {
  background: rgba(0, 0, 0, 0.28);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--success) 52%, transparent);
}

.availability-preset-option.is-active .availability-preset-icon svg {
  color: var(--success);
}

.availability-preset-check {
  position: absolute;
  top: 0.65rem;
  right: 0.55rem;
  width: 1rem;
  height: 1rem;
  border-radius: 9999px;
  background: var(--success);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 34%, transparent);
}

.availability-preset-check::after {
  content: "";
  position: absolute;
  left: 0.34rem;
  top: 0.2rem;
  width: 0.28rem;
  height: 0.52rem;
  border-right: 2px solid #0a0a0a;
  border-bottom: 2px solid #0a0a0a;
  transform: rotate(45deg);
}

.availability-preset-description {
  color: var(--text-secondary);
}

.availability-preset-option:hover .availability-preset-description,
.availability-preset-option.is-active .availability-preset-description {
  color: color-mix(in srgb, var(--text-primary) 72%, transparent);
}

.availability-preset-summary {
  color: color-mix(in srgb, var(--success) 78%, var(--text-primary));
}

:global(html:not([data-backoffice-theme="light"])) .availability-preset-option.is-active {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bo-success) 18%, transparent), color-mix(in srgb, var(--bo-success) 10%, transparent)) !important;
  border-color: var(--bo-success) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.10),
    0 0 0 1px color-mix(in srgb, var(--bo-success) 72%, transparent),
    0 0 0 4px color-mix(in srgb, var(--bo-success) 10%, transparent),
    0 14px 32px color-mix(in srgb, var(--bo-success) 16%, transparent) !important;
}

:global(html:not([data-backoffice-theme="light"])) .availability-preset-option.is-active .availability-preset-icon {
  background: color-mix(in srgb, var(--bo-success) 12%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--bo-success) 48%, transparent);
}

:global(html:not([data-backoffice-theme="light"])) .availability-preset-option.is-active .availability-preset-icon svg {
  color: var(--bo-success) !important;
  stroke: currentColor;
}

:global(html[data-backoffice-theme="light"]) .availability-preset-panel {
  background: var(--bo-success-surface);
  border-color: color-mix(in srgb, var(--bo-success) 24%, transparent);
}

:global(html[data-backoffice-theme="light"]) .availability-preset-option {
  background: rgba(255, 255, 255, 0.82);
  border-color: color-mix(in srgb, var(--bo-success) 26%, transparent);
  color: rgba(15, 23, 42, 0.92);
}

:global(html[data-backoffice-theme="light"]) .availability-preset-option.is-active {
  background: linear-gradient(180deg, color-mix(in srgb, var(--bo-success) 10%, #ffffff), #ffffff);
  border-color: color-mix(in srgb, var(--bo-success) 76%, transparent);
  color: var(--bo-success-text);
}

:global(html[data-backoffice-theme="light"]) .availability-preset-option.is-active .availability-preset-icon {
  background: color-mix(in srgb, var(--bo-success) 13%, transparent);
  box-shadow: none;
}

:global(html[data-backoffice-theme="light"]) .availability-preset-option.is-active .availability-preset-icon svg {
  color: var(--bo-success-text);
}

:global(html[data-backoffice-theme="light"]) .availability-preset-check {
  background: var(--bo-success);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--bo-success) 16%, transparent);
}

:global(html[data-backoffice-theme="light"]) .availability-preset-check::after {
  border-color: #ffffff;
}

:global(html[data-backoffice-theme="light"]) .availability-preset-summary {
  color: var(--bo-success-text);
}
</style>
