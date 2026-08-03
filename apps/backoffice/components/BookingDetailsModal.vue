<script setup lang="ts">
import { BanknotesIcon, CalendarDaysIcon, ChatBubbleLeftEllipsisIcon, CheckCircleIcon, ChevronDownIcon, ClipboardDocumentIcon, ClockIcon, EyeIcon, PencilIcon, PhoneIcon, PlayIcon, ReceiptPercentIcon, StopIcon, UserIcon, XCircleIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import type { Booking, BookingSchedulePayload, BookingStatus } from '~/composables/useBackofficeApi'
import type { Master, Service } from '~/composables/useBackofficeApi'

const props = defineProps<{
  booking: Booking | null
  allowedStatuses?: BookingStatus[]
  pendingStatus?: BookingStatus | ''
  pendingSchedule?: boolean
  pendingDiscount?: boolean
  pendingDelete?: boolean
  canEdit?: boolean
  canEditDiscount?: boolean
  canDelete?: boolean
  masters?: Master[]
  services?: Service[]
}>()

const emit = defineEmits<{
  close: []
  updateStatus: [status: BookingStatus]
  updateSchedule: [payload: BookingSchedulePayload]
  updateDiscount: [discountAmount: number]
  delete: []
}>()

const {
  bookingStart,
  bookingEnd,
  bookingComment,
  bookingPhone,
  customerName,
  masterName,
  redirectedFromMasterName,
  bookingServiceIds,
  bookingServices,
  bookingServicesLabel,
  formatPrice,
  formatDateTime,
  formatBookingStatus,
  formatMoney,
  toKyivIso,
} = useBookingFormatting()
const toast = useBaseToastNotification()

const allowed = computed(() => props.allowedStatuses || [])
const scheduleForm = reactive({
  date: '',
  start_time: '',
  duration_minutes: 30,
})
const serviceForm = reactive({
  service_ids: [] as string[],
})
const discountForm = reactive({
  amount: 0,
})
const scheduleError = ref('')
const serviceError = ref('')
const discountError = ref('')
const scheduleEditing = ref(false)
const serviceEditing = ref(false)
const discountEditing = ref(false)
const deleteConfirmOpen = ref(false)
const phoneCopied = ref(false)
let phoneCopiedTimeout: ReturnType<typeof setTimeout> | null = null
const masterOptions = computed(() => props.masters || [])
const { isAdmin, isBarber } = useBackofficeAccess(masterOptions)

const dateInputFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Kyiv',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const timeInputFormatter = new Intl.DateTimeFormat('uk-UA', {
  timeZone: 'Europe/Kyiv',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const dateInputFromDateTime = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = Object.fromEntries(dateInputFormatter.formatToParts(date).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

const timeInputFromDateTime = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return timeInputFormatter.format(date)
}

const bookingDurationMinutes = (booking: Booking) => {
  const start = new Date(bookingStart(booking)).getTime()
  const end = new Date(bookingEnd(booking)).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return resolvedServices.value.reduce((total, service) => total + Number(service.duration_minutes || 0), 0) || 30
  }

  return Math.max(1, Math.round((end - start) / 60000))
}

const resetScheduleForm = () => {
  if (!props.booking) return
  scheduleForm.date = dateInputFromDateTime(bookingStart(props.booking))
  scheduleForm.start_time = timeInputFromDateTime(bookingStart(props.booking))
  scheduleForm.duration_minutes = bookingDurationMinutes(props.booking)
  scheduleError.value = ''
  scheduleEditing.value = false
}

const resetServiceForm = () => {
  if (!props.booking) return
  serviceForm.service_ids = bookingServiceIds(props.booking).map(String)
  serviceError.value = ''
  serviceEditing.value = false
}

const resetDiscountForm = () => {
  if (!props.booking) return
  discountForm.amount = Number(props.booking.discount_amount || 0)
  discountError.value = ''
  discountEditing.value = false
}

