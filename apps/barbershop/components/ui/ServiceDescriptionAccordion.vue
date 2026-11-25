<script setup lang="ts">
const props = withDefaults(defineProps<{
  description: string
  theme?: 'light' | 'dark'
  showReadMore?: boolean
}>(), {
  theme: 'light',
  showReadMore: true,
})

const { locale } = useTerms()
const open = ref(false)
const fullDescription = ref<HTMLParagraphElement | null>(null)
const hasOverflow = ref(false)
const accordionText = ref<HTMLElement | null>(null)
const closing = ref(false)
let heightAnimation: Animation | undefined

onBeforeUnmount(() => heightAnimation?.cancel())

watch(open, async (expanded, _, onCleanup) => {
  const text = accordionText.value
  const startHeight = text?.getBoundingClientRect().height ?? 0
  heightAnimation?.cancel()
  closing.value = false
  if (!text || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  closing.value = !expanded
  let cancelled = false
  onCleanup(() => {
    cancelled = true
  })

  await nextTick()
  if (cancelled || !text.isConnected) return

  const endHeight = expanded ? text.scrollHeight : Number.parseFloat(getComputedStyle(text).lineHeight) * 2
  heightAnimation = text.animate(
    [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
    { duration: 280, easing: 'ease-in-out' },
  )
  heightAnimation.onfinish = () => { closing.value = false }
})


watch(fullDescription, (element, _, onCleanup) => {
  if (!element) return

  const mobile = window.matchMedia('(max-width: 639px)')
  const measure = () => {
    const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight)
    hasOverflow.value = mobile.matches && element.getBoundingClientRect().height > lineHeight * 2 + 1
    if (!hasOverflow.value) open.value = false
  }

  const observer = new ResizeObserver(measure)
  observer.observe(element)
  mobile.addEventListener('change', measure)
  measure()

  onCleanup(() => {
    observer.disconnect()
    mobile.removeEventListener('change', measure)
  })
}, { flush: 'post' })
const expandLabel = computed(() => locale.value === 'en' ? 'Read full description' : 'Читати повністю')
const summaryClass = computed(() => props.theme === 'dark'
  ? 'w-full items-start gap-2 text-left text-white/60 focus-visible:ring-2 focus-visible:ring-white/70'
  : 'w-full items-start gap-2 text-left text-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-950/40')
</script>

<template>
  <div v-if="description" class="service-description">
    <p
      ref="fullDescription"
      class="service-description__plain"
      :class="[
        theme === 'dark' ? 'text-white/60 sm:text-white/55' : 'text-neutral-600',
        { 'service-description__measurement': hasOverflow },
      ]"
      :aria-hidden="hasOverflow || undefined"
    >
      {{ description }}
    </p>
    <BaseAccordion
      v-if="hasOverflow"
      v-model="open"
      :summary-class="summaryClass"
    >
      <template #summary="{ open: isOpen }">
        <span class="block min-w-0">
          <span ref="accordionText" class="service-description__text" :class="{ 'service-description__text--collapsed': !isOpen && !closing }">
            {{ description }}
          </span>
          <span v-if="showReadMore && !isOpen && !closing" class="service-description__action">{{ expandLabel }}</span>
        </span>
      </template>
    </BaseAccordion>
  </div>
</template>

<style scoped>
.service-description {
  position: relative;
}

.service-description__plain {
  font-size: 0.875rem;
  line-height: 1.75rem;
}

.service-description__measurement {
  position: absolute;
  inset-inline: 0;
  visibility: hidden;
  pointer-events: none;
}

.service-description__text {
  display: block;
  overflow: hidden;
  font-size: 0.875rem;
  line-height: 1.375rem;
}

.service-description__text--collapsed {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.service-description__action {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

@media (max-width: 639px) {
  .service-description__plain,
  .service-description__text {
    font-size: 12px;
    line-height: 1.2rem;
  }
}
</style>
