<script setup lang="ts">
type AssetModule = { default: string }

const { terms } = useTerms()
const bookingSectionPhotos = ref('')
const bookingMountRoot = ref<HTMLElement | null>(null)
const shouldMountBookingSection = ref(false)
const shouldMountDeferredSections = ref(false)
const mobileBookingPhoto = ref<HTMLElement | null>(null)
let bookingSectionObserver: IntersectionObserver | null = null
let mobileBookingPhotoObserver: IntersectionObserver | null = null
let bookingAnchorLockTimer: number | null = null
let deferredSectionsMountTimer: number | null = null
const bookingHashTargets = new Set(['#booking', '#booking-stepper'])
const hasBookingHashTarget = () => bookingHashTargets.has(window.location.hash)
const stopBookingAnchorLock = () => {
  if (bookingAnchorLockTimer === null) return

  window.clearTimeout(bookingAnchorLockTimer)
  bookingAnchorLockTimer = null
}

const stopBookingAnchorLockOnInput = () => {
  stopBookingAnchorLock()
  window.removeEventListener('wheel', stopBookingAnchorLockOnInput)
  window.removeEventListener('touchstart', stopBookingAnchorLockOnInput)
  window.removeEventListener('pointerdown', stopBookingAnchorLockOnInput)
  window.removeEventListener('keydown', stopBookingAnchorLockOnInput)
}

const stopDeferredSectionsSchedule = () => {
  if (deferredSectionsMountTimer !== null) {
    window.clearTimeout(deferredSectionsMountTimer)
    deferredSectionsMountTimer = null
  }

  window.removeEventListener('scroll', mountDeferredSections)
  window.removeEventListener('wheel', mountDeferredSections)
  window.removeEventListener('touchstart', mountDeferredSections)
  window.removeEventListener('keydown', mountDeferredSections)
}

const loadBookingPhoto = async () => {
  if (bookingSectionPhotos.value) return

  const image = await import('~/assets/images/main/sc-open-img.webp') as AssetModule
  bookingSectionPhotos.value = image.default
}

const mountBookingSection = () => {
  if (shouldMountBookingSection.value) return

  shouldMountBookingSection.value = true
  bookingSectionObserver?.disconnect()
  bookingSectionObserver = null
}

const mountDeferredSections = () => {
  if (shouldMountDeferredSections.value) return

  shouldMountDeferredSections.value = true
  stopDeferredSectionsSchedule()
}

const observeBookingSection = () => {
  const target = bookingMountRoot.value

  if (!target || typeof window.IntersectionObserver !== 'function') {
    mountBookingSection()
    return
  }

  bookingSectionObserver = new IntersectionObserver((entries) => {
    if (!entries.some(entry => entry.isIntersecting)) return

    mountBookingSection()
  }, {
    rootMargin: '640px 0px',
  })

  bookingSectionObserver.observe(target)
}

const keepMountedBookingHashTargetAnchored = () => {
  if (!hasBookingHashTarget()) return

  const targetId = window.location.hash === '#booking' ? 'booking' : 'booking-stepper'
  const startedAt = window.performance.now()

  stopBookingAnchorLockOnInput()
  window.addEventListener('wheel', stopBookingAnchorLockOnInput, { once: true, passive: true })
  window.addEventListener('touchstart', stopBookingAnchorLockOnInput, { once: true, passive: true })
  window.addEventListener('pointerdown', stopBookingAnchorLockOnInput, { once: true })
  window.addEventListener('keydown', stopBookingAnchorLockOnInput, { once: true })

  const scrollWhenReady = () => {
    if (!hasBookingHashTarget()) {
      stopBookingAnchorLockOnInput()
      return
    }

    const bookingSection = document.querySelector<HTMLElement>('.booking-section:not(.booking-section--drawer)')
    const target = targetId === 'booking'
      ? bookingSection
      : document.getElementById('booking-stepper')

    if (bookingSection && target) {
      target.scrollIntoView({ block: 'start', behavior: 'auto' })
    }

    if (window.performance.now() - startedAt < 8000) {
      bookingAnchorLockTimer = window.setTimeout(scrollWhenReady, 100)
      return
    }

    stopBookingAnchorLockOnInput()
  }

  window.requestAnimationFrame(scrollWhenReady)
}

const handleBookingHashNavigation = () => {
  if (!hasBookingHashTarget()) return

  mountBookingSection()
  keepMountedBookingHashTargetAnchored()
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

const scheduleDeferredSectionsMount = () => {
  if (shouldMountDeferredSections.value) return

  stopDeferredSectionsSchedule()
  window.addEventListener('scroll', mountDeferredSections, { once: true, passive: true })
  window.addEventListener('wheel', mountDeferredSections, { once: true, passive: true })
  window.addEventListener('touchstart', mountDeferredSections, { once: true, passive: true })
  window.addEventListener('keydown', mountDeferredSections, { once: true })

  deferredSectionsMountTimer = window.setTimeout(mountDeferredSections, 12000)
}

const scheduleDeferredSectionsMountAfterHashScroll = () => {
  if (shouldMountDeferredSections.value) return

  stopDeferredSectionsSchedule()
  window.addEventListener('wheel', mountDeferredSections, { once: true, passive: true })
  window.addEventListener('touchstart', mountDeferredSections, { once: true, passive: true })
  window.addEventListener('keydown', mountDeferredSections, { once: true })

  deferredSectionsMountTimer = window.setTimeout(scheduleDeferredSectionsMount, 8500)
}

onMounted(() => {
  window.addEventListener('hashchange', handleBookingHashNavigation)

  if (hasBookingHashTarget()) {
    handleBookingHashNavigation()
    return
  }

  observeBookingSection()
})

watch(shouldMountBookingSection, async (shouldMount) => {
  if (!shouldMount) return

  await nextTick()
  observeMobileBookingPhoto()
  if (hasBookingHashTarget()) {
    scheduleDeferredSectionsMountAfterHashScroll()
  }
  else {
    scheduleDeferredSectionsMount()
  }
  keepMountedBookingHashTargetAnchored()
})

onBeforeUnmount(() => {
  stopBookingAnchorLockOnInput()
  stopDeferredSectionsSchedule()
  window.removeEventListener('hashchange', handleBookingHashNavigation)
  bookingSectionObserver?.disconnect()
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
      ref="bookingMountRoot"
      class="h-px scroll-mt-28"
      aria-hidden="true"
    />
    <ClientOnly v-if="shouldMountBookingSection">
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
      <template v-if="shouldMountDeferredSections">
        <LazyBotSection />
        <LazyTeamSection />
        <LazyReviewsSection />
        <LazyBlogSection />
        <LazyIdemNaBukviMarquee />
        <LazyFAQSection />
        <LazyFeedbackSection />
      </template>
    </ClientOnly>
  </div>
</template>
