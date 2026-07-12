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
  <div class="space-y-3 xl:space-y-4">
    <div>
      <p class="type-eyebrow text-xs text-cyan-700 xl:text-sm">Статистика</p>
      <h1 class="type-page-title mt-1 text-2xl text-slate-900 xl:text-3xl">Моя статистика</h1>
      <p class="mt-1 max-w-2xl text-xs leading-5 text-slate-500 xl:mt-2 xl:text-sm xl:leading-6">
        Дохід, записи, клієнти та завантаження за вибраний місяць.
      </p>
    </div>

    <StatisticsMonthYearFilter
      v-model:month="month"
      v-model:year="year"
      :loading="pending"
      @refresh="refresh"
    />

    <p v-if="error" class="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600 xl:rounded-2xl xl:px-4 xl:py-3 xl:text-sm">
      {{ statisticsErrorMessage(error, 'Не вдалося завантажити статистику майстра. Перевірте, що backend запущений з monthly statistics API.') }}
    </p>

    <StatisticsBarberDashboardContent :stats="stats" :loading="pending" />
  </div>
</template>
