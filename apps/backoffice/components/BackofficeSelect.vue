<script setup lang="ts">
import type { BaseSelectOption, BaseSelectValue } from './BaseSelect.vue'

defineProps<{
  modelValue?: BaseSelectValue
  options: BaseSelectOption[]
  disabled?: boolean
  placeholder?: string
  menuClass?: string
  ariaLabel?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: BaseSelectValue]
}>()
</script>

<template>
  <BaseSelect
    :model-value="modelValue"
    :options="options"
    :disabled="disabled"
    :placeholder="placeholder"
    :menu-class="menuClass"
    :aria-label="ariaLabel"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
