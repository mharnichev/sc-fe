<script setup lang="ts">
import { CalendarDaysIcon, ChatBubbleLeftEllipsisIcon, CheckCircleIcon, ChevronDownIcon, ClipboardDocumentIcon, ClockIcon, PencilIcon, PhoneIcon, PlayIcon, StopIcon, UserIcon, XCircleIcon } from '@heroicons/vue/24/outline'
import type { Booking, BookingSchedulePayload, BookingStatus } from '~/composables/useBackofficeApi'
import type { Master, Service } from '~/composables/useBackofficeApi'

const props = defineProps<{
  booking: Booking | null
  allowedStatuses?: BookingStatus[]
  pendingStatus?: BookingStatus | ''
  pendingSchedule?: boolean
  error?: string
  masters?: Master[]
  services?: Service[]
}>()

const emit = defineEmits<{
  close: []
  updateStatus: [status: BookingStatus]
  updateSchedule: [payload: BookingSchedulePayload]
}>()

const {
  bookingStart,
  bookingEnd,
  bookingComment,
  bookingPhone,
  customerName,
  masterName,
  serviceName,
  formatDateTime,
  formatBookingStatus,
  toKyivIso,
} = useBookingFormatting()

const allowed = computed(() => props.allowedStatuses || [])
const scheduleForm = reactive({
  date: '',
  start_time: '',
  duration_minutes: 30,
})
const scheduleError = ref('')
const scheduleEditing = ref(false)
const phoneCopied = ref(false)
let phoneCopiedTimeout: ReturnType<typeof setTimeout> | null = null
const masterOptions = computed(() => props.masters || [])
const { isBarber } = useBackofficeAccess(masterOptions)

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
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return resolvedService.value?.duration_minutes || 30

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

const resolvedMaster = computed(() =>
  props.booking?.master || props.booking?.barber || props.masters?.find(master => master.id === props.booking?.master_id) || null,
)

const resolvedService = computed(() =>
  props.booking?.service || props.services?.find(service => service.id === props.booking?.service_id) || null,
)

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
    return
  }
  if (!Number.isFinite(scheduleForm.duration_minutes) || scheduleForm.duration_minutes < 1) {
    scheduleError.value = 'Тривалість має бути більше 0 хвилин.'
    return
  }

  const startAt = toKyivIso(scheduleForm.date, scheduleForm.start_time)
  const endAt = new Date(new Date(startAt).getTime() + scheduleForm.duration_minutes * 60000).toISOString()
  emit('updateSchedule', { start_at: startAt, end_at: endAt })
}

const cancelScheduleEditing = () => {
  resetScheduleForm()
  scheduleEditing.value = false
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

watch(
  () => [props.booking?.id, props.booking ? bookingStart(props.booking) : '', props.booking ? bookingEnd(props.booking) : ''],
  resetScheduleForm,
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
          <button class="shrink-0 rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 sm:px-4 sm:py-2" @click="closeModal">
            Закрити
          </button>
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
          <div class="rounded-xl bg-slate-50 px-3 py-2 sm:rounded-2xl sm:p-4" :class="isBarber ? 'col-span-2' : ''">
            <dt class="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.18em]">Послуга</dt>
            <dd class="mt-1 text-sm font-medium text-slate-900 sm:mt-2 sm:text-base">{{ serviceName(resolvedService) }}</dd>
          </div>
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
          <div v-if="!scheduleEditing" class="col-span-2">
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
          <form v-else class="col-span-2 rounded-xl bg-slate-50 px-3 py-2 sm:rounded-2xl sm:p-4" @submit.prevent="submitSchedule">
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-medium text-slate-900">Час запису</p>
              <p class="text-xs text-slate-500">{{ formatDateTime(bookingStart(booking)) }} - {{ formatDateTime(bookingEnd(booking)) }}</p>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_9rem_auto] sm:items-end">
              <label class="space-y-1 text-xs font-medium text-slate-600">
                <span>Дата</span>
                <input v-model="scheduleForm.date" required type="date" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
              </label>
              <label class="space-y-1 text-xs font-medium text-slate-600">
                <span>Початок</span>
                <input v-model="scheduleForm.start_time" required type="time" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
              </label>
              <label class="col-span-2 space-y-1 text-xs font-medium text-slate-600 sm:col-span-1">
                <span>Тривалість, хв</span>
                <input v-model.number="scheduleForm.duration_minutes" required type="number" min="1" step="1" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
              </label>
              <button type="submit" :disabled="pendingSchedule" class="col-span-2 inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 sm:col-span-1">
                {{ pendingSchedule ? 'Збереження...' : 'Зберегти' }}
              </button>
            </div>
            <button type="button" class="mt-2 text-sm font-medium text-slate-500 hover:text-slate-800" @click="cancelScheduleEditing">
              Скасувати редагування
            </button>
            <p v-if="scheduleError" class="mt-2 text-sm text-rose-600">{{ scheduleError }}</p>
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

        <p v-if="error" class="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600 sm:rounded-2xl sm:px-4 sm:py-3">
          {{ error }}
        </p>

        <div v-if="allowed.length" class="grid gap-2 border-t border-slate-200 pt-3 sm:gap-3 sm:pt-5">
          <button
            v-for="status in allowed"
            :key="status"
            class="inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium disabled:opacity-60 sm:gap-2 sm:px-4 sm:py-2"
            :class="statusActionClass(status)"
            :disabled="pendingStatus === status"
            @click="emit('updateStatus', status)"
          >
            <component :is="statusActionIcon(status)" class="h-4 w-4 shrink-0" aria-hidden="true" />
            {{ pendingStatus === status ? 'Оновлення...' : `Позначити як "${formatBookingStatus(status)}"` }}
          </button>
        </div>
      </div>
    </template>
  </BaseModal>
</template>
