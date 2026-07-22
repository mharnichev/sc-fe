<script setup lang="ts">
import type { MasterRatingStatistics } from '~/types/reviews'
import { clampRating, formatRating } from '~/utils/reviews'

const props = defineProps<{
  stats?: MasterRatingStatistics | null
  loading?: boolean
  error?: unknown
  compact?: boolean
}>()

const distribution = computed(() => [5, 4, 3, 2, 1].map(rating => ({
  rating,
  count: Number(props.stats?.rating_distribution?.[rating as 1 | 2 | 3 | 4 | 5] || 0),
})))
const maxCount = computed(() => Math.max(1, ...distribution.value.map(item => item.count)))
const status = computed(() => typeof props.error === 'object' && props.error && 'response' in props.error
  ? (props.error as { response?: { status?: number } }).response?.status
  : undefined)
</script>

<template>
  <section class="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm" :class="compact ? '' : 'xl:rounded-[1.75rem] xl:p-5'">
    <div v-if="loading" class="grid animate-pulse gap-3 sm:grid-cols-3">
      <div v-for="index in 3" :key="index" class="h-16 rounded-2xl bg-slate-100" />
    </div>
    <p v-else-if="error" class="text-sm text-rose-600">
      {{ status === 403 ? 'У вас немає доступу до цієї статистики відгуків.' : 'Статистика відгуків недоступна: потрібен backend aggregate contract.' }}
    </p>
    <div v-else-if="stats" class="grid gap-4 lg:grid-cols-[auto_auto_minmax(12rem,1fr)] lg:items-center">
      <div>
        <p class="text-xs uppercase tracking-[0.16em] text-slate-500">Схвалений рейтинг</p>
        <p class="mt-1 text-3xl font-semibold text-slate-900">{{ formatRating(stats.approved_average_rating) }}<span class="text-base text-slate-400">/5</span></p>
        <p class="mt-1 text-amber-500" :aria-label="`${formatRating(stats.approved_average_rating)} з 5`">
          {{ '★'.repeat(clampRating(stats.approved_average_rating)) }}<span class="text-slate-200">{{ '★'.repeat(5 - clampRating(stats.approved_average_rating)) }}</span>
        </p>
      </div>
      <dl class="grid grid-cols-2 gap-3 text-sm">
        <div class="rounded-2xl bg-slate-50 px-4 py-3"><dt class="text-slate-500">Схвалено</dt><dd class="mt-1 text-xl font-semibold text-slate-900">{{ stats.approved_review_count }}</dd></div>
        <div class="rounded-2xl bg-amber-50 px-4 py-3"><dt class="text-amber-700">Очікують</dt><dd class="mt-1 text-xl font-semibold text-amber-800">{{ stats.pending_review_count }}</dd></div>
      </dl>
      <div v-if="stats.rating_distribution" class="space-y-1.5" aria-label="Розподіл схвалених оцінок">
        <div v-for="item in distribution" :key="item.rating" class="grid grid-cols-[2rem_1fr_2rem] items-center gap-2 text-xs text-slate-500">
          <span>{{ item.rating }}★</span>
          <span class="h-1.5 overflow-hidden rounded-full bg-slate-100"><span class="block h-full rounded-full bg-amber-400" :style="{ width: `${(item.count / maxCount) * 100}%` }" /></span>
          <span class="text-right">{{ item.count }}</span>
        </div>
      </div>
      <p v-else class="text-sm text-slate-400">Розподіл оцінок API не надав.</p>
    </div>
    <p v-else class="text-sm text-slate-500">Ще немає схвалених відгуків.</p>
  </section>
</template>
