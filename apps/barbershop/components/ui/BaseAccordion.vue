<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue?: boolean
  summaryClass?: string
  contentClass?: string
}>(), {
  modelValue: false,
  summaryClass: '',
  contentClass: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const details = ref<HTMLDetailsElement | null>(null)
const summary = ref<HTMLElement | null>(null)
const content = ref<HTMLElement | null>(null)
let cleanupTimer: ReturnType<typeof setTimeout> | null = null

const timing = {
  heightDuration: 420,
  contentDuration: 260,
  easing: 'cubic-bezier(0.3, 1, 0.3, 1)',
}

const clearAnimation = () => {
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
}

const setOpen = (open: boolean) => {
  if (!details.value) return
  details.value.open = open
  details.value.setAttribute('aria-expanded', open ? 'true' : 'false')
}

const animate = (open: boolean) => {
  if (!details.value || !summary.value || !content.value) return
  clearAnimation()

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setOpen(open)
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
    content.value.style.opacity = '0'
    content.value.style.transform = 'translateY(12px)'
  }
  else {
    details.value.setAttribute('aria-expanded', 'false')
  }

  let endHeight = summary.value.getBoundingClientRect().height
  if (open) {
    details.value.style.height = 'auto'
    endHeight = details.value.getBoundingClientRect().height
    details.value.style.height = `${startHeight}px`
  }

  details.value.getBoundingClientRect()
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (!details.value || !content.value) return
      details.value.style.transition = `height ${timing.heightDuration}ms ${timing.easing}`
      content.value.style.transition = `opacity ${timing.contentDuration}ms ${timing.easing} 80ms, transform ${timing.contentDuration}ms ${timing.easing} 80ms`
      details.value.style.height = `${endHeight}px`
      content.value.style.opacity = open ? '1' : '0'
      content.value.style.transform = open ? 'translateY(0)' : 'translateY(8px)'
    })
  })

  cleanupTimer = window.setTimeout(() => {
    if (!open && details.value) details.value.open = false
    resetStyles()
    cleanupTimer = null
  }, timing.heightDuration + 140)
}

const handleSummaryClick = (event: MouseEvent) => {
  event.preventDefault()
  emit('update:modelValue', !props.modelValue)
}

watch(() => props.modelValue, (open) => {
  if (details.value?.open !== open) animate(open)
}, { flush: 'post' })

onMounted(() => setOpen(props.modelValue))
onBeforeUnmount(clearAnimation)
</script>

<template>
  <details ref="details" class="base-accordion">
    <summary ref="summary" class="base-accordion__summary" :class="summaryClass" @click="handleSummaryClick">
      <span class="min-w-0 flex-1">
        <slot name="summary" :open="modelValue" />
      </span>
      <svg class="base-accordion__icon h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="m5 7.5 5 5 5-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </summary>
    <div ref="content" :class="contentClass">
      <slot />
    </div>
  </details>
</template>

<style scoped>
.base-accordion__summary {
  display: flex;
  cursor: pointer;
  list-style: none;
}

.base-accordion__summary::-webkit-details-marker {
  display: none;
}

.base-accordion__summary:focus {
  outline: none;
}

.base-accordion__icon {
  transition: transform 500ms cubic-bezier(0.3, 1, 0.3, 1);
}

.base-accordion[open] > .base-accordion__summary .base-accordion__icon {
  transform: rotate(180deg);
}

@media (prefers-reduced-motion: reduce) {
  .base-accordion__icon {
    transition: none;
  }
}
</style>
