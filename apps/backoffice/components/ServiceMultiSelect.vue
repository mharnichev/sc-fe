<script setup lang="ts">
import type { BaseMultiSelectOption, BaseMultiSelectValue } from './BaseMultiSelect.vue'

interface ServiceMultiSelectOption {
  id: number | string
  name: string
  title_uk?: string | null
  title_en?: string | null
  description?: string | null
  description_uk?: string | null
  description_en?: string | null
  duration_minutes: number
  price: string | number
}

const props = withDefaults(defineProps<{
  modelValue: string[]
  services: ServiceMultiSelectOption[]
  placeholder?: string
  maxSelected?: number
  showLimit?: boolean
  showSelectedChips?: boolean
  disabled?: boolean
}>(), {
  placeholder: 'Пошук послуг',
  maxSelected: 5,
  showLimit: true,
  showSelectedChips: true,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const { serviceName, formatDuration, formatPrice } = useBookingFormatting()

const asService = (value: unknown) => (value && typeof value === 'object' ? value as ServiceMultiSelectOption : null)

const options = computed<BaseMultiSelectOption[]>(() =>
  props.services.map(service => ({
    value: String(service.id),
    label: serviceName(service),
    description: `${formatDuration(service.duration_minutes)} · ${formatPrice(service.price)}`,
    searchText: [
      serviceName(service),
      service.title_en,
      service.description,
      service.description_uk,
      service.description_en,
      service.price,
      service.duration_minutes,
    ].filter(Boolean).join(' '),
    meta: service,
  })),
)

const selectedServices = computed(() => {
  const selectedSet = new Set(props.modelValue.map(String))
  return props.services.filter(service => selectedSet.has(String(service.id)))
})

const selectedDuration = computed(() =>
  selectedServices.value.reduce((total, service) => total + Number(service.duration_minutes || 0), 0),
)

const selectedPrice = computed(() =>
  selectedServices.value.reduce((total, service) => total + Number(service.price || 0), 0),
)

const setValue = (value: BaseMultiSelectValue[]) => {
  emit('update:modelValue', [...new Set(value.map(String))])
}
</script>

<template>
  <BaseMultiSelect
    :model-value="modelValue"
    :options="options"
    placeholder="Виберіть послуги"
    :search-placeholder="placeholder"
    empty-label="Послуг не знайдено."
    :max-selected="maxSelected"
    :show-limit="showLimit"
    :show-selected-chips="showSelectedChips"
    :disabled="disabled"
    @update:model-value="setValue"
  >
    <template #summary="{ selectedOptions }">
      {{ selectedOptions.length }}<template v-if="showLimit">/{{ maxSelected }}</template> посл. · {{ formatDuration(selectedDuration) }} · {{ formatPrice(selectedPrice) }}
    </template>

    <template #chip="{ option }">
      <span class="min-w-0 truncate">{{ option.label }}</span>
    </template>

    <template #option="{ option }">
      <span class="min-w-0 flex-1">
        <span class="block font-medium text-slate-900">{{ option.label }}</span>
        <span class="block text-xs text-slate-500">
          {{ formatDuration(asService(option.meta)?.duration_minutes || 0) }} · {{ formatPrice(asService(option.meta)?.price || 0) }}
        </span>
      </span>
    </template>
  </BaseMultiSelect>
</template>
