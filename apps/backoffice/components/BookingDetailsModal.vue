<script setup lang="ts">
import { BanknotesIcon, CalendarDaysIcon, ChatBubbleLeftEllipsisIcon, CheckCircleIcon, ChevronDownIcon, ClipboardDocumentIcon, ClockIcon, EyeIcon, PencilIcon, PhoneIcon, PlayIcon, ReceiptPercentIcon, StopIcon, UserIcon, XCircleIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { bookingEndTime, bookingTimeDuration, parseBookingTime } from '~/utils/bookingScheduleTime'
import type { Booking, BookingPricingPayload, BookingSchedulePayload, BookingStatus } from '~/composables/useBackofficeApi'
import type { Master, Promotion, Service } from '~/composables/useBackofficeApi'

const props = defineProps<{
  busy?: boolean
  checking?: boolean
  needsRefresh?: boolean
  notice?: string
  actionError?: string
  booking: Booking | null
  allowedStatuses?: BookingStatus[]
  pendingStatus?: BookingStatus | ''
  pendingSchedule?: boolean
  pendingPricing?: boolean
  pendingDelete?: boolean
  canEdit?: boolean
  canEditPricing?: boolean
  canDelete?: boolean
  masters?: Master[]
  services?: Service[]
  promotions?: Promotion[]
}>()

const emit = defineEmits<{
  refresh: []
  close: []
  updateStatus: [status: BookingStatus]
  updateSchedule: [payload: BookingSchedulePayload]
  updatePricing: [payload: BookingPricingPayload]
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
  redirectedFromMasterId,
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

const interactionBusy = computed(() => Boolean(props.busy || props.pendingStatus || props.pendingSchedule || props.pendingPricing || props.pendingDelete))
const allowed = computed(() => props.booking?.status === 'completed' ? [] : props.allowedStatuses || [])
const scheduleForm = reactive({
  date: '',
  start_time: '',
  end_time: '',
  duration_minutes: 30,
})
const serviceForm = reactive({
  service_ids: [] as string[],
})
const pricingForm = reactive({
  service_prices: [] as Array<{ service_id: number, price_amount: number }>,
  promotion_code: '',
})
const scheduleError = ref('')
const serviceError = ref('')
const pricingError = ref('')
const scheduleEditing = ref(false)
const serviceEditing = ref(false)
const pricingEditing = ref(false)
const deleteConfirmOpen = ref(false)
const phoneCopied = ref(false)
let phoneCopiedTimeout: ReturnType<typeof setTimeout> | null = null
const masterOptions = computed(() => props.masters || [])
const { isAdmin, isBarber, canManageBooking } = useBackofficeAccess(masterOptions)

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
  scheduleForm.end_time = timeInputFromDateTime(bookingEnd(props.booking))
  scheduleError.value = ''
  scheduleEditing.value = false
}

const resetServiceForm = () => {
  if (!props.booking) return
  serviceForm.service_ids = bookingServiceIds(props.booking).map(String)
  serviceError.value = ''
  serviceEditing.value = false
}

const resetPricingForm = () => {
  if (!props.booking) return
  pricingForm.service_prices = resolvedServices.value.map(service => ({
    service_id: Number(service.id),
    price_amount: bookingServicePrice(service),
  }))
  pricingForm.promotion_code = props.booking.promotion_code || ''
  pricingError.value = ''
  pricingEditing.value = false
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

const bookingServicePrice = (service: { id?: number | string, price?: number | string | null }) => Number(
  props.booking?.service_prices?.[String(service.id ?? '')] ?? service.price ?? 0,
)

const resolvedServicesPriceLabel = computed(() => {
  if (!resolvedServices.value.length) return ''
  const prices = resolvedServices.value.map(bookingServicePrice)
  const total = prices.reduce((sum, price) => sum + price, 0)

  if (resolvedServices.value.length === 1) return formatPrice(prices[0])

  return `${prices.map(formatPrice).join(', ')} · разом ${formatPrice(total)}`
})

const bookingSubtotal = computed(() =>
  props.booking?.subtotal_amount ?? resolvedServices.value.reduce((sum, service) => sum + bookingServicePrice(service), 0),
)
const bookingDiscount = computed(() => Number(props.booking?.discount_amount || 0))
const bookingTotal = computed(() =>
  props.booking?.total_amount ?? Math.max(Number(bookingSubtotal.value || 0) - bookingDiscount.value, 0),
)
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
const promotionOptions = computed(() => [
  { value: '', label: 'Без акції' },
  ...(props.promotions || []).map(promotion => ({
    value: promotion.code,
    label: `${promotion.name_uk || promotion.name_en || promotion.code} · ${promotion.code} · ${promotion.discount_percent}%`,
  })),
])
const pricingServiceName = (serviceId: number) => {
  const service = resolvedServices.value.find(item => Number(item.id) === serviceId)
  return service?.title_uk || service?.name || service?.title_en || `Послуга #${serviceId}`
}

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

const canManageCurrentBooking = computed(() => Boolean(props.booking && canManageBooking(props.booking.master_id, redirectedFromMasterId(props.booking))))
const canEditBooking = computed(() => Boolean(props.booking && props.booking.status !== 'completed' && canManageCurrentBooking.value && props.canEdit !== false))
const canEditBookingPricing = computed(() => Boolean(props.booking && canManageCurrentBooking.value && (isAdmin.value || props.booking.status !== 'completed') && props.canEditPricing === true))
const canDeleteBooking = computed(() => Boolean(props.booking && props.canDelete !== false))
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

const setScheduleStart = (value: unknown) => {
  scheduleForm.start_time = String(value ?? '')
  scheduleForm.end_time = bookingEndTime(scheduleForm.start_time, scheduleForm.duration_minutes)
  scheduleError.value = ''
}
const setScheduleEnd = (value: unknown) => {
  scheduleForm.end_time = String(value ?? '')
  const duration = bookingTimeDuration(scheduleForm.start_time, scheduleForm.end_time)
  if (duration !== null) scheduleForm.duration_minutes = duration
  scheduleError.value = ''
}
const setScheduleDuration = (value: unknown) => {
  scheduleForm.duration_minutes = Number(value)
  scheduleForm.end_time = bookingEndTime(scheduleForm.start_time, scheduleForm.duration_minutes)
  scheduleError.value = ''
}
const scheduleErrorId = `booking-schedule-error-${useId()}`

const submitSchedule = () => {
  if (interactionBusy.value || !canEditBooking.value) return
  scheduleError.value = ''
  if (!scheduleForm.date || parseBookingTime(scheduleForm.start_time) === null) {
    scheduleError.value = 'Вкажіть дату та час початку.'
    toast.warning(scheduleError.value)
    return
  }
  if (!Number.isInteger(scheduleForm.duration_minutes) || scheduleForm.duration_minutes < 1) {
    scheduleError.value = 'Тривалість має бути цілим числом хвилин, більшим за 0.'
    toast.warning(scheduleError.value)
    return
  }

  if (bookingTimeDuration(scheduleForm.start_time, scheduleForm.end_time) === null) {
    scheduleError.value = 'Завершення має бути пізніше початку в межах одного дня (ГГ:ХХ, 24 години).'
    toast.warning(scheduleError.value)
    return
  }
  const startAt = toKyivIso(scheduleForm.date, scheduleForm.start_time)
  const endAt = toKyivIso(scheduleForm.date, scheduleForm.end_time)
  emit('updateSchedule', { start_at: startAt, end_at: endAt })
}

const submitServices = () => {
  if (interactionBusy.value || !canEditBooking.value) return
  serviceError.value = ''
  const serviceIds = serviceForm.service_ids.map(Number).filter(Number.isFinite)
  if (!serviceIds.length) {
    serviceError.value = 'Виберіть хоча б одну послугу.'
    toast.warning(serviceError.value)
    return
  }

  emit('updateSchedule', { service_ids: serviceIds })
}

const submitPricing = () => {
  if (interactionBusy.value || !canEditBookingPricing.value) return
  const invalidPrice = pricingForm.service_prices.find(item => (
    !Number.isFinite(Number(item.price_amount))
    || !Number.isInteger(Number(item.price_amount))
    || Number(item.price_amount) < 0
  ))
  if (!pricingForm.service_prices.length || invalidPrice) {
    pricingError.value = 'Ціна кожної послуги має бути цілим невід’ємним числом.'
    toast.warning(pricingError.value)
    return
  }

  pricingError.value = ''
  emit('updatePricing', {
    service_prices: pricingForm.service_prices.map(item => ({
      service_id: item.service_id,
      price_amount: Number(item.price_amount),
    })),
    ...(isAdmin.value ? { promotion_code: pricingForm.promotion_code || null } : {}),
  })
}

const cancelScheduleEditing = () => {
  resetScheduleForm()
  scheduleEditing.value = false
}

const cancelServiceEditing = () => {
  resetServiceForm()
  serviceEditing.value = false
}

const cancelPricingEditing = () => {
  resetPricingForm()
  pricingEditing.value = false
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
  if (!canDeleteBooking.value || interactionBusy.value) return
  emit('delete')
}

watch(() => [props.booking?.id, props.booking?.status], (values, previous) => {
  if (previous && values.every((value, index) => value === previous[index])) return
  scheduleEditing.value = false
  serviceEditing.value = false
  pricingEditing.value = false
  deleteConfirmOpen.value = false
})

watch(
  () => [props.booking?.id, props.booking ? bookingStart(props.booking) : '', props.booking ? bookingEnd(props.booking) : ''],
  (values, previous) => {
    if (!previous || values.some((value, index) => value !== previous[index])) resetScheduleForm()
  },
  { immediate: true },
)

watch(
  () => [props.booking?.id, props.booking?.service_id, props.booking?.service_ids?.join(',') || ''],
  resetServiceForm,
  { immediate: true },
)

watch(
  () => [
    props.booking?.id,
    props.booking?.promotion_code,
    JSON.stringify(props.booking?.service_prices || {}),
  ],
  resetPricingForm,
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
      <div v-if="booking" class="booking-details-content space-y-2 sm:space-y-3">
        <div v-if="checking || notice || actionError" class="rounded-xl bg-slate-100 p-3 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-100" aria-live="polite">
          <p v-if="checking" role="status">Перевіряємо актуальність запису…</p>
          <p v-if="notice" role="status">{{ notice }}</p>
          <p v-if="actionError" role="alert" class="mt-1">{{ actionError }}</p>
          <BaseButton v-if="needsRefresh" :disabled="checking" class="mt-2" @click="emit('refresh')">Оновити дані</BaseButton>
        </div>
        <dl class="grid grid-cols-2 gap-2 sm:gap-3">
          <div class="rounded-xl bg-slate-50 px-3 py-2 sm:rounded-2xl sm:p-3">
            <dt class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.18em]">
              <UserIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Клієнт
            </dt>
            <dd class="mt-1 text-sm font-medium text-slate-900 sm:mt-2 sm:text-base">{{ customerName(booking) }}</dd>
          </div>
          <div class="rounded-xl bg-slate-50 px-3 py-2 sm:rounded-2xl sm:p-3">
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
          <div v-if="!isBarber" class="rounded-xl bg-slate-50 px-3 py-2 sm:rounded-2xl sm:p-3">
            <dt class="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.18em]">Майстер</dt>
            <dd class="mt-1 text-sm font-medium text-slate-900 sm:mt-2 sm:text-base">{{ masterName(resolvedMaster) }}</dd>
          </div>
          <div v-if="redirectSourceName" class="backoffice-booking-redirect-card rounded-xl px-3 py-2 sm:rounded-2xl sm:p-3">
            <dt class="backoffice-booking-redirect-label text-[11px] font-medium uppercase tracking-[0.12em] sm:text-xs sm:tracking-[0.18em]">Перенаправлено від</dt>
            <dd class="backoffice-booking-redirect-value mt-1 text-sm font-medium sm:mt-2 sm:text-base">{{ redirectSourceName }}</dd>
          </div>
          <div class="booking-tone booking-tone--services rounded-xl px-3 py-2 sm:rounded-2xl sm:p-3" :class="isBarber && !redirectSourceName ? 'col-span-2' : ''">
            <dt class="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500"><span>Послуги</span>
            <BaseButton
              v-if="canEditBooking && !serviceEditing"
              type="button"
              class="booking-edit-icon"
              title="Редагувати послуги"
              aria-label="Редагувати послуги бронювання"
              :disabled="interactionBusy"
              @click="serviceEditing = true"
            >
              <PencilIcon class="h-4 w-4" aria-hidden="true" />
            </BaseButton>
            </dt>
            <dd class="mt-1 text-sm font-medium text-slate-900 sm:mt-2 sm:text-base">
              {{ bookingServicesLabel(booking, services || []) }}
              <span v-if="resolvedServicesPriceLabel" class="mt-0.5 block text-xs font-medium text-slate-500 sm:text-sm">
                Ціна: {{ resolvedServicesPriceLabel }}
              </span>
            </dd>
          </div>
          <div class="booking-tone booking-tone--price col-span-2 rounded-xl px-3 py-2 sm:rounded-2xl sm:p-3">
            <dt class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.18em]">
              <BanknotesIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span class="flex-1">Оплата</span>
              <BaseButton
                v-if="canEditBookingPricing && !pricingEditing"
                type="button"
                class="booking-edit-icon"
                :title="isAdmin ? 'Редагувати ціни та акцію' : 'Редагувати ціну'"
                :aria-label="isAdmin ? 'Редагувати ціни та акцію бронювання' : 'Редагувати ціну бронювання'"
                :disabled="interactionBusy"
                @click="pricingEditing = true"
              >
                <PencilIcon class="h-4 w-4" aria-hidden="true" />
              </BaseButton>
            </dt>
            <dd class="mt-1.5 grid grid-cols-3 gap-1.5 text-xs sm:text-sm">
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
            <form
              v-if="canEditBookingPricing && pricingEditing"
              class="mt-3 rounded-xl bg-white p-3 ring-1 ring-slate-200"
              @submit.prevent="submitPricing"
            >
              <div class="space-y-3">
                <BaseInput
                  v-for="item in pricingForm.service_prices"
                  :key="item.service_id"
                  v-model.number="item.price_amount"
                  :label="`Ціна · ${pricingServiceName(item.service_id)}, грн`"
                  required
                  type="number"
                  min="0"
                  step="1"
                  inputmode="numeric"
                  input-class="base-control px-3 py-2 text-sm"
                />
                <label v-if="isAdmin" class="block space-y-1 text-xs text-slate-700 sm:text-sm">
                  <span class="inline-flex items-center gap-1.5 font-medium">
                    <ReceiptPercentIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
                    Акція
                  </span>
                  <BaseSelect
                    :model-value="pricingForm.promotion_code"
                    :options="promotionOptions"
                    placeholder="Без акції"
                    menu-class="z-[260]"
                    aria-label="Акція бронювання"
                    @update:model-value="pricingForm.promotion_code = String($event || '')"
                  />
                </label>
                <p v-if="pricingError" class="text-xs font-medium text-rose-600">{{ pricingError }}</p>
                <p v-if="isAdmin" class="text-xs text-slate-500">Щоб прибрати застосовану знижку, виберіть «Без акції».</p>
              </div>
              <div class="booking-edit-actions mt-2 grid grid-cols-2 gap-2">
                <BaseButton type="submit" variant="success" size="sm" :disabled="interactionBusy">
                  <CheckCircleIcon v-if="!pendingPricing" class="h-4 w-4" aria-hidden="true" />
                  {{ pendingPricing ? 'Збереження...' : 'Зберегти' }}
                </BaseButton>
                <BaseButton type="button" variant="danger" size="sm" :disabled="interactionBusy" @click="cancelPricingEditing">
                  <XMarkIcon class="h-4 w-4" aria-hidden="true" />
                  Скасувати
                </BaseButton>
              </div>
            </form>
          </div>
          <form v-if="canEditBooking && serviceEditing" class="booking-tone booking-tone--services col-span-2 rounded-xl px-3 py-2 sm:rounded-2xl sm:p-3" @submit.prevent="submitServices">
            <ServiceMultiSelect v-model="serviceForm.service_ids" :services="editableServiceOptions" />
            <div class="booking-edit-actions mt-2 grid grid-cols-2 gap-2">
              <BaseButton type="submit" variant="success" size="sm" :disabled="interactionBusy">
                <CheckCircleIcon v-if="!pendingSchedule" class="h-4 w-4" aria-hidden="true" />
                {{ pendingSchedule ? 'Збереження...' : 'Зберегти' }}
              </BaseButton>
              <BaseButton type="button" variant="danger" size="sm" :disabled="interactionBusy" @click="cancelServiceEditing">
                <XMarkIcon class="h-4 w-4" aria-hidden="true" />
                Скасувати
              </BaseButton>
            </div>
          </form>
          <div class="booking-tone booking-tone--time col-span-2 rounded-xl px-3 py-2 sm:rounded-2xl sm:p-3">
            <dt class="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
              <ClockIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span class="flex-1">Час послуги</span>
              <BaseButton
                v-if="canEditBooking && !scheduleEditing"
                type="button"
                class="booking-edit-icon"
                title="Редагувати час"
                aria-label="Редагувати час бронювання"
                :disabled="interactionBusy"
                @click="scheduleEditing = true"
              ><PencilIcon class="h-4 w-4" aria-hidden="true" /></BaseButton>
            </dt>
            <dd class="mt-1 grid grid-cols-2 gap-3 text-sm font-medium text-slate-900">
              <div class="min-w-0">
                <span class="mb-1 flex items-center gap-1 text-[10px] font-normal text-slate-500"><PlayIcon class="h-3 w-3" aria-hidden="true" />Початок</span>
                {{ formatDateTime(bookingStart(booking)) }}
              </div>
              <div class="min-w-0">
                <span class="mb-1 flex items-center gap-1 text-[10px] font-normal text-slate-500"><StopIcon class="h-3 w-3" aria-hidden="true" />Завершення</span>
                {{ formatDateTime(bookingEnd(booking)) }}
              </div>
            </dd>
          </div>
          <form v-if="canEditBooking && scheduleEditing" class="booking-tone booking-tone--time col-span-2 rounded-xl px-3 py-2 sm:rounded-2xl sm:p-3" @submit.prevent="submitSchedule">
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:items-end">
              <label class="col-span-2 min-w-0 space-y-1 text-xs font-medium text-slate-600 sm:col-span-1">
                <span>Дата</span>
                <BaseCalendar v-model="scheduleForm.date" required class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label class="space-y-1 text-xs font-medium text-slate-600">
                <span>Початок</span>
                <BaseInput :model-value="scheduleForm.start_time" @update:model-value="setScheduleStart" required type="text" inputmode="text" placeholder="ГГ:ХХ" :maxlength="5" autocomplete="off" :aria-describedby="scheduleError || actionError ? scheduleErrorId : undefined" input-class="base-control min-w-0 w-full px-3 py-2 text-sm" />
              </label>
              <label class="min-w-0 space-y-1 text-xs font-medium text-slate-600">
                <span>Завершення</span>
                <BaseInput :model-value="scheduleForm.end_time" @update:model-value="setScheduleEnd" required type="text" inputmode="text" placeholder="ГГ:ХХ" :maxlength="5" autocomplete="off" :aria-describedby="scheduleError || actionError ? scheduleErrorId : undefined" input-class="base-control min-w-0 w-full px-3 py-2 text-sm" />
              </label>
              <label class="col-span-2 min-w-0 space-y-1 text-xs font-medium text-slate-600 sm:col-span-1">
                <span>Тривалість, хв</span>
                <BaseInput :model-value="scheduleForm.duration_minutes" @update:model-value="setScheduleDuration" required type="number" min="1" step="1" input-class="base-control min-w-0 w-full px-3 py-2 text-sm" />
              </label>
            </div>
            <p v-if="scheduleError || actionError" :id="scheduleErrorId" class="booking-schedule-error mt-2 text-xs" role="alert">{{ scheduleError || actionError }}</p>
            <div class="booking-edit-actions mt-2 grid grid-cols-2 gap-2">
              <BaseButton type="submit" variant="success" size="sm" :disabled="interactionBusy">
                <CheckCircleIcon v-if="!pendingSchedule" class="h-4 w-4" aria-hidden="true" />
                {{ pendingSchedule ? 'Збереження...' : 'Зберегти' }}
              </BaseButton>
              <BaseButton type="button" variant="danger" size="sm" :disabled="interactionBusy" @click="cancelScheduleEditing">
                <XMarkIcon class="h-4 w-4" aria-hidden="true" />
                Скасувати
              </BaseButton>
            </div>
          </form>
          <div class="rounded-xl bg-slate-50 px-3 py-2 sm:rounded-2xl sm:p-3">
            <dt class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.18em]">
              <CalendarDaysIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Створено
            </dt>
            <dd class="mt-1 text-sm font-medium text-slate-900 sm:mt-2 sm:text-base">{{ formatDateTime(booking.created_at) }}</dd>
          </div>
          <div class="rounded-xl bg-slate-50 px-3 py-2 sm:rounded-2xl sm:p-3">
            <dt class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.18em]">
              <CheckCircleIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Завершено
            </dt>
            <dd class="mt-1 text-sm font-medium text-slate-900 sm:mt-2 sm:text-base">{{ formatDateTime(booking.completed_at) }}</dd>
          </div>
        </dl>

        <details class="group rounded-xl bg-slate-50 px-3 py-2 sm:rounded-2xl sm:p-3">
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

        <div class="rounded-xl bg-slate-50 px-3 py-2 sm:rounded-2xl sm:p-3">
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
            :disabled="interactionBusy"
            @click="!interactionBusy && emit('updateStatus', status)"
          >
            <component :is="statusActionIcon(status)" class="h-4 w-4 shrink-0" aria-hidden="true" />
            {{ pendingStatus === status ? 'Оновлення...' : formatBookingStatus(status) }}
          </BaseButton>
          <BaseButton
            v-if="canDeleteBooking"
            type="button"
            class="backoffice-modal-action-button backoffice-modal-action-danger-outline backoffice-booking-status-action"
            :disabled="interactionBusy"
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
        message="Використовуйте видалення, якщо послугу не було надано або запис створено помилково. Запис буде збережено в архіві, зникне з календаря та не враховуватиметься у доходах і статистиці."
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

