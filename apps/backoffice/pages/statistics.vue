<script setup lang="ts">
definePageMeta({
  middleware: () => {
    const auth = useAuthStore()
    if (auth.user?.is_superuser || auth.user?.role === 'admin') {
      return navigateTo('/admin/statistics')
    }
  },
})

const api = useBackofficeApi()
const { statisticsErrorMessage } = useStatisticsFormatting()

const now = new Date()
const month = ref(now.getMonth() + 1)
const year = ref(now.getFullYear())

const { data: stats, pending, error, refresh } = await useAsyncData(
  'my-monthly-statistics',
  () => api.getMyMonthlyStatistics(year.value, month.value),
  { watch: [year, month] },
)
</script>

<template>
  <div class="space-y-4">
    <div>
      <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Статистика</p>
      <h1 class="mt-1 text-3xl font-semibold text-slate-900">Моя статистика</h1>
      <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
        Дохід, записи, клієнти та завантаження за вибраний місяць.
      </p>
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
