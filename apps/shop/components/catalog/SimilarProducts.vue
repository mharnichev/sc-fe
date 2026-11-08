<script setup lang="ts">
import type { ProductDto } from '@shared-types'

const props = defineProps<{ slug: string }>()
const { getProductRecommendations } = useCatalogDomain()
const { terms } = useShopLocale()
const headingId = useId()
const viewportId = useId()
const sentinel = ref<HTMLElement | null>(null)
const viewport = ref<HTMLElement | null>(null)
const recommendations = shallowRef<ProductDto[] | 'loading' | null>()
const canScrollBack = ref(false)
const canScrollForward = ref(false)
let observer: IntersectionObserver | undefined
let request: AbortController | undefined

onMounted(() => {
  onNuxtReady(() => {
    if (!sentinel.value) return
    if (!('IntersectionObserver' in window)) {
      recommendations.value = null
      return
    }

    observer = new IntersectionObserver(async (entries) => {
      if (!sentinel.value || recommendations.value !== undefined || !entries.some(entry => entry.intersectionRatio > 0)) return

      observer?.disconnect()
      const controller = new AbortController()
      request = controller
      recommendations.value = 'loading'
      try {
        const items = await getProductRecommendations(props.slug, controller.signal)
        if (!controller.signal.aborted) recommendations.value = items.length >= 2 ? items : null
      }
      catch {
        if (!controller.signal.aborted) recommendations.value = null
      }
    }, { root: null, rootMargin: '0px', threshold: 0.01 })

    observer.observe(sentinel.value)
  })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  request?.abort()
})

const updateControls = () => {
  const element = viewport.value
  if (!element) return
  canScrollBack.value = element.scrollLeft > 2
  canScrollForward.value = element.scrollLeft + element.clientWidth < element.scrollWidth - 2
}

watchPostEffect((onCleanup) => {
  if (!Array.isArray(recommendations.value) || !viewport.value) return
  const resizeObserver = new ResizeObserver(updateControls)
  resizeObserver.observe(viewport.value)
  onCleanup(() => resizeObserver.disconnect())
  updateControls()
})

const scrollProducts = (direction: -1 | 1) => {
  const element = viewport.value
  const track = element?.firstElementChild
  const card = track?.firstElementChild
  if (!element || !track || !card) return

  const gap = Number.parseFloat(getComputedStyle(track).columnGap)
  element.scrollBy({
    left: direction * (card.getBoundingClientRect().width + gap),
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  })
}
</script>

<template>
  <div v-if="recommendations === undefined" ref="sentinel" class="similar-products__sentinel" aria-hidden="true" />
  <section
    v-else-if="recommendations"
    class="similar-products"
    :aria-labelledby="headingId"
    :aria-busy="recommendations === 'loading' || undefined"
  >
    <div class="similar-products__heading">
      <h2 :id="headingId" class="section-title type-title-strong">{{ terms.common.similarProducts }}</h2>
      <div
        class="similar-products__controls"
        :class="{ 'similar-products__controls--hidden': !canScrollBack && !canScrollForward }"
      >
        <BaseButton
          variant="outline-dark"
          shape="circle"
          :class="{ 'sc-button--disabled': !canScrollBack }"
          :aria-label="terms.common.previousSimilarProducts"
          :aria-controls="viewportId"
          :aria-disabled="!canScrollBack"
          @click="scrollProducts(-1)"
        >
          <BaseIcon name="chevron-left" size="xxs" />
        </BaseButton>
        <BaseButton
          variant="outline-dark"
          shape="circle"
          :class="{ 'sc-button--disabled': !canScrollForward }"
          :aria-label="terms.common.nextSimilarProducts"
          :aria-controls="viewportId"
          :aria-disabled="!canScrollForward"
          @click="scrollProducts(1)"
        >
          <BaseIcon name="chevron-right" size="xxs" />
        </BaseButton>
      </div>
    </div>

    <div
      :id="viewportId"
      ref="viewport"
      class="similar-products__viewport"
      :tabindex="canScrollBack || canScrollForward ? 0 : undefined"
      @scroll.passive="updateControls"
      @keydown.left.self.prevent="scrollProducts(-1)"
      @keydown.right.self.prevent="scrollProducts(1)"
    >
      <ul v-if="recommendations === 'loading'" class="similar-products__track" aria-hidden="true">
        <li v-for="index in 4" :key="index" class="similar-products__placeholder">
          <BaseSkeleton height="100%" />
        </li>
      </ul>
      <ul v-else class="similar-products__track">
        <li v-for="product in recommendations" :key="product.id" class="similar-products__item">
          <CatalogProductTile :product="product" />
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.similar-products__sentinel {
  height: 1px;
}

.similar-products__heading {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.similar-products__controls {
  display: flex;
  flex: 0 0 auto;
  gap: 0.5rem;
}

.similar-products__controls--hidden {
  visibility: hidden;
}

.similar-products__viewport {
  overflow-x: auto;
  padding-bottom: 1rem;
  overscroll-behavior-inline: contain;
  scroll-snap-type: inline mandatory;
  scrollbar-width: thin;
}

.similar-products__viewport:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: -2px;
}

.similar-products__track {
  --columns: 2;
  --gap: 0.5rem;

  display: grid;
  grid-auto-columns: calc((100% - (var(--columns) - 1) * var(--gap)) / var(--columns));
  grid-auto-flow: column;
  gap: var(--gap);
}

.similar-products__item {
  display: flex;
  min-width: 0;
  scroll-snap-align: start;
}

.similar-products__placeholder {
  position: relative;
  min-height: 22rem;
  aspect-ratio: 0.78;
}

.similar-products__placeholder > .base-skeleton {
  position: absolute;
  inset: 0;
}

@media (max-width: 519px) {
  .similar-products__placeholder {
    min-height: 0;
    padding-top: calc(60% + 9.24rem);
    aspect-ratio: auto;
  }
}

@media (min-width: 576px) {
  .similar-products__placeholder {
    min-height: 25rem;
  }
}

@media (max-width: 767px) {
  .similar-products__placeholder:nth-child(n + 3) {
    display: none;
  }
}

@media (min-width: 768px) {
  .similar-products__track {
    --columns: 3;
    --gap: 0.75rem;
  }
}

@media (max-width: 1023px) {
  .similar-products__placeholder:nth-child(4) {
    display: none;
  }
}

@media (min-width: 1024px) {
  .similar-products__track {
    --columns: 4;
  }
}
</style>
