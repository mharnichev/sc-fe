<script setup lang="ts">
const props = withDefaults(defineProps<{
  dateFrom?: string | null
  dateTo?: string | null
  fromLabel?: string
  toLabel?: string
  fromPlaceholder?: string
  toPlaceholder?: string
  min?: string
  max?: string
  disabled?: boolean
  fieldClass?: string
  inputClass?: string
}>(), {
  dateFrom: '',
  dateTo: '',
  fromLabel: 'З',
  toLabel: 'До',
  fromPlaceholder: 'Оберіть дату',
  toPlaceholder: 'Оберіть дату',
})

const emit = defineEmits<{
  'update:dateFrom': [value: string]
  'update:dateTo': [value: string]
}>()
</script>

<template>
  <div class="grid min-w-0 gap-3 md:grid-cols-2">
    <BaseCalendar
      :model-value="props.dateFrom"
      :label="fromLabel"
      :placeholder="fromPlaceholder"
      :min="min"
      :max="dateTo || max"
      :disabled="disabled"
      :field-class="fieldClass"
      :input-class="inputClass || 'w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm'"
      @update:model-value="emit('update:dateFrom', $event)"
    />
    <BaseCalendar
      :model-value="props.dateTo"
      :label="toLabel"
      :placeholder="toPlaceholder"
      :min="dateFrom || min"
      :max="max"
      :disabled="disabled"
      :field-class="fieldClass"
      :input-class="inputClass || 'w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm'"
      @update:model-value="emit('update:dateTo', $event)"
    />
  </div>
</template>
