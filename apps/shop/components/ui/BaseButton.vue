<template>
  <component
    :is="componentTag"
    v-bind="{ ...componentProps, ...attrs }"
    :class="buttonClass"
  >
    <span class="sc-button__surface" aria-hidden="true">
      <span class="sc-button__fill" />
    </span>
    <span class="sc-button__text">
      <slot />
    </span>
  </component>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { computed, resolveComponent, useAttrs } from 'vue'

const attrs = useAttrs()
const nuxtLink = resolveComponent('NuxtLink')

const props = withDefaults(defineProps<{
  to?: RouteLocationRaw
  href?: string
  target?: string
  rel?: string
  type?: 'button' | 'submit' | 'reset'
  variant?: 'dark' | 'light' | 'outline-dark' | 'outline-light'
  size?: 'xs' | 'sm' | 'md'
  shape?: 'default' | 'circle'
  effect?: 'none' | 'waves'
  disabled?: boolean
  block?: boolean
}>(), {
  type: 'button',
  variant: 'dark',
  size: 'md',
  shape: 'default',
  effect: 'none',
  disabled: false,
  block: false,
})

defineOptions({
  inheritAttrs: false,
})

const isNativeButton = computed(() => !props.to && !props.href)

const componentTag = computed(() => {
  if (props.to) return nuxtLink
  if (props.href) return 'a'
  return 'button'
})

const componentProps = computed(() => {
  if (props.to) {
    return {
      to: props.to,
      target: props.target,
      rel: props.rel,
      'aria-disabled': props.disabled ? 'true' : undefined,
      tabindex: props.disabled ? -1 : undefined,
    }
  }

  if (props.href) {
    return {
      href: props.disabled ? undefined : props.href,
      target: props.target,
      rel: props.rel ?? (props.target === '_blank' ? 'noopener noreferrer' : undefined),
      'aria-disabled': props.disabled ? 'true' : undefined,
      tabindex: props.disabled ? -1 : undefined,
    }
  }

  return {
    type: props.type,
    disabled: props.disabled,
  }
})

const buttonClass = computed(() => [
  'sc-button',
  `sc-button--${props.variant}`,
  `sc-button--${props.size}`,
  props.shape !== 'default' ? `sc-button--${props.shape}` : '',
  props.effect !== 'none' ? `sc-button--effect-${props.effect}` : '',
  props.block ? 'sc-button--block' : '',
  props.disabled && !isNativeButton.value ? 'sc-button--disabled' : '',
])
</script>
