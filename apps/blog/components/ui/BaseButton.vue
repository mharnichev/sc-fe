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

<style scoped>
.sc-button {
  --sc-button-bg: #0a0a0a;
  --sc-button-text: #ffffff;
  --sc-button-fill: #ffffff;
  --sc-button-hover-text: #0a0a0a;
  --sc-button-border: #0a0a0a;
  --sc-button-fill-y: -76%;
  --sc-button-shadow: none;
  --sc-button-backdrop-filter: none;

  position: relative;
  isolation: isolate;
  display: inline-flex;
  min-width: 0;
  min-height: 3rem;
  align-items: center;
  justify-content: center;
  overflow: visible;
  border: 1px solid var(--sc-button-border);
  border-radius: 0;
  background: var(--sc-button-bg);
  box-shadow: var(--sc-button-shadow);
  -webkit-backdrop-filter: var(--sc-button-backdrop-filter);
  backdrop-filter: var(--sc-button-backdrop-filter);
  color: var(--sc-button-text);
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: 0;
  text-align: center;
  text-transform: uppercase;
  cursor: pointer;
  transition:
    color 420ms cubic-bezier(0.3, 1, 0.3, 1),
    border-color 420ms cubic-bezier(0.3, 1, 0.3, 1),
    background-color 420ms cubic-bezier(0.3, 1, 0.3, 1),
    box-shadow 420ms cubic-bezier(0.3, 1, 0.3, 1),
    opacity 200ms ease;
}

.sc-button--md {
  padding: 0.85rem 1.5rem;
}

.sc-button--xs {
  min-height: 2.25rem;
  padding: 0.55rem 0.85rem;
  font-size: 0.6875rem;
}

.sc-button--sm {
  min-height: 2.5rem;
  padding: 0.65rem 1.05rem;
  font-size: 0.75rem;
}

.sc-button--block {
  width: 100%;
}

.sc-button--light {
  --sc-button-bg: #ffffff;
  --sc-button-text: #0a0a0a;
  --sc-button-fill: #0a0a0a;
  --sc-button-hover-text: #ffffff;
  --sc-button-border: #0a0a0a;
}

.sc-button--outline-dark {
  --sc-button-bg: rgb(255 255 255 / 0.46);
  --sc-button-text: #0a0a0a;
  --sc-button-fill: #0a0a0a;
  --sc-button-hover-text: #ffffff;
  --sc-button-border: rgb(10 10 10 / 0.28);
  --sc-button-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.68),
    inset 0 -1px 0 rgb(10 10 10 / 0.08),
    0 0.65rem 1.85rem rgb(10 10 10 / 0.12);
  --sc-button-backdrop-filter: blur(18px) saturate(1.45);
}

.sc-button--outline-light {
  --sc-button-bg: rgb(255 255 255 / 0.12);
  --sc-button-text: #ffffff;
  --sc-button-fill: #ffffff;
  --sc-button-hover-text: #0a0a0a;
  --sc-button-border: rgb(255 255 255 / 0.34);
  --sc-button-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.24),
    inset 0 -1px 0 rgb(255 255 255 / 0.08),
    0 0.65rem 1.85rem rgb(0 0 0 / 0.2);
  --sc-button-backdrop-filter: blur(18px) saturate(1.45);
}

.sc-button--circle {
  width: 2.75rem;
  min-width: 2.75rem;
  height: 2.75rem;
  min-height: 2.75rem;
  padding: 0;
  border-radius: 9999px;
  font-weight: 900;
  line-height: 1;
}

.sc-button--circle.sc-button--xs {
  width: 2.25rem;
  min-width: 2.25rem;
  height: 2.25rem;
  min-height: 2.25rem;
}

.sc-button--circle.sc-button--sm {
  width: 2.5rem;
  min-width: 2.5rem;
  height: 2.5rem;
  min-height: 2.5rem;
}

.sc-button--disabled,
.sc-button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.sc-button--effect-waves:not(:disabled, .sc-button--disabled) {
  border: 1px solid rgb(115 115 115 / 0.7);
  animation: sc-button-waves 2.1s ease-in-out infinite;
}

.sc-button__surface {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;
}

.sc-button__fill {
  position: absolute;
  top: -50%;
  left: -25%;
  display: block;
  width: 150%;
  height: 200%;
  border-radius: 50%;
  background: var(--sc-button-fill);
  transform: translate3d(0, var(--sc-button-fill-y), 0);
  transition: transform 540ms cubic-bezier(0.3, 1, 0.3, 1);
  will-change: transform;
}

.sc-button__text {
  position: relative;
  z-index: 2;
  display: inline-flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  pointer-events: none;
}

.sc-button__text :deep(svg) {
  width: 1rem;
  height: 1rem;
  flex: 0 0 auto;
}

.sc-button:not(:disabled, .sc-button--disabled):hover,
.sc-button:not(:disabled, .sc-button--disabled):focus-visible {
  --sc-button-fill-y: 0%;

  color: var(--sc-button-hover-text);
}

.sc-button:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .sc-button,
  .sc-button__fill {
    animation: none;
    transition: none;
  }
}

@keyframes sc-button-waves {
  0%,
  100% {
    border-color: rgb(115 115 115 / 0.55);
    box-shadow:
      0 0 0 0 rgb(255 255 255 / 0),
      0 0.45rem 1.25rem rgb(0 0 0 / 0.12);
  }

  50% {
    border-color: rgb(64 64 64 / 0.85);
    box-shadow:
      0 0 0 0.42rem rgb(255 255 255 / 0.24),
      0 0 0 0.72rem rgb(255 255 255 / 0.1),
      0 0.65rem 1.75rem rgb(0 0 0 / 0.2);
  }
}
</style>
