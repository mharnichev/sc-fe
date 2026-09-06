<script setup lang="ts">
import type { SegmentRules, SegmentCondition } from '~/types/segments'
import { defaultCondition, defaultSegmentRules, summarizeRules } from '~/utils/segmentRules.mjs'
import SegmentRuleRow from './SegmentRuleRow.vue'
type Option = { value: number; label: string }
const props = defineProps<{ modelValue: SegmentRules; masters: Option[]; services: Option[]; campaigns: Option[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: SegmentRules] }>()
const updateGroup = (group: 'conditions' | 'exclusions', rules: SegmentCondition[]) => emit('update:modelValue', { ...props.modelValue, [group]: rules })
const update = (group: 'conditions' | 'exclusions', index: number, rule: SegmentCondition) => updateGroup(group, props.modelValue[group].map((item, position) => position === index ? rule : item))
const remove = (group: 'conditions' | 'exclusions', index: number) => updateGroup(group, props.modelValue[group].filter((_, position) => position !== index))
const excludesUpcoming = computed(() => props.modelValue.exclusions.some(rule => rule.type === 'upcoming_booking' && rule.present !== false))
const toggleUpcoming = (value: unknown) => {
  const other = props.modelValue.exclusions.filter(rule => !(rule.type === 'upcoming_booking' && rule.present !== false))
  updateGroup('exclusions', value ? [...other, { type: 'upcoming_booking', present: true }] : other)
}
const summaryLabels = computed(() => ({
  masters: Object.fromEntries(props.masters.map(option => [option.value, option.label])),
  services: Object.fromEntries(props.services.map(option => [option.value, option.label])),
  campaigns: Object.fromEntries(props.campaigns.map(option => [option.value, option.label])),
}))
</script>
<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <BaseSelect :model-value="modelValue.combine" label="Клієнт відповідає" :options="[{value:'all',label:'Усім умовам (І)'},{value:'any',label:'Будь-якій умові (АБО)'}]" @update:model-value="emit('update:modelValue', {...modelValue, combine: $event as 'all' | 'any'})" />
      <BaseButton variant="neutral" @click="emit('update:modelValue', defaultSegmentRules())">Шаблон: останній візит 3–12 місяців тому</BaseButton>
    </div>
    <p class="text-sm text-ui-muted">Враховуються завершені візити та доступна імпортована історія. Невідома історія не означає неактивність. Календарні місяці рахуються за часом Києва, дні — як інтервали по 24 години.</p>
    <SegmentRuleRow v-for="(rule,index) in modelValue.conditions" :key="index" :model-value="rule" :index="index" :masters="masters" :services="services" :campaigns="campaigns" @update:model-value="update('conditions',index,$event)" @remove="remove('conditions',index)" />
    <BaseButton variant="neutral" :disabled="modelValue.conditions.length >= 20" @click="updateGroup('conditions',[...modelValue.conditions, defaultCondition('completed_visit_count')])">Додати умову</BaseButton>
    <div class="space-y-4 border-t border-ui pt-5">
      <h3 class="font-semibold text-ui-primary">Виключення</h3>
      <p class="text-sm text-ui-muted">Збіг із будь-яким виключенням прибирає клієнта, незалежно від умов вище.</p>
      <BaseCheckbox :model-value="excludesUpcoming" :disabled="!excludesUpcoming && modelValue.exclusions.length >= 20" label="Виключити клієнтів із майбутніми записами" @update:model-value="toggleUpcoming" />
      <template v-for="(rule,index) in modelValue.exclusions" :key="index">
        <SegmentRuleRow v-if="!(rule.type === 'upcoming_booking' && rule.present !== false)" :model-value="rule" :index="index" exclusion :masters="masters" :services="services" :campaigns="campaigns" @update:model-value="update('exclusions',index,$event)" @remove="remove('exclusions',index)" />
      </template>
      <BaseButton variant="neutral" :disabled="modelValue.exclusions.length >= 20" @click="updateGroup('exclusions',[...modelValue.exclusions, defaultCondition('marketing_contact')])">Додати виключення</BaseButton>
    </div>
    <BaseCard variant="subtle" padding="sm"><p class="text-sm text-ui-secondary" aria-live="polite">{{ summarizeRules(modelValue, summaryLabels) }}</p></BaseCard>
  </div>
</template>
