<script setup lang="ts">
import type { SegmentPeriod } from '~/types/segments'
import { defaultPeriod, periodUnits } from '~/utils/segmentRules.mjs'
const props = defineProps<{ modelValue: SegmentPeriod }>()
const emit = defineEmits<{ 'update:modelValue': [value: SegmentPeriod] }>()
const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
const localDateTime = (value?: string | null) => {
  if (!value || !Number.isFinite(Date.parse(value))) return ''
  const date = new Date(value)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
const patchDate = (key: string, value: string) => {
  const parsed = new Date(value)
  patch(key, value && Number.isFinite(parsed.getTime()) ? parsed.toISOString() : '')
}
const relative = computed(() => props.modelValue.last != null)
const changeMode = (value: unknown) => emit('update:modelValue', value === 'relative' ? defaultPeriod() : { start: '', end: '' })
const patch = (key: string, value: unknown) => emit('update:modelValue', { ...props.modelValue, [key]: value } as SegmentPeriod)
</script>
<template>
  <div class="grid gap-3 sm:grid-cols-3">
    <BaseSelect :model-value="relative ? 'relative' : 'absolute'" label="Період" :options="[{value:'relative',label:'Від дати оцінки назад'},{value:'absolute',label:'Конкретні дати'}]" @update:model-value="changeMode" />
    <template v-if="relative">
      <BaseInput :model-value="modelValue.last" type="number" label="За останні" :min="1" :max="modelValue.unit === 'calendar_months' ? 120 : 3660" @update:model-value="patch('last', $event)" />
      <BaseSelect :model-value="modelValue.unit" label="Одиниця періоду" :options="periodUnits" @update:model-value="patch('unit', $event)" />
    </template>
    <template v-else>
      <BaseCalendar :model-value="localDateTime(modelValue.start)" mode="datetime" label="Початок включно" :hint="`Час пристрою: ${deviceTimezone}`" @update:model-value="patchDate('start', $event)" />
      <BaseCalendar :model-value="localDateTime(modelValue.end)" mode="datetime" label="Кінець невключно" :hint="`Час пристрою: ${deviceTimezone}`" @update:model-value="patchDate('end', $event)" />
    </template>
  </div>
</template>
