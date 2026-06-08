<script setup lang="ts">
interface GalleryImage {
  src: string
  alt: string
}

const props = defineProps<{
  images?: GalleryImage[]
}>()

const originalImageCount = computed(() => props.images?.length ?? 0)
const carouselImages = computed(() => [...(props.images ?? []), ...(props.images ?? []), ...(props.images ?? [])])
const carousel = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const isPaused = ref(false)
const shouldAnimate = ref(true)

let animationFrame = 0
let lastAnimationTime = 0
let dragStartX = 0
let dragStartScrollLeft = 0

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

  isDragging.value = true
  isPaused.value = true
  dragStartX = event.clientX
  dragStartScrollLeft = carousel.value.scrollLeft
  carousel.value.setPointerCapture(event.pointerId)
}

const dragCarousel = (event: PointerEvent) => {
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

  isDragging.value = false
  isPaused.value = false
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
})
</script>

<template>
  <section v-if="props.images?.length" class="photo-carousel py-12 sm:py-16">
    <div
      ref="carousel"
      class="photo-carousel-viewport"
      :class="{ 'is-dragging': isDragging }"
      tabindex="0"
      @mouseenter="isPaused = true"
      @mouseleave="isPaused = false"
      @pointerdown="startDrag"
      @pointermove="dragCarousel"
      @pointerup="stopDrag"
      @pointercancel="stopDrag"
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
            class="h-full w-full object-cover"
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
  scrollbar-width: none;
  touch-action: pan-y;
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
  display: flex;
  width: max-content;
}

.photo-carousel-slide {
  aspect-ratio: 4 / 5;
  flex: 0 0 72vw;
  width: 72vw;
}

.photo-carousel-viewport:hover .photo-carousel-track {
  animation-play-state: paused;
}

@media (min-width: 640px) {
  .photo-carousel-slide {
    flex-basis: 38vw;
    width: 38vw;
  }
}

@media (min-width: 1024px) {
  .photo-carousel-slide {
    flex-basis: 26vw;
    width: 26vw;
  }
}

@media (prefers-reduced-motion: reduce) {
  .photo-carousel-viewport {
    scroll-behavior: auto;
  }
}
</style>
