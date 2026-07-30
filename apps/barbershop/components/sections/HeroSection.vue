<script setup lang="ts">
import heroImageOne from '~/assets/images/hero/2020-12-05.webp'
import heroImageOneMobile from '~/assets/images/hero/2020-12-05-mobile.jpg'

type AssetModule = { default: string }

const { terms } = useTerms()
const { trackContactClick, trackEvent } = useAnalytics()
const { open: openBookingDrawer } = useFloatingBookingDrawer()

const handleBookingClick = () => {
  openBookingDrawer()
  trackEvent('booking_cta_click', { source: 'hero_cta' })
}

const secondaryHeroImageLoaders = [
  () => import('~/assets/images/hero/soulcuts-team.webp') as Promise<AssetModule>,
  () => import('~/assets/images/hero/2021-03-17.webp') as Promise<AssetModule>,
  () => import('~/assets/images/hero/2021-03-17_2.webp') as Promise<AssetModule>,
  () => import('~/assets/images/hero/sc-hero-barber-1.webp') as Promise<AssetModule>,
  () => import('~/assets/images/hero/sc-hero-barber-2.webp') as Promise<AssetModule>,
]

const HERO_BLACKOUT_DURATION = 1000
const HERO_IMAGE_PRELOAD_TIMEOUT = 1500
const heroImages = ref([heroImageOne])
const activeImageIndex = ref(0)
const isHeroBlackoutOpaque = ref(false)
const isHeroTransitioning = ref(false)
const heroMobileImageFor = (image: string) => image === heroImageOne ? heroImageOneMobile : image
const heroImageTypeFor = (image: string) => image === heroImageOneMobile ? 'image/jpeg' : 'image/webp'
const activeHeroImage = computed(() => heroImages.value[activeImageIndex.value] || heroImageOne)
const activeHeroMobileImage = computed(() => heroMobileImageFor(activeHeroImage.value))
let sliderInterval: ReturnType<typeof setInterval> | undefined
let heroTransitionFrame: number | undefined
let heroTransitionTimers: number[] = []
let isHeroUnmounted = false

const clearHeroTransitionTimers = () => {
  if (heroTransitionFrame !== undefined) {
    window.cancelAnimationFrame(heroTransitionFrame)
    heroTransitionFrame = undefined
  }

  heroTransitionTimers.forEach(timer => window.clearTimeout(timer))
  heroTransitionTimers = []
}

const requestHeroTransitionFrame = (callback: () => void, frameCount = 1) => {
  if (heroTransitionFrame !== undefined) {
    window.cancelAnimationFrame(heroTransitionFrame)
  }

  const requestNextFrame = (remainingFrames: number) => {
    heroTransitionFrame = window.requestAnimationFrame(() => {
      heroTransitionFrame = undefined

      if (remainingFrames <= 1) {
        callback()
        return
      }

      requestNextFrame(remainingFrames - 1)
    })
  }

  requestNextFrame(frameCount)
}

const scheduleHeroTransitionTimer = (callback: () => void, delay: number) => {
  const timer = window.setTimeout(() => {
    heroTransitionTimers = heroTransitionTimers.filter(item => item !== timer)
    callback()
  }, delay)

  heroTransitionTimers.push(timer)
}

const preloadHeroImageForIndex = async (imageIndex: number) => {
  const image = heroImages.value[imageIndex]

  if (!image) return

  const imageSource = window.matchMedia('(max-width: 767px)').matches
    ? heroMobileImageFor(image)
    : image

  await new Promise<void>((resolve) => {
    let isResolved = false
    const imageElement = new Image()
    const timeout = window.setTimeout(() => {
      done()
    }, HERO_IMAGE_PRELOAD_TIMEOUT)

    const done = () => {
      if (isResolved) return

      isResolved = true
      window.clearTimeout(timeout)
      resolve()
    }

    imageElement.decoding = 'async'
    imageElement.onload = () => {
      if (typeof imageElement.decode !== 'function') {
        done()
        return
      }

      imageElement.decode().then(done).catch(done)
    }
    imageElement.onerror = done
    imageElement.src = imageSource

    if (imageElement.complete) done()
  })
}

const transitionToHeroImage = (nextImageIndex: number) => {
  if (
    isHeroTransitioning.value
    || nextImageIndex === activeImageIndex.value
    || !heroImages.value[nextImageIndex]
  ) {
    return
  }

  clearHeroTransitionTimers()
  isHeroTransitioning.value = true
  isHeroBlackoutOpaque.value = false

  void nextTick().then(() => {
    if (isHeroUnmounted) return

    requestHeroTransitionFrame(() => {
      isHeroBlackoutOpaque.value = true

      scheduleHeroTransitionTimer(() => {
        void preloadHeroImageForIndex(nextImageIndex).then(() => {
          if (isHeroUnmounted) return

          activeImageIndex.value = nextImageIndex
          requestHeroTransitionFrame(() => {
            isHeroBlackoutOpaque.value = false

            scheduleHeroTransitionTimer(() => {
              if (isHeroUnmounted) return

              isHeroTransitioning.value = false
            }, HERO_BLACKOUT_DURATION)
          })
        })
      }, HERO_BLACKOUT_DURATION)
    }, 2)
  })
}

