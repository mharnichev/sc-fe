<script setup lang="ts">
import {
  ArrowPathIcon,
  ArrowRightIcon,
} from '@heroicons/vue/24/outline'
import type { Booking, Master, MasterAvailabilityWindow, MasterService, TimeBlock } from '~/composables/useBackofficeApi'

type AvailabilityTone = 'available' | 'partial' | 'blocked' | 'closed'

definePageMeta({
  middleware: () => {
    const auth = useAuthStore()
    if (auth.user?.is_superuser || auth.user?.role === 'admin') {
      return navigateTo('/')
    }
  },
})

const auth = useAuthStore()
const api = useBackofficeApi()
const {
  statuses,
  timeZone,
  todayInput,
  addDaysInput,
  toKyivIso,
  bookingStart,
  bookingEnd,
  bookingComment,
  bookingPhone,
  customerName,
  masterName,
  bookingServices,
  bookingServicesLabel,
  formatDateTime,
  formatTime,
  formatBookingStatus,
  formatDuration,
  formatPrice,
  normalizeItems,
  apiErrorMessage,
} = useBookingFormatting()

const today = todayInput()
const rangeEnd = addDaysInput(today, 14)
const workdayStart = '09:00'
const workdayEnd = '20:00'
const workdayMinutes = 11 * 60
const availabilityDays = 30

const { data: publicMasters } = await useAsyncData('barber-dashboard-master-options', () => api.getPublicMasters())
const masterList = computed<Master[]>(() => publicMasters.value || [])
const { isBarber, linkedMaster, roleLabel } = useBackofficeAccess(masterList)
const barberId = computed(() => linkedMaster.value?.id || auth.user?.master_id || null)

const { data, pending, error, refresh } = await useAsyncData(
  'barber-dashboard',
  async () => {
    const [bookings, timeBlocks, services, availability] = await Promise.all([
      api.getMyBookings({ date_from: today, date_to: rangeEnd }),
      api.getMyTimeBlocks(),
      barberId.value ? api.getMasterServices(barberId.value) : Promise.resolve([] as MasterService[]),
      api.getMyAvailability({
        date_from: toKyivIso(today, workdayStart),
        date_to: toKyivIso(addDaysInput(today, availabilityDays - 1), workdayEnd),
      }),
    ])

    return { bookings, timeBlocks, services, availability }
  },
  { watch: [barberId] },
)
const { data: reviewStats, pending: reviewPending, error: reviewError, refresh: refreshReviewStats } = await useAsyncData(
  'barber-dashboard-review-statistics',
  () => api.getMyRatingStatistics(),
)
const refreshAll = () => Promise.all([refresh(), refreshReviewStats()])

const bookings = computed<Booking[]>(() => normalizeItems(data.value?.bookings))
const timeBlocks = computed<TimeBlock[]>(() => normalizeItems(data.value?.timeBlocks))
const services = computed<MasterService[]>(() => normalizeItems(data.value?.services))
const availabilityWindows = computed<MasterAvailabilityWindow[]>(() => data.value?.availability || [])

const dateInputFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const shortDateFormatter = new Intl.DateTimeFormat('uk-UA', {
  timeZone,
  weekday: 'short',
  day: '2-digit',
  month: 'short',
})

const dateInputFromDateTime = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = Object.fromEntries(dateInputFormatter.formatToParts(date).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

const formatInputDate = (dateInput: string) => shortDateFormatter.format(new Date(toKyivIso(dateInput, '12:00')))

const minutesBetween = (start?: string | null, end?: string | null) => {
  if (!start || !end) return 0
  const startTime = new Date(start).getTime()
  const endTime = new Date(end).getTime()
  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime <= startTime) return 0
  return Math.round((endTime - startTime) / 60000)
}

const sortBookings = (items: Booking[]) =>
  [...items].sort((first, second) => new Date(bookingStart(first)).getTime() - new Date(bookingStart(second)).getTime())

const resolveServices = (booking: Booking) =>
  bookingServices(booking, services.value)

const bookingDurationMinutes = (booking: Booking) => {
  const duration = minutesBetween(bookingStart(booking), bookingEnd(booking))
  if (duration) return duration
  return resolveServices(booking).reduce((total, service) => total + Number(service.duration_minutes || 0), 0)
}

const bookingPrice = (booking: Booking) =>
  resolveServices(booking).reduce((total, service) => total + Number(service.price || 0), 0)