const resolvedMaster = computed(() =>
  props.booking?.master || props.booking?.barber || props.masters?.find(master => master.id === props.booking?.master_id) || null,
)
const customerProfilePath = computed(() => {
  const customerId = props.booking?.customer_id || props.booking?.customer?.id
  return customerId ? `/customers/${customerId}` : ''
})
const redirectSourceName = computed(() =>
  props.booking ? redirectedFromMasterName(props.booking) : '',
)

const resolvedServices = computed(() =>
  props.booking ? bookingServices(props.booking, props.services || []) : [],
)

const resolvedServicesPriceLabel = computed(() => {
  if (!resolvedServices.value.length) return ''
  const total = resolvedServices.value.reduce((sum, service) => sum + Number(service.price || 0), 0)

  if (resolvedServices.value.length === 1) return formatPrice(resolvedServices.value[0]?.price)

  return `${resolvedServices.value.map(service => formatPrice(service.price)).join(', ')} · разом ${formatPrice(total)}`
})

const bookingSubtotal = computed(() =>
  props.booking?.subtotal_amount ?? resolvedServices.value.reduce((sum, service) => sum + Number(service.price || 0), 0),
)
const bookingDiscount = computed(() => Number(props.booking?.discount_amount || 0))
const bookingTotal = computed(() =>
  props.booking?.total_amount ?? Math.max(Number(bookingSubtotal.value || 0) - bookingDiscount.value, 0),
)
const discountInputMax = computed(() => Math.max(Math.floor(Number(bookingSubtotal.value || 0)), 0))
const hasPromotion = computed(() => Boolean(
  props.booking?.promotion_code
  || props.booking?.promotion_id
  || props.booking?.promotion_name_uk
  || props.booking?.promotion_name_en
  || props.booking?.promotion_discount_percent,
))
const promotionLabel = computed(() => {
  if (!props.booking) return ''
  const name = props.booking.promotion_name_uk || props.booking.promotion_name_en || 'Акція'
  const code = props.booking.promotion_code ? ` (${props.booking.promotion_code})` : ''
  const percent = props.booking.promotion_discount_percent ? ` · ${props.booking.promotion_discount_percent}%` : ''
  return `${name}${code}${percent}`
})

const editableServiceOptions = computed(() => {
  if (!props.booking) return []
  const masterId = Number(props.booking.master_id)
  const options = (props.services || []).filter(service => !service.barber_id || Number(service.barber_id) === masterId)
  const byId = new Map<number, Service>()

  for (const service of [...options, ...resolvedServices.value]) {
    byId.set(Number(service.id), service as Service)
  }

  return Array.from(byId.values())
})

const canEditBooking = computed(() => Boolean(props.booking && props.booking.status !== 'completed' && isAdmin.value && props.canEdit !== false))
const canEditBookingDiscount = computed(() => Boolean(props.booking && isAdmin.value && props.canEditDiscount === true))
const canDeleteBooking = computed(() => Boolean(props.booking && props.booking.status !== 'completed' && props.canDelete !== false))
const orderedAllowedStatuses = computed(() => {
  const order: BookingStatus[] = ['completed', 'cancelled', 'confirmed']
  return [...allowed.value].sort((first, second) => order.indexOf(first) - order.indexOf(second))
})

const statusActionClass = (status: BookingStatus) => {
  if (status === 'cancelled') return 'backoffice-modal-action-danger-outline'
  if (status === 'completed') return 'backoffice-modal-action-success'

  return 'backoffice-modal-action-primary'
}

const statusActionIcon = (status: BookingStatus) => {
  if (status === 'cancelled') return XCircleIcon
  if (status === 'completed') return CheckCircleIcon

  return ClockIcon
}