const scheduleSliderStart = (callback: () => void) => {
  const schedule = () => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(callback, { timeout: 3500 })
      return
    }

    window.setTimeout(callback, 2400)
  }

  if (document.readyState === 'complete') {
    schedule()
    return
  }

  window.addEventListener('load', schedule, { once: true })
}

useHead({
  link: [
    {
      rel: 'preload',
      as: 'image',
      href: heroImageOneMobile,
      type: 'image/jpeg',
      media: '(max-width: 767px)',
      fetchpriority: 'high',
    },
    {
      rel: 'preload',
      as: 'image',
      href: heroImageOne,
      type: 'image/webp',
      media: '(min-width: 768px)',
      fetchpriority: 'high',
    },
  ],
})

onMounted(() => {
  scheduleSliderStart(async () => {
    const secondaryImages = await Promise.all(
      secondaryHeroImageLoaders.map(async loadImage => (await loadImage()).default),
    )
    heroImages.value = [heroImageOne, ...secondaryImages]

    sliderInterval = setInterval(() => {
      transitionToHeroImage((activeImageIndex.value + 1) % heroImages.value.length)
    }, 5000)
  })
})

onBeforeUnmount(() => {
  isHeroUnmounted = true
  if (sliderInterval) clearInterval(sliderInterval)
  clearHeroTransitionTimers()
})
</script>

<template>
  <section data-header-theme="dark" class="relative flex min-h-screen items-end overflow-hidden bg-neutral-950 text-white">
    <picture
      class="absolute inset-0 z-0 h-full w-full"
    >
      <source
        :srcset="activeHeroMobileImage"
        media="(max-width: 767px)"
        :type="heroImageTypeFor(activeHeroMobileImage)"
      >
      <img
        :src="activeHeroImage"
        :alt="terms.home.hero.imageAlt"
        class="h-full w-full object-cover opacity-70"
        width="1360"
        height="907"
        loading="eager"
        fetchpriority="high"
        decoding="async"
      >
    </picture>
    <div class="absolute inset-0 z-10 bg-gradient-to-t from-neutral-950 via-neutral-950/45 to-neutral-950/20" />
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 z-20 bg-neutral-950 transition-opacity duration-1000 ease-in-out"
      :class="isHeroBlackoutOpaque ? 'opacity-100' : 'opacity-0'"
    />

    <div class="site-container justify-end relative z-30 flex flex-col min-h-screen items-center text-center gap-3 pb-6 pt-36 md:pb-10">
      <div>
        <SectionLabel>
          {{ terms.home.hero.eyebrowPrefix }}
          <a
            :href="terms.home.contact.mapUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-white/80 transition hover:text-white"
            @click="trackContactClick('map', 'hero')"
          >
            <BaseHoverUnderlineText>{{ terms.home.hero.location }}</BaseHoverUnderlineText>
          </a>
        </SectionLabel>
      </div>

      <div class="flex max-w-[22rem] flex-col gap-1 sm:max-w-none sm:gap-0">
        <h1 class="max-w-5xl text-center text-2xl font-semibold uppercase leading-[0.95] tracking-normal sm:text-2xl md:text-3xl">
          <NuxtLink
            to="/barbershop-odesa"
            class="transition-colors hover:text-white/80"
          >
            <BaseHoverUnderlineText>{{ terms.home.hero.title }}</BaseHoverUnderlineText>
          </NuxtLink>
        </h1>

        <p class="text-sm leading-6 text-white/65 sm:text-base sm:leading-8 sm:text-white/60">
          {{ terms.home.hero.text }}
        </p>
      </div>
      <div class="max-w-3xl flex w-full flex-col gap-3 sm:flex-row">
        <BaseButton variant="light" effect="waves" block @click="handleBookingClick">{{ terms.home.hero.primaryCta }}</BaseButton>
        <BaseButton to="#services" variant="dark" block @click="trackEvent('view_services', { source: 'hero_cta' })">
          {{ terms.home.hero.secondaryCta }}
        </BaseButton>
      </div>

      <div class="mt-5 flex flex-col items-center gap-1 text-white/65" aria-hidden="true">
        <span class="block h-5 w-5 rotate-45 border-b-2 border-r-2 border-white/60 animate-[hero-arrow_1.35s_ease-in-out_infinite]" />
        <span class="block h-5 w-5 rotate-45 border-b-2 border-r-2 border-white/60 animate-[hero-arrow_1.35s_ease-in-out_infinite] [animation-delay:160ms]" />
      </div>
    </div>
  </section>
</template>
