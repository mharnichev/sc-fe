<script setup lang="ts">
import {
  ArrowPathIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  ClockIcon,
  SparklesIcon,
} from '@heroicons/vue/24/outline'
import type { Booking, Master, MasterService, Service, TimeBlock } from '~/composables/useBackofficeApi'

type DashboardService = MasterService | Service
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
const workdayStart = '08:00'
const workdayEnd = '20:00'
const workdayMinutes = 12 * 60
const availabilityDays = 30

const { data: publicMasters } = await useAsyncData('barber-dashboard-master-options', () => api.getPublicMasters())
const masterList = computed<Master[]>(() => publicMasters.value || [])
const { isBarber, linkedMaster, roleLabel } = useBackofficeAccess(masterList)
const barberId = computed(() => linkedMaster.value?.id || auth.user?.master_id || null)

const { data, pending, error, refresh } = await useAsyncData(
  'barber-dashboard',
  async () => {
    const [bookings, timeBlocks, services] = await Promise.all([
      api.getMyBookings({ date_from: today, date_to: rangeEnd }),
      api.getMyTimeBlocks(),
      barberId.value ? api.getMasterServices(barberId.value) : Promise.resolve([] as MasterService[]),
    ])

    return { bookings, timeBlocks, services }
  },
  { watch: [barberId] },
)

const bookings = computed<Booking[]>(() => normalizeItems(data.value?.bookings))
const timeBlocks = computed<TimeBlock[]>(() => normalizeItems(data.value?.timeBlocks))
const services = computed<MasterService[]>(() => normalizeItems(data.value?.services))

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

const resolveService = (booking: Booking): DashboardService | null =>
  booking.service || services.value.find(service => Number(service.id) === Number(booking.service_id)) || null

const dashboardServiceName = (service?: DashboardService | null) =>
  service?.name || (service?.id ? `Послуга #${service.id}` : 'Немає послуги')

const bookingDurationMinutes = (booking: Booking) => {
  const duration = minutesBetween(bookingStart(booking), bookingEnd(booking))
  if (duration) return duration
  return Number(resolveService(booking)?.duration_minutes || 0)
}

const bookingPrice = (booking: Booking) => Number(resolveService(booking)?.price || 0)

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
    .filter(status => status !== 'pending')
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

    const manualBlockedMinutes = Math.min(
      workdayMinutes,
      blocks.reduce((total, segment) => total + segment.minutes, 0),
    )
    const blockedMinutes = dayOff ? workdayMinutes : manualBlockedMinutes
    const availableMinutes = dayOff ? 0 : Math.max(0, workdayMinutes - manualBlockedMinutes)
    const busyPercent = Math.min(100, Math.round((blockedMinutes / workdayMinutes) * 100))
    const tone: AvailabilityTone = dayOff ? 'closed' : blockedMinutes >= workdayMinutes ? 'blocked' : blockedMinutes > 0 ? 'partial' : 'available'
    const status = dayOff ? 'Вихідний' : blockedMinutes >= workdayMinutes ? 'Повністю заблоковано' : blockedMinutes > 0 ? 'Частково заблоковано' : 'Доступний'

    return {
      date,
      label: formatInputDate(date),
      dayOff,
      blocks,
      blockedMinutes,
      availableMinutes,
      busyPercent,
      status,
      tone,
    }
  }),
)

