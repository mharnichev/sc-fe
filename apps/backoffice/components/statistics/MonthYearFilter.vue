<script setup lang="ts">
import { ArrowPathIcon, CalendarDaysIcon, CalendarIcon } from '@heroicons/vue/24/outline'

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
const yearOptions = Array.from({ length: 7 }, (_, index) => {
  const value = currentYear - 4 + index
  return { value, label: String(value) }
})

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
  <div class="grid grid-cols-2 gap-2 rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end xl:gap-3 xl:rounded-[1.75rem] xl:p-4">
    <BaseSelect
      v-model="selectedMonth"
      :options="monthOptions"
      label="Місяць"
      field-class="grid gap-1 text-xs font-medium text-slate-700 xl:gap-1.5 xl:text-sm"
      trigger-class="min-h-9 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 xl:min-h-11 xl:rounded-2xl xl:px-4 xl:py-2.5"
      menu-class="z-[260]"
    >
      <template #icon>
        <CalendarDaysIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
      </template>
      <template #selected="{ label }">
        <span class="flex min-w-0 items-center gap-2">
          <CalendarDaysIcon class="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span class="min-w-0 truncate">{{ label }}</span>
        </span>
      </template>
      <template #option="{ option }">
        <span class="flex min-w-0 items-center gap-2">
          <CalendarDaysIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
          <span class="min-w-0 truncate font-medium">{{ option.label }}</span>
        </span>
      </template>
    </BaseSelect>
    <BaseSelect
      v-model="selectedYear"
      :options="yearOptions"
      label="Рік"
      field-class="grid gap-1 text-xs font-medium text-slate-700 xl:gap-1.5 xl:text-sm"
      trigger-class="min-h-9 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 xl:min-h-11 xl:rounded-2xl xl:px-4 xl:py-2.5"
      menu-class="z-[260]"
    >
      <template #icon>
        <CalendarIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
      </template>
      <template #selected="{ label }">
        <span class="flex min-w-0 items-center gap-2">
          <CalendarIcon class="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span class="min-w-0 truncate">{{ label }}</span>
        </span>
      </template>
      <template #option="{ option }">
        <span class="flex min-w-0 items-center gap-2">
          <CalendarIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
          <span class="min-w-0 truncate font-medium">{{ option.label }}</span>
        </span>
      </template>
    </BaseSelect>
    <BaseButton
      type="button"
      :disabled="loading"
      class="col-span-2 inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 sm:col-span-1 xl:min-h-11 xl:px-5 xl:py-2.5 xl:text-sm"
      @click="emit('refresh')"
    >
      <ArrowPathIcon class="h-4 w-4 shrink-0" :class="{ 'animate-spin': loading }" aria-hidden="true" />
      {{ loading ? 'Оновлення...' : 'Оновити' }}
    </BaseButton>
  </div>
</template>
