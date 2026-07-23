<script setup lang="ts">
import type { BrandDto } from '@shared-types'
import { isMonochromeBrandLogo, localBrandLogoUrl } from '@shared-utils'

const props = withDefaults(defineProps<{
  brands?: BrandDto[]
  pending?: boolean
}>(), {
  brands: () => [],
  pending: false,
})

const config = useRuntimeConfig()
const requestUrl = useRequestURL()
const { terms } = useShopLocale()
const viewport = ref<HTMLElement | null>(null)
const canScrollBack = ref(false)
const canScrollForward = ref(false)
const isScrollAnimating = ref(false)
const AUTO_SCROLL_INTERVAL_MS = 3000
const SCROLL_ANIMATION_DURATION_MS = 720
let resizeObserver: ResizeObserver | undefined
let autoScrollTimer: ReturnType<typeof setInterval> | undefined
let scrollAnimationFrame: number | undefined
let autoScrollDirection: -1 | 1 = 1

const updateControls = () => {
  const element = viewport.value
  if (!element) return

  canScrollBack.value = element.scrollLeft > 2
  canScrollForward.value = element.scrollLeft + element.clientWidth < element.scrollWidth - 2
}

const stopScrollAnimation = () => {
  if (scrollAnimationFrame === undefined) return
  cancelAnimationFrame(scrollAnimationFrame)
  scrollAnimationFrame = undefined
  isScrollAnimating.value = false
}

const easeInOutSine = (progress: number) =>
  -(Math.cos(Math.PI * progress) - 1) / 2

const animateScrollTo = (requestedLeft: number) => {
  const element = viewport.value
  if (!element) return

  stopScrollAnimation()

  const startLeft = element.scrollLeft
  const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth)
  const targetLeft = Math.min(Math.max(requestedLeft, 0), maxScroll)
  const distance = targetLeft - startLeft

  if (
    Math.abs(distance) < 1
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    element.scrollLeft = targetLeft
    isScrollAnimating.value = false
    return
  }

  isScrollAnimating.value = true
  let startedAt: number | undefined
  const animate = (timestamp: number) => {
    startedAt ??= timestamp
    const progress = Math.min((timestamp - startedAt) / SCROLL_ANIMATION_DURATION_MS, 1)
    element.scrollLeft = startLeft + distance * easeInOutSine(progress)

    if (progress < 1) {
      scrollAnimationFrame = requestAnimationFrame(animate)
      return
    }

    element.scrollLeft = targetLeft
    scrollAnimationFrame = undefined
    isScrollAnimating.value = false
    updateControls()
  }

  scrollAnimationFrame = requestAnimationFrame(animate)
}

const scrollBrands = (direction: -1 | 1) => {
  const element = viewport.value
  if (!element) return

  const firstSlide = element.querySelector<HTMLElement>('.brand-slider__item')
  const slideWidth = firstSlide?.getBoundingClientRect().width
  if (!slideWidth) return

  autoScrollDirection = direction
  const currentSlide = Math.round(element.scrollLeft / slideWidth)
  animateScrollTo((currentSlide + direction) * slideWidth)
  startAutoScroll()
}

const stopAutoScroll = () => {
  if (!autoScrollTimer) return
  clearInterval(autoScrollTimer)
  autoScrollTimer = undefined
}

const advanceAutoScroll = () => {
  const element = viewport.value
  if (!element) return

  const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth)
  const firstSlide = element.querySelector<HTMLElement>('.brand-slider__item')
  const slideWidth = firstSlide?.getBoundingClientRect().width || element.clientWidth
  const reachedStart = element.scrollLeft <= 2
  const reachedEnd = element.scrollLeft >= maxScroll - 2

  if (reachedEnd) autoScrollDirection = -1
  else if (reachedStart) autoScrollDirection = 1

  const currentSlide = Math.round(element.scrollLeft / slideWidth)
  animateScrollTo((currentSlide + autoScrollDirection) * slideWidth)
}

