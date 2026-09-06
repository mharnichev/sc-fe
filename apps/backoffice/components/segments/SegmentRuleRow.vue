<script setup lang="ts">
import type { SegmentCondition } from '~/types/segments'
import { defaultCondition, defaultPeriod, periodUnits, ruleTypes, summarizeCondition } from '~/utils/segmentRules.mjs'
import SegmentPeriodEditor from './SegmentPeriodEditor.vue'
type Option = { value: number; label: string }
const props = defineProps<{ modelValue: SegmentCondition; index: number; exclusion?: boolean; masters: Option[]; services: Option[]; campaigns: Option[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: SegmentCondition]; remove: [] }>()
const rule = computed(() => props.modelValue as SegmentCondition & Record<string, any>)
const patch = (key: string, value: unknown) => emit('update:modelValue', { ...props.modelValue, [key]: value } as SegmentCondition)
const changeType = (value: unknown) => emit('update:modelValue', defaultCondition(String(value)))
const changeMasterMode = (value: unknown) => {
  const next: Record<string, any> = { ...rule.value, mode: value }
  if (value === 'within_period') next.period = defaultPeriod()
  else delete next.period
  emit('update:modelValue', next as SegmentCondition)
}
const idsKey = computed(() => rule.value.type === 'visited_master' ? 'master_ids' : 'service_ids')
const options = computed(() => rule.value.type === 'visited_master' ? props.masters : props.services)
const selectedIds = computed<number[]>(() => rule.value[idsKey.value] || [])
const addId = (value: unknown) => {
  const id = Number(value)
  if (id > 0 && !selectedIds.value.includes(id)) patch(idsKey.value, [...selectedIds.value, id])
}
const removeId = (id: number) => patch(idsKey.value, selectedIds.value.filter(value => value !== id))
const optionalPeriod = computed(() => ['completed_visit_count', 'received_campaign'].includes(rule.value.type))
const summaryLabels = computed(() => ({
  masters: Object.fromEntries(props.masters.map(option => [option.value, option.label])),
  services: Object.fromEntries(props.services.map(option => [option.value, option.label])),
  campaigns: Object.fromEntries(props.campaigns.map(option => [option.value, option.label])),
}))
</script>
<template>
  <fieldset class="space-y-4 rounded-2xl border border-ui p-4">
    <legend class="px-2 text-sm font-medium text-ui-secondary">{{ exclusion ? 'Виключення' : 'Умова' }} {{ index + 1 }}</legend>
    <div class="flex items-end gap-3">
      <BaseSelect :model-value="rule.type" label="Параметр" :options="ruleTypes" class="min-w-0 flex-1" @update:model-value="changeType" />
      <BaseButton variant="danger-outline" :aria-label="`Видалити ${exclusion ? 'виключення' : 'умову'} ${index + 1}`" @click="emit('remove')">Видалити</BaseButton>
    </div>
    <div v-if="['last_visit_age', 'completed_visit_count'].includes(rule.type)" class="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <BaseInput :model-value="rule.min" type="number" label="Нижня межа (необов’язково)" :min="0" @update:model-value="patch('min', $event)" />
      <BaseInput :model-value="rule.max" type="number" label="Верхня межа (необов’язково)" :min="0" @update:model-value="patch('max', $event)" />
      <BaseSelect v-if="rule.type === 'last_visit_age'" :model-value="rule.unit" label="Одиниця часу" :options="periodUnits" @update:model-value="patch('unit', $event)" />
      <template v-if="rule.type === 'last_visit_age'">
        <BaseSelect :model-value="rule.min_inclusive ?? false" label="Нижня межа" :options="[{value:false,label:'Більше ніж (>)'},{value:true,label:'Не менше ніж (≥)'}]" @update:model-value="patch('min_inclusive', $event)" />
        <BaseSelect :model-value="rule.max_inclusive ?? true" label="Верхня межа" :options="[{value:true,label:'Не більше ніж (≤)'},{value:false,label:'Менше ніж (<)'}]" @update:model-value="patch('max_inclusive', $event)" />
      </template>
      <p v-else class="text-sm text-ui-muted">Обидві межі включні. Рахуються завершені записи в системі.</p>
    </div>
    <BaseSelect v-if="['upcoming_booking','marketing_contact'].includes(rule.type)" :model-value="rule.present ?? true" label="Наявність" :options="[{value:true,label:'Є'},{value:false,label:'Немає'}]" @update:model-value="patch('present', $event)" />
    <BaseSelect v-if="rule.type === 'visited_master'" :model-value="rule.mode" label="Який візит" :options="[{value:'last',label:'Останній відомий майстер'},{value:'within_period',label:'Відвідано протягом періоду'}]" @update:model-value="changeMasterMode" />
    <div v-if="['visited_master','received_service'].includes(rule.type)" class="space-y-3">
      <BaseSelect :model-value="null" :label="rule.type === 'visited_master' ? 'Додати майстра' : 'Додати послугу'" :disabled="selectedIds.length >= 50" :options="options.filter(option => !selectedIds.includes(option.value))" @update:model-value="addId" />
      <div class="flex flex-wrap gap-2">
        <BaseButton v-for="id in selectedIds" :key="id" variant="neutral" size="sm" :aria-label="`Прибрати ${options.find(option => option.value === id)?.label || '#' + id}`" @click="removeId(id)">{{ options.find(option => option.value === id)?.label || '#' + id }} ×</BaseButton>
      </div>
      <p v-if="!options.length" class="text-sm text-ui-muted">Довідник порожній або ще завантажується.</p>
    </div>
    <BaseSelect v-if="rule.type === 'received_campaign'" :model-value="rule.campaign_id" label="Кампанія" :options="campaigns.some(option => option.value === rule.campaign_id) || !rule.campaign_id ? campaigns : [{value:rule.campaign_id,label:`Кампанія #${rule.campaign_id}`}, ...campaigns]" @update:model-value="patch('campaign_id', $event)" />
    <BaseCheckbox v-if="optionalPeriod" :model-value="Boolean(rule.period)" label="Обмежити періодом" @update:model-value="patch('period', $event ? defaultPeriod() : null)" />
    <SegmentPeriodEditor v-if="rule.period" :model-value="rule.period" @update:model-value="patch('period', $event)" />
    <p class="text-sm text-ui-secondary">{{ summarizeCondition(modelValue, summaryLabels) }}</p>
  </fieldset>
</template>
