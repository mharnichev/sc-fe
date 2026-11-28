<script setup lang="ts">
const { locale, terms } = useTerms()
const { trackContactClick, trackEvent } = useAnalytics()
const { open: openBookingDrawer } = useFloatingBookingDrawer()
const { offers } = useBookingPromotions()
const firstVisitOffer = computed(() => firstVisitOffers(offers.value)
  .at(0) || null)
const firstVisitBadge = computed(() => {
  if (!firstVisitOffer.value) return ''
  return locale.value === 'en'
    ? `−${firstVisitOffer.value.discount_percent}% on your first visit`
    : `−${firstVisitOffer.value.discount_percent}% на перший візит`
})

const handleBookingClick = () => {
  openBookingDrawer()
  trackEvent('booking_cta_click', { source: 'hero_cta' })
}

const posterUrl = '/videos/hero/soulcuts-poster.webp'
const poster = ref<HTMLImageElement | null>(null)
const videoSource = ref('')
const isVideoPlaying = ref(false)
let frame: number | undefined
let motionPreference: MediaQueryList | undefined
let isMounted = false

useHead({
  link: [{ rel: 'preload', as: 'image', href: posterUrl, type: 'image/webp', fetchpriority: 'high' }],
})

const updateVideo = () => {
  if (motionPreference?.matches) {
    videoSource.value = ''
    isVideoPlaying.value = false
    return
  }

  const size = window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop'
  videoSource.value = `/videos/hero/soulcuts-${size}-light.webm`
}

onMounted(async () => {
  isMounted = true
  await poster.value?.decode().catch(() => {})
  if (!isMounted) return

  // Give the browser a paint with the decoded poster before inserting media sources.
  frame = window.requestAnimationFrame(() => {
    frame = window.requestAnimationFrame(() => {
      motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
      motionPreference.addEventListener('change', updateVideo)
      updateVideo()
    })
  })
})

onBeforeUnmount(() => {
  isMounted = false
  if (frame !== undefined) window.cancelAnimationFrame(frame)
  motionPreference?.removeEventListener('change', updateVideo)
})
</script>

<template>
  <section data-header-theme="dark" class="relative flex min-h-screen items-end overflow-hidden bg-neutral-950 text-white">
    <div class="pointer-events-none absolute inset-0 opacity-70" aria-hidden="true">
      <img
        ref="poster"
        :src="posterUrl"
        alt=""
        class="h-full w-full object-cover"
        fetchpriority="high"
        decoding="async"
      >
      <video
        v-if="videoSource"
        autoplay
        muted
        loop
        playsinline
        preload="none"
        class="absolute inset-0 h-full w-full object-cover"
        :class="{ 'opacity-0': !isVideoPlaying }"
        @playing="isVideoPlaying = true"
        @error="isVideoPlaying = false"
      >
        <source :src="videoSource" type="video/webm; codecs=vp9">
        <source src="/videos/hero/soulcuts-fallback.mp4" type="video/mp4">
      </video>
    </div>
    <div class="absolute inset-0 z-10 bg-gradient-to-t from-neutral-950 via-neutral-950/45 to-neutral-950/20" />

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

      <div class="flex max-w-[22rem] flex-col sm:max-w-none">
        <h1 class="section-title max-w-5xl text-center text-2xl font-semibold uppercase leading-[0.95] tracking-normal max-md:!pt-0 sm:text-2xl md:text-3xl">
          <LocaleLink
            to="/barbershop-odesa"
            class="hero-title-link transition-colors hover:text-white/80"
          >
            <BaseHoverUnderlineText>{{ terms.home.hero.title }}</BaseHoverUnderlineText>
          </LocaleLink>
        </h1>

        <p class="section-description text-sm leading-6 text-white/65 sm:text-base sm:leading-8 sm:text-white/60">
          {{ terms.home.hero.text }}
        </p>
      </div>
      <div class="max-w-3xl flex w-full flex-col gap-3 sm:flex-row">
        <div class="flex min-w-0 flex-1 flex-col gap-1.5">
          <span
            v-if="firstVisitBadge"
            class="hero-offer-badge self-center px-2.5 py-1 text-[0.68rem] font-bold uppercase leading-none tracking-[0.06em] text-white sm:self-start"
          >
            {{ firstVisitBadge }}
          </span>
          <BaseButton variant="light" effect="waves" block @click="handleBookingClick">{{ terms.home.hero.primaryCta }}</BaseButton>
        </div>
        <div class="flex min-w-0 flex-1 flex-col justify-end">
          <BaseButton to="#services" variant="dark" block @click="trackEvent('view_services', { source: 'hero_cta' })">
            {{ terms.home.hero.secondaryCta }}
          </BaseButton>
        </div>
      </div>

      <div class="mt-5 flex flex-col items-center gap-1 text-white/65" aria-hidden="true">
        <span class="block h-5 w-5 rotate-45 border-b-2 border-r-2 border-white/60 animate-[hero-arrow_1.35s_ease-in-out_infinite]" />
        <span class="block h-5 w-5 rotate-45 border-b-2 border-r-2 border-white/60 animate-[hero-arrow_1.35s_ease-in-out_infinite] [animation-delay:160ms]" />
      </div>
    </div>
  </section>
</template>

<style scoped>
@media (max-width: 767px) {
  .hero-title-link :deep(.base-hover-underline-text__lines) {
    display: none;
  }
}

.hero-offer-badge {
  background: linear-gradient(110deg, rgb(153 27 27), rgb(239 68 68), rgb(185 28 28));
  box-shadow: 0 5px 16px rgb(69 10 10 / 0.25);
}
</style>