const startAutoScroll = () => {
  stopAutoScroll()
  const element = viewport.value
  if (
    !element
    || element.scrollWidth <= element.clientWidth + 2
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) return

  autoScrollTimer = setInterval(advanceAutoScroll, AUTO_SCROLL_INTERVAL_MS)
}

const resolveLogoUrl = (value: string | null | undefined) => {
  const url = value?.trim()
  if (!url) return ''
  if (/^(?:https?:|data:|blob:)/i.test(url)) return url

  try {
    const apiOrigin = new URL(String(config.public.apiBase), requestUrl.origin).origin
    return new URL(url, apiOrigin).toString()
  }
  catch {
    return url
  }
}

const brandLogoUrl = (brand: BrandDto) =>
  resolveLogoUrl(brand.logo_url) || localBrandLogoUrl(brand.slug)

const brandLogoMaskStyle = (brand: BrandDto) => ({
  '--brand-logo-url': `url(${JSON.stringify(brandLogoUrl(brand))})`,
})

const visibleBrands = computed(() =>
  props.brands.filter(brand => Boolean(brandLogoUrl(brand))),
)

onMounted(() => {
  resizeObserver = new ResizeObserver(updateControls)
  if (viewport.value) resizeObserver.observe(viewport.value)
  nextTick(() => {
    updateControls()
    startAutoScroll()
  })
})

watch(() => visibleBrands.value.length, () => nextTick(() => {
  updateControls()
  startAutoScroll()
}))

onBeforeUnmount(() => {
  stopAutoScroll()
  stopScrollAnimation()
  resizeObserver?.disconnect()
})
</script>

<template>
  <section v-if="pending || visibleBrands.length" class="brand-slider">
    <div class="brand-slider__heading">
      <div class="brand-slider__copy">
        <p class="type-eyebrow type-eyebrow--wide text-xs">
        <BaseScribbleOutline>{{ terms.home.brandsEyebrow }}</BaseScribbleOutline>
        </p>
        <h2 class="section-title type-title-strong">
          {{ terms.home.brandsTitle }}
        </h2>
        <p>{{ terms.home.brandsDescription }}</p>
      </div>

      <div class="brand-slider__controls">
        <BaseButton
          type="button"
          variant="outline-dark"
          shape="circle"
          :aria-label="terms.home.previousBrands"
          :disabled="!canScrollBack"
          @click="scrollBrands(-1)"
        >
          <BaseIcon name="chevron-left" size="xxs" />
        </BaseButton>
        <BaseButton
          type="button"
          variant="outline-dark"
          shape="circle"
          :aria-label="terms.home.nextBrands"
          :disabled="!canScrollForward"
          @click="scrollBrands(1)"
        >
          <BaseIcon name="chevron-right" size="xxs" />
        </BaseButton>
      </div>
    </div>

    <div
      ref="viewport"
      class="brand-slider__viewport"
      :class="{ 'brand-slider__viewport--animating': isScrollAnimating }"
      role="region"
      :aria-label="terms.home.brandsSliderLabel"
      tabindex="0"
      @scroll.passive="updateControls"
      @mouseenter="stopAutoScroll"
      @mouseleave="startAutoScroll"
      @focusin="stopAutoScroll"
      @focusout="startAutoScroll"
      @pointerdown="stopScrollAnimation"
      @wheel.passive="stopScrollAnimation"
    >
      <ul class="brand-slider__track">
        <template v-if="pending">
          <li v-for="index in 5" :key="`brand-skeleton-${index}`" class="brand-slider__skeleton" aria-hidden="true">
            <span />
          </li>
        </template>
        <template v-else>
          <li v-for="brand in visibleBrands" :key="brand.id" class="brand-slider__item">
            <NuxtLink
              class="brand-slider__card"
              :to="{ path: '/catalog', query: { brand: brand.slug } }"
              :aria-label="terms.home.viewBrand(brand.name)"
            >
              <span class="brand-slider__logo">
                <span
                  v-if="isMonochromeBrandLogo(brand.slug)"
                  class="brand-slider__logo-mask"
                  :style="brandLogoMaskStyle(brand)"
                  role="img"
                  :aria-label="brand.name"
                />
                <img
                  v-else-if="brandLogoUrl(brand)"
                  :src="brandLogoUrl(brand)"
                  :alt="brand.name"
                  width="240"
                  height="120"
                  loading="lazy"
                >
              </span>
            </NuxtLink>
          </li>
        </template>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.brand-slider {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1.25rem;
}

