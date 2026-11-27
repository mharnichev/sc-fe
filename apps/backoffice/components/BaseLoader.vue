<script setup lang="ts">
const props = withDefaults(defineProps<{
  as?: string
  label?: string
  labelClass?: string
  size?: 'sm' | 'md' | 'lg'
  inline?: boolean
  overlay?: boolean
  inheritColor?: boolean
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
    :class="[
      overlay ? 'base-loader--overlay absolute inset-0 z-20 rounded-[inherit] p-4' : inline ? 'inline-flex' : 'min-h-24 w-full px-5 py-8',
      inheritColor ? 'base-loader--inherit' : '',
    ]"
    role="status"
    aria-live="polite"
  >
    <span class="base-loader__spinner shrink-0 animate-spin rounded-full motion-reduce:animate-none" :class="spinnerClass" aria-hidden="true" />
    <span :class="labelClass">{{ label }}</span>
  </component>
</template>

<style scoped>
.base-loader--overlay {
  background: color-mix(in srgb, var(--bo-surface) 88%, transparent);
  color: var(--bo-text-primary);
  backdrop-filter: blur(3px);
}
.base-loader--inherit {
  color: inherit;
}
.base-loader--inherit .base-loader__spinner {
  border-color: currentColor;
  border-top-color: transparent;
}
</style>
