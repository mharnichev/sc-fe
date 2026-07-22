<script setup lang="ts">
import type { BlogImageFit } from '~/data/posts'

interface GalleryImage {
  src: string
  alt: string
  width?: number
  height?: number
}

const props = withDefaults(defineProps<{
  images?: GalleryImage[]
  imageFit?: BlogImageFit
}>(), {
  images: () => [],
  imageFit: 'cover',
})

const { trackBlogEvent } = useBlogAnalytics()
const originalImageCount = computed(() => props.images.length)
const carouselImages = computed(() => [...props.images, ...props.images, ...props.images])
const carousel = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const isPaused = ref(false)
const shouldAnimate = ref(true)

let animationFrame = 0
let lastAnimationTime = 0
let resumeAnimationTimeout = 0
let dragStartX = 0
let dragStartScrollLeft = 0
let hasTrackedCarouselInteraction = false

const getSegmentWidth = () => {
  if (!carousel.value) {
    return 0
  }

  return carousel.value.scrollWidth / 3
}

const normalizeScroll = () => {
  if (!carousel.value) {
    return
  }

  const segmentWidth = getSegmentWidth()

  if (!segmentWidth) {
    return
  }

  if (carousel.value.scrollLeft >= segmentWidth * 2) {
    carousel.value.scrollLeft -= segmentWidth
  }

  if (carousel.value.scrollLeft <= 0) {
    carousel.value.scrollLeft += segmentWidth
  }
}

const clearResumeAnimationTimeout = () => {
  if (!resumeAnimationTimeout) {
    return
  }

  window.clearTimeout(resumeAnimationTimeout)
  resumeAnimationTimeout = 0
}

const pauseAutoScroll = () => {
  clearResumeAnimationTimeout()
  isPaused.value = true
}

const resumeAutoScroll = () => {
  clearResumeAnimationTimeout()

  if (!isDragging.value) {
    isPaused.value = false
  }
}

const pauseAutoScrollTemporarily = (delay = 1400) => {
  isPaused.value = true
  clearResumeAnimationTimeout()
  resumeAnimationTimeout = window.setTimeout(() => {
    if (!isDragging.value) {
      isPaused.value = false
    }
  }, delay)
}

const trackCarouselInteraction = (method: string) => {
  if (hasTrackedCarouselInteraction) {
    return
  }

  hasTrackedCarouselInteraction = true
  trackBlogEvent('gallery_interaction', {
    image_count: originalImageCount.value,
    method,
  })
}

const animateCarousel = (timestamp: number) => {
  if (!lastAnimationTime) {
    lastAnimationTime = timestamp
  }

  const delta = timestamp - lastAnimationTime
  lastAnimationTime = timestamp

  if (carousel.value && shouldAnimate.value && !isPaused.value && !isDragging.value) {
    carousel.value.scrollLeft += delta * 0.035
    normalizeScroll()
  }

  animationFrame = window.requestAnimationFrame(animateCarousel)
}

const startDrag = (event: PointerEvent) => {
  if (!carousel.value) {
    return
  }

  if (event.pointerType === 'touch') {
    trackCarouselInteraction('touch')
    pauseAutoScrollTemporarily()
    return
  }

  trackCarouselInteraction('drag')
  isDragging.value = true
  pauseAutoScroll()
  dragStartX = event.clientX
  dragStartScrollLeft = carousel.value.scrollLeft
  carousel.value.setPointerCapture(event.pointerId)
}

const dragCarousel = (event: PointerEvent) => {
  if (event.pointerType === 'touch') {
    trackCarouselInteraction('touch')
    pauseAutoScrollTemporarily()
    return
  }

  if (!carousel.value || !isDragging.value) {
    return
  }

  carousel.value.scrollLeft = dragStartScrollLeft - (event.clientX - dragStartX)
  normalizeScroll()
}

const stopDrag = (event: PointerEvent) => {
  if (!carousel.value) {
    return
  }

  if (event.pointerType === 'touch') {
    trackCarouselInteraction('touch')
    pauseAutoScrollTemporarily()
    normalizeScroll()
    return
  }

  isDragging.value = false
  pauseAutoScrollTemporarily(700)
  normalizeScroll()

  if (carousel.value.hasPointerCapture(event.pointerId)) {
    carousel.value.releasePointerCapture(event.pointerId)
  }
}

