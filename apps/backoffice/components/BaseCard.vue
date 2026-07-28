<script setup lang="ts">
const props = withDefaults(defineProps<{
  as?: 'div' | 'section' | 'article' | 'aside'
  variant?: 'surface' | 'elevated' | 'subtle'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  interactive?: boolean
}>(), {
  as: 'div',
  variant: 'surface',
  padding: 'md',
})

const paddingClass = computed(() => ({
  none: '',
  sm: 'p-3 sm:p-4',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
}[props.padding]))
</script>

<template>
  <component
    :is="as"
    class="base-card rounded-[1.5rem]"
    :class="[
      variant === 'surface' ? '' : `base-card--${variant}`,
      interactive ? 'base-card--interactive' : '',
      paddingClass,
    ]"
  >
    <slot />
  </component>
</template>
