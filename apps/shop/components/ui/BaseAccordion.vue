<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue?: boolean
  summaryClass?: string
  contentClass?: string
  previewHeight?: number
  disabled?: boolean
}>(), {
  modelValue: false,
  summaryClass: '',
  contentClass: '',
  previewHeight: 0,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const details = ref<HTMLDetailsElement | null>(null)
const summary = ref<HTMLElement | null>(null)
const content = ref<HTMLElement | null>(null)
const nativeOpen = ref(props.modelValue || props.previewHeight > 0)
let animationGeneration = 0
let cleanupTimer: ReturnType<typeof setTimeout> | null = null
let motionPreference: MediaQueryList | undefined
const frames = new Set<number>()
const frame = (callback: () => void) => {
  const id = window.requestAnimationFrame(() => { frames.delete(id); callback() })
  frames.add(id)
}
const collapsedHeight = () => {
  if (!summary.value || !details.value) return 0
  const summaryStyle = getComputedStyle(summary.value)
  const detailsStyle = getComputedStyle(details.value)
  const spacing = [summaryStyle.marginTop, summaryStyle.marginBottom, detailsStyle.paddingTop,
    detailsStyle.paddingBottom, detailsStyle.borderTopWidth, detailsStyle.borderBottomWidth]
    .reduce((total, value) => total + (parseFloat(value) || 0), 0)
  return summary.value.getBoundingClientRect().height + spacing + Math.max(0, props.previewHeight)
}

const timing = {
  heightDuration: 420,
  contentDuration: 260,
  easing: 'cubic-bezier(0.3, 1, 0.3, 1)',
}

const clearAnimation = () => {
  animationGeneration++
  frames.forEach(id => window.cancelAnimationFrame(id))
  frames.clear()
  if (cleanupTimer) window.clearTimeout(cleanupTimer)
  cleanupTimer = null
}

const resetStyles = () => {
  if (!details.value || !content.value) return
  details.value.style.height = ''
  details.value.style.overflow = ''
  details.value.style.transition = ''
  details.value.style.willChange = ''
  content.value.style.opacity = ''
  content.value.style.transform = ''
  content.value.style.transition = ''
  content.value.style.willChange = ''
  if (!props.modelValue && props.previewHeight > 0) {
    details.value.style.height = `${collapsedHeight()}px`
    details.value.style.overflow = 'hidden'
  }
}

const setOpen = (open: boolean) => {
  if (!details.value) return
  nativeOpen.value = open || props.previewHeight > 0
  details.value.open = nativeOpen.value
  details.value.setAttribute('aria-expanded', open ? 'true' : 'false')
}

const animate = (open: boolean) => {
  if (!details.value || !summary.value || !content.value) return
  clearAnimation()

  const generation = animationGeneration
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setOpen(open)
    resetStyles()
    return
  }

  const startHeight = details.value.getBoundingClientRect().height
  details.value.style.overflow = 'hidden'
  details.value.style.height = `${startHeight}px`
  details.value.style.willChange = 'height'
  details.value.style.transition = 'none'
  content.value.style.transition = 'none'
  content.value.style.willChange = 'opacity, transform'

  if (open) {
    setOpen(true)
    content.value.style.opacity = props.previewHeight > 0 ? '1' : '0'
    content.value.style.transform = props.previewHeight > 0 ? 'translateY(0)' : 'translateY(12px)'
  }
  else {
    details.value.setAttribute('aria-expanded', 'false')
  }

  let endHeight = collapsedHeight()
  if (open) {
    details.value.style.height = 'auto'
    endHeight = details.value.getBoundingClientRect().height
    details.value.style.height = `${startHeight}px`
  }

  details.value.getBoundingClientRect()
  frame(() => {
    frame(() => {
      if (generation !== animationGeneration || !details.value || !content.value) return
      details.value.style.transition = `height ${timing.heightDuration}ms ${timing.easing}`
      content.value.style.transition = `opacity ${timing.contentDuration}ms ${timing.easing} 80ms, transform ${timing.contentDuration}ms ${timing.easing} 80ms`
      details.value.style.height = `${endHeight}px`
      content.value.style.opacity = open || props.previewHeight > 0 ? '1' : '0'
      content.value.style.transform = open || props.previewHeight > 0 ? 'translateY(0)' : 'translateY(8px)'
    })
  })

  cleanupTimer = window.setTimeout(() => {
    if (generation !== animationGeneration) return
    setOpen(open)
    resetStyles()
    cleanupTimer = null
  }, timing.heightDuration + 140)
}

const handleSummaryClick = (event: MouseEvent) => {
  event.preventDefault()
  if (!props.disabled) emit('update:modelValue', !props.modelValue)
}

watch(() => props.modelValue, (open) => {
  animate(open)
}, { flush: 'post' })

watch(() => [props.previewHeight, props.disabled], () => {
  clearAnimation()
  setOpen(props.modelValue)
  resetStyles()
}, { flush: 'post' })
const handleMotionChange = () => {
  if (!motionPreference?.matches) return
  clearAnimation()
  setOpen(props.modelValue)
  resetStyles()
}
onMounted(() => {
  setOpen(props.modelValue)
  resetStyles()
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  motionPreference.addEventListener('change', handleMotionChange)
})
onBeforeUnmount(() => {
  clearAnimation()
  motionPreference?.removeEventListener('change', handleMotionChange)
})
</script>

<template>
  <details ref="details" class="base-accordion" :open="nativeOpen">
    <summary ref="summary" class="base-accordion__summary" :class="summaryClass" :aria-disabled="disabled || undefined" :tabindex="disabled ? -1 : undefined" :aria-expanded="modelValue" @click="handleSummaryClick">
      <span class="min-w-0 flex-1">
        <slot name="summary" :open="modelValue" />
      </span>
      <svg class="base-accordion__icon h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="m5 7.5 5 5 5-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </summary>
    <div ref="content" :class="contentClass" :inert="!modelValue && previewHeight > 0">
      <slot />
    </div>
  </details>
</template>

<style scoped>
.base-accordion__summary {
  display: flex;
  align-items: center;
  gap: .5rem;
  cursor: pointer;
  list-style: none;
}

.base-accordion__summary::-webkit-details-marker {
  display: none;
}

.base-accordion__summary[aria-disabled="true"] { cursor: default; }
.base-accordion__summary[aria-disabled="true"] .base-accordion__icon { display: none; }
.base-accordion__summary[aria-expanded="false"] .base-accordion__icon { transform: none; }

.base-accordion__summary:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 3px;
}

.base-accordion__icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  transition: transform 500ms cubic-bezier(0.3, 1, 0.3, 1);
}

.base-accordion__summary[aria-expanded="true"] .base-accordion__icon {
  transform: rotate(180deg);
}

@media (prefers-reduced-motion: reduce) {
  .base-accordion__icon {
    transition: none;
  }
}
</style>
