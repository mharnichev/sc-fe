<script setup lang="ts">
defineProps<{
  text: string
}>()

const root = ref<HTMLElement | null>(null)
const pointerInside = ref(false)
const keyboardFocused = ref(false)
let trigger: HTMLElement | null = null

const handleEnter = (event: PointerEvent) => {
  if (event.pointerType !== 'touch') pointerInside.value = true
}
const handleLeave = () => {
  pointerInside.value = false
}
const handleFocus = () => {
  keyboardFocused.value = Boolean(trigger?.matches(':focus-visible'))
}
const handleBlur = (event: FocusEvent) => {
  if (event.relatedTarget instanceof Node && trigger?.contains(event.relatedTarget)) return
  keyboardFocused.value = false
}

onMounted(() => {
  trigger = root.value?.closest<HTMLElement>('a, button') || null
  if (!trigger) return
  trigger.addEventListener('pointerenter', handleEnter)
  trigger.addEventListener('pointerleave', handleLeave)
  trigger.addEventListener('focusin', handleFocus)
  trigger.addEventListener('focusout', handleBlur)
})

onBeforeUnmount(() => {
  trigger?.removeEventListener('pointerenter', handleEnter)
  trigger?.removeEventListener('pointerleave', handleLeave)
  trigger?.removeEventListener('focusin', handleFocus)
  trigger?.removeEventListener('focusout', handleBlur)
})
</script>

<template>
  <span
    ref="root"
    class="base-animated-menu-text"
    :class="{ 'base-animated-menu-text--active': pointerInside || keyboardFocused }"
  >
    <span class="sr-only">{{ text }}</span>
    <span class="base-animated-menu-text__window" aria-hidden="true">
      <span class="base-animated-menu-text__stack">
        <span>{{ text }}</span>
        <span class="base-animated-menu-text__hover">{{ text }}</span>
      </span>
    </span>
  </span>
</template>

<style scoped>
.base-animated-menu-text {
  display: inline-flex;
  line-height: 1.15;
  white-space: nowrap;
}

.base-animated-menu-text__window {
  display: inline-block;
  overflow: hidden;
}

.base-animated-menu-text__stack {
  position: relative;
  display: block;
  transition: transform 420ms cubic-bezier(0.65, 0, 0.85, 0.55);
}

.base-animated-menu-text__hover {
  position: absolute;
  inset: 100% auto auto 0;
}

.base-animated-menu-text--active .base-animated-menu-text__stack {
  transform: translateY(-100%);
}

@media (prefers-reduced-motion: reduce) {
  .base-animated-menu-text__stack,
  .base-animated-menu-text--active .base-animated-menu-text__stack {
    transition: none;
    transform: none;
  }
}
</style>
