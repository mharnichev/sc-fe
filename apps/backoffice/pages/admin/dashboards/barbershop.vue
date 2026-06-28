<script setup lang="ts">
import {
  ArrowPathIcon,
  ArrowRightIcon,
  ClockIcon,
  SparklesIcon,
} from '@heroicons/vue/24/outline'
import type { Booking, Master, TimeBlock } from '~/composables/useBackofficeApi'

definePageMeta({
  middleware: () => {
    const auth = useAuthStore()
    if (!auth.user?.is_superuser && auth.user?.role !== 'admin') {
      return navigateTo('/dashboard')
    }
  },
})

const api = useBackofficeApi()
const {
  addDaysInput,
  apiErrorMessage,
  bookingEnd,
  bookingPhone,
  bookingServicesLabel,
  bookingStart,
  customerName,
  formatBookingStatus,
  formatDateTime,
  formatDuration,
  formatMoney,
  formatTime,
  masterName,
  normalizeItems,
  todayInput,
} = useBookingFormatting()
const { barberName, statisticsErrorMessage } = useStatisticsFormatting()

const now = new Date()
const month = now.getMonth() + 1
const year = now.getFullYear()
const today = todayInput()
const tomorrow = addDaysInput(today, 1)
const nextWeek = addDaysInput(today, 7)

const { data, pending, error, refresh } = await useAsyncData('admin-barbershop-dashboard', async () => {
  const [monthly, comparison, bookings, masters, services, customers, timeBlocks] = await Promise.all([
    api.adminGetMonthlyStatistics(year, month),
    api.adminGetBarbersComparison(year, month),
    api.adminGetBookings(1, 100, { date_from: today, date_to: nextWeek }),
    api.adminGetMasters(1, 100, { is_active: true }),
    api.adminGetBaseServices(1, 100, { is_active: true }),
    api.getCustomers(1, 1, { sort_by: 'created_at', sort_order: 'desc' }),
    api.adminGetTimeBlocks(1, 100, { date_from: today, date_to: nextWeek }),
  ])

  return { monthly, comparison, bookings, masters, services, customers, timeBlocks }
})

const monthly = computed(() => data.value?.monthly || null)
const comparison = computed(() => data.value?.comparison || null)
const bookings = computed<Booking[]>(() => normalizeItems(data.value?.bookings))
const masters = computed<Master[]>(() => normalizeItems(data.value?.masters))
const services = computed(() => normalizeItems(data.value?.services))
const timeBlocks = computed<TimeBlock[]>(() => normalizeItems(data.value?.timeBlocks))
const totalCustomers = computed(() => data.value?.customers?.total || 0)

const dateInputFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Kyiv',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const shortDateFormatter = new Intl.DateTimeFormat('uk-UA', {
  timeZone: 'Europe/Kyiv',
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

const formatInputDate = (dateInput: string) => {
  const [dateYear, dateMonth, dateDay] = dateInput.split('-').map(Number)
  return shortDateFormatter.format(new Date(Date.UTC(dateYear, dateMonth - 1, dateDay, 12)))
}

const sortBookings = (items: Booking[]) =>
  [...items].sort((first, second) => new Date(bookingStart(first)).getTime() - new Date(bookingStart(second)).getTime())

const todayBookings = computed(() => sortBookings(bookings.value.filter(booking => dateInputFromDateTime(bookingStart(booking)) === today)))
const tomorrowBookings = computed(() => bookings.value.filter(booking => dateInputFromDateTime(bookingStart(booking)) === tomorrow))
const upcomingBookings = computed(() => sortBookings(bookings.value.filter(booking => booking.status !== 'cancelled')).slice(0, 8))
const completedToday = computed(() => todayBookings.value.filter(booking => booking.status === 'completed').length)
const cancelledToday = computed(() => todayBookings.value.filter(booking => booking.status === 'cancelled').length)
const confirmedToday = computed(() => todayBookings.value.filter(booking => booking.status === 'confirmed').length)
const activeMasters = computed(() => masters.value.filter(master => master.is_active !== false))
const blockedMasters = computed(() => new Set(timeBlocks.value.map(block => block.master_id)).size)
const topBarbers = computed(() => monthly.value?.top_barbers?.length ? monthly.value.top_barbers : comparison.value?.top_performing_barbers || [])
const popularServices = computed(() => monthly.value?.most_popular_services || monthly.value?.aggregate.most_popular_services || [])