<style scoped>
.booking-edit-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--bo-success);
  border-radius: 10px;
  color: var(--bo-on-accent);
  background: var(--bo-success);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.12);
  transition: background-color 200ms ease;
}
.booking-edit-icon:focus-visible { outline: 2px solid var(--bo-success); outline-offset: 2px; }
.booking-edit-icon:disabled { opacity: 0.45; }
@media (hover: hover) and (pointer: fine) {
  .booking-edit-icon:hover:not(:disabled) { background: var(--bo-accent-hover); }
}
.booking-details-content dl > div { min-width: 0; }
.booking-details-content .booking-tone--price {
  background: color-mix(in srgb, var(--bo-accent) 8%, var(--bo-surface-elevated));
}
.booking-details-content .booking-tone--time {
  background: color-mix(in srgb, #8eb8bd 8%, var(--bo-surface-elevated));
}
.booking-details-content .booking-tone--services {
  background: color-mix(in srgb, #d3bb91 8%, var(--bo-surface-elevated));
}
.booking-details-content .booking-tone {
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.07);
}
.booking-schedule-error { color: var(--bo-danger-text); }
.booking-edit-actions > button { min-width: 0; width: 100%; }
@media (prefers-reduced-motion: reduce) {
  .booking-edit-icon { transition: none; }
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .booking-details-content .booking-tone { background: var(--bo-control); box-shadow: none; }
}
@media (forced-colors: active) {
  .booking-edit-icon { color: ButtonText; background: ButtonFace; border-color: ButtonText; }
}
.booking-details-content .booking-money-card { min-width: 0; padding: 6px; overflow-wrap: anywhere; }
@media (max-width: 639px) {
  .booking-details-content dl { gap: 6px; }
  .booking-details-content dl > div { padding: 8px; }
  .booking-details-content dt { font-size: 10px; letter-spacing: 0.03em; }
  .booking-details-content dd { margin-top: 4px; font-size: 12px; }
  .booking-details-content .booking-money-card > span:first-child { font-size: 10px; }
}
</style>