const submitSchedule = () => {
  scheduleError.value = ''
  if (!scheduleForm.date || !scheduleForm.start_time) {
    scheduleError.value = 'Вкажіть дату та час початку.'
    toast.warning(scheduleError.value)
    return
  }
  if (!Number.isFinite(scheduleForm.duration_minutes) || scheduleForm.duration_minutes < 1) {
    scheduleError.value = 'Тривалість має бути більше 0 хвилин.'
    toast.warning(scheduleError.value)
    return
  }

  const startAt = toKyivIso(scheduleForm.date, scheduleForm.start_time)
  const endAt = new Date(new Date(startAt).getTime() + scheduleForm.duration_minutes * 60000).toISOString()
  emit('updateSchedule', { start_at: startAt, end_at: endAt })
}

const submitServices = () => {
  serviceError.value = ''
  const serviceIds = serviceForm.service_ids.map(Number).filter(Number.isFinite)
  if (!serviceIds.length) {
    serviceError.value = 'Виберіть хоча б одну послугу.'
    toast.warning(serviceError.value)
    return
  }

  emit('updateSchedule', { service_ids: serviceIds })
}

const submitDiscount = () => {
  discountError.value = validateBookingDiscountAmount(discountForm.amount, bookingSubtotal.value)
  if (discountError.value) {
    toast.warning(discountError.value)
    return
  }

  if (Number(discountForm.amount) === bookingDiscount.value) {
    discountEditing.value = false
    return
  }

  emit('updateDiscount', Number(discountForm.amount))
}

const removeDiscount = () => {
  if (!canEditBookingDiscount.value || bookingDiscount.value <= 0 || props.pendingDiscount) return
  discountError.value = ''
  discountEditing.value = false
  emit('updateDiscount', 0)
}

const cancelScheduleEditing = () => {
  resetScheduleForm()
  scheduleEditing.value = false
}

const cancelServiceEditing = () => {
  resetServiceForm()
  serviceEditing.value = false
}

const cancelDiscountEditing = () => {
  resetDiscountForm()
  discountEditing.value = false
}

const copyPhone = async () => {
  if (!props.booking || !import.meta.client) return
  const phone = bookingPhone(props.booking)
  if (!phone) return

  await navigator.clipboard.writeText(phone)
  phoneCopied.value = true
  if (phoneCopiedTimeout) clearTimeout(phoneCopiedTimeout)
  phoneCopiedTimeout = setTimeout(() => {
    phoneCopied.value = false
    phoneCopiedTimeout = null
  }, 1500)
}

const handleModalUpdate = (value: boolean) => {
  if (!value) emit('close')
}

const confirmDelete = () => {
  if (!canDeleteBooking.value || props.pendingDelete) return
  emit('delete')
}

watch(
  () => [props.booking?.id, props.booking ? bookingStart(props.booking) : '', props.booking ? bookingEnd(props.booking) : ''],
  resetScheduleForm,
  { immediate: true },
)

watch(
  () => [props.booking?.id, props.booking?.service_id, props.booking?.service_ids?.join(',') || ''],
  resetServiceForm,
  { immediate: true },
)

watch(
  () => [props.booking?.id, props.booking?.discount_amount],
  resetDiscountForm,
  { immediate: true },
)

onBeforeUnmount(() => {
  if (phoneCopiedTimeout) clearTimeout(phoneCopiedTimeout)
})
</script>

