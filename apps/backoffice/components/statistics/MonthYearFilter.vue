<script setup lang="ts">
import { ArrowPathIcon } from '@heroicons/vue/24/outline'

const props = defineProps<{
  month: number
  year: number
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:month': [value: number]
  'update:year': [value: number]
  refresh: []
}>()

const monthOptions = [
  { value: 1, label: 'Січень' },
  { value: 2, label: 'Лютий' },
  { value: 3, label: 'Березень' },
  { value: 4, label: 'Квітень' },
  { value: 5, label: 'Травень' },
  { value: 6, label: 'Червень' },
  { value: 7, label: 'Липень' },
  { value: 8, label: 'Серпень' },
  { value: 9, label: 'Вересень' },
  { value: 10, label: 'Жовтень' },
  { value: 11, label: 'Листопад' },
  { value: 12, label: 'Грудень' },
]

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 7 }, (_, index) => currentYear - 4 + index)

const selectedMonth = computed({
  get: () => props.month,
  set: value => emit('update:month', Number(value)),
})

const selectedYear = computed({
  get: () => props.year,
  set: value => emit('update:year', Number(value)),
})
</script>

<template>
  <div class="grid gap-2 rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end xl:gap-3 xl:rounded-[1.75rem] xl:p-4">
    <label class="grid gap-1 text-xs font-medium text-slate-700 xl:gap-1.5 xl:text-sm">
      Місяць
      <select v-model="selectedMonth" class="min-h-9 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 xl:min-h-11 xl:rounded-2xl xl:px-4 xl:py-2.5">
        <option v-for="option in monthOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
    </label>
    <label class="grid gap-1 text-xs font-medium text-slate-700 xl:gap-1.5 xl:text-sm">
      Рік
      <select v-model="selectedYear" class="min-h-9 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 xl:min-h-11 xl:rounded-2xl xl:px-4 xl:py-2.5">
        <option v-for="option in yearOptions" :key="option" :value="option">{{ option }}</option>
      </select>
    </label>
    <button
      type="button"
      :disabled="loading"
      class="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 xl:min-h-11 xl:px-5 xl:py-2.5 xl:text-sm"
      @click="emit('refresh')"
    >
      <ArrowPathIcon class="h-4 w-4 shrink-0" :class="{ 'animate-spin': loading }" aria-hidden="true" />
      {{ loading ? 'Оновлення...' : 'Оновити' }}
    </button>
  </div>
</template>
