<script setup lang="ts">
import { EyeIcon, UserCircleIcon } from '@heroicons/vue/24/outline'
import type { Master } from '~/composables/useBackofficeApi'

definePageMeta({
  middleware: () => {
    const auth = useAuthStore()
    if (!auth.user?.is_superuser && auth.user?.role !== 'admin') {
      return navigateTo('/statistics')
    }
  },
})

const api = useBackofficeApi()
const { formatMoney, normalizeItems } = useBookingFormatting()
const { barberName, statisticsErrorMessage } = useStatisticsFormatting()

const now = new Date()
const month = ref(now.getMonth() + 1)
const year = ref(now.getFullYear())
const selectedBarberId = ref<number | null>(null)

const [{ data: mastersData }, { data, pending, error, refresh }] = await Promise.all([
  useAsyncData('statistics-admin-master-options', () => api.adminGetMasters(1, 200, { is_active: true })),
  useAsyncData(
    'admin-monthly-statistics',
    async () => {
      const [monthly, comparison] = await Promise.all([
        api.adminGetMonthlyStatistics(year.value, month.value),
        api.adminGetBarbersComparison(year.value, month.value),
      ])
      return { monthly, comparison }
    },
    { watch: [year, month] },
  ),
])

const masters = computed<Master[]>(() => normalizeItems(mastersData.value))
const monthly = computed(() => data.value?.monthly || null)
const comparison = computed(() => data.value?.comparison || null)
const topBarbers = computed(() => monthly.value?.top_barbers?.length ? monthly.value.top_barbers : comparison.value?.top_performing_barbers || [])
const comparisonRows = computed(() => comparison.value?.barbers || monthly.value?.top_barbers || [])
const selectedBarberPath = computed(() => selectedBarberId.value ? `/admin/statistics/barbers/${selectedBarberId.value}` : '')

const refreshAll = () => refresh()
</script>

<template>
  <div class="space-y-3 xl:space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-2 xl:gap-3">
      <div>
        <p class="text-xs uppercase tracking-[0.22em] text-cyan-700 xl:text-sm xl:tracking-[0.3em]">Статистика</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900 xl:text-3xl">Статистика барбершопу</h1>
        <p class="mt-1 max-w-2xl text-xs leading-5 text-slate-500 xl:mt-2 xl:text-sm xl:leading-6">
          Загальний дохід, клієнти, записи та порівняння майстрів за місяць.
        </p>
      </div>
    </div>

    <StatisticsMonthYearFilter
      v-model:month="month"
      v-model:year="year"
      :loading="pending"
      @refresh="refreshAll"
    />

    <p v-if="error" class="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600 xl:rounded-2xl xl:px-4 xl:py-3 xl:text-sm">
      {{ statisticsErrorMessage(error, 'Не вдалося завантажити статистику адміністратора. Перевірте, що backend запущений з monthly statistics API.') }}
    </p>

    <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4">
      <StatisticsStatCard
        label="Глобальний дохід"
        :value="formatMoney(monthly?.total_barbershop_monthly_revenue)"
        :loading="pending"
        tone="dark"
      />
      <StatisticsStatCard
        label="Завершені записи"
        :value="monthly?.total_completed_appointments || 0"
        :loading="pending"
        tone="cyan"
      />
      <StatisticsStatCard
        label="Унікальні клієнти"
        :value="monthly?.total_clients || 0"
        :loading="pending"
      />
      <StatisticsStatCard
        label="Скасування / неявки"
        :value="(monthly?.total_cancelled_appointments || 0) + (monthly?.aggregate.no_show_appointments || 0)"
        :loading="pending"
        :hint="`Неявки: ${monthly?.aggregate.no_show_appointments || 0}`"
        tone="rose"
      />
    </div>

    <section class="grid gap-2 rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-end xl:gap-3 xl:rounded-[1.75rem] xl:p-4">
      <MasterSelect
        v-model="selectedBarberId"
        :masters="masters"
        label="Детальна статистика майстра"
        placeholder="Оберіть майстра"
        all-label="Оберіть майстра"
        value-type="number"
        compact
        field-class="grid gap-1.5 text-sm font-medium text-slate-700"
        trigger-class="h-11 min-h-11 rounded-2xl px-4 py-2.5 shadow-sm"
        menu-class="z-[260]"
      >
        <template #icon>
          <UserCircleIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
        </template>
      </MasterSelect>
      <NuxtLink
        :to="selectedBarberPath || '/admin/statistics'"
        class="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition xl:min-h-11 xl:px-5 xl:py-2.5 xl:text-sm"
        :class="selectedBarberPath ? 'border-cyan-200 bg-cyan-50 text-cyan-800 hover:border-cyan-300 hover:bg-cyan-100' : 'pointer-events-none border-slate-300 bg-slate-100 text-slate-400 opacity-70'"
      >
        <EyeIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
        Переглянути майстра
      </NuxtLink>
    </section>

    <div class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-4">
      <StatisticsPopularServicesChart
        :items="monthly?.most_popular_services || []"
        :loading="pending"
        title="Популярні послуги барбершопу"
      />

      <section class="rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm xl:rounded-[1.75rem] xl:p-4">
        <h2 class="text-base font-semibold text-slate-900 xl:text-lg">Топ майстрів</h2>
        <div v-if="pending" class="mt-3 space-y-2 xl:mt-4 xl:space-y-3">
          <div v-for="index in 4" :key="index" class="h-12 animate-pulse rounded-xl bg-slate-100 xl:h-14 xl:rounded-2xl" />
        </div>
        <StatisticsEmptyState
          v-else-if="!topBarbers.length"
          class="mt-3 xl:mt-4"
          title="Немає рейтингу"
          description="Рейтинг зʼявиться після завершених записів."
        />
        <div v-else class="mt-3 space-y-2 xl:mt-4 xl:space-y-3">
          <NuxtLink
            v-for="(row, index) in topBarbers.slice(0, 5)"
            :key="row.barber.id"
            :to="`/admin/statistics/barbers/${row.barber.id}`"
            class="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:border-cyan-300 hover:bg-cyan-50 xl:gap-3 xl:rounded-2xl xl:px-4 xl:py-3"
          >
            <span class="min-w-0">
              <span class="block truncate text-sm font-medium text-slate-900 xl:text-base">#{{ index + 1 }} {{ barberName(row.barber) }}</span>
              <span class="mt-0.5 block text-xs text-slate-500 xl:mt-1 xl:text-sm">{{ row.completed_appointments }} записів · {{ row.unique_clients }} клієнтів</span>
            </span>
            <span class="shrink-0 text-xs font-semibold text-slate-900 xl:text-sm">{{ formatMoney(row.revenue) }}</span>
          </NuxtLink>
        </div>
      </section>
    </div>

    <StatisticsBarberComparisonTable
      :rows="comparisonRows"
      :loading="pending"
      :selected-barber-id="selectedBarberId"
    />

    <div class="grid gap-3 xl:grid-cols-2 xl:gap-4">
      <StatisticsRevenueByServiceChart
        :items="monthly?.aggregate.revenue_by_service || []"
        :loading="pending"
        title="Дохід барбершопу за послугами"
      />
      <StatisticsWorkloadChart
        :days="monthly?.aggregate.workload_by_day || []"
        :weeks="monthly?.aggregate.workload_by_week || []"
        :loading="pending"
        title="Завантаження барбершопу"
      />
    </div>
  </div>
</template>
