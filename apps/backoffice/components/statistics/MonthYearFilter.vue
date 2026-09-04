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
const currentMonth = new Date().getMonth() + 1
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
  <BaseFilterPanel
    padding="sm"
    :loading="loading"
    :active="month !== currentMonth || year !== currentYear"
    :show-clear="false"
    aria-label="Фільтр статистики за місяцем"
    mobile-title="Період статистики"
    mobile-trigger-label="Період"
    apply-label="Оновити"
    fields-class="grid-cols-2 gap-2 xl:gap-3"
    @apply="emit('refresh')"
  >
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
    <template #actions>
      <BaseButton type="button" variant="neutral" :loading="loading" loading-label="Оновлення" @click="emit('refresh')">
        <ArrowPathIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
        Оновити
      </BaseButton>
    </template>
  </BaseFilterPanel>
</template>
