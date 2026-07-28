<script setup lang="ts">
import {
  hasDashboardMetric,
  normalizeDashboardRate,
  type AdminDashboardMetricComparison,
} from '~/utils/adminDashboard'

interface MetricHelpContent {
  summary: string
  formula?: string
  trigger?: string
  action?: string
  note?: string
}

const props = withDefaults(defineProps<{
  label: string
  value: string | number | null | undefined
  kind?: 'money' | 'number'
  comparison?: AdminDashboardMetricComparison | null
  loading?: boolean
  tone?: 'dark' | 'cyan' | 'emerald' | 'slate'
  hint?: string
  help?: MetricHelpContent
}>(), {
  kind: 'number',
  tone: 'slate',
})

const { formatMoney } = useBookingFormatting()
const available = computed(() => hasDashboardMetric(props.value))
const displayValue = computed(() => {
  if (!available.value) return 'Недоступно'
  if (props.kind === 'money') return formatMoney(props.value)
  return Number(props.value).toLocaleString('uk-UA', { maximumFractionDigits: 2 })
})
const comparisonDirection = computed(() => {
  const comparisonValue = props.comparison?.percentage_change ?? props.comparison?.absolute_change
  if (!hasDashboardMetric(comparisonValue) || Number(comparisonValue) === 0) return 'neutral'
  return Number(comparisonValue) > 0 ? 'positive' : 'negative'
})
const comparisonAbsolute = computed(() => {
  const value = props.comparison?.absolute_change
  if (!hasDashboardMetric(value)) return ''
  const prefix = Number(value) > 0 ? '+' : ''
  return props.kind === 'money'
    ? `${prefix}${formatMoney(value)}`
    : `${prefix}${Number(value).toLocaleString('uk-UA', { maximumFractionDigits: 2 })}`
})
const comparisonPercentage = computed(() => {
  const value = normalizeDashboardRate(props.comparison?.percentage_change)
  if (value === null) return ''
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toLocaleString('uk-UA', { maximumFractionDigits: 1 })}%`
})
const toneClass = computed(() => `statistics-stat-card--${props.tone}`)
</script>

<template>
  <article
    class="dashboard-decision-metric-card statistics-stat-card min-h-32 rounded-[1.5rem] border p-4 shadow-sm"
    :class="toneClass"
  >
    <div v-if="loading" class="animate-pulse space-y-4" aria-label="Завантаження метрики">
      <div class="h-3 w-24 rounded bg-current opacity-10" />
      <div class="h-9 w-36 rounded bg-current opacity-10" />
      <div class="h-3 w-44 rounded bg-current opacity-10" />
    </div>
    <template v-else>
      <div class="flex items-center gap-1">
        <p class="statistics-stat-card__label text-sm">{{ label }}</p>
        <DashboardMetricHelp
          v-if="help"
          :title="label"
          :summary="help.summary"
          :formula="help.formula"
          :trigger="help.trigger"
          :action="help.action"
          :note="help.note"
        />
      </div>
      <p
        class="statistics-stat-card__value mt-2 break-words text-2xl font-semibold sm:text-3xl"
        :class="{ 'dashboard-decision-metric-card__value--unavailable': !available }"
      >
        {{ displayValue }}
      </p>
      <p v-if="comparison && (comparisonAbsolute || comparisonPercentage)" class="mt-3 text-xs leading-5">
        <span
          class="dashboard-decision-metric-card__comparison font-semibold"
          :class="{
            'dashboard-decision-metric-card__comparison--positive': comparisonDirection === 'positive',
            'dashboard-decision-metric-card__comparison--negative': comparisonDirection === 'negative',
            'dashboard-decision-metric-card__comparison--neutral': comparisonDirection === 'neutral',
          }"
        >
          {{ [comparisonAbsolute, comparisonPercentage].filter(Boolean).join(' · ') }}
        </span>
        <span class="statistics-stat-card__hint"> проти попереднього періоду</span>
      </p>
      <p v-else-if="hint" class="statistics-stat-card__hint mt-3 text-xs leading-5">{{ hint }}</p>
      <p v-else-if="!available" class="statistics-stat-card__hint mt-3 text-xs leading-5">
        Backend ще не надав цю метрику.
      </p>
    </template>
  </article>
</template>

<style scoped>
.dashboard-decision-metric-card {
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--stat-card-text) 9%, transparent),
    0 14px 36px color-mix(in srgb, #000 16%, transparent) !important;
}

.dashboard-decision-metric-card__value--unavailable {
  color: var(--stat-card-muted) !important;
}

.dashboard-decision-metric-card__comparison--positive {
  color: color-mix(in srgb, var(--success) 72%, var(--stat-card-text)) !important;
}

.dashboard-decision-metric-card__comparison--negative {
  color: color-mix(in srgb, var(--danger) 72%, var(--stat-card-text)) !important;
}

.dashboard-decision-metric-card__comparison--neutral {
  color: var(--stat-card-muted) !important;
}
</style>
