<script setup lang="ts">
import { initials } from '@shared-utils'
import type { Master } from '~/composables/useBackofficeApi'
import type { BaseMultiSelectOption, BaseMultiSelectValue } from './BaseMultiSelect.vue'

const props = withDefaults(defineProps<{
  modelValue: number[]
  masters: Master[]
  placeholder?: string
  disabled?: boolean
}>(), {
  placeholder: 'Пошук майстрів',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: number[]]
}>()

const assetUrl = useAssetUrl()
const { masterName } = useBookingFormatting()

const asMaster = (value: unknown) => (value && typeof value === 'object' ? value as Master : null)

const masterDisplayName = (value?: unknown) => {
  const master = asMaster(value)
  if (!master) return 'Майстра не вибрано'
  const firstName = master.first_name_uk || master.name || ''
  const lastName = master.last_name_uk || master.last_name || ''
  const explicitName = [firstName, lastName].filter(Boolean).join(' ')
  return explicitName || master.full_name_uk || master.full_name || masterName(master)
}

const masterImageUrl = (value?: unknown) => {
  const master = asMaster(value)
  return master ? assetUrl(master.avatar || master.avatar_url || master.photo || master.photo_url) : ''
}

const masterInitials = (value?: unknown) => initials(masterDisplayName(value)) || 'SC'

const options = computed<BaseMultiSelectOption[]>(() =>
  props.masters.map(master => ({
    value: Number(master.id),
    label: masterDisplayName(master),
    description: master.position_uk,
    searchText: [
      masterDisplayName(master),
      master.full_name,
      master.full_name_uk,
      master.full_name_en,
      master.position_uk,
      master.position_en,
      master.email,
      master.phone,
    ].filter(Boolean).join(' '),
    meta: master,
  })),
)

const setValue = (value: BaseMultiSelectValue[]) => {
  emit('update:modelValue', [...new Set(value.map(Number).filter(Number.isFinite))])
}
</script>

<template>
  <BaseMultiSelect
    :model-value="modelValue"
    :options="options"
    placeholder="Виберіть майстрів"
    :search-placeholder="placeholder"
    empty-label="Майстрів не знайдено."
    :disabled="disabled"
    :show-selected-chips="false"
    @update:model-value="setValue"
  >
    <template #summary="{ selectedOptions }">
      {{ selectedOptions.length }} майстр.
    </template>

    <template #option="{ option }">
      <span class="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
        <img v-if="masterImageUrl(option.meta)" :src="masterImageUrl(option.meta)" :alt="masterDisplayName(option.meta)" class="h-full w-full object-cover">
        <span v-else>{{ masterInitials(option.meta) }}</span>
      </span>
      <span class="min-w-0 flex-1">
        <span class="block font-medium text-slate-900">{{ option.label }}</span>
        <span v-if="option.description" class="block truncate text-xs text-slate-500">{{ option.description }}</span>
      </span>
    </template>
  </BaseMultiSelect>
</template>
