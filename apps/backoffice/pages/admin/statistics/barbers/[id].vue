<script setup lang="ts">
definePageMeta({
  middleware: () => {
    const auth = useAuthStore()
    if (!auth.user?.is_superuser && auth.user?.role !== 'admin') {
      return navigateTo('/statistics')
    }
  },
})

const route = useRoute()
const api = useBackofficeApi()
const { barberName, statisticsErrorMessage } = useStatisticsFormatting()

const barberId = computed(() => Number(route.params.id))
const now = new Date()
const month = ref(now.getMonth() + 1)
const year = ref(now.getFullYear())

const { data: stats, pending, error, refresh } = await useAsyncData(
  'admin-barber-monthly-statistics',
  () => api.getBarberMonthlyStatistics(barberId.value, year.value, month.value),
  { watch: [barberId, year, month] },
)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Статистика майстра</p>
        <h1 class="mt-1 text-3xl font-semibold text-slate-900">{{ barberName(stats?.barber) || `Майстер #${barberId}` }}</h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Детальний місячний зріз доходу, послуг, клієнтів і завантаження.
        </p>
      </div>
      <NuxtLink to="/admin/statistics" class="inline-flex min-h-10 items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
        До загальної статистики
      </NuxtLink>
    </div>

    <StatisticsMonthYearFilter
      v-model:month="month"
      v-model:year="year"
      :loading="pending"
      @refresh="refresh"
    />

    <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
      {{ statisticsErrorMessage(error, 'Не вдалося завантажити статистику майстра. Перевірте, що backend запущений з monthly statistics API.') }}
    </p>

    <StatisticsBarberDashboardContent :stats="stats" :loading="pending" />
  </div>
</template>
