<script setup lang="ts">
import { ChevronDownIcon, EyeIcon, UserCircleIcon } from '@heroicons/vue/24/outline'
import { initials } from '@shared-utils'
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
const { formatMoney, normalizeItems, masterName } = useBookingFormatting()
const { barberName, statisticsErrorMessage } = useStatisticsFormatting()

const now = new Date()
const month = ref(now.getMonth() + 1)
const year = ref(now.getFullYear())
const selectedBarberId = ref<number | null>(null)
const masterSelectOpen = ref(false)
const masterSelectRef = ref<HTMLElement | null>(null)

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
const selectedMaster = computed(() => masters.value.find(master => master.id === selectedBarberId.value) || null)
const selectedBarberPath = computed(() => selectedBarberId.value ? `/admin/statistics/barbers/${selectedBarberId.value}` : '')
const assetUrl = useAssetUrl()

const masterImageUrl = (master?: Master | null) =>
  master ? assetUrl(master.avatar || master.avatar_url || master.photo || master.photo_url) : ''
const masterInitials = (master?: Master | null) => initials(masterName(master)) || 'SC'

const refreshAll = () => refresh()
const selectMaster = (master: Master | null) => {
  selectedBarberId.value = master?.id || null
  masterSelectOpen.value = false
}

const handleMasterSelectClickOutside = (event: MouseEvent) => {
  const target = event.target
  if (!(target instanceof Node) || masterSelectRef.value?.contains(target)) return
  masterSelectOpen.value = false
}

onMounted(() => {
  document.addEventListener('mousedown', handleMasterSelectClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleMasterSelectClickOutside)
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Статистика</p>
        <h1 class="mt-1 text-3xl font-semibold text-slate-900">Статистика барбершопу</h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
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

    <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
      {{ statisticsErrorMessage(error, 'Не вдалося завантажити статистику адміністратора. Перевірте, що backend запущений з monthly statistics API.') }}
    </p>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

    <section class="grid gap-3 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
      <div ref="masterSelectRef" class="relative grid gap-1.5 text-sm font-medium text-slate-700">
        <span class="inline-flex items-center gap-1.5">
          <UserCircleIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
          Детальна статистика майстра
        </span>
        <button
          type="button"
          class="flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-300 bg-white px-3 py-2 text-left text-sm shadow-sm sm:px-4"
          :aria-expanded="masterSelectOpen"
          @click="masterSelectOpen = !masterSelectOpen"
        >
          <span class="flex min-w-0 items-center gap-2.5">
            <span class="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[0.7rem] font-semibold text-slate-600 ring-1 ring-slate-200">
              <img v-if="masterImageUrl(selectedMaster)" :src="masterImageUrl(selectedMaster)" :alt="masterName(selectedMaster)" class="h-full w-full object-cover">
              <span v-else>{{ selectedMaster ? masterInitials(selectedMaster) : 'SC' }}</span>
            </span>
            <span class="min-w-0">
              <span class="block truncate" :class="selectedMaster ? 'text-slate-900' : 'text-slate-500'">
                {{ selectedMaster ? masterName(selectedMaster) : 'Оберіть майстра' }}
              </span>
              <span v-if="selectedMaster?.position_uk" class="block truncate text-xs font-normal text-slate-500">{{ selectedMaster.position_uk }}</span>
            </span>
          </span>
          <ChevronDownIcon class="h-4 w-4 shrink-0 text-slate-400 transition" :class="{ 'rotate-180': masterSelectOpen }" aria-hidden="true" />
        </button>
        <div
          v-if="masterSelectOpen"
          class="booking-select-menu absolute z-[180] mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl md:rounded-2xl"
        >
          <button
            type="button"
            class="flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
            :class="!selectedBarberId ? 'bg-slate-50' : ''"
            @click="selectMaster(null)"
          >
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[0.7rem] font-semibold text-slate-600 ring-1 ring-slate-200">SC</span>
            <span class="min-w-0 truncate font-medium">Оберіть майстра</span>
          </button>
          <button
            v-for="master in masters"
            :key="master.id"
            type="button"
            class="flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
            :class="selectedBarberId === master.id ? 'bg-slate-50' : ''"
            @click="selectMaster(master)"
          >
            <span class="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[0.7rem] font-semibold text-slate-600 ring-1 ring-slate-200">
              <img v-if="masterImageUrl(master)" :src="masterImageUrl(master)" :alt="masterName(master)" class="h-full w-full object-cover">
              <span v-else>{{ masterInitials(master) }}</span>
            </span>
            <span class="min-w-0">
              <span class="block truncate font-medium">{{ masterName(master) }}</span>
              <span v-if="master.position_uk" class="block truncate text-xs text-slate-500">{{ master.position_uk }}</span>
            </span>
          </button>
        </div>
      </div>
      <NuxtLink
        :to="selectedBarberPath || '/admin/statistics'"
        class="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition"
        :class="selectedBarberPath ? 'border-cyan-200 bg-cyan-50 text-cyan-800 hover:border-cyan-300 hover:bg-cyan-100' : 'pointer-events-none border-slate-300 bg-slate-100 text-slate-400 opacity-70'"
      >
        <EyeIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
        Переглянути майстра
      </NuxtLink>
    </section>

    <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <StatisticsPopularServicesChart
        :items="monthly?.most_popular_services || []"
        :loading="pending"
        title="Популярні послуги барбершопу"
      />

      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
        <h2 class="text-lg font-semibold text-slate-900">Топ майстрів</h2>
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
    </div>

    <StatisticsBarberComparisonTable
      :rows="comparisonRows"
      :loading="pending"
      :selected-barber-id="selectedBarberId"
    />

    <div class="grid gap-4 xl:grid-cols-2">
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