const activeBookings = computed(() => bookings.value.filter(booking => booking.status !== 'cancelled'))
const todayBookings = computed(() =>
  sortBookings(activeBookings.value.filter(booking => dateInputFromDateTime(bookingStart(booking)) === today)),
)
const nextTodayBooking = computed(() =>
  todayBookings.value.find(booking => new Date(bookingStart(booking)).getTime() >= Date.now()) || null,
)
const activeServices = computed(() => services.value.filter(service => service.is_active))
const upcomingTimeBlocks = computed(() =>
  [...timeBlocks.value]
    .filter(block => dateInputFromDateTime(block.end_at) >= today)
    .sort((first, second) => new Date(first.start_at).getTime() - new Date(second.start_at).getTime()),
)

const todayRevenue = computed(() =>
  todayBookings.value.reduce((total, booking) => total + bookingPrice(booking), 0),
)
const rangeRevenue = computed(() =>
  activeBookings.value.reduce((total, booking) => total + bookingPrice(booking), 0),
)
const todayBookedMinutes = computed(() =>
  todayBookings.value.reduce((total, booking) => total + bookingDurationMinutes(booking), 0),
)

const averageServicePrice = computed(() => {
  if (!activeServices.value.length) return 0
  return activeServices.value.reduce((total, service) => total + Number(service.price || 0), 0) / activeServices.value.length
})

const averageServiceDuration = computed(() => {
  if (!activeServices.value.length) return 0
  return Math.round(activeServices.value.reduce((total, service) => total + Number(service.duration_minutes || 0), 0) / activeServices.value.length)
})

const daySummaries = computed(() =>
  Array.from({ length: 7 }, (_, index) => {
    const date = addDaysInput(today, index)
    const dayOff = isMonday(date)
    const dayBookings = activeBookings.value.filter(booking => dateInputFromDateTime(bookingStart(booking)) === date)
    const dayBlocks = upcomingTimeBlocks.value.filter(block => dateInputFromDateTime(block.start_at) === date)
    const bookedMinutes = dayBookings.reduce((total, booking) => total + bookingDurationMinutes(booking), 0)
    const busyPercent = dayOff ? 100 : Math.min(100, Math.round((bookedMinutes / workdayMinutes) * 100))

    return {
      date,
      label: formatInputDate(date),
      dayOff,
      bookings: dayBookings.length,
      blocks: dayBlocks.length,
      bookedMinutes,
      busyPercent,
    }
  }),
)

const statusSummaries = computed(() =>
  statuses
    .map(status => ({
      status,
      label: formatBookingStatus(status),
      count: bookings.value.filter(booking => booking.status === status).length,
    })),
)

const isMonday = (dateInput: string) => new Date(toKyivIso(dateInput, '12:00')).getUTCDay() === 1

const timeBlockOverlapMinutes = (block: TimeBlock, dateInput: string) => {
  const workStart = new Date(toKyivIso(dateInput, workdayStart)).getTime()
  const workEnd = new Date(toKyivIso(dateInput, workdayEnd)).getTime()
  const blockStart = new Date(block.start_at).getTime()
  const blockEnd = new Date(block.end_at).getTime()

  if ([workStart, workEnd, blockStart, blockEnd].some(Number.isNaN)) return 0

  const overlapStart = Math.max(workStart, blockStart)
  const overlapEnd = Math.min(workEnd, blockEnd)
  if (overlapEnd <= overlapStart) return 0

  return Math.round((overlapEnd - overlapStart) / 60000)
}

const availabilityOverlapMinutes = (window: MasterAvailabilityWindow, dateInput: string) => {
  const workStart = new Date(toKyivIso(dateInput, workdayStart)).getTime()
  const workEnd = new Date(toKyivIso(dateInput, workdayEnd)).getTime()
  const windowStart = new Date(window.start_at).getTime()
  const windowEnd = new Date(window.end_at).getTime()

  if ([workStart, workEnd, windowStart, windowEnd].some(Number.isNaN)) return 0

  const overlapStart = Math.max(workStart, windowStart)
  const overlapEnd = Math.min(workEnd, windowEnd)
  if (overlapEnd <= overlapStart) return 0

  return Math.round((overlapEnd - overlapStart) / 60000)
}

const availabilityStatusClass = (tone: AvailabilityTone) => ({
  available: 'bg-emerald-50 text-emerald-700',
  partial: 'bg-amber-50 text-amber-700',
  blocked: 'bg-rose-50 text-rose-700',
  closed: 'bg-slate-100 text-slate-600',
}[tone])

