<script setup lang="ts">
type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

const props = withDefaults(defineProps<{
  as?: 'span' | 'div'
  tone?: BadgeTone
  size?: 'sm' | 'md'
  dot?: boolean
  ariaLabel?: string
}>(), {
  as: 'span',
  tone: 'neutral',
  size: 'sm',
})

const toneClass = computed(() => {
  if (props.tone === 'accent') return 'base-badge--accent'
  if (props.tone === 'neutral') return 'ui-status-neutral'
  return `ui-status-${props.tone}`
})

const sizeClass = computed(() => props.size === 'sm'
  ? 'gap-1.5 px-2.5 py-1 text-xs'
  : 'gap-2 px-3 py-1.5 text-sm')
</script>

<template>
  <component
    :is="as"
    class="base-badge"
    :class="[toneClass, sizeClass]"
    :aria-label="ariaLabel"
  >
    <span v-if="dot" class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
    <slot />
  </component>
</template>
