<script setup lang="ts">
import heroImageOne from '~/assets/images/hero/2020-12-05.webp'
import heroImageTwo from '~/assets/images/hero/2021-03-17.webp'
import heroImageThree from '~/assets/images/hero/2021-03-17_2.webp'
import heroImageFour from '~/assets/images/hero/sc-hero-barber-1.webp'
import heroImageFive from '~/assets/images/hero/sc-hero-barber-2.webp'

const { terms } = useTerms()
const { trackContactClick, trackEvent } = useAnalytics()

const heroImages = [
  heroImageOne,
  heroImageTwo,
  heroImageThree,
  heroImageFour,
  heroImageFive,
]

const activeImageIndex = ref(0)
let sliderInterval: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  sliderInterval = setInterval(() => {
    activeImageIndex.value = (activeImageIndex.value + 1) % heroImages.length
  }, 5000)
})

onBeforeUnmount(() => {
  if (sliderInterval) clearInterval(sliderInterval)
})
</script>

<template>
  <section data-header-theme="dark" class="relative flex min-h-screen items-end overflow-hidden bg-neutral-950 text-white">
    <img
      v-for="(image, index) in heroImages"
      :key="image"
      :src="image"
      :alt="index === activeImageIndex ? terms.home.hero.imageAlt : ''"
      class="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out"
      :class="index === activeImageIndex ? 'opacity-70' : 'opacity-0'"
      :loading="index === 0 ? 'eager' : 'lazy'"
      :fetchpriority="index === 0 ? 'high' : 'auto'"
      :aria-hidden="index === activeImageIndex ? undefined : true"
    >
    <div class="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/45 to-neutral-950/20" />

    <div class="site-container justify-end relative flex flex-col min-h-screen items-center text-center gap-3 pb-6 pt-36 md:pb-10">
      <div data-reveal="soft">
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

      <div class="flex flex-col" data-reveal="soft" data-reveal-delay="140">
        <h1 class="max-w-5xl text-center text-2xl font-semibold uppercase leading-[0.95] tracking-normal sm:text-2xl md:text-3xl">
          {{ terms.home.hero.title }}
        </h1>

        <p class="text-base leading-8 text-white/60">
          {{ terms.home.hero.text }}
        </p>
      </div>
      <div class="max-w-3xl flex w-full flex-col gap-3 sm:flex-row" data-reveal="soft" data-reveal-delay="280">
        <PrimaryButton to="#booking-stepper" class="w-full text-center" @click="trackEvent('booking_start', { source: 'hero_cta' })">{{ terms.home.hero.primaryCta }}</PrimaryButton>
        <NuxtLink to="#services" class="w-full inline-flex justify-center items-center border border-white/35 px-6 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white hover:text-neutral-950 text-center" @click="trackEvent('view_services', { source: 'hero_cta' })">
          {{ terms.home.hero.secondaryCta }}
        </NuxtLink>
      </div>

      <div class="mt-5 flex flex-col items-center gap-1 text-white/65" data-reveal="soft" data-reveal-delay="420" aria-hidden="true">
        <span class="block h-5 w-5 rotate-45 border-b-2 border-r-2 border-white/60 animate-[hero-arrow_1.35s_ease-in-out_infinite]" />
        <span class="block h-5 w-5 rotate-45 border-b-2 border-r-2 border-white/60 animate-[hero-arrow_1.35s_ease-in-out_infinite] [animation-delay:160ms]" />
      </div>
    </div>
  </section>
</template>
