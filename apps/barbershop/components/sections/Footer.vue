<script setup lang="ts">
import logoNameDark from '~/assets/images/main/sc-logo-name-dark.webp'
import logoVinylDark from '~/assets/logo-vinyl-dark.webp'

const { terms } = useTerms()
const { resetCookieConsent } = useCookieConsent()
const { trackContactClick, trackEvent } = useAnalytics()

const footerElement = ref<HTMLElement | null>(null)
const footerRevealOffset = ref(0)
const phoneHref = computed(() => `tel:${terms.value.home.contact.phone.replace(/[^\d+]/g, '')}`)
const emailHref = computed(() => `mailto:${terms.value.home.contact.email}`)
const footerStyle = computed(() => ({
  transform: `translate3d(0, ${footerRevealOffset.value}px, 0)`,
}))

let revealFrame: number | null = null

const syncFooterHeight = () => {
  if (!import.meta.client) return 0

  const footerHeight = Math.ceil(footerElement.value?.offsetHeight ?? 0)

  if (footerHeight > 0) {
    document.documentElement.style.setProperty('--barbershop-footer-height', `${footerHeight}px`)
  }

  return footerHeight
}

const updateFooterReveal = () => {
  if (!import.meta.client) return

  revealFrame = null

  const footerHeight = syncFooterHeight()
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (reduceMotion || footerHeight <= 0) {
    footerRevealOffset.value = 0
    return
  }

  const main = document.querySelector('main')
  const mainBottom = main?.getBoundingClientRect().bottom ?? window.innerHeight
  const viewportHeight = window.innerHeight || 1
  const revealRange = Math.min(footerHeight, viewportHeight)
  const revealDistance = Math.min(footerHeight * 0.35, viewportHeight * 0.24)
  const progress = Math.min(1, Math.max(0, (viewportHeight - mainBottom) / revealRange))

  footerRevealOffset.value = Number(((1 - progress) * revealDistance).toFixed(2))
}

const requestFooterRevealUpdate = () => {
  if (!import.meta.client || revealFrame !== null) {
    return
  }

  revealFrame = window.requestAnimationFrame(updateFooterReveal)
}

onMounted(() => {
  if (!import.meta.client) return

  window.addEventListener('scroll', requestFooterRevealUpdate, { passive: true })
  window.addEventListener('resize', requestFooterRevealUpdate)
  requestFooterRevealUpdate()
})

onBeforeUnmount(() => {
  if (!import.meta.client) return

  window.removeEventListener('scroll', requestFooterRevealUpdate)
  window.removeEventListener('resize', requestFooterRevealUpdate)

  if (revealFrame !== null) {
    window.cancelAnimationFrame(revealFrame)
  }
})
</script>

<template>
  <footer
    ref="footerElement"
    data-header-theme="dark"
    class="fixed inset-x-0 bottom-0 z-0 overflow-hidden bg-neutral-950 py-8 text-white will-change-transform md:py-12"
    :style="footerStyle"
  >
    <div class="site-container w-full">
      <div class="grid gap-4 md:gap-8 lg:grid-cols-[minmax(0,1fr)_18.7rem] lg:items-end lg:gap-12">
        <div class="order-2 lg:order-2">
          <div class="relative mx-auto aspect-square w-full max-w-[min(44vw,8.75rem)] md:max-w-[min(56vw,13.5rem)] lg:mx-0 lg:max-w-[18.7rem]" aria-label="Soul Cuts">
            <img
              :src="logoVinylDark"
              alt=""
              class="footer-vinyl-spin h-full w-full object-contain"
              aria-hidden="true"
            >
            <div class="pointer-events-none absolute left-1/2 top-1/2 flex aspect-square w-[70%] -translate-x-1/2 -translate-y-1/2 items-center justify-center p-[6%]">
              <span class="absolute left-1/2 top-1/2 aspect-square w-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 shadow-[0_0_2rem_rgba(255,255,255,0.12)]" aria-hidden="true" />
              <img :src="logoNameDark" alt="Soul Cuts" class="relative z-10 w-full object-contain">
            </div>
          </div>
        </div>

        <div class="order-1 w-full space-y-3 md:space-y-5 lg:order-1">
          <SectionLabel>{{ terms.home.cta.label }}</SectionLabel>
          <h2 class="mt-3 w-full text-[1.875rem] font-semibold leading-tight md:mt-5 md:text-[52px]">
            {{ terms.home.cta.title }}
          </h2>
          <p class="max-w-2xl text-sm leading-6 text-white/65 md:text-base md:leading-8">
            {{ terms.home.cta.text }}
          </p>
          <PrimaryButton to="#booking" @click="trackEvent('booking_start', { source: 'footer_cta' })">{{ terms.home.cta.button }}</PrimaryButton>
        </div>
      </div>

      <div class="mt-6 grid gap-5 md:mt-12 md:grid-cols-[1.2fr_0.8fr_0.8fr] md:gap-8">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.32em]">{{ terms.common.brand }}</p>
          <p class="mt-4 max-w-sm text-sm leading-7 text-white/55">
            {{ terms.home.footer.description }}
          </p>
        </div>
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">{{ terms.common.info }}</p>
          <div class="mt-4 space-y-2 text-sm text-white/70">
            <p>
              <a
                :href="terms.home.contact.mapUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="underline decoration-white/20 underline-offset-4 transition hover:text-white hover:decoration-white"
                @click="trackContactClick('map', 'footer')"
              >
                {{ terms.home.contact.address }}
              </a>
            </p>
            <p>
              <a :href="phoneHref" class="transition hover:text-white hover:underline" @click="trackContactClick('phone', 'footer')">
                {{ terms.home.contact.phone }}
              </a>
            </p>
            <p v-if="terms.home.contact.email">
              <a :href="emailHref" class="transition hover:text-white hover:underline" @click="trackContactClick('email', 'footer')">
                {{ terms.home.contact.email }}
              </a>
            </p>
            <button
              type="button"
              class="text-left underline decoration-white/20 underline-offset-4 transition hover:text-white hover:decoration-white"
              @click="resetCookieConsent"
            >
              {{ terms.common.cookieSettings }}
            </button>
          </div>
        </div>
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">{{ terms.common.hours }}</p>
          <dl class="mt-4 space-y-2 text-sm text-white/70">
            <div v-for="[day, time] in terms.home.contact.hours" :key="day" class="flex justify-between gap-4">
              <dt>{{ day }}</dt>
              <dd>{{ time }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.footer-vinyl-spin {
  animation: footer-vinyl-spin 18s linear infinite;
}

@keyframes footer-vinyl-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .footer-vinyl-spin {
    animation: none;
  }
}
</style>