<template>
  <BaseModal
    :model-value="Boolean(booking)"
    max-width-class="max-w-3xl"
    @update:model-value="handleModalUpdate"
  >
    <template #head="{ close: closeModal }">
      <template v-if="booking">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-cyan-700 sm:text-sm sm:tracking-[0.25em]">Деталі бронювання</p>
            <div class="mt-1 flex flex-wrap items-center gap-2 sm:mt-2">
              <h2 class="min-w-0 truncate text-lg font-semibold text-slate-900 sm:text-2xl">
                #{{ booking.id }} · {{ customerName(booking) }}
              </h2>
              <NuxtLink
                v-if="customerProfilePath"
                :to="customerProfilePath"
                class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition hover:bg-white hover:text-slate-950"
                aria-label="Відкрити профіль клієнта"
                title="Відкрити профіль клієнта"
              >
                <EyeIcon class="h-4 w-4" aria-hidden="true" />
              </NuxtLink>
              <BookingStatusBadge :status="booking.status" />
            </div>
          </div>
          <ModalCloseButton @click="closeModal" />
        </div>
      </template>
    </template>

    <template #body>
      <div v-if="booking" class="space-y-3 sm:space-y-6">
        <dl class="grid grid-cols-2 gap-2 sm:gap-3">
          <div class="rounded-xl bg-slate-50 px-3 py-2 sm:rounded-2xl sm:p-4">
            <dt class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.18em]">
              <UserIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Клієнт
            </dt>
            <dd class="mt-1 text-sm font-medium text-slate-900 sm:mt-2 sm:text-base">{{ customerName(booking) }}</dd>
          </div>
          <div class="rounded-xl bg-slate-50 px-3 py-2 sm:rounded-2xl sm:p-4">
            <dt class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.18em]">
              <PhoneIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Телефон
            </dt>
            <dd class="mt-1 flex items-center justify-between gap-2 text-sm font-medium text-slate-900 sm:mt-2 sm:text-base">
              <span class="min-w-0 truncate">{{ bookingPhone(booking) || '-' }}</span>
              <BaseButton
                v-if="bookingPhone(booking)"
                type="button"
                class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition hover:bg-white"
                :aria-label="phoneCopied ? 'Телефон скопійовано' : 'Скопіювати телефон'"
                :title="phoneCopied ? 'Скопійовано' : 'Скопіювати'"
                @click="copyPhone"
              >
                <ClipboardDocumentIcon class="h-3.5 w-3.5" aria-hidden="true" />
              </BaseButton>
            </dd>
          </div>
          <div v-if="!isBarber" class="rounded-xl bg-slate-50 px-3 py-2 sm:rounded-2xl sm:p-4">
            <dt class="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.18em]">Майстер</dt>
            <dd class="mt-1 text-sm font-medium text-slate-900 sm:mt-2 sm:text-base">{{ masterName(resolvedMaster) }}</dd>
          </div>
          <div v-if="redirectSourceName" class="backoffice-booking-redirect-card rounded-xl px-3 py-2 sm:rounded-2xl sm:p-4">
            <dt class="backoffice-booking-redirect-label text-[11px] font-medium uppercase tracking-[0.12em] sm:text-xs sm:tracking-[0.18em]">Перенаправлено від</dt>
            <dd class="backoffice-booking-redirect-value mt-1 text-sm font-medium sm:mt-2 sm:text-base">{{ redirectSourceName }}</dd>
          </div>
          <div class="rounded-xl bg-slate-50 px-3 py-2 sm:rounded-2xl sm:p-4" :class="isBarber && !redirectSourceName ? 'col-span-2' : ''">
            <dt class="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.18em]">Послуги</dt>
            <dd class="mt-1 text-sm font-medium text-slate-900 sm:mt-2 sm:text-base">
              {{ bookingServicesLabel(booking, services || []) }}
              <span v-if="resolvedServicesPriceLabel" class="mt-0.5 block text-xs font-medium text-slate-500 sm:text-sm">
                Ціна: {{ resolvedServicesPriceLabel }}
              </span>
            </dd>
          </div>
          <div class="col-span-2 rounded-xl bg-slate-50 px-3 py-2 sm:rounded-2xl sm:p-4">
            <dt class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.18em]">
              <BanknotesIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Оплата
            </dt>
            <dd class="mt-2 grid gap-2 text-sm sm:grid-cols-3">
              <span class="booking-money-card rounded-lg px-3 py-2">
                <span class="block text-xs text-slate-500">Послуги</span>
                <span class="font-semibold text-slate-900">{{ formatMoney(bookingSubtotal) }}</span>
              </span>
              <span class="booking-money-card rounded-lg px-3 py-2">
                <span class="block text-xs text-slate-500">Знижка</span>
                <span class="font-semibold" :class="bookingDiscount > 0 ? 'text-emerald-700' : 'text-slate-900'">-{{ formatMoney(bookingDiscount) }}</span>
              </span>
              <span class="booking-money-card rounded-lg px-3 py-2">
                <span class="block text-xs text-slate-500">До сплати</span>
                <span class="font-semibold text-slate-900">{{ formatMoney(bookingTotal) }}</span>
              </span>
            </dd>
            <p v-if="hasPromotion" class="booking-promotion-chip mt-3 inline-flex max-w-full items-start gap-2 rounded-full px-3 py-1.5 text-xs font-semibold">
              <ReceiptPercentIcon class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span class="min-w-0 break-words">Стрижка за акцією: {{ promotionLabel }}</span>
            </p>
            <div v-if="canEditBookingDiscount && !discountEditing" class="mt-3 grid gap-2" :class="bookingDiscount > 0 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'">
              <BaseButton
                type="button"
                class="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
                :aria-label="bookingDiscount > 0 ? 'Редагувати знижку бронювання' : 'Додати знижку до бронювання'"
                :disabled="pendingDiscount"
                @click="discountEditing = true"
              >
                <PencilIcon class="h-4 w-4" aria-hidden="true" />
                {{ bookingDiscount > 0 ? 'Редагувати знижку' : 'Додати знижку' }}
              </BaseButton>
              <BaseButton
                v-if="bookingDiscount > 0"
                type="button"
                class="backoffice-modal-action-danger-outline inline-flex w-full items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition"
                aria-label="Видалити знижку бронювання"
                :disabled="pendingDiscount"
                @click="removeDiscount"
              >
                <TrashIcon v-if="!pendingDiscount" />
                {{ pendingDiscount ? 'Видалення...' : 'Видалити знижку' }}
              </BaseButton>
            </div>
            <form
              v-else-if="canEditBookingDiscount"
              class="mt-3 rounded-xl bg-white p-3 ring-1 ring-slate-200"
              @submit.prevent="submitDiscount"
            >
              <BaseInput
                v-model.number="discountForm.amount"
                label="Знижка, грн"
                :error="discountError"
                required
                type="number"
                min="0"
                :max="discountInputMax"
                step="1"
                inputmode="numeric"
                input-class="base-control px-3 py-2 text-sm"
              />
              <div class="backoffice-modal-actions mt-3">
                <BaseButton type="submit" :disabled="pendingDiscount" class="backoffice-modal-action-button backoffice-modal-action-primary">
                  <CheckCircleIcon v-if="!pendingDiscount" class="h-4 w-4" aria-hidden="true" />
                  {{ pendingDiscount ? 'Збереження...' : 'Зберегти' }}
                </BaseButton>
                <BaseButton type="button" :disabled="pendingDiscount" class="backoffice-modal-action-button backoffice-modal-action-neutral" @click="cancelDiscountEditing">
                  <XMarkIcon class="h-4 w-4" aria-hidden="true" />
                  Скасувати
                </BaseButton>
              </div>
            </form>
          </div>
          <div v-if="canEditBooking && !serviceEditing" class="col-span-2">
            <BaseButton
              type="button"
              class="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
              aria-label="Редагувати послуги бронювання"
              @click="serviceEditing = true"
            >
              <PencilIcon class="h-4 w-4" aria-hidden="true" />
              Редагувати послуги
            </BaseButton>
          </div>
          <form v-else-if="canEditBooking" class="col-span-2 rounded-xl bg-slate-50 px-3 py-2 sm:rounded-2xl sm:p-4" @submit.prevent="submitServices">
            <ServiceMultiSelect v-model="serviceForm.service_ids" :services="editableServiceOptions" />
            <div class="backoffice-modal-actions mt-3">
              <BaseButton type="submit" :disabled="pendingSchedule" class="backoffice-modal-action-button backoffice-modal-action-primary">
                <CheckCircleIcon v-if="!pendingSchedule" class="h-4 w-4" aria-hidden="true" />
                {{ pendingSchedule ? 'Збереження...' : 'Зберегти' }}
              </BaseButton>
              <BaseButton type="button" class="backoffice-modal-action-button backoffice-modal-action-neutral" @click="cancelServiceEditing">
                <XMarkIcon class="h-4 w-4" aria-hidden="true" />
                Скасувати
              </BaseButton>
            </div>
          </form>
          <div class="rounded-xl bg-slate-50 px-3 py-2 sm:rounded-2xl sm:p-4">
            <dt class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.18em]">
              <PlayIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Час початку
            </dt>
            <dd class="mt-1 text-sm font-medium text-slate-900 sm:mt-2 sm:text-base">{{ formatDateTime(bookingStart(booking)) }}</dd>
          </div>
          <div class="rounded-xl bg-slate-50 px-3 py-2 sm:rounded-2xl sm:p-4">
            <dt class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.18em]">
              <StopIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Час завершення
            </dt>
            <dd class="mt-1 text-sm font-medium text-slate-900 sm:mt-2 sm:text-base">{{ formatDateTime(bookingEnd(booking)) }}</dd>
          </div>
          <div v-if="canEditBooking && !scheduleEditing" class="col-span-2">
            <BaseButton
              type="button"
              class="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
              aria-label="Редагувати час бронювання"
              @click="scheduleEditing = !scheduleEditing"
            >
              <PencilIcon class="h-4 w-4" aria-hidden="true" />
              Редагувати час
            </BaseButton>
          </div>
          <form v-else-if="canEditBooking" class="col-span-2 rounded-xl bg-slate-50 px-3 py-2 sm:rounded-2xl sm:p-4" @submit.prevent="submitSchedule">
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem] sm:items-end">
              <label class="space-y-1 text-xs font-medium text-slate-600">
                <span>Дата</span>
                <BaseCalendar v-model="scheduleForm.date" required class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label class="space-y-1 text-xs font-medium text-slate-600">
                <span>Початок</span>
                <BaseInput v-model="scheduleForm.start_time" required type="time" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label class="space-y-1 text-xs font-medium text-slate-600">
                <span>Тривалість, хв</span>
                <BaseInput v-model.number="scheduleForm.duration_minutes" required type="number" min="1" step="1" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              </label>
            </div>
            <div class="backoffice-modal-actions mt-3">
              <BaseButton type="submit" :disabled="pendingSchedule" class="backoffice-modal-action-button backoffice-modal-action-primary">
                <CheckCircleIcon v-if="!pendingSchedule" class="h-4 w-4" aria-hidden="true" />
                {{ pendingSchedule ? 'Збереження...' : 'Зберегти' }}
              </BaseButton>
              <BaseButton type="button" class="backoffice-modal-action-button backoffice-modal-action-neutral" @click="cancelScheduleEditing">
                <XMarkIcon class="h-4 w-4" aria-hidden="true" />
                Скасувати
              </BaseButton>
            </div>
          </form>
          <div class="rounded-xl bg-slate-50 px-3 py-2 sm:rounded-2xl sm:p-4">
            <dt class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.18em]">
              <CalendarDaysIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Створено
            </dt>
            <dd class="mt-1 text-sm font-medium text-slate-900 sm:mt-2 sm:text-base">{{ formatDateTime(booking.created_at) }}</dd>
          </div>
          <div class="rounded-xl bg-slate-50 px-3 py-2 sm:rounded-2xl sm:p-4">
            <dt class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.18em]">
              <CheckCircleIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Завершено
            </dt>
            <dd class="mt-1 text-sm font-medium text-slate-900 sm:mt-2 sm:text-base">{{ formatDateTime(booking.completed_at) }}</dd>
          </div>
        </dl>

        <details class="group rounded-xl bg-slate-50 px-3 py-2 sm:rounded-2xl sm:p-4">
          <summary class="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
            Додаткова інформація
            <ChevronDownIcon class="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <dl class="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
            <div class="col-span-2 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-100 md:col-span-1">
              <dt class="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.18em]">Email</dt>
              <dd class="mt-1 break-words text-sm font-medium text-slate-900 sm:mt-2 sm:text-base">{{ booking.customer_email || booking.customer?.email || '-' }}</dd>
            </div>
            <div class="col-span-2 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-100 md:col-span-1">
              <dt class="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.18em]">Профіль клієнта</dt>
              <dd class="mt-1 text-sm font-medium text-slate-900 sm:mt-2 sm:text-base">
                <NuxtLink v-if="booking.customer_id || booking.customer?.id" :to="`/customers/${booking.customer_id || booking.customer?.id}`" class="text-cyan-700 hover:text-cyan-900">
                  Customer #{{ booking.customer_id || booking.customer?.id }}
                </NuxtLink>
                <span v-else>-</span>
              </dd>
            </div>
            <div class="col-span-2 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-100 md:col-span-1">
              <dt class="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.18em]">Скасовано</dt>
              <dd class="mt-1 text-sm font-medium text-slate-900 sm:mt-2 sm:text-base">{{ formatDateTime(booking.cancelled_at) }}</dd>
            </div>
          </dl>
        </details>

        <div class="rounded-xl bg-slate-50 px-3 py-2 sm:rounded-2xl sm:p-4">
          <p class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.18em]">
            <ChatBubbleLeftEllipsisIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Коментар клієнта
          </p>
          <p class="mt-1 text-sm leading-5 text-slate-700 sm:mt-2 sm:leading-6">{{ bookingComment(booking) || 'Без коментаря' }}</p>
        </div>

        <div v-if="orderedAllowedStatuses.length || canDeleteBooking" class="grid grid-cols-2 gap-2 pt-2 sm:gap-3 sm:pt-3">
          <BaseButton
            v-for="status in orderedAllowedStatuses"
            :key="status"
            class="backoffice-modal-action-button backoffice-booking-status-action"
            :class="[statusActionClass(status), status === 'completed' ? 'col-span-2' : '']"
            :disabled="pendingStatus === status"
            @click="emit('updateStatus', status)"
          >
            <component :is="statusActionIcon(status)" class="h-4 w-4 shrink-0" aria-hidden="true" />
            {{ pendingStatus === status ? 'Оновлення...' : formatBookingStatus(status) }}
          </BaseButton>
          <BaseButton
            v-if="canDeleteBooking"
            type="button"
            class="backoffice-modal-action-button backoffice-modal-action-danger-outline backoffice-booking-status-action"
            :disabled="pendingDelete"
            @click="deleteConfirmOpen = true"
          >
            <TrashIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
            {{ pendingDelete ? 'Видалення...' : 'Видалити' }}
          </BaseButton>
        </div>
      </div>

      <ConfirmActionModal
        v-if="booking"
        v-model="deleteConfirmOpen"
        title="Видалити бронювання?"
        message="Це повністю прибере помилково створений запис з календаря. Для клієнтських відмов використовуйте зміну статусу на скасований."
        confirm-label="Видалити"
        :pending="pendingDelete"
        destructive
        :context-items="[
          { label: 'Клієнт', value: customerName(booking) },
          { label: 'Час', value: formatDateTime(bookingStart(booking)) },
          { label: 'Послуги', value: bookingServicesLabel(booking, services || []) },
        ]"
        @confirm="confirmDelete"
      />
    </template>
  </BaseModal>
</template>
