<script setup lang="ts">
import { UserCircleIcon } from '@heroicons/vue/24/outline'
import { initials } from '@shared-utils'
import type { Master } from '~/composables/useBackofficeApi'
import type { BaseSelectValue } from './BaseSelect.vue'

const props = withDefaults(defineProps<{
  modelValue?: string | number | null
  masters?: Master[]
  label?: string
  ariaLabel?: string
  hint?: string
  error?: string
  placeholder?: string
  allLabel?: string
  valueType?: 'string' | 'number'
  required?: boolean
  disabled?: boolean
  compact?: boolean
  fieldClass?: string
  triggerClass?: string
  menuClass?: string
}>(), {
  masters: () => [],
  placeholder: 'Оберіть майстра',
  allLabel: '',
  valueType: 'string',
  compact: false,
  menuClass: 'z-[220]',
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number | null]
}>()

const assetUrl = useAssetUrl()
const { masterName } = useBookingFormatting()

const emptyLabel = computed(() => props.allLabel || props.placeholder)
const asMaster = (value: unknown) => (value && typeof value === 'object' ? value as Master : null)

const masterDisplayName = (value?: unknown) => {
  const master = asMaster(value)
  if (!master) return emptyLabel.value
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

const optionValue = (master: Master): BaseSelectValue =>
  props.valueType === 'number' ? Number(master.id) : String(master.id)

const masterOptions = computed(() => [
  ...(props.allLabel
    ? [{ value: props.valueType === 'number' ? null : '', label: props.allLabel, meta: null }]
    : []),
  ...props.masters.map(master => ({
    value: optionValue(master),
    label: masterDisplayName(master),
    meta: master,
  })),
])

const selectedMaster = computed(() =>
  props.masters.find(master => String(master.id) === String(props.modelValue ?? '')) || null,
)

const emitValue = (value: BaseSelectValue) => {
  emit('update:modelValue', props.valueType === 'number' ? (value === '' || value === null ? null : Number(value)) : String(value ?? ''))
}
</script>

<template>
  <BaseSelect
    :model-value="modelValue"
    :options="masterOptions"
    :label="label"
    :aria-label="ariaLabel"
    :hint="hint"
    :error="error"
    :placeholder="placeholder"
    :required="required"
    :disabled="disabled"
    :field-class="fieldClass"
    :trigger-class="triggerClass"
    :menu-class="menuClass"
    @update:model-value="emitValue"
  >
    <template v-if="$slots.icon" #icon>
      <slot name="icon" />
    </template>
    <template v-if="$slots.label" #label>
      <slot name="label" />
    </template>

    <template #selected>
      <span class="flex min-w-0 items-center" :class="compact ? 'gap-2' : 'gap-3'">
        <span
          class="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 font-semibold text-slate-600"
          :class="compact ? 'h-6 w-6 text-[0.65rem] ring-1 ring-slate-200' : 'h-8 w-8 text-xs'"
        >
          <img v-if="masterImageUrl(selectedMaster)" :src="masterImageUrl(selectedMaster)" :alt="masterDisplayName(selectedMaster)" class="h-full w-full object-cover">
          <span v-else-if="selectedMaster">{{ masterInitials(selectedMaster) }}</span>
          <UserCircleIcon v-else class="h-4 w-4" aria-hidden="true" />
        </span>
        <span v-if="compact" class="min-w-0 truncate font-medium text-slate-900">{{ masterDisplayName(selectedMaster) }}</span>
        <span v-else class="min-w-0">
          <span class="block truncate font-medium text-slate-900">{{ masterDisplayName(selectedMaster) }}</span>
          <span v-if="selectedMaster?.position_uk" class="block truncate text-xs text-slate-500">{{ selectedMaster.position_uk }}</span>
        </span>
      </span>
    </template>

    <template #option="{ option }">
      <span class="flex min-w-0 items-center gap-3">
        <span class="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
          <img v-if="masterImageUrl(option.meta)" :src="masterImageUrl(option.meta)" :alt="masterDisplayName(option.meta)" class="h-full w-full object-cover">
          <span v-else-if="option.meta">{{ masterInitials(option.meta) }}</span>
          <UserCircleIcon v-else class="h-4 w-4" aria-hidden="true" />
        </span>
        <span class="min-w-0">
          <span class="block truncate font-medium">{{ option.label }}</span>
          <span v-if="option.meta?.position_uk" class="block truncate text-xs text-slate-500">{{ option.meta.position_uk }}</span>
        </span>
      </span>
    </template>
  </BaseSelect>
</template>
