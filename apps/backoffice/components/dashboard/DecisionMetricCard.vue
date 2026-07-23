<script setup lang="ts">
import {
  hasDashboardMetric,
  normalizeDashboardRate,
  type AdminDashboardMetricComparison,
} from '~/utils/adminDashboard'

const props = withDefaults(defineProps<{
  label: string
  value: string | number | null | undefined
  kind?: 'money' | 'number'
  comparison?: AdminDashboardMetricComparison | null
  loading?: boolean
  tone?: 'dark' | 'cyan' | 'emerald' | 'slate'
  hint?: string
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
</script>

<template>
  <article
    class="min-h-32 rounded-[1.5rem] border p-4 shadow-sm"
    :class="{
      'border-slate-900 bg-slate-950 text-white': tone === 'dark',
      'border-cyan-100 bg-cyan-50 text-slate-900': tone === 'cyan',
      'border-emerald-100 bg-emerald-50 text-slate-900': tone === 'emerald',
      'border-slate-200 bg-white text-slate-900': tone === 'slate',
    }"
  >
    <div v-if="loading" class="animate-pulse space-y-4" aria-label="Завантаження метрики">
      <div class="h-3 w-24 rounded bg-current opacity-10" />
      <div class="h-9 w-36 rounded bg-current opacity-10" />
      <div class="h-3 w-44 rounded bg-current opacity-10" />
    </div>
    <template v-else>
      <p class="text-sm" :class="tone === 'dark' ? 'text-slate-300' : 'text-slate-500'">{{ label }}</p>
      <p class="mt-2 break-words text-2xl font-semibold sm:text-3xl" :class="{ 'text-slate-400': !available && tone !== 'dark' }">
        {{ displayValue }}
      </p>
      <p v-if="comparison && (comparisonAbsolute || comparisonPercentage)" class="mt-3 text-xs leading-5">
        <span
          class="font-semibold"
          :class="{
            'text-emerald-600': comparisonDirection === 'positive' && tone !== 'dark',
            'text-emerald-300': comparisonDirection === 'positive' && tone === 'dark',
            'text-rose-600': comparisonDirection === 'negative' && tone !== 'dark',
            'text-rose-300': comparisonDirection === 'negative' && tone === 'dark',
            'text-slate-500': comparisonDirection === 'neutral' && tone !== 'dark',
            'text-slate-300': comparisonDirection === 'neutral' && tone === 'dark',
          }"
        >
          {{ [comparisonAbsolute, comparisonPercentage].filter(Boolean).join(' · ') }}
        </span>
        <span :class="tone === 'dark' ? 'text-slate-400' : 'text-slate-500'"> проти попереднього періоду</span>
      </p>
      <p v-else-if="hint" class="mt-3 text-xs leading-5" :class="tone === 'dark' ? 'text-slate-400' : 'text-slate-500'">{{ hint }}</p>
      <p v-else-if="!available" class="mt-3 text-xs leading-5" :class="tone === 'dark' ? 'text-slate-400' : 'text-slate-500'">
        Backend ще не надав цю метрику.
      </p>
    </template>
  </article>
</template>
