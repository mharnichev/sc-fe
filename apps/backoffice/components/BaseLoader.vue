<script setup lang="ts">
const props = withDefaults(defineProps<{
  as?: string
  label?: string
  labelClass?: string
  size?: 'sm' | 'md' | 'lg'
  inline?: boolean
}>(), {
  as: 'div',
  label: 'Завантаження…',
  size: 'md',
})

const spinnerClass = computed(() => ({
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-9 w-9 border-[3px]',
}[props.size]))
</script>

<template>
  <component
    :is="as"
    class="base-loader flex items-center justify-center gap-3 text-sm"
    :class="inline ? 'inline-flex' : 'min-h-24 w-full px-5 py-8'"
    role="status"
    aria-live="polite"
  >
    <span class="base-loader__spinner animate-spin rounded-full" :class="spinnerClass" aria-hidden="true" />
    <span :class="labelClass">{{ label }}</span>
  </component>
</template>
