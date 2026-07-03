<script setup lang="ts">
import heroImageOne from '~/assets/images/hero/2020-12-05.webp'
import heroImageOneMobile from '~/assets/images/hero/2020-12-05-mobile.jpg'

type AssetModule = { default: string }

const { terms } = useTerms()
const { trackContactClick, trackEvent } = useAnalytics()

const secondaryHeroImageLoaders = [
  () => import('~/assets/images/hero/2021-03-17.webp') as Promise<AssetModule>,
  () => import('~/assets/images/hero/2021-03-17_2.webp') as Promise<AssetModule>,
  () => import('~/assets/images/hero/sc-hero-barber-1.webp') as Promise<AssetModule>,
  () => import('~/assets/images/hero/sc-hero-barber-2.webp') as Promise<AssetModule>,
]

const heroImages = ref([heroImageOne])
const activeImageIndex = ref(0)
const activeHeroImage = computed(() => heroImages.value[activeImageIndex.value] || heroImageOne)
const activeHeroMobileImage = computed(() =>
  activeHeroImage.value === heroImageOne ? heroImageOneMobile : activeHeroImage.value,
)
let sliderInterval: ReturnType<typeof setInterval> | undefined

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
      activeImageIndex.value = (activeImageIndex.value + 1) % heroImages.value.length
    }, 5000)
  })
})

onBeforeUnmount(() => {
  if (sliderInterval) clearInterval(sliderInterval)
})
</script>

<template>
  <section data-header-theme="dark" class="relative flex min-h-screen items-end overflow-hidden bg-neutral-950 text-white">
    <picture
      :key="activeHeroImage"
      class="absolute inset-0 h-full w-full"
    >
      <source
        :srcset="activeHeroMobileImage"
        media="(max-width: 767px)"
        :type="activeHeroMobileImage === heroImageOneMobile ? 'image/jpeg' : 'image/webp'"
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
    <div class="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/45 to-neutral-950/20" />

    <div class="site-container justify-end relative flex flex-col min-h-screen items-center text-center gap-3 pb-6 pt-36 md:pb-10">
      <div>
        <SectionLabel>
          {{ terms.home.hero.eyebrowPrefix }}
          <a
            :href="terms.home.contact.mapUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-white/80 underline decoration-white/25 underline-offset-4 transition hover:text-white hover:decoration-white"
            @click="trackContactClick('map', 'hero')"
          >
            {{ terms.home.hero.location }}
          </a>
        </SectionLabel>
      </div>

      <div class="flex flex-col">
        <h1 class="max-w-5xl text-center text-2xl font-semibold uppercase leading-[0.95] tracking-normal sm:text-2xl md:text-3xl">
          {{ terms.home.hero.title }}
        </h1>

        <p class="text-base leading-8 text-white/60">
          {{ terms.home.hero.text }}
        </p>
      </div>
      <div class="max-w-3xl flex w-full flex-col gap-3 sm:flex-row">
        <BaseButton to="#booking-stepper" variant="light" effect="waves" block @click="trackEvent('booking_start', { source: 'hero_cta' })">{{ terms.home.hero.primaryCta }}</BaseButton>
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
