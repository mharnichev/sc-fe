<script setup lang="ts">
import type { StatisticsServiceItem } from '~/composables/useBackofficeApi'

const props = defineProps<{
  items: StatisticsServiceItem[]
  title?: string
  loading?: boolean
}>()

const { formatMoney } = useBookingFormatting()
const revenueValue = (item: StatisticsServiceItem) => Number(item.revenue || 0)
const maxRevenue = computed(() => Math.max(...props.items.map(revenueValue), 0))
const progressWidth = (revenue: number) => {
  if (!revenue || !maxRevenue.value) return 0
  return Math.max(6, (revenue / maxRevenue.value) * 100)
}
</script>

<template>
  <section class="rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm xl:rounded-[1.75rem] xl:p-4">
    <h2 class="text-base font-semibold text-slate-900 xl:text-lg">{{ title || 'Дохід за послугами' }}</h2>
    <div v-if="loading" class="mt-3 space-y-2 xl:mt-4 xl:space-y-3">
      <div v-for="index in 5" :key="index" class="h-10 animate-pulse rounded-xl bg-slate-100 xl:h-12 xl:rounded-2xl" />
    </div>
    <StatisticsEmptyState
      v-else-if="!items.length"
      class="mt-3 xl:mt-4"
      title="Немає доходу за послугами"
      description="Дані будуть доступні після завершених записів у вибраному місяці."
    />
    <div v-else class="mt-3 overflow-hidden rounded-xl border border-slate-200 xl:mt-4 xl:rounded-2xl">
      <table class="w-full divide-y divide-slate-200 text-xs xl:text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-3 py-2 text-left font-medium text-slate-500 xl:px-4 xl:py-3">Послуга</th>
            <th class="px-3 py-2 text-left font-medium text-slate-500 xl:px-4 xl:py-3">Записи</th>
            <th class="px-3 py-2 text-left font-medium text-slate-500 xl:px-4 xl:py-3">Дохід</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="item in items" :key="item.service_id">
            <td data-label="Послуга" class="px-3 py-2 xl:px-4 xl:py-3">
              <p class="font-medium text-slate-900">{{ item.service_name }}</p>
              <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 xl:mt-2 xl:h-2">
                <div class="h-full rounded-full bg-emerald-500" :style="{ width: `${progressWidth(revenueValue(item))}%` }" />
              </div>
            </td>
            <td data-label="Записи" class="px-3 py-2 text-slate-700 xl:px-4 xl:py-3">{{ item.count }}</td>
            <td data-label="Дохід" class="px-3 py-2 font-medium text-slate-900 xl:px-4 xl:py-3">{{ formatMoney(item.revenue) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
