<script setup lang="ts">
type AssetModule = { default: string }

const { terms } = useTerms()
const bookingSectionPhotos = ref('')
const interactiveSectionsRoot = ref<HTMLElement | null>(null)
const shouldMountInteractiveSections = ref(false)
const mobileBookingPhoto = ref<HTMLElement | null>(null)
let interactiveSectionsObserver: IntersectionObserver | null = null
let mobileBookingPhotoObserver: IntersectionObserver | null = null

const loadBookingPhoto = async () => {
  if (bookingSectionPhotos.value) return

  const image = await import('~/assets/images/main/sc-open-img.webp') as AssetModule
  bookingSectionPhotos.value = image.default
}

const mountInteractiveSections = () => {
  if (shouldMountInteractiveSections.value) return

  shouldMountInteractiveSections.value = true
  interactiveSectionsObserver?.disconnect()
  interactiveSectionsObserver = null
}

const observeInteractiveSections = () => {
  const target = interactiveSectionsRoot.value

  if (!target || typeof window.IntersectionObserver !== 'function') {
    mountInteractiveSections()
    return
  }

  interactiveSectionsObserver = new IntersectionObserver((entries) => {
    if (!entries.some(entry => entry.isIntersecting)) return

    mountInteractiveSections()
  }, {
    rootMargin: '640px 0px',
  })

  interactiveSectionsObserver.observe(target)
}

const observeMobileBookingPhoto = () => {
  const target = mobileBookingPhoto.value

  if (!target || typeof window.IntersectionObserver !== 'function') {
    window.setTimeout(loadBookingPhoto, 3000)
    return
  }

  mobileBookingPhotoObserver = new IntersectionObserver((entries) => {
    if (!entries.some(entry => entry.isIntersecting)) return

    mobileBookingPhotoObserver?.disconnect()
    mobileBookingPhotoObserver = null
    loadBookingPhoto()
  }, {
    rootMargin: '240px 0px',
  })

  mobileBookingPhotoObserver.observe(target)
}

onMounted(() => {
  observeInteractiveSections()
})

watch(shouldMountInteractiveSections, async (shouldMount) => {
  if (!shouldMount) return

  await nextTick()
  observeMobileBookingPhoto()
})

onBeforeUnmount(() => {
  interactiveSectionsObserver?.disconnect()
  mobileBookingPhotoObserver?.disconnect()
})

useSeo(
  () => terms.value.seo.homeTitle,
  () => terms.value.seo.homeDescription,
)
</script>

<template>
  <div>
    <HeroSection />
    <IntroSection />
    <ServicesGrid />
    <div
      ref="interactiveSectionsRoot"
      :id="shouldMountInteractiveSections ? undefined : 'booking'"
      class="h-px scroll-mt-28"
      aria-hidden="true"
    >
      <span v-if="!shouldMountInteractiveSections" id="booking-stepper" />
    </div>
    <ClientOnly v-if="shouldMountInteractiveSections">
      <LazyBookingSection />
      <section ref="mobileBookingPhoto" data-header-theme="dark" class="bg-neutral-950 px-4 pb-12 min-[560px]:hidden">
        <img
          v-if="bookingSectionPhotos"
          :src="bookingSectionPhotos"
          alt="photo booking"
          class="mx-auto w-full max-w-md object-contain"
          width="790"
          height="992"
          loading="lazy"
        >
      </section>
      <LazyBotSection />
      <LazyTeamSection />
      <LazyReviewsSection />
      <LazyBlogSection />
      <LazyIdemNaBukviMarquee />
      <LazyFAQSection />
      <LazyFeedbackSection />
    </ClientOnly>
  </div>
</template>