const nextSevenDays = computed(() =>
  Array.from({ length: 7 }, (_, index) => {
    const date = addDaysInput(today, index)
    const dayBookings = bookings.value.filter(booking => dateInputFromDateTime(bookingStart(booking)) === date)
    const activeBookings = dayBookings.filter(booking => booking.status !== 'cancelled')

    return {
      date,
      label: formatInputDate(date),
      total: dayBookings.length,
      active: activeBookings.length,
      cancelled: dayBookings.length - activeBookings.length,
    }
  }),
)

const maxDayBookings = computed(() => Math.max(1, ...nextSevenDays.value.map(day => day.total)))
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Admin dashboard</p>
        <h1 class="mt-1 text-3xl font-semibold text-slate-900">Барбершоп</h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Операційний день, записи, команда та місячна ефективність майстрів.
        </p>
      </div>
      <BaseButton
        type="button"
        :disabled="pending"
        class="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        @click="refresh"
      >
        <ArrowPathIcon class="h-4 w-4" aria-hidden="true" />
        {{ pending ? 'Оновлення...' : 'Оновити' }}
      </BaseButton>
    </div>

    <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
      {{ statisticsErrorMessage(error, apiErrorMessage(error, 'Не вдалося завантажити dashboard барбершопу.')) }}
    </p>

    <div class="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <StatisticsStatCard
        class="col-span-2 xl:col-span-1"
        label="Дохід місяця"
        :value="formatMoney(monthly?.total_barbershop_monthly_revenue)"
        :loading="pending"
        tone="dark"
      />
      <StatisticsStatCard
        label="Записи сьогодні"
        :value="todayBookings.length"
        :hint="`${confirmedToday} підтверджено · ${completedToday} завершено · ${cancelledToday} скасовано`"
        :loading="pending"
        tone="cyan"
      />
      <StatisticsStatCard
        label="Активні майстри"
        :value="activeMasters.length"
        :hint="`${blockedMasters} мають блокування на 7 днів`"
        :loading="pending"
      />
      <StatisticsStatCard
        class="col-span-2 xl:col-span-1"
        label="Клієнти в базі"
        :value="totalCustomers"
        :hint="`${monthly?.total_clients || 0} унікальних клієнтів цього місяця`"
        :loading="pending"
        tone="emerald"
      />
    </div>

    <div class="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">Найближчі записи</h2>
            <p class="mt-1 text-sm text-slate-500">Сьогодні і наступні 7 днів.</p>
          </div>
          <NuxtLink to="/bookings" class="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
            Календар
            <ArrowRightIcon class="h-4 w-4" aria-hidden="true" />
          </NuxtLink>
        </div>

        <div v-if="pending" class="mt-4 space-y-3">
          <div v-for="index in 5" :key="index" class="h-16 animate-pulse rounded-2xl bg-slate-100" />
        </div>
        <StatisticsEmptyState
          v-else-if="!upcomingBookings.length"
          class="mt-4"
          title="Записів немає"
          description="Найближчі бронювання зʼявляться тут після створення."
        />
        <div v-else class="mt-4 divide-y divide-slate-100">
          <article v-for="booking in upcomingBookings" :key="booking.id" class="grid gap-3 py-3 md:grid-cols-[8rem_minmax(0,1fr)_auto] md:items-center">
            <div>
              <p class="font-semibold text-slate-900">{{ formatTime(bookingStart(booking)) }}</p>
              <p class="mt-1 text-xs text-slate-500">{{ formatDateTime(bookingStart(booking)) }}</p>
            </div>
            <div class="min-w-0">
              <p class="truncate font-medium text-slate-900">{{ customerName(booking) }} · {{ bookingPhone(booking) || 'Без телефону' }}</p>
              <p class="mt-1 truncate text-sm text-slate-500">
                {{ masterName(booking.master || booking.barber) }} · {{ bookingServicesLabel(booking, services) }}
              </p>
            </div>
            <div class="flex items-center gap-2 md:justify-end">
              <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {{ formatBookingStatus(booking.status) }}
              </span>
              <span class="text-xs text-slate-400">{{ formatTime(bookingEnd(booking)) }}</span>
            </div>
          </article>
        </div>
      </section>

      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
        <h2 class="text-lg font-semibold text-slate-900">Завантаження 7 днів</h2>
        <p class="mt-1 text-sm text-slate-500">Активні та скасовані записи по днях.</p>
        <div class="mt-4 space-y-3">
          <div v-for="day in nextSevenDays" :key="day.date" class="space-y-2">
            <div class="flex items-center justify-between gap-3 text-sm">
              <span class="font-medium text-slate-900">{{ day.label }}</span>
              <span class="text-slate-500">{{ day.active }} активних<span v-if="day.cancelled"> · {{ day.cancelled }} скас.</span></span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-slate-100">
              <div class="h-full rounded-full bg-cyan-500" :style="{ width: `${Math.round((day.total / maxDayBookings) * 100)}%` }" />
            </div>
          </div>
        </div>
        <div class="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Завтра: {{ tomorrowBookings.length }} записів · Послуг у меню: {{ services.length }}
        </div>
      </section>
    </div>

    <div class="grid gap-4 xl:grid-cols-2">
      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold text-slate-900">Топ майстрів місяця</h2>
          <NuxtLink to="/admin/statistics" class="text-sm font-medium text-cyan-700">Статистика</NuxtLink>
        </div>
        <div v-if="pending" class="mt-4 space-y-3">
          <div v-for="index in 4" :key="index" class="h-14 animate-pulse rounded-2xl bg-slate-100" />
        </div>
        <StatisticsEmptyState
          v-else-if="!topBarbers.length"
          class="mt-4"
          title="Немає рейтингу"
          description="Рейтинг зʼявиться після завершених записів."
        />
        <div v-else class="mt-4 space-y-3">
          <NuxtLink
            v-for="(row, index) in topBarbers.slice(0, 5)"
            :key="row.barber.id"
            :to="`/admin/statistics/barbers/${row.barber.id}`"
            class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 transition hover:border-cyan-300 hover:bg-cyan-50"
          >
            <span class="min-w-0">
              <span class="block font-medium text-slate-900">#{{ index + 1 }} {{ barberName(row.barber) }}</span>
              <span class="mt-1 block text-sm text-slate-500">{{ row.completed_appointments }} записів · {{ row.unique_clients }} клієнтів</span>
            </span>
            <span class="shrink-0 text-sm font-semibold text-slate-900">{{ formatMoney(row.revenue) }}</span>
          </NuxtLink>
        </div>
      </section>

      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold text-slate-900">Популярні послуги</h2>
          <SparklesIcon class="h-5 w-5 text-cyan-700" aria-hidden="true" />
        </div>
        <div v-if="pending" class="mt-4 space-y-3">
          <div v-for="index in 5" :key="index" class="h-12 animate-pulse rounded-2xl bg-slate-100" />
        </div>
        <StatisticsEmptyState
          v-else-if="!popularServices.length"
          class="mt-4"
          title="Послуг ще немає"
          description="Після завершених записів тут буде попит за послугами."
        />
        <div v-else class="mt-4 space-y-3">
          <article v-for="service in popularServices.slice(0, 6)" :key="service.service_id" class="rounded-2xl bg-slate-50 px-4 py-3">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate font-medium text-slate-900">{{ service.service_name }}</p>
                <p class="mt-1 text-sm text-slate-500">{{ service.count }} виконань</p>
              </div>
              <p class="shrink-0 text-sm font-semibold text-slate-900">{{ formatMoney(service.revenue) }}</p>
            </div>
          </article>
        </div>
      </section>
    </div>

    <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-slate-900">Операційні сигнали</h2>
          <p class="mt-1 text-sm text-slate-500">Що потребує уваги адміністратора зараз.</p>
        </div>
        <ClockIcon class="h-5 w-5 text-cyan-700" aria-hidden="true" />
      </div>
      <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <div class="rounded-2xl bg-slate-50 px-4 py-3">
          <p class="text-sm text-slate-500">Блокування часу</p>
          <p class="mt-2 text-2xl font-semibold text-slate-900">{{ timeBlocks.length }}</p>
          <p class="mt-1 text-xs text-slate-500">На найближчі 7 днів</p>
        </div>
        <div class="rounded-2xl bg-slate-50 px-4 py-3">
          <p class="text-sm text-slate-500">Скасування сьогодні</p>
          <p class="mt-2 text-2xl font-semibold text-rose-700">{{ cancelledToday }}</p>
          <p class="mt-1 text-xs text-slate-500">Перевірити причини і перенесення</p>
        </div>
        <div class="col-span-2 rounded-2xl bg-slate-50 px-4 py-3 md:col-span-1">
          <p class="text-sm text-slate-500">Середній чек</p>
          <p class="mt-2 text-2xl font-semibold text-slate-900">{{ formatMoney(monthly?.aggregate.average_check_per_appointment) }}</p>
          <p class="mt-1 text-xs text-slate-500">За завершеними записами місяця</p>
        </div>
      </div>
    </section>
  </div>
</template>