onMounted(async () => {
  shouldAnimate.value = !window.matchMedia('(prefers-reduced-motion: reduce)').matches

  await nextTick()

  if (carousel.value) {
    carousel.value.scrollLeft = getSegmentWidth()
  }

  animationFrame = window.requestAnimationFrame(animateCarousel)
})

onBeforeUnmount(() => {
  window.cancelAnimationFrame(animationFrame)
  clearResumeAnimationTimeout()
})
</script>

<template>
  <section
    v-if="props.images.length"
    class="photo-carousel py-12 sm:py-16"
    :class="`photo-carousel--${props.imageFit}`"
  >
    <div
      ref="carousel"
      class="photo-carousel-viewport"
      :class="{ 'is-dragging': isDragging }"
      tabindex="0"
      @mouseenter="pauseAutoScroll"
      @mouseleave="resumeAutoScroll"
      @pointerdown="startDrag"
      @pointermove="dragCarousel"
      @pointerup="stopDrag"
      @pointercancel="stopDrag"
      @touchstart.passive="() => pauseAutoScrollTemporarily()"
      @touchmove.passive="() => pauseAutoScrollTemporarily()"
      @touchend.passive="() => pauseAutoScrollTemporarily()"
      @wheel.passive="() => { trackCarouselInteraction('wheel'); pauseAutoScrollTemporarily() }"
      @scroll.passive="normalizeScroll"
    >
      <div class="photo-carousel-track">
        <figure
          v-for="(image, imageIndex) in carouselImages"
          :key="`${image.src}-${imageIndex}`"
          class="photo-carousel-slide"
          :aria-hidden="imageIndex < originalImageCount || imageIndex >= originalImageCount * 2"
        >
          <img
            :src="image.src"
            :alt="imageIndex >= originalImageCount && imageIndex < originalImageCount * 2 ? image.alt : ''"
            :width="image.width"
            :height="image.height"
            class="photo-carousel-image"
            loading="lazy"
            draggable="false"
          >
        </figure>
      </div>
    </div>
  </section>
</template>

<style scoped>
.photo-carousel {
  background: transparent;
}

.photo-carousel-viewport {
  cursor: grab;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  touch-action: pan-x pan-y;
  user-select: none;
  width: 100%;
}

.photo-carousel-viewport::-webkit-scrollbar {
  display: none;
}

.photo-carousel-viewport.is-dragging {
  cursor: grabbing;
}

.photo-carousel-track {
  align-items: center;
  display: flex;
  width: max-content;
}

.photo-carousel-slide {
  aspect-ratio: 4 / 5;
  flex: 0 0 72vw;
  overflow: hidden;
  width: 72vw;
}

.photo-carousel-image {
  display: block;
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.photo-carousel--contain .photo-carousel-slide {
  background: rgb(0 0 0 / 18%);
}

.photo-carousel--contain .photo-carousel-image {
  object-fit: contain;
}

.photo-carousel--natural-capped .photo-carousel-slide {
  aspect-ratio: auto;
  display: flex;
  flex: 0 0 auto;
  justify-content: center;
  overflow: visible;
  padding-inline: 0.375rem;
  width: auto;
}

.photo-carousel--natural-capped .photo-carousel-image {
  height: auto;
  max-height: clamp(18rem, 62svh, 34rem);
  max-width: min(84vw, 48rem);
  object-fit: contain;
  width: auto;
}

.photo-carousel-viewport:hover .photo-carousel-track {
  animation-play-state: paused;
}

@media (min-width: 640px) {
  .photo-carousel-slide {
    flex-basis: 38vw;
    width: 38vw;
  }

  .photo-carousel--natural-capped .photo-carousel-slide {
    flex-basis: auto;
    width: auto;
  }

  .photo-carousel--natural-capped .photo-carousel-image {
    max-height: clamp(22rem, 65svh, 38rem);
  }
}

@media (min-width: 1024px) {
  .photo-carousel-slide {
    flex-basis: 26vw;
    width: 26vw;
  }

  .photo-carousel--natural-capped .photo-carousel-slide {
    flex-basis: auto;
    width: auto;
  }

  .photo-carousel--natural-capped .photo-carousel-image {
    max-height: clamp(24rem, 68vh, 42rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .photo-carousel-viewport {
    scroll-behavior: auto;
  }
}
</style>
