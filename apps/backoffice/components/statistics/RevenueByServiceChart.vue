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
</script>

<template>
  <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
    <h2 class="text-lg font-semibold text-slate-900">{{ title || 'Дохід за послугами' }}</h2>
    <div v-if="loading" class="mt-4 space-y-3">
      <div v-for="index in 5" :key="index" class="h-12 animate-pulse rounded-2xl bg-slate-100" />
    </div>
    <StatisticsEmptyState
      v-else-if="!items.length"
      class="mt-4"
      title="Немає доходу за послугами"
      description="Дані будуть доступні після завершених записів у вибраному місяці."
    />
    <div v-else class="mt-4 overflow-hidden rounded-2xl border border-slate-200">
      <table class="w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Послуга</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Записи</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Дохід</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="item in items" :key="item.service_id">
            <td data-label="Послуга" class="px-4 py-3">
              <p class="font-medium text-slate-900">{{ item.service_name }}</p>
              <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div class="h-full rounded-full bg-emerald-500" :style="{ width: `${maxRevenue ? Math.max(6, (revenueValue(item) / maxRevenue) * 100) : 0}%` }" />
              </div>
            </td>
            <td data-label="Записи" class="px-4 py-3 text-slate-700">{{ item.count }}</td>
            <td data-label="Дохід" class="px-4 py-3 font-medium text-slate-900">{{ formatMoney(item.revenue) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
