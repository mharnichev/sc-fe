<script setup lang="ts">
const iconsCache = new Map<string, string>()

const props = withDefaults(defineProps<{
  name: string
  category?: string
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  label?: string
  effect?: 'none' | 'button' | 'heart'
  variant?: 'dark' | 'light'
}>(), {
  category: 'default',
  size: 'md',
  label: '',
  effect: 'none',
  variant: 'dark',
})

const iconPath = computed(() => `/lehko/icons/${props.category}/${props.name}.svg`)
const svgMarkup = ref('')

const loadIcon = async () => {
  const path = iconPath.value
  if (!import.meta.client) return

  const cached = iconsCache.get(path)
  if (cached) {
    svgMarkup.value = cached
    return
  }

  try {
    const response = await fetch(path)
    if (!response.ok) throw new Error(`Icon not found: ${path}`)
    const svg = await response.text()
    iconsCache.set(path, svg)
    svgMarkup.value = svg
  }
  catch {
    svgMarkup.value = ''
  }
}

watch(iconPath, loadIcon, { immediate: true })
</script>

<template>
  <span
    :class="[
      'base-icon',
      `base-icon--${size}`,
      effect !== 'none' ? `base-icon--effect-${effect}` : '',
      effect === 'button' ? `base-icon--${variant}` : '',
    ]"
    :aria-hidden="label ? undefined : 'true'"
    :aria-label="label || undefined"
  >
    <span v-if="effect === 'button'" class="base-icon__surface" aria-hidden="true">
      <span class="base-icon__fill" />
    </span>
    <span class="base-icon__glyph" v-html="svgMarkup" />
    <span v-if="effect === 'heart'" class="base-icon__heart-fill" aria-hidden="true" v-html="svgMarkup" />
  </span>
</template>

<style scoped>
.base-icon {
  --base-icon-bg: transparent;
  --base-icon-text: currentColor;
  --base-icon-fill: currentColor;
  --base-icon-hover-text: #ffffff;
  --base-icon-fill-y: -76%;

  position: relative;
  isolation: isolate;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--base-icon-bg);
  color: var(--base-icon-text);
  transition:
    color 420ms cubic-bezier(0.3, 1, 0.3, 1),
    background-color 420ms cubic-bezier(0.3, 1, 0.3, 1),
    border-color 420ms cubic-bezier(0.3, 1, 0.3, 1);
}

.base-icon__surface {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;
}

.base-icon__fill {
  position: absolute;
  top: -50%;
  left: -25%;
  display: block;
  width: 150%;
  height: 200%;
  border-radius: 50%;
  background: var(--base-icon-fill);
  transform: translate3d(0, var(--base-icon-fill-y), 0);
  transition: transform 540ms cubic-bezier(0.3, 1, 0.3, 1);
  will-change: transform;
}

.base-icon__glyph {
  position: relative;
  z-index: 1;
  display: block;
  height: 100%;
  width: 100%;
  pointer-events: none;
}

.base-icon__glyph :deep(svg) {
  display: block;
  height: 100%;
  width: 100%;
}

.base-icon__heart-fill {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: block;
  color: #c01818;
  clip-path: inset(100% 0 0);
  pointer-events: none;
  transition: clip-path 540ms cubic-bezier(0.3, 1, 0.3, 1);
  will-change: clip-path;
}

.base-icon__heart-fill :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
  fill: currentColor;
}

.base-icon--effect-heart:hover .base-icon__heart-fill,
.base-icon--effect-heart:focus-visible .base-icon__heart-fill,
button:not(:disabled):hover .base-icon--effect-heart .base-icon__heart-fill,
button:not(:disabled):focus-visible .base-icon--effect-heart .base-icon__heart-fill,
a:not([aria-disabled="true"]):hover .base-icon--effect-heart .base-icon__heart-fill,
a:not([aria-disabled="true"]):focus-visible .base-icon--effect-heart .base-icon__heart-fill {
  clip-path: inset(0);
}

.base-icon--effect-button {
  border-radius: 9999px;
  border: 1px solid var(--base-icon-border, currentColor);
}

.base-icon--dark {
  --base-icon-bg: #0a0a0a;
  --base-icon-text: #ffffff;
  --base-icon-fill: #ffffff;
  --base-icon-hover-text: #0a0a0a;
  --base-icon-border: #0a0a0a;
}

.base-icon--light {
  --base-icon-bg: #ffffff;
  --base-icon-text: #0a0a0a;
  --base-icon-fill: #0a0a0a;
  --base-icon-hover-text: #ffffff;
  --base-icon-border: #0a0a0a;
}

.base-icon--effect-button:hover,
.base-icon--effect-button:focus-visible,
button:not(:disabled):hover .base-icon--effect-button,
button:not(:disabled):focus-visible .base-icon--effect-button,
a:not([aria-disabled="true"]):hover .base-icon--effect-button,
a:not([aria-disabled="true"]):focus-visible .base-icon--effect-button {
  --base-icon-fill-y: 0%;

  color: var(--base-icon-hover-text);
}

.base-icon--xxs {
  height: 1.65rem;
  width: 1.65rem;
}

.base-icon--xs {
  height: 2rem;
  width: 2rem;
}

.base-icon--sm {
  height: 2.35rem;
  width: 2.35rem;
}

.base-icon--md {
  height: 2.75rem;
  width: 2.75rem;
}

.base-icon--lg {
  height: 3.25rem;
  width: 3.25rem;
}

.base-icon--xl {
  height: 4rem;
  width: 4rem;
}

.base-icon:not(.base-icon--effect-button).base-icon--xxs {
  height: 1.125rem;
  width: 1.125rem;
}

.base-icon:not(.base-icon--effect-button).base-icon--xs {
  height: 1.35rem;
  width: 1.35rem;
}

.base-icon:not(.base-icon--effect-button).base-icon--sm {
  height: 1.6rem;
  width: 1.6rem;
}

.base-icon:not(.base-icon--effect-button).base-icon--md {
  height: 2rem;
  width: 2rem;
}

.base-icon:not(.base-icon--effect-button).base-icon--lg {
  height: 2.5rem;
  width: 2.5rem;
}

.base-icon:not(.base-icon--effect-button).base-icon--xl {
  height: 3rem;
  width: 3rem;
}

@media (prefers-reduced-motion: reduce) {
  .base-icon,
  .base-icon__fill,
  .base-icon__heart-fill {
    transition: none;
  }
}
</style>
