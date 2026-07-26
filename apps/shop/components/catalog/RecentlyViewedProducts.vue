<script setup lang="ts">
const props = defineProps<{
  excludeProductId?: number
}>()

const recentlyViewed = useRecentlyViewedStore()
const { terms } = useShopLocale()
const viewport = ref<HTMLElement | null>(null)
const canScrollBack = ref(false)
const canScrollForward = ref(false)
let resizeObserver: ResizeObserver | undefined

const visibleProducts = computed(() =>
  recentlyViewed.products.filter(product => product.id !== props.excludeProductId),
)

const updateControls = () => {
  const element = viewport.value
  if (!element) return

  canScrollBack.value = element.scrollLeft > 2
  canScrollForward.value = element.scrollLeft + element.clientWidth < element.scrollWidth - 2
}

const observeViewport = () => {
  resizeObserver?.disconnect()
  const element = viewport.value
  if (!element) return

  resizeObserver = new ResizeObserver(updateControls)
  resizeObserver.observe(element)
  updateControls()
}

const scrollProducts = (direction: -1 | 1) => {
  const element = viewport.value
  if (!element) return

  const item = element.querySelector<HTMLElement>('.recently-viewed-products__item')
  const itemWidth = item?.getBoundingClientRect().width || element.clientWidth
  const gap = Number.parseFloat(getComputedStyle(element).columnGap) || 12
  element.scrollBy({
    left: direction * (itemWidth + gap),
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  })
}

onMounted(() => {
  recentlyViewed.hydrate()
  nextTick(observeViewport)
})

watch(
  [() => visibleProducts.value.length, viewport],
  () => nextTick(observeViewport),
)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})
</script>

<template>
  <section v-if="visibleProducts.length" class="recently-viewed-products">
    <div class="recently-viewed-products__heading">
      <div class="recently-viewed-products__copy">
        <h2 class="section-title type-title-strong">
          {{ terms.common.recentlyViewed }}
        </h2>
        <p>{{ terms.common.recentlyViewedDescription }}</p>
      </div>

      <div class="recently-viewed-products__controls">
        <BaseButton
          type="button"
          variant="outline-dark"
          shape="circle"
          :aria-label="terms.common.previousRecentlyViewed"
          :disabled="!canScrollBack"
          @click="scrollProducts(-1)"
        >
          <BaseIcon name="chevron-left" size="xxs" />
        </BaseButton>
        <BaseButton
          type="button"
          variant="outline-dark"
          shape="circle"
          :aria-label="terms.common.nextRecentlyViewed"
          :disabled="!canScrollForward"
          @click="scrollProducts(1)"
        >
          <BaseIcon name="chevron-right" size="xxs" />
        </BaseButton>
      </div>
    </div>

    <div
      ref="viewport"
      class="recently-viewed-products__viewport"
      tabindex="0"
      :aria-label="terms.common.recentlyViewed"
      @scroll.passive="updateControls"
    >
      <ul class="recently-viewed-products__track">
        <li
          v-for="product in visibleProducts"
          :key="product.id"
          class="recently-viewed-products__item"
        >
          <CatalogProductTile :product="product" />
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.recently-viewed-products {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1rem;
}

.recently-viewed-products__heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

.recently-viewed-products__copy {
  min-width: 0;
}

.recently-viewed-products__copy p {
  max-width: 36rem;
  padding-top: 0.375rem;
  color: #737373;
  font-size: 0.875rem;
  line-height: 1.6;
}

.recently-viewed-products__controls {
  display: flex;
  flex: 0 0 auto;
  gap: 0.5rem;
}

.recently-viewed-products__viewport {
  min-width: 0;
  overflow-x: auto;
  padding: 0.25rem 0 1rem;
  overscroll-behavior-inline: contain;
  scroll-snap-type: inline mandatory;
  scrollbar-color: #a3a3a3 transparent;
  scrollbar-width: thin;
}

.recently-viewed-products__viewport:focus-visible {
  border-radius: 0.5rem;
  outline: 2px solid #0a0a0a;
  outline-offset: 0.25rem;
}

.recently-viewed-products__track {
  display: grid;
  grid-auto-columns: minmax(9.125rem, 72vw);
  grid-auto-flow: column;
  gap: 0.75rem;
}

.recently-viewed-products__item {
  display: flex;
  min-width: 0;
  scroll-snap-align: start;
}

@media (min-width: 520px) {
  .recently-viewed-products__track {
    grid-auto-columns: minmax(15rem, calc((100% - 2.25rem) / 4));
  }
}

@media (max-width: 519px) {
  .recently-viewed-products__controls {
    display: none;
  }
}
</style>
