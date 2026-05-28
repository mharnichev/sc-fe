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
  <section class="rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm xl:rounded-[1.75rem] xl:p-4">
    <h2 class="text-base font-semibold text-slate-900 xl:text-lg">{{ title || 'Популярні послуги' }}</h2>
    <div v-if="loading" class="mt-3 space-y-2 xl:mt-4 xl:space-y-3">
      <div v-for="index in 4" :key="index" class="h-10 animate-pulse rounded-xl bg-slate-100 xl:h-12 xl:rounded-2xl" />
    </div>
    <StatisticsEmptyState
      v-else-if="!items.length"
      class="mt-3 xl:mt-4"
      title="Немає даних за цей місяць"
      description="Популярні послуги зʼявляться після завершених записів."
    />
    <div v-else class="mt-3 space-y-2.5 xl:mt-4 xl:space-y-3">
      <div v-for="item in items" :key="item.service_id" class="space-y-1.5 xl:space-y-2">
        <div class="flex items-start justify-between gap-2 text-xs xl:gap-3 xl:text-sm">
          <p class="font-medium text-slate-900">{{ item.service_name }}</p>
          <p class="shrink-0 text-slate-500">{{ item.count }} записів</p>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-slate-100 xl:h-2.5">
          <div class="h-full rounded-full bg-cyan-500" :style="{ width: `${maxCount ? Math.max(6, (item.count / maxCount) * 100) : 0}%` }" />
        </div>
      </div>
    </div>
  </section>
</template>
