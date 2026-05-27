<script setup lang="ts">
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
  <div class="grid gap-3 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
    <label class="grid gap-1.5 text-sm font-medium text-slate-700">
      Місяць
      <select v-model="selectedMonth" class="min-h-11 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900">
        <option v-for="option in monthOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
    </label>
    <label class="grid gap-1.5 text-sm font-medium text-slate-700">
      Рік
      <select v-model="selectedYear" class="min-h-11 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900">
        <option v-for="option in yearOptions" :key="option" :value="option">{{ option }}</option>
      </select>
    </label>
    <button
      type="button"
      :disabled="loading"
      class="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
      @click="emit('refresh')"
    >
      {{ loading ? 'Оновлення...' : 'Оновити' }}
    </button>
  </div>
</template>
