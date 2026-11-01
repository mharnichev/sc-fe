<template>
  <component
    :is="componentTag"
    v-bind="buttonAttrs()"
    :class="buttonClass"
  >
    <span class="sc-button__surface" aria-hidden="true">
      <span class="sc-button__fill" />
    </span>
    <span v-if="loading" class="sc-button__spinner" aria-hidden="true" />
    <span class="sc-button__text">
      <slot />
    </span>
  </component>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { computed, mergeProps, resolveComponent, useAttrs } from 'vue'

const attrs = useAttrs()
const nuxtLink = resolveComponent('NuxtLink')

const props = withDefaults(defineProps<{
  to?: RouteLocationRaw
  href?: string
  target?: string
  rel?: string
  type?: 'button' | 'submit' | 'reset'
  variant?: 'dark' | 'light' | 'outline-dark' | 'outline-light' | 'borderless' | 'text'
  size?: 'xs' | 'sm' | 'md'
  shape?: 'default' | 'circle' | 'pill'
  effect?: 'none' | 'waves'
  disabled?: boolean
  loading?: boolean
  block?: boolean
}>(), {
  type: 'button',
  variant: 'dark',
  size: 'md',
  shape: 'default',
  effect: 'none',
  disabled: false,
  loading: false,
  block: false,
})

defineOptions({
  inheritAttrs: false,
})

const isNativeButton = computed(() => !props.to && !props.href)
const isDisabled = computed(() => props.disabled || props.loading)

const componentTag = computed(() => {
  if (props.to) return isDisabled.value ? 'a' : nuxtLink
  if (props.href) return 'a'
  return 'button'
})

const componentProps = () => {
  if (props.to) {
    return {
      to: isDisabled.value ? undefined : props.to,
      href: undefined,
      role: isDisabled.value ? 'link' : attrs.role,
      target: props.target,
      rel: props.rel,
      'aria-disabled': isDisabled.value ? 'true' : attrs['aria-disabled'],
      tabindex: isDisabled.value ? -1 : attrs.tabindex,
    }
  }

  if (props.href) {
    return {
      href: isDisabled.value ? undefined : props.href,
      role: isDisabled.value ? 'link' : attrs.role,
      target: props.target,
      rel: props.rel ?? (props.target === '_blank' ? 'noopener noreferrer' : undefined),
      'aria-disabled': isDisabled.value ? 'true' : attrs['aria-disabled'],
      tabindex: isDisabled.value ? -1 : attrs.tabindex,
    }
  }

  return {
    type: props.type,
    disabled: isDisabled.value,
  }
}

// Capture before caller listeners or router handlers, including synthetic DOM clicks.
const activationGuard = (event: Event) => {
  if (isDisabled.value) {
    event.preventDefault()
    event.stopImmediatePropagation()
  }
}
const keyboardGuard = (event: KeyboardEvent) => {
  if (['Enter', ' '].includes(event.key)) activationGuard(event)
}
const buttonAttrs = () => mergeProps({
  onClickCapture: activationGuard,
  onAuxclickCapture: activationGuard,
  onDblclickCapture: activationGuard,
  onKeydownCapture: keyboardGuard,
  onKeyupCapture: keyboardGuard,
  onKeypressCapture: keyboardGuard,
}, attrs, componentProps(), {
  ...(isDisabled.value ? { 'aria-disabled': 'true', tabindex: -1 } : {}),
  'aria-busy': props.loading ? 'true' : attrs['aria-busy'],
})

const buttonClass = computed(() => [
  'sc-button',
  props.loading ? 'sc-button--loading' : '',
  `sc-button--${props.variant}`,
  `sc-button--${props.size}`,
  props.shape !== 'default' ? `sc-button--${props.shape}` : '',
  props.effect !== 'none' ? `sc-button--effect-${props.effect}` : '',
  props.block ? 'sc-button--block' : '',
  isDisabled.value && !isNativeButton.value ? 'sc-button--disabled' : '',
])
</script>

<style scoped>
.sc-button--loading .sc-button__text {
  opacity: 0;
}

.sc-button__spinner {
  position: absolute;
  inset: 0;
  z-index: 3;
  width: 1rem;
  height: 1rem;
  margin: auto;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  pointer-events: none;
  animation: sc-button-spin 700ms linear infinite;
}

@keyframes sc-button-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .sc-button__spinner { animation: none; }
}
</style>
