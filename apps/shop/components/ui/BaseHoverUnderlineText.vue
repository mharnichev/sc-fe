<script setup lang="ts">
type HoverTrigger = 'parent' | 'self'

interface UnderlineLine {
  key: string
  left: number
  top: number
  width: number
}

const props = withDefaults(defineProps<{
  trigger?: HoverTrigger
  disabled?: boolean
}>(), {
  trigger: 'parent',
  disabled: false,
})

const root = ref<HTMLElement | null>(null)
const content = ref<HTMLElement | null>(null)
const lines = ref<UnderlineLine[]>([])
const isHovered = ref(false)
let hoverTarget: HTMLElement | null = null
let resizeObserver: ResizeObserver | null = null
let mutationObserver: MutationObserver | null = null
let measureFrame: number | null = null

const lineStyle = (line: UnderlineLine) => ({
  left: `${line.left}px`,
  top: `${line.top}px`,
  width: `${line.width}px`,
})

const setHovered = (value: boolean) => {
  if (props.disabled) {
    isHovered.value = false
    return
  }

  isHovered.value = value
  if (value) scheduleMeasure()
}

const resolveHoverTarget = () => {
  const element = root.value
  if (!element || props.trigger === 'self') return element

  const interactiveTarget = element.parentElement?.closest<HTMLElement>('a, button, [role="link"], [role="button"]')
  if (interactiveTarget && interactiveTarget.tagName !== 'BODY') return interactiveTarget

  const parent = element.parentElement
  return parent && parent.tagName !== 'BODY' ? parent : element
}

const detachHoverTarget = () => {
  if (!hoverTarget) return

  hoverTarget.removeEventListener('pointerenter', handlePointerEnter)
  hoverTarget.removeEventListener('pointerleave', handlePointerLeave)
  hoverTarget.removeEventListener('focusin', handleFocusIn)
  hoverTarget.removeEventListener('focusout', handleFocusOut)
  hoverTarget = null
}

const attachHoverTarget = () => {
  detachHoverTarget()

  hoverTarget = resolveHoverTarget()
  if (!hoverTarget) return

  hoverTarget.addEventListener('pointerenter', handlePointerEnter)
  hoverTarget.addEventListener('pointerleave', handlePointerLeave)
  hoverTarget.addEventListener('focusin', handleFocusIn)
  hoverTarget.addEventListener('focusout', handleFocusOut)
}

function handlePointerEnter() {
  setHovered(true)
}

function handlePointerLeave() {
  setHovered(false)
}

function handleFocusIn() {
  setHovered(true)
}

function handleFocusOut(event: FocusEvent) {
  const nextTarget = event.relatedTarget
  if (nextTarget instanceof Node && hoverTarget?.contains(nextTarget)) return

  setHovered(false)
}

const measureLines = () => {
  measureFrame = null

  const rootElement = root.value
  const contentElement = content.value
  if (!rootElement || !contentElement) return

  const range = document.createRange()
  range.selectNodeContents(contentElement)

  const rootRect = rootElement.getBoundingClientRect()
  const rects = Array.from(range.getClientRects())
    .filter(rect => rect.width > 0 && rect.height > 0)
  range.detach()

  const groupedRects = rects.reduce<Array<{ left: number, right: number, bottom: number }>>((groups, rect) => {
    const bottom = Math.round(rect.bottom * 2) / 2
    const group = groups.find(item => Math.abs(item.bottom - bottom) < 3)

    if (group) {
      group.left = Math.min(group.left, rect.left)
      group.right = Math.max(group.right, rect.right)
      group.bottom = Math.max(group.bottom, rect.bottom)
      return groups
    }

    groups.push({ left: rect.left, right: rect.right, bottom: rect.bottom })
    return groups
  }, [])

  lines.value = groupedRects.map((line, index) => ({
    key: `${index}-${Math.round(line.left)}-${Math.round(line.right)}-${Math.round(line.bottom)}`,
    left: Math.max(0, line.left - rootRect.left),
    top: Math.max(0, line.bottom - rootRect.top - 1),
    width: Math.max(0, line.right - line.left),
  }))
}

function scheduleMeasure() {
  if (!import.meta.client) return
  if (measureFrame !== null) window.cancelAnimationFrame(measureFrame)

  measureFrame = window.requestAnimationFrame(measureLines)
}

onMounted(() => {
  if (!import.meta.client) return

  attachHoverTarget()
  scheduleMeasure()

  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(scheduleMeasure)
    if (root.value) resizeObserver.observe(root.value)
    if (content.value) resizeObserver.observe(content.value)
  }

  if ('MutationObserver' in window && content.value) {
    mutationObserver = new MutationObserver(scheduleMeasure)
    mutationObserver.observe(content.value, {
      childList: true,
      characterData: true,
      subtree: true,
    })
  }

  window.addEventListener('resize', scheduleMeasure)
})

onBeforeUnmount(() => {
  if (!import.meta.client) return

  detachHoverTarget()
  resizeObserver?.disconnect()
  mutationObserver?.disconnect()
  window.removeEventListener('resize', scheduleMeasure)

  if (measureFrame !== null) window.cancelAnimationFrame(measureFrame)
})

watch(() => props.trigger, () => {
  if (!import.meta.client) return
  attachHoverTarget()
})

watch(() => props.disabled, (disabled) => {
  if (disabled) isHovered.value = false
})
</script>

<template>
  <span
    ref="root"
    class="base-hover-underline-text"
    :class="{ 'base-hover-underline-text--active': isHovered && !disabled }"
  >
    <span ref="content" class="base-hover-underline-text__content">
      <slot />
    </span>
    <span class="base-hover-underline-text__lines" aria-hidden="true">
      <span
        v-for="line in lines"
        :key="line.key"
        class="base-hover-underline-text__line"
        :style="lineStyle(line)"
      />
    </span>
  </span>
</template>

<style scoped>
.base-hover-underline-text {
  position: relative;
  display: inline-block;
  max-width: 100%;
  vertical-align: baseline;
}

.base-hover-underline-text__content {
  display: inline;
}

.base-hover-underline-text__lines {
  position: absolute;
  inset: 0;
  overflow: visible;
  pointer-events: none;
}

.base-hover-underline-text__line {
  position: absolute;
  height: var(--base-hover-underline-thickness, 1px);
  background: currentColor;
  transform: scaleX(0);
  transform-origin: right center;
  transition: transform 432ms cubic-bezier(0.3, 1, 0.3, 1);
  will-change: transform;
}

.base-hover-underline-text--active .base-hover-underline-text__line {
  transform: scaleX(1);
  transform-origin: left center;
}

@media (prefers-reduced-motion: reduce) {
  .base-hover-underline-text__line {
    transition: none;
  }
}
</style>