const availabilityRows = computed(() =>
  Array.from({ length: availabilityDays }, (_, index) => {
    const date = addDaysInput(today, index)
    const dayOff = isMonday(date)
    const blocks = upcomingTimeBlocks.value
      .map(block => ({
        block,
        minutes: timeBlockOverlapMinutes(block, date),
      }))
      .filter(segment => segment.minutes > 0)
    const openSegments = availabilityWindows.value
      .map(window => ({
        window,
        minutes: availabilityOverlapMinutes(window, date),
      }))
      .filter(segment => segment.minutes > 0)

    const manualBlockedMinutes = Math.min(
      workdayMinutes,
      blocks.reduce((total, segment) => total + segment.minutes, 0),
    )
    const openMinutes = dayOff ? 0 : Math.min(
      workdayMinutes,
      openSegments.reduce((total, segment) => total + segment.minutes, 0),
    )
    const availableMinutes = dayOff ? 0 : Math.max(0, openMinutes - manualBlockedMinutes)
    const busyPercent = Math.min(100, Math.round((openMinutes / workdayMinutes) * 100))
    const tone: AvailabilityTone = dayOff || openMinutes <= 0
      ? 'closed'
      : manualBlockedMinutes >= openMinutes
        ? 'blocked'
        : openMinutes < workdayMinutes || manualBlockedMinutes > 0
          ? 'partial'
          : 'available'
    const status = dayOff
      ? 'Вихідний'
      : openMinutes <= 0
        ? 'Не відкрито'
        : manualBlockedMinutes >= openMinutes
          ? 'Повністю заблоковано'
          : openMinutes < workdayMinutes || manualBlockedMinutes > 0
            ? 'Частково відкрито'
            : 'Відкрито'

    return {
      date,
      label: formatInputDate(date),
      dayOff,
      blocks,
      blockedMinutes: manualBlockedMinutes,
      openSegments,
      openMinutes,
      availableMinutes,
      busyPercent,
      status,
      tone,
    }
  }),
)

</script>