const quickActions = [
  { label: 'Бронювання', value: 'Календар', to: '/bookings', icon: CalendarDaysIcon },
  { label: 'Мої послуги', value: 'Ціни й тривалість', to: '/my-services', icon: SparklesIcon },
  { label: 'Блокування часу', value: 'Недоступність', to: '/my-time-blocks', icon: ClockIcon },
]
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Огляд майстра</p>
        <h1 class="mt-1 text-3xl font-semibold text-slate-900">Дашборд</h1>
        <p class="mt-1 text-sm text-slate-500">
          {{ roleLabel }}<span v-if="linkedMaster"> · {{ masterName(linkedMaster) }}</span>
        </p>
      </div>
      <button
        type="button"
        :disabled="pending"
        class="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        @click="refresh"
      >
        <ArrowPathIcon class="h-4 w-4" aria-hidden="true" />
        {{ pending ? 'Оновлення...' : 'Оновити' }}
      </button>
    </div>

    <section class="grid gap-3 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
      <NuxtLink
        v-for="action in quickActions"
        :key="action.to"
        :to="action.to"
        class="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-slate-200 px-3 py-2.5 text-left transition hover:border-cyan-300 hover:bg-cyan-50"
      >
        <span class="flex min-w-0 items-center gap-3">
          <span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white">
            <component :is="action.icon" class="h-5 w-5" aria-hidden="true" />
          </span>
          <span class="min-w-0">
            <span class="block font-medium text-slate-900">{{ action.label }}</span>
            <span class="mt-1 block truncate text-sm text-slate-500">{{ action.value }}</span>
          </span>
        </span>
        <ArrowRightIcon class="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      </NuxtLink>
    </section>

    <p v-if="!isBarber || !barberId" class="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
      Для повного огляду потрібен акаунт із роллю майстра або прив’язкою до профілю майстра.
    </p>

    <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
      {{ apiErrorMessage(error, 'Не вдалося завантажити dashboard майстра.') }}
    </p>

    <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-slate-900">Статуси бронювань</h2>
          <p class="mt-1 text-sm text-slate-500">Діапазон: {{ formatInputDate(today) }} - {{ formatInputDate(rangeEnd) }}</p>
        </div>
        <NuxtLink to="/my-bookings" class="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
          Мої бронювання
          <ArrowRightIcon class="h-4 w-4" aria-hidden="true" />
        </NuxtLink>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-3">
        <div v-for="summary in statusSummaries" :key="summary.status" class="rounded-2xl bg-slate-50 px-4 py-2.5">
          <p class="text-sm text-slate-500">{{ summary.label }}</p>
          <p class="mt-1 text-2xl font-semibold text-slate-900">{{ summary.count }}</p>
        </div>
      </div>
    </section>

    <div class="grid gap-4 md:grid-cols-2">
      <article class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
        <p class="text-sm text-slate-500">Сьогодні</p>
        <p class="mt-2 text-3xl font-semibold text-slate-900">{{ todayBookings.length }}</p>
        <p class="mt-2 text-sm text-slate-500">{{ formatDuration(todayBookedMinutes) }} · {{ formatPrice(todayRevenue) }}</p>
      </article>
      <article class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
        <p class="text-sm text-slate-500">Наступний запис</p>
        <p class="mt-2 text-2xl font-semibold text-slate-900">
          {{ nextTodayBooking ? formatTime(bookingStart(nextTodayBooking)) : 'Немає' }}
        </p>
        <p class="mt-2 truncate text-sm text-slate-500">
          {{ nextTodayBooking ? `${formatDateTime(bookingStart(nextTodayBooking))} · ${dashboardServiceName(resolveService(nextTodayBooking))}` : 'На сьогодні наступних записів немає' }}
        </p>
      </article>
    </div>

    <div class="grid gap-4">
      <section class="rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-200 px-4 py-3">
          <h2 class="text-lg font-semibold text-slate-900">Сьогоднішній розклад</h2>
          <p class="mt-1 text-sm text-slate-500">{{ formatInputDate(today) }}</p>
        </div>
        <div v-if="pending" class="p-4 text-sm text-slate-500">Завантаження даних...</div>
        <div v-else-if="!todayBookings.length" class="p-4 text-sm text-slate-500">На сьогодні записів немає.</div>
        <div v-else class="divide-y divide-slate-100">
          <article v-for="booking in todayBookings.slice(0, 6)" :key="booking.id" class="grid gap-3 px-4 py-3 md:grid-cols-[120px_1fr_auto] md:items-center">
            <div>
              <p class="font-semibold text-slate-900">{{ formatTime(bookingStart(booking)) }}</p>
              <p class="text-xs text-slate-500">{{ formatTime(bookingEnd(booking)) }}</p>
            </div>
            <div class="min-w-0">
              <p class="truncate font-medium text-slate-900">{{ customerName(booking) }} · {{ bookingPhone(booking) || 'Без телефону' }}</p>
              <p class="mt-1 truncate text-sm text-slate-500">
                {{ dashboardServiceName(resolveService(booking)) }} · {{ bookingComment(booking) || 'Без коментаря' }}
              </p>
            </div>
            <BookingStatusBadge :status="booking.status" />
          </article>
        </div>
      </section>
    </div>

    <div class="grid gap-4 xl:grid-cols-2">
      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">Найближчі 7 днів</h2>
            <p class="mt-1 text-sm text-slate-500">Заповнення відносно робочого дня 08:00-20:00.</p>
          </div>
          <p class="rounded-full bg-cyan-50 px-3 py-1 text-sm font-medium text-cyan-700">
            {{ formatPrice(rangeRevenue) }}
          </p>
        </div>
        <div class="mt-3 space-y-3">
          <div v-for="day in daySummaries" :key="day.date" class="space-y-2">
            <div class="flex items-center justify-between gap-4 text-sm">
              <span class="font-medium text-slate-900">{{ day.label }}</span>
              <span class="text-slate-500">
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

      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">Послуги</h2>
            <p class="mt-1 text-sm text-slate-500">Активні послуги персонального профілю майстра.</p>
          </div>
          <NuxtLink to="/my-services" class="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
            Послуги
            <ArrowRightIcon class="h-4 w-4" aria-hidden="true" />
          </NuxtLink>
        </div>

        <dl class="mt-3 grid gap-3 sm:grid-cols-3">
          <div class="rounded-2xl bg-slate-50 px-4 py-2.5">
            <dt class="text-sm text-slate-500">Активні</dt>
            <dd class="mt-1 text-2xl font-semibold text-slate-900">{{ activeServices.length }}</dd>
          </div>
          <div class="rounded-2xl bg-slate-50 px-4 py-2.5">
            <dt class="text-sm text-slate-500">Середня тривалість</dt>
            <dd class="mt-1 text-2xl font-semibold text-slate-900">{{ formatDuration(averageServiceDuration) }}</dd>
          </div>
          <div class="rounded-2xl bg-slate-50 px-4 py-2.5">
            <dt class="text-sm text-slate-500">Середня ціна</dt>
            <dd class="mt-1 text-2xl font-semibold text-slate-900">{{ formatPrice(averageServicePrice) }}</dd>
          </div>
        </dl>

        <div class="mt-3 max-h-[18rem] divide-y divide-slate-100 overflow-y-auto pr-2">
          <article v-for="service in activeServices" :key="service.id" class="py-2.5">
            <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start">
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
          <p v-if="!activeServices.length" class="py-3 text-sm text-slate-500">Активних послуг немає.</p>
        </div>
      </section>
    </div>

    <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-slate-900">Доступність</h2>
          <p class="mt-1 text-sm text-slate-500">
            Місяць вперед за графіком {{ workdayStart }}-{{ workdayEnd }}. Понеділок — вихідний за замовчуванням.
          </p>
        </div>
        <NuxtLink to="/my-time-blocks" class="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
          Блокування
          <ArrowRightIcon class="h-4 w-4" aria-hidden="true" />
        </NuxtLink>
      </div>

      <div class="availability-table-scroll mt-3 overflow-x-auto rounded-2xl border border-slate-200">
        <table class="availability-table min-w-[760px] w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-4 py-3 text-left font-medium text-slate-500">Дата</th>
              <th class="px-4 py-3 text-left font-medium text-slate-500">Статус</th>
              <th class="px-4 py-3 text-left font-medium text-slate-500">Заблоковано</th>
              <th class="px-4 py-3 text-left font-medium text-slate-500">Доступно</th>
              <th class="px-4 py-3 text-left font-medium text-slate-500">Блокування часу</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="row in availabilityRows" :key="row.date">
              <td data-label="Дата" class="px-4 py-3">
                <p class="font-medium text-slate-900">{{ row.label }}</p>
                <p class="mt-1 text-xs text-slate-500">{{ row.dayOff ? 'Понеділок' : `${workdayStart}-${workdayEnd}` }}</p>
              </td>
              <td data-label="Статус" class="px-4 py-3">
                <span class="rounded-full px-3 py-1 text-xs font-medium" :class="availabilityStatusClass(row.tone)">
                  {{ row.status }}
                </span>
              </td>
              <td data-label="Заблоковано" class="px-4 py-3">
                <p class="font-medium text-slate-900">{{ formatDuration(row.blockedMinutes) }}</p>
                <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div class="h-full rounded-full bg-slate-900" :style="{ width: `${row.busyPercent}%` }" />
                </div>
              </td>
              <td data-label="Доступно" class="px-4 py-3 text-slate-700">{{ formatDuration(row.availableMinutes) }}</td>
              <td data-label="Блокування часу" class="px-4 py-3">
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
    padding: 0.75rem 0.875rem !important;
    text-align: left !important;
    vertical-align: top;
    white-space: nowrap;
  }

  .availability-table td::before {
    display: none !important;
    content: none !important;
  }

  .availability-table td:last-child {
    min-width: 240px;
    white-space: normal;
  }
}
</style>
