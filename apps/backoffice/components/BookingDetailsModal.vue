<script setup lang="ts">
import { CalendarDaysIcon, ChatBubbleLeftEllipsisIcon, CheckCircleIcon, ChevronDownIcon, ClipboardDocumentIcon, ClockIcon, PencilIcon, PhoneIcon, PlayIcon, StopIcon, TrashIcon, UserIcon, XCircleIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import type { Booking, BookingSchedulePayload, BookingStatus } from '~/composables/useBackofficeApi'
import type { Master, Service } from '~/composables/useBackofficeApi'

const props = defineProps<{
  booking: Booking | null
  allowedStatuses?: BookingStatus[]
  pendingStatus?: BookingStatus | ''
  pendingSchedule?: boolean
  pendingDelete?: boolean
  canEdit?: boolean
  canDelete?: boolean
  masters?: Master[]
  services?: Service[]
}>()

const emit = defineEmits<{
  close: []
  updateStatus: [status: BookingStatus]
  updateSchedule: [payload: BookingSchedulePayload]
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
  formatDateTime,
  formatBookingStatus,
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
const scheduleError = ref('')
const serviceError = ref('')
const scheduleEditing = ref(false)
const serviceEditing = ref(false)
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

const resolvedMaster = computed(() =>
  props.booking?.master || props.booking?.barber || props.masters?.find(master => master.id === props.booking?.master_id) || null,
)
const redirectSourceName = computed(() =>
  props.booking ? redirectedFromMasterName(props.booking) : '',
)

const resolvedServices = computed(() =>
  props.booking ? bookingServices(props.booking, props.services || []) : [],
)

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
const canDeleteBooking = computed(() => Boolean(props.booking && props.booking.status !== 'completed' && props.canDelete !== false))
const orderedAllowedStatuses = computed(() => {
  const order: BookingStatus[] = ['completed', 'cancelled', 'confirmed']
  return [...allowed.value].sort((first, second) => order.indexOf(first) - order.indexOf(second))
})

const statusActionClass = (status: BookingStatus) => {
  if (status === 'cancelled') return 'border border-rose-300 text-rose-700'
  if (status === 'completed') return 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'

  return 'bg-slate-950 text-white'
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

const cancelScheduleEditing = () => {
  resetScheduleForm()
  scheduleEditing.value = false
}

const cancelServiceEditing = () => {
  resetServiceForm()
  serviceEditing.value = false
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
              <button
                v-if="bookingPhone(booking)"
                type="button"
                class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition hover:bg-white"
                :aria-label="phoneCopied ? 'Телефон скопійовано' : 'Скопіювати телефон'"
                :title="phoneCopied ? 'Скопійовано' : 'Скопіювати'"
                @click="copyPhone"
              >
                <ClipboardDocumentIcon class="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </dd>
          </div>
          <div v-if="!isBarber" class="rounded-xl bg-slate-50 px-3 py-2 sm:rounded-2xl sm:p-4">
            <dt class="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.18em]">Майстер</dt>
            <dd class="mt-1 text-sm font-medium text-slate-900 sm:mt-2 sm:text-base">{{ masterName(resolvedMaster) }}</dd>
          </div>
          <div v-if="redirectSourceName" class="rounded-xl bg-cyan-50 px-3 py-2 ring-1 ring-cyan-100 sm:rounded-2xl sm:p-4">
            <dt class="text-[11px] font-medium uppercase tracking-[0.12em] text-cyan-700 sm:text-xs sm:tracking-[0.18em]">Перенаправлено від</dt>
            <dd class="mt-1 text-sm font-medium text-slate-900 sm:mt-2 sm:text-base">{{ redirectSourceName }}</dd>
          </div>
          <div class="rounded-xl bg-slate-50 px-3 py-2 sm:rounded-2xl sm:p-4" :class="isBarber && !redirectSourceName ? 'col-span-2' : ''">
            <dt class="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.18em]">Послуги</dt>
            <dd class="mt-1 text-sm font-medium text-slate-900 sm:mt-2 sm:text-base">{{ bookingServicesLabel(booking, services || []) }}</dd>
          </div>
          <div v-if="canEditBooking && !serviceEditing" class="col-span-2">
            <button
              type="button"
              class="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
              aria-label="Редагувати послуги бронювання"
              @click="serviceEditing = true"
            >
              <PencilIcon class="h-4 w-4" aria-hidden="true" />
              Редагувати послуги
            </button>
          </div>
          <form v-else-if="canEditBooking" class="col-span-2 rounded-xl bg-slate-50 px-3 py-2 sm:rounded-2xl sm:p-4" @submit.prevent="submitServices">
            <ServiceMultiSelect v-model="serviceForm.service_ids" :services="editableServiceOptions" />
            <div class="backoffice-modal-actions mt-3">
              <button type="submit" :disabled="pendingSchedule" class="backoffice-modal-action-button backoffice-modal-action-primary">
                <CheckCircleIcon v-if="!pendingSchedule" class="h-4 w-4" aria-hidden="true" />
                {{ pendingSchedule ? 'Збереження...' : 'Зберегти' }}
              </button>
              <button type="button" class="backoffice-modal-action-button backoffice-modal-action-neutral" @click="cancelServiceEditing">
                <XMarkIcon class="h-4 w-4" aria-hidden="true" />
                Скасувати
              </button>
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
            <button
              type="button"
              class="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
              aria-label="Редагувати час бронювання"
              @click="scheduleEditing = !scheduleEditing"
            >
              <PencilIcon class="h-4 w-4" aria-hidden="true" />
              Редагувати час
            </button>
          </div>
          <form v-else-if="canEditBooking" class="col-span-2 rounded-xl bg-slate-50 px-3 py-2 sm:rounded-2xl sm:p-4" @submit.prevent="submitSchedule">
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem] sm:items-end">
              <label class="space-y-1 text-xs font-medium text-slate-600">
                <span>Дата</span>
                <input v-model="scheduleForm.date" required type="date" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
              </label>
              <label class="space-y-1 text-xs font-medium text-slate-600">
                <span>Початок</span>
                <input v-model="scheduleForm.start_time" required type="time" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
              </label>
              <label class="space-y-1 text-xs font-medium text-slate-600">
                <span>Тривалість, хв</span>
                <input v-model.number="scheduleForm.duration_minutes" required type="number" min="1" step="1" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
              </label>
            </div>
            <div class="backoffice-modal-actions mt-3">
              <button type="submit" :disabled="pendingSchedule" class="backoffice-modal-action-button backoffice-modal-action-primary">
                <CheckCircleIcon v-if="!pendingSchedule" class="h-4 w-4" aria-hidden="true" />
                {{ pendingSchedule ? 'Збереження...' : 'Зберегти' }}
              </button>
              <button type="button" class="backoffice-modal-action-button backoffice-modal-action-neutral" @click="cancelScheduleEditing">
                <XMarkIcon class="h-4 w-4" aria-hidden="true" />
                Скасувати
              </button>
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
          <button
            v-for="status in orderedAllowedStatuses"
            :key="status"
            class="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium disabled:opacity-60 sm:gap-2"
            :class="[statusActionClass(status), status === 'completed' ? 'col-span-2' : '']"
            :disabled="pendingStatus === status"
            @click="emit('updateStatus', status)"
          >
            <component :is="statusActionIcon(status)" class="h-4 w-4 shrink-0" aria-hidden="true" />
            {{ pendingStatus === status ? 'Оновлення...' : formatBookingStatus(status) }}
          </button>
          <button
            v-if="canDeleteBooking"
            type="button"
            class="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-60 sm:gap-2"
            :disabled="pendingDelete"
            @click="deleteConfirmOpen = true"
          >
            <TrashIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
            {{ pendingDelete ? 'Видалення...' : 'Видалити' }}
          </button>
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
