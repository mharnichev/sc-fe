<script setup lang="ts">
import type { Component } from 'vue'

export type BaseSegmentedValue = string | number | boolean
export interface BaseSegmentedOption {
  value: BaseSegmentedValue
  label: string
  description?: string
  icon?: Component
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  modelValue?: BaseSegmentedValue | null
  options: BaseSegmentedOption[]
  ariaLabel?: string
  containerClass?: string
  optionClass?: string
  activeClass?: string
  inactiveClass?: string
}>(), {
  containerClass: 'grid gap-1 rounded-xl bg-ui-subtle p-1',
  optionClass: 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
  activeClass: 'bg-ui-elevated text-ui-primary shadow-sm',
  inactiveClass: 'text-ui-secondary',
})

const emit = defineEmits<{
  'update:modelValue': [value: BaseSegmentedValue]
}>()
</script>

<template>
  <div class="base-segmented-control" :class="containerClass" role="radiogroup" :aria-label="ariaLabel">
    <BaseButton
      v-for="option in options"
      :key="String(option.value)"
      type="button"
      variant="unstyled"
      :disabled="option.disabled"
      :class="['base-segmented-option', modelValue === option.value ? 'is-active' : 'is-inactive', optionClass, modelValue === option.value ? activeClass : inactiveClass]"
      role="radio"
      :aria-checked="modelValue === option.value"
      @click="emit('update:modelValue', option.value)"
    >
      <slot name="option" :option="option" :active="modelValue === option.value">
        <component :is="option.icon" v-if="option.icon" class="h-4 w-4" aria-hidden="true" />
        <span class="min-w-0">
          <span class="block truncate">{{ option.label }}</span>
          <span v-if="option.description" class="block truncate text-[11px] opacity-75">{{ option.description }}</span>
        </span>
      </slot>
    </BaseButton>
  </div>
</template>