<template>
  <div class="space-y-3 xl:space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-xs uppercase tracking-[0.22em] text-cyan-700 xl:text-sm xl:tracking-[0.3em]">Огляд майстра</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900 xl:text-3xl">Дашборд</h1>
        <p class="mt-1 text-xs text-slate-500 xl:text-sm">
          {{ roleLabel }}<span v-if="linkedMaster"> · {{ masterName(linkedMaster) }}</span>
        </p>
      </div>
      <BaseButton
        type="button"
        :disabled="pending"
        class="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 xl:min-h-10 xl:gap-2 xl:px-4 xl:py-2.5 xl:text-sm"
        @click="refreshAll"
      >
        <ArrowPathIcon class="h-4 w-4" aria-hidden="true" />
        {{ pending ? 'Оновлення...' : 'Оновити' }}
      </BaseButton>
    </div>

    <p v-if="!isBarber || !barberId" class="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700 xl:rounded-2xl xl:px-4 xl:py-3 xl:text-sm">
      Для повного огляду потрібен акаунт із роллю майстра або прив’язкою до профілю майстра.
    </p>

    <p v-if="error" class="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600 xl:rounded-2xl xl:px-4 xl:py-3 xl:text-sm">
      {{ apiErrorMessage(error, 'Не вдалося завантажити dashboard майстра.') }}
    </p>

    <ReviewsRatingSummary :stats="reviewStats" :loading="reviewPending" :error="reviewError" />

    <section class="rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm xl:rounded-[1.75rem] xl:p-4">
      <div class="flex flex-wrap items-center justify-between gap-2 xl:gap-3">
        <div>
          <h2 class="text-base font-semibold text-slate-900 xl:text-lg">Статуси бронювань</h2>
          <p class="mt-0.5 text-xs text-slate-500 xl:mt-1 xl:text-sm">Діапазон: {{ formatInputDate(today) }} - {{ formatInputDate(rangeEnd) }}</p>
        </div>
        <NuxtLink to="/my-bookings" class="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 xl:gap-2 xl:px-4 xl:py-2 xl:text-sm">
          Мої бронювання
          <ArrowRightIcon class="h-4 w-4" aria-hidden="true" />
        </NuxtLink>
      </div>
      <div class="mt-2 grid grid-cols-3 gap-2 xl:mt-3 xl:gap-3">
        <div v-for="summary in statusSummaries" :key="summary.status" class="rounded-xl bg-slate-50 px-2 py-2 xl:rounded-2xl xl:px-4 xl:py-2.5">
          <p class="truncate text-xs text-slate-500 xl:text-sm">{{ summary.label }}</p>
          <p class="mt-0.5 text-xl font-semibold text-slate-900 xl:mt-1 xl:text-2xl">{{ summary.count }}</p>
        </div>
      </div>
    </section>

    <div class="grid gap-2 md:grid-cols-2 xl:gap-4">
      <article class="rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm xl:rounded-[1.75rem] xl:p-4">
        <p class="text-xs text-slate-500 xl:text-sm">Сьогодні</p>
        <p class="mt-1 text-2xl font-semibold text-slate-900 xl:mt-2 xl:text-3xl">{{ todayBookings.length }}</p>
        <p class="mt-1 text-xs text-slate-500 xl:mt-2 xl:text-sm">{{ formatDuration(todayBookedMinutes) }} · {{ formatPrice(todayRevenue) }}</p>
      </article>
      <article class="rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm xl:rounded-[1.75rem] xl:p-4">
        <p class="text-xs text-slate-500 xl:text-sm">Наступний запис</p>
        <p class="mt-1 text-xl font-semibold text-slate-900 xl:mt-2 xl:text-2xl">
          {{ nextTodayBooking ? formatTime(bookingStart(nextTodayBooking)) : 'Немає' }}
        </p>
        <p class="mt-1 truncate text-xs text-slate-500 xl:mt-2 xl:text-sm">
          {{ nextTodayBooking ? `${formatDateTime(bookingStart(nextTodayBooking))} · ${bookingServicesLabel(nextTodayBooking, services)}` : 'На сьогодні наступних записів немає' }}
        </p>
      </article>
    </div>

    <div class="grid gap-3 xl:gap-4">
      <section class="rounded-[1.25rem] border border-slate-200 bg-white shadow-sm xl:rounded-[1.75rem]">
        <div class="border-b border-slate-200 px-3 py-2 xl:px-4 xl:py-3">
          <h2 class="text-base font-semibold text-slate-900 xl:text-lg">Сьогоднішній розклад</h2>
          <p class="mt-0.5 text-xs text-slate-500 xl:mt-1 xl:text-sm">{{ formatInputDate(today) }}</p>
        </div>
        <div v-if="pending" class="p-3 text-xs text-slate-500 xl:p-4 xl:text-sm">Завантаження даних...</div>
        <div v-else-if="!todayBookings.length" class="p-3 text-xs text-slate-500 xl:p-4 xl:text-sm">На сьогодні записів немає.</div>
        <div v-else class="divide-y divide-slate-100">
          <article v-for="booking in todayBookings.slice(0, 6)" :key="booking.id" class="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 px-3 py-2 md:grid-cols-[120px_1fr_auto] md:items-center xl:gap-3 xl:px-4 xl:py-3">
            <div>
              <p class="text-sm font-semibold text-slate-900 xl:text-base">{{ formatTime(bookingStart(booking)) }}</p>
              <p class="text-xs text-slate-500">{{ formatTime(bookingEnd(booking)) }}</p>
            </div>
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-slate-900 xl:text-base">{{ customerName(booking) }} · {{ bookingPhone(booking) || 'Без телефону' }}</p>
              <p class="mt-0.5 truncate text-xs text-slate-500 xl:mt-1 xl:text-sm">
                {{ bookingServicesLabel(booking, services) }} · {{ bookingComment(booking) || 'Без коментаря' }}
              </p>
            </div>
            <div class="col-span-2 md:col-span-1">
              <BookingStatusBadge :status="booking.status" />
            </div>
          </article>
        </div>
      </section>
    </div>

    <div class="grid gap-3 xl:grid-cols-2 xl:gap-4">
      <section class="rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm xl:rounded-[1.75rem] xl:p-4">
        <div class="flex flex-wrap items-center justify-between gap-2 xl:gap-3">
          <div>
            <h2 class="text-base font-semibold text-slate-900 xl:text-lg">Найближчі 7 днів</h2>
            <p class="mt-0.5 text-xs text-slate-500 xl:mt-1 xl:text-sm">Заповнення відносно робочого дня 09:00-20:00.</p>
          </div>
          <p class="rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-medium text-cyan-700 xl:px-3 xl:py-1 xl:text-sm">
            {{ formatPrice(rangeRevenue) }}
          </p>
        </div>
        <div class="mt-2 space-y-2 xl:mt-3 xl:space-y-3">
          <div v-for="day in daySummaries" :key="day.date" class="space-y-1.5 xl:space-y-2">
            <div class="flex items-center justify-between gap-3 text-xs xl:gap-4 xl:text-sm">
              <span class="font-medium text-slate-900">{{ day.label }}</span>
              <span class="truncate text-right text-slate-500">
                {{ day.dayOff ? 'Вихідний' : `${day.bookings} записів · ${formatDuration(day.bookedMinutes)}` }}
              </span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                class="h-full rounded-full"
                :class="day.dayOff ? 'bg-slate-300' : 'bg-cyan-500'"
                :style="{ width: `${day.busyPercent}%` }"
              />
            </div>
            <p v-if="day.dayOff" class="text-xs text-slate-500">Понеділок — вихідний день за замовчуванням.</p>
            <p v-else-if="day.blocks" class="text-xs text-slate-500">Блокування часу: {{ day.blocks }}</p>
          </div>
        </div>
      </section>

      <section class="rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm xl:rounded-[1.75rem] xl:p-4">
        <div class="flex flex-wrap items-center justify-between gap-2 xl:gap-3">
          <div>
            <h2 class="text-base font-semibold text-slate-900 xl:text-lg">Послуги</h2>
            <p class="mt-0.5 text-xs text-slate-500 xl:mt-1 xl:text-sm">Активні послуги персонального профілю майстра.</p>
          </div>
          <NuxtLink to="/my-services" class="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 xl:gap-2 xl:px-4 xl:py-2 xl:text-sm">
            Послуги
            <ArrowRightIcon class="h-4 w-4" aria-hidden="true" />
          </NuxtLink>
        </div>

        <dl class="mt-2 grid grid-cols-3 gap-2 xl:mt-3 xl:gap-3">
          <div class="rounded-xl bg-slate-50 px-2 py-2 xl:rounded-2xl xl:px-4 xl:py-2.5">
            <dt class="truncate text-xs text-slate-500 xl:text-sm">Активні</dt>
            <dd class="mt-0.5 text-xl font-semibold text-slate-900 xl:mt-1 xl:text-2xl">{{ activeServices.length }}</dd>
          </div>
          <div class="rounded-xl bg-slate-50 px-2 py-2 xl:rounded-2xl xl:px-4 xl:py-2.5">
            <dt class="truncate text-xs text-slate-500 xl:text-sm">Тривалість</dt>
            <dd class="mt-0.5 truncate text-xl font-semibold text-slate-900 xl:mt-1 xl:text-2xl">{{ formatDuration(averageServiceDuration) }}</dd>
          </div>
          <div class="rounded-xl bg-slate-50 px-2 py-2 xl:rounded-2xl xl:px-4 xl:py-2.5">
            <dt class="truncate text-xs text-slate-500 xl:text-sm">Ціна</dt>
            <dd class="mt-0.5 truncate text-xl font-semibold text-slate-900 xl:mt-1 xl:text-2xl">{{ formatPrice(averageServicePrice) }}</dd>
          </div>
        </dl>

        <div class="mt-2 max-h-[16rem] divide-y divide-slate-100 overflow-y-auto pr-1 xl:mt-3 xl:max-h-[18rem] xl:pr-2">
          <article v-for="service in activeServices" :key="service.id" class="py-2 xl:py-2.5">
            <div class="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start xl:gap-2">
              <div class="min-w-0">
                <p class="text-sm font-medium text-slate-900">{{ service.name }}</p>
                <p v-if="service.description" class="mt-0.5 line-clamp-1 text-xs text-slate-500">{{ service.description }}</p>
              </div>
              <div class="min-w-0">
                <p class="text-sm font-medium text-slate-700">{{ service.title_en || 'Без англійської назви' }}</p>
                <p v-if="service.description_en" class="mt-0.5 line-clamp-1 text-xs text-slate-500">{{ service.description_en }}</p>
                <p v-else class="mt-0.5 text-xs text-slate-400">Без опису англійською</p>
              </div>
              <div class="shrink-0 text-xs text-slate-500 sm:text-right">
                <p class="font-medium text-slate-900">{{ formatPrice(service.price) }}</p>
                <p class="mt-0.5">{{ formatDuration(service.duration_minutes) }}</p>
              </div>
            </div>
          </article>
          <p v-if="!activeServices.length" class="py-2 text-xs text-slate-500 xl:py-3 xl:text-sm">Активних послуг немає.</p>
        </div>
      </section>
    </div>

    <section class="rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm xl:rounded-[1.75rem] xl:p-4">
      <div class="flex flex-wrap items-center justify-between gap-2 xl:gap-3">
        <div>
          <h2 class="text-base font-semibold text-slate-900 xl:text-lg">Доступність</h2>
          <p class="mt-0.5 text-xs text-slate-500 xl:mt-1 xl:text-sm">
            Місяць вперед за відкритими інтервалами {{ workdayStart }}-{{ workdayEnd }}. Понеділок — вихідний за замовчуванням.
          </p>
        </div>
        <NuxtLink to="/my-time-blocks" class="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 xl:gap-2 xl:px-4 xl:py-2 xl:text-sm">
          Доступність
          <ArrowRightIcon class="h-4 w-4" aria-hidden="true" />
        </NuxtLink>
      </div>

      <div class="availability-table-scroll mt-2 overflow-x-auto rounded-xl border border-slate-200 xl:mt-3 xl:rounded-2xl">
        <table class="availability-table min-w-[680px] w-full divide-y divide-slate-200 text-xs xl:min-w-[760px] xl:text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-3 py-2 text-left font-medium text-slate-500 xl:px-4 xl:py-3">Дата</th>
              <th class="px-3 py-2 text-left font-medium text-slate-500 xl:px-4 xl:py-3">Статус</th>
              <th class="px-3 py-2 text-left font-medium text-slate-500 xl:px-4 xl:py-3">Відкрито</th>
              <th class="px-3 py-2 text-left font-medium text-slate-500 xl:px-4 xl:py-3">Доступно</th>
              <th class="px-3 py-2 text-left font-medium text-slate-500 xl:px-4 xl:py-3">Блокування часу</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="row in availabilityRows" :key="row.date">
              <td data-label="Дата" class="px-3 py-2 xl:px-4 xl:py-3">
                <p class="font-medium text-slate-900">{{ row.label }}</p>
                <p class="mt-1 text-xs text-slate-500">{{ row.dayOff ? 'Понеділок' : `${workdayStart}-${workdayEnd}` }}</p>
              </td>
              <td data-label="Статус" class="px-3 py-2 xl:px-4 xl:py-3">
                <span class="rounded-full px-2.5 py-0.5 text-xs font-medium xl:px-3 xl:py-1" :class="availabilityStatusClass(row.tone)">
                  {{ row.status }}
                </span>
              </td>
              <td data-label="Відкрито" class="px-3 py-2 xl:px-4 xl:py-3">
                <p class="font-medium text-slate-900">{{ formatDuration(row.openMinutes) }}</p>
                <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div class="h-full rounded-full bg-emerald-500" :style="{ width: `${row.busyPercent}%` }" />
                </div>
              </td>
              <td data-label="Доступно" class="px-3 py-2 text-slate-700 xl:px-4 xl:py-3">{{ formatDuration(row.availableMinutes) }}</td>
              <td data-label="Блокування часу" class="px-3 py-2 xl:px-4 xl:py-3">
                <div v-if="row.blocks.length" class="space-y-1">
                  <p v-for="segment in row.blocks.slice(0, 2)" :key="segment.block.id" class="text-sm text-slate-600">
                    {{ formatTime(segment.block.start_at) }}-{{ formatTime(segment.block.end_at) }} · {{ segment.block.reason || 'Без причини' }}
                  </p>
                  <p v-if="row.blocks.length > 2" class="text-xs text-slate-400">
                    +{{ row.blocks.length - 2 }} ще
                  </p>
                </div>
                <span v-else class="text-slate-400">{{ row.dayOff ? 'Вихідний за графіком' : '-' }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

  </div>
</template>

<style scoped>
@media (max-width: 767px) {
  .availability-table-scroll {
    margin-left: -1rem;
    margin-right: -1rem;
    border-left-width: 0;
    border-right-width: 0;
    border-radius: 0;
  }

  .availability-table {
    display: table !important;
    width: 100% !important;
  }

  .availability-table thead {
    display: table-header-group !important;
  }

  .availability-table tbody {
    display: table-row-group !important;
    padding: 0 !important;
    background: transparent !important;
  }

  .availability-table tr {
    display: table-row !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }

  .availability-table th,
  .availability-table td {
    display: table-cell !important;
    padding: 0.5rem 0.625rem !important;
    text-align: left !important;
    vertical-align: top;
    white-space: nowrap;
  }

  .availability-table td::before {
    display: none !important;
    content: none !important;
  }

  .availability-table td:last-child {
    min-width: 210px;
    white-space: normal;
  }
}
</style>
