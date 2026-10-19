<script setup lang="ts">
defineProps<{
  text: string
}>()

const root = ref<HTMLElement | null>(null)
const label = ref<HTMLElement | null>(null)
const hoverLabel = ref<HTMLElement | null>(null)
let trigger: HTMLElement | null = null
let observer: ResizeObserver | null = null
let motionPreference: MediaQueryList | null = null
let frame: number | null = null
let progress = 0
let height = 36
let pointerInside = false
let keyboardFocused = false

const easeInOut = (value: number) => (1 - Math.cos(Math.PI * value)) / 2

const paint = () => {
  if (!label.value || !hoverLabel.value) return
  const reduced = motionPreference?.matches
  const amount = reduced ? Number(pointerInside || keyboardFocused) : easeInOut(progress)
  label.value.style.transform = `translate3d(0, ${reduced ? 0 : -(height + 8) * amount}px, 0)`
  hoverLabel.value.style.transform = `translate3d(0, ${Math.ceil(height + 100) * (reduced ? 1 : 1 - amount)}px, 0)`
  hoverLabel.value.style.opacity = String(reduced ? 0 : amount)
}

const measure = () => {
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  height = rect.height
  paint()
}

const animate = () => {
  if (frame !== null) cancelAnimationFrame(frame)
  frame = null
  const destination = Number(pointerInside || keyboardFocused)
  if (motionPreference?.matches) {
    progress = destination
    paint()
    return
  }
  const from = progress
  const start = performance.now()
  const duration = 200
  const tick = (now: number) => {
    const elapsed = Math.min(1, (now - start) / duration)
    progress = from + (destination - from) * elapsed
    paint()
    frame = elapsed < 1 ? requestAnimationFrame(tick) : null
  }
  frame = requestAnimationFrame(tick)
}

const handleEnter = (event: PointerEvent) => {
  if (event.pointerType === 'touch') return
  pointerInside = true
  animate()
}
const handleLeave = () => {
  pointerInside = false
  animate()
}
const handleFocus = () => {
  keyboardFocused = Boolean(trigger?.matches(':focus-visible'))
  animate()
}
const handleBlur = (event: FocusEvent) => {
  if (event.relatedTarget instanceof Node && trigger?.contains(event.relatedTarget)) return
  keyboardFocused = false
  animate()
}

onMounted(() => {
  trigger = root.value?.closest<HTMLElement>('a, button') || null
  if (!trigger) return
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  motionPreference.addEventListener('change', animate)
  trigger.addEventListener('pointerenter', handleEnter)
  trigger.addEventListener('pointerleave', handleLeave)
  trigger.addEventListener('focusin', handleFocus)
  trigger.addEventListener('focusout', handleBlur)
  observer = new ResizeObserver(measure)
  observer.observe(trigger)
  measure()
})

onBeforeUnmount(() => {
  if (frame !== null) cancelAnimationFrame(frame)
  observer?.disconnect()
  motionPreference?.removeEventListener('change', animate)
  trigger?.removeEventListener('pointerenter', handleEnter)
  trigger?.removeEventListener('pointerleave', handleLeave)
  trigger?.removeEventListener('focusin', handleFocus)
  trigger?.removeEventListener('focusout', handleBlur)
})
</script>

<template>
  <span ref="root" class="base-animated-menu-text">
    <span class="sr-only">{{ text }}</span>
    <span class="base-animated-menu-text__stack" aria-hidden="true">
      <span ref="label" class="base-animated-menu-text__label">{{ text }}</span>
      <span ref="hoverLabel" class="base-animated-menu-text__hover">{{ text }}</span>
    </span>
  </span>
</template>

<style scoped>
.base-animated-menu-text {
  display: inline-block;
  line-height: 1;
  white-space: nowrap;
}

.base-animated-menu-text__stack,
.base-animated-menu-text__label {
  position: relative;
  display: inline-block;
  z-index: 1;
}

.base-animated-menu-text__hover {
  position: absolute;
  inset: 0 auto auto 0;
  display: inline-block;
  color: inherit;
  opacity: 0;
  transform: translateY(136px);
}

.base-animated-menu-text__label,
.base-animated-menu-text__hover {
  will-change: transform, opacity;
}
</style>
