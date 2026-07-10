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
    <div v-else class="statistics-revenue-table-wrap mt-3 overflow-hidden rounded-xl border xl:mt-4 xl:rounded-2xl">
      <table class="statistics-revenue-table w-full divide-y text-xs xl:text-sm">
        <thead>
          <tr>
            <th class="px-3 py-2 text-left font-medium xl:px-4 xl:py-3">Послуга</th>
            <th class="px-3 py-2 text-left font-medium xl:px-4 xl:py-3">Записи</th>
            <th class="px-3 py-2 text-left font-medium xl:px-4 xl:py-3">Дохід</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.service_id">
            <td data-label="Послуга" class="statistics-revenue-service-cell px-3 py-2 xl:px-4 xl:py-3">
              <p class="statistics-revenue-service-name font-medium">{{ item.service_name }}</p>
              <div class="statistics-revenue-progress mt-1.5 h-1.5 overflow-hidden rounded-full xl:mt-2 xl:h-2">
                <div class="h-full rounded-full bg-emerald-500" :style="{ width: `${progressWidth(revenueValue(item))}%` }" />
              </div>
            </td>
            <td data-label="Записи" class="statistics-revenue-muted px-3 py-2 xl:px-4 xl:py-3">{{ item.count }}</td>
            <td data-label="Дохід" class="statistics-revenue-total px-3 py-2 font-medium xl:px-4 xl:py-3">{{ formatMoney(item.revenue) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.statistics-revenue-table-wrap {
  border-color: var(--border);
  background: color-mix(in srgb, var(--text-primary) 4%, transparent);
}

.statistics-revenue-table {
  border-color: var(--border);
}

.statistics-revenue-table thead {
  background: color-mix(in srgb, var(--text-primary) 8%, transparent);
  color: var(--text-secondary);
}

.statistics-revenue-table tbody {
  color: var(--text-primary);
}

.statistics-revenue-table tbody > :not([hidden]) ~ :not([hidden]) {
  border-color: var(--border);
}

.statistics-revenue-service-name,
.statistics-revenue-total {
  color: var(--text-primary);
}

.statistics-revenue-muted {
  color: var(--text-secondary);
}

.statistics-revenue-progress {
  background: color-mix(in srgb, var(--text-primary) 12%, transparent);
}

@media (max-width: 767px) {
  .statistics-revenue-table tbody {
    background: color-mix(in srgb, var(--text-primary) 5%, transparent);
  }

  .statistics-revenue-table tr {
    border-color: var(--border);
    background: var(--row-bg);
    box-shadow: var(--surface-shadow);
  }

  .statistics-revenue-table td {
    border-color: var(--border);
  }

  .statistics-revenue-table td::before {
    color: var(--text-secondary);
  }

  .statistics-revenue-service-cell {
    display: block;
    text-align: left;
  }

  .statistics-revenue-service-cell::before {
    display: block;
    max-width: none;
    margin-bottom: 0.375rem;
  }
}
</style>
