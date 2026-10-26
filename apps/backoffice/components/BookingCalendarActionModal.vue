<script setup lang="ts">
import { ArrowPathIcon, CalendarDaysIcon, ChatBubbleLeftEllipsisIcon, ClockIcon, LockOpenIcon, NoSymbolIcon, PlusIcon, ReceiptPercentIcon, ScissorsIcon, UserIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import type { CalendarActionPayload, CalendarActionType, CalendarSelection } from '~/composables/useBookingCalendar'
import type { CustomerSummary, Master, Promotion, Service } from '~/composables/useBackofficeApi'

const props = defineProps<{
  modelValue: boolean
  selection: CalendarSelection | null
  services: Service[]
  promotions?: Promotion[]
  canUsePromotions?: boolean
  masterName: string
  defaultAction?: CalendarActionType
  pending?: boolean
  admin?: boolean
  masters?: Master[]
  masterId?: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: CalendarActionPayload]
  saved: [message: string]
}>()

const {
  toKyivIso,
} = useBookingFormatting()
const calendar = useBookingCalendar()
const toast = useBaseToastNotification()
const { normalizePhone, isCompletePhone } = useUkrainianPhoneMask()

const form = reactive({
  action: 'booking' as CalendarActionType,
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

const availabilityBusy = ref(false)
const modalBusy = computed(() => Boolean(props.pending || availabilityBusy.value))
const actionOptions = computed(() => calendarActionOptions.map(option => ({ ...option, disabled: modalBusy.value })))
const selectedMasterOptions = computed(() => (props.masters || []).filter(master => master.id === props.masterId))
const setCalendarAction = (value: string | number | boolean) => {
  if (!modalBusy.value) form.action = value as CalendarActionType
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
  if (!modalBusy.value) emit('update:modelValue', false)
}

const validate = () => {
  if (!form.date || !form.start_time || !form.end_time) return 'Виберіть початок і завершення інтервалу.'
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
  if (modalBusy.value || form.action === 'availability') return
  localError.value = validate()
  if (localError.value) {
    toast.warning(localError.value)
    return
  }
  const serviceIds = form.action === 'booking' ? form.service_ids.map(Number).filter(Number.isFinite) : []
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
    max-width-class="availability-modal max-w-4xl"
    fill-height
    :close-on-backdrop="!modalBusy"
    :close-on-escape="!modalBusy"
    @update:model-value="close"
    @close="localError = ''"
  >
    <template #head>
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-cyan-700 xl:text-sm xl:tracking-[0.25em]">Календар</p>
          <h2 class="mt-1 truncate text-xl font-semibold text-slate-900 xl:mt-2 xl:text-2xl">Новий інтервал</h2>
        </div>
        <ModalCloseButton :disabled="modalBusy" @click="close" />
      </div>
        <BaseSegmentedControl
          class="mt-2 shrink-0"
          aria-label="Дія з інтервалом"
          :model-value="form.action"
          :options="actionOptions"
          container-class="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 xl:gap-2 xl:rounded-2xl"
          option-class="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-xs font-medium leading-tight transition xl:min-h-11 xl:gap-2 xl:rounded-xl xl:px-3 xl:py-2 xl:text-sm"
          active-class="bg-white text-slate-950 shadow-sm"
          inactive-class="text-slate-600 hover:text-slate-950"
          @update:model-value="setCalendarAction"
        />
    </template>

    <template #body>
      <div class="flex h-full min-h-full flex-col gap-3">


        <AvailabilityWindowForm
          class="!min-h-0 flex-1"
          v-show="form.action === 'availability'"
          :active="modelValue && form.action === 'availability'"
          :admin="admin"
          :masters="selectedMasterOptions"
          :initial-master-id="masterId"
          :initial-date="form.date"
          :initial-start-time="form.start_time"
          :initial-end-time="form.end_time"
          @busy="availabilityBusy = $event"
          @saved="emit('saved', $event)"
          @complete="emit('update:modelValue', false)"
        />
        <form v-show="form.action !== 'availability'" class="space-y-3 xl:space-y-5" @submit.prevent="submit">
        <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 md:grid-cols-3 xl:gap-4">
          <label class="col-span-2 min-w-0 space-y-1 text-xs text-slate-700 md:col-span-1 xl:space-y-2 xl:text-sm">
            <span class="inline-flex items-center gap-1.5 font-medium">
              <CalendarDaysIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
              Дата
            </span>
            <BaseCalendar v-model="form.date" required class="min-w-0 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3" />
          </label>
          <label class="min-w-0 space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="inline-flex items-center gap-1.5 font-medium">
              <ClockIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
              Початок
            </span>
            <BaseInput v-model="form.start_time" required type="time" :min="calendar.workdayStart" :max="calendar.workdayEnd" class="min-w-0 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500 xl:rounded-2xl xl:px-4 xl:py-3" />
          </label>
          <label class="min-w-0 space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="inline-flex items-center gap-1.5 font-medium">
              <ClockIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
              Завершення
            </span>
            <BaseInput v-model="form.end_time" required type="time" :min="calendar.workdayStart" :max="calendar.workdayEnd" class="min-w-0 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500 xl:rounded-2xl xl:px-4 xl:py-3" />
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
      </div>
    </template>
  </BaseModal>
</template>
