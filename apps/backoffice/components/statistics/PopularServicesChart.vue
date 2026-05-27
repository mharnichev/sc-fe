<script setup lang="ts">
import type { StatisticsServiceItem } from '~/composables/useBackofficeApi'

const props = defineProps<{
  items: StatisticsServiceItem[]
  title?: string
  loading?: boolean
}>()

const maxCount = computed(() => Math.max(...props.items.map(item => item.count), 0))
</script>

<template>
  <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
    <h2 class="text-lg font-semibold text-slate-900">{{ title || 'Популярні послуги' }}</h2>
    <div v-if="loading" class="mt-4 space-y-3">
      <div v-for="index in 4" :key="index" class="h-12 animate-pulse rounded-2xl bg-slate-100" />
    </div>
    <StatisticsEmptyState
      v-else-if="!items.length"
      class="mt-4"
      title="Немає даних за цей місяць"
      description="Популярні послуги зʼявляться після завершених записів."
    />
    <div v-else class="mt-4 space-y-3">
      <div v-for="item in items" :key="item.service_id" class="space-y-2">
        <div class="flex items-start justify-between gap-3 text-sm">
          <p class="font-medium text-slate-900">{{ item.service_name }}</p>
          <p class="shrink-0 text-slate-500">{{ item.count }} записів</p>
        </div>
        <div class="h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div class="h-full rounded-full bg-cyan-500" :style="{ width: `${maxCount ? Math.max(6, (item.count / maxCount) * 100) : 0}%` }" />
        </div>
      </div>
    </div>
  </section>
</template>
