<script setup lang="ts">
import type { CampaignMetrics } from '~/types/messaging'

const props = defineProps<{ metrics?: CampaignMetrics | null }>()

const cards = computed(() => [
  { label: 'Отримувачі', value: props.metrics?.total_recipients || 0 },
  { label: 'Надіслано', value: props.metrics?.sent || 0 },
  { label: 'Помилки', value: props.metrics?.failed || 0 },
  { label: 'Пропущено', value: props.metrics?.skipped || 0 },
  { label: 'Доставка', value: `${props.metrics?.delivery_rate || 0}%` },
  { label: 'Відгуки', value: props.metrics?.reviews_received ?? 0 },
])
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
    <div v-for="card in cards" :key="card.label" class="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
      <p class="text-xs uppercase tracking-[0.18em] text-slate-500">{{ card.label }}</p>
      <p class="mt-2 text-2xl font-semibold text-slate-900">{{ card.value }}</p>
    </div>
  </div>
</template>