.brand-slider__heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2rem;
}

.brand-slider__copy {
  min-width: 0;
}

.brand-slider__copy .section-title {
  padding-top: 0.75rem;
}

.brand-slider__copy > p:last-child {
  max-width: 42rem;
  padding-top: 0.5rem;
  color: #57534e;
  font-size: 0.875rem;
  line-height: 1.75rem;
}

.brand-slider__controls {
  display: flex;
  flex: 0 0 auto;
  gap: 0.5rem;
}

.brand-slider__viewport {
  min-width: 0;
  overflow-x: auto;
  padding: 0.25rem 0 0.75rem;
  overscroll-behavior-inline: contain;
  scroll-snap-type: inline mandatory;
  scrollbar-color: #a3a3a3 transparent;
  scrollbar-width: thin;
}

.brand-slider__viewport--animating {
  scroll-snap-type: none;
}

.brand-slider__viewport:focus-visible {
  outline: 2px solid #0a0a0a;
  outline-offset: 0.25rem;
}

.brand-slider__track {
  display: grid;
  grid-auto-columns: minmax(14rem, 72vw);
  grid-auto-flow: column;
}

.brand-slider__item {
  display: flex;
  min-width: 0;
  scroll-snap-align: start;
}

.brand-slider__card {
  display: flex;
  width: 100%;
  min-height: 9rem;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: inherit;
  padding: 1.25rem 2rem;
  transition: opacity 180ms ease;
}

.brand-slider__card:hover,
.brand-slider__card:focus-visible {
  opacity: 0.62;
}

.brand-slider__card:focus-visible {
  outline: 2px solid #0a0a0a;
  outline-offset: -0.25rem;
}

.brand-slider__logo {
  display: flex;
  width: 100%;
  height: 6rem;
  align-items: center;
  justify-content: center;
  color: #292524;
}

.brand-slider__logo img,
.brand-slider__logo-mask {
  width: 100%;
  height: 100%;
}

.brand-slider__logo img {
  object-fit: contain;
}

.brand-slider__logo-mask {
  display: block;
  background-color: currentColor;
  -webkit-mask-image: var(--brand-logo-url);
  -webkit-mask-position: center;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-size: contain;
  mask-image: var(--brand-logo-url);
  mask-position: center;
  mask-repeat: no-repeat;
  mask-size: contain;
}

.brand-slider__skeleton {
  display: flex;
  min-height: 9rem;
  align-items: center;
  justify-content: center;
  padding: 1.25rem 2rem;
  scroll-snap-align: start;
}

.brand-slider__skeleton + .brand-slider__skeleton {
  border-left: 1px solid rgb(10 10 10 / 0.14);
}

.brand-slider__skeleton span {
  width: 100%;
  height: 4rem;
  border-radius: 0.375rem;
  background: linear-gradient(90deg, #f5f5f4 25%, #e7e5e4 50%, #f5f5f4 75%);
  background-size: 200% 100%;
  animation: brand-slider-pulse 1.4s infinite linear;
}

@media (min-width: 640px) {
  .brand-slider__track {
    grid-auto-columns: minmax(14rem, 50%);
  }
}

@media (min-width: 1024px) {
  .brand-slider__track {
    grid-auto-columns: minmax(14rem, 25%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .brand-slider__card,
  .brand-slider__skeleton span {
    animation: none;
    transition: none;
  }
}

@keyframes brand-slider-pulse {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}
</style>
