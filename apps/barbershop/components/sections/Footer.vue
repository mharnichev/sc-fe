<script setup lang="ts">
import logoNameDark from '~/assets/images/main/sc-logo-name-dark.webp'
import logoVinylDark from '~/assets/logo-vinyl-dark.webp'

const { terms } = useTerms()
const { resetCookieConsent } = useCookieConsent()
const { trackContactClick, trackEvent } = useAnalytics()

const shouldShowFooterEmail = ref(false)
const phoneHref = computed(() => `tel:${terms.value.home.contact.phone.replace(/[^\d+]/g, '')}`)

const openFooterEmail = () => {
  trackContactClick('email', 'footer')

  if (!import.meta.client || !terms.value.home.contact.email) return

  window.location.href = `mailto:${terms.value.home.contact.email}`
}

onMounted(() => {
  shouldShowFooterEmail.value = true
})
</script>

<template>
  <footer data-header-theme="dark" class="overflow-hidden bg-neutral-950 py-8 text-white md:py-12">
    <div class="site-container w-full">
      <div class="grid gap-4 md:gap-8 lg:grid-cols-[minmax(0,1fr)_18.7rem] lg:items-end lg:gap-12">
        <div class="order-2 hidden md:block lg:order-2">
          <div class="relative mx-auto aspect-square w-full max-w-[min(44vw,8.75rem)] md:max-w-[min(56vw,13.5rem)] lg:mx-0 lg:max-w-[18.7rem]" aria-label="Soul Cuts">
            <img
              :src="logoVinylDark"
              alt=""
              class="footer-vinyl-spin h-full w-full object-contain"
              width="712"
              height="712"
              loading="lazy"
              fetchpriority="low"
              decoding="async"
              aria-hidden="true"
            >
            <div class="pointer-events-none absolute left-1/2 top-1/2 flex aspect-square w-[70%] -translate-x-1/2 -translate-y-1/2 items-center justify-center p-[6%]">
              <span class="absolute left-1/2 top-1/2 aspect-square w-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 shadow-[0_0_2rem_rgba(255,255,255,0.12)]" aria-hidden="true" />
              <img
                :src="logoNameDark"
                alt="Soul Cuts"
                class="relative z-10 w-full object-contain"
                width="360"
                height="102"
                loading="lazy"
                fetchpriority="low"
                decoding="async"
              >
            </div>
          </div>
        </div>

        <div class="order-1 w-full space-y-3 md:space-y-5 lg:order-1">
          <SectionLabel>{{ terms.home.cta.label }}</SectionLabel>
          <h2 class="mt-3 w-full text-2xl font-semibold uppercase leading-tight md:mt-5 md:text-4xl">
            {{ terms.home.cta.title }}
          </h2>
          <p class="max-w-2xl text-sm leading-6 text-white/65 md:text-base md:leading-8">
            {{ terms.home.cta.text }}
          </p>
          <BaseButton class="w-full md:w-auto" to="#booking" variant="light" effect="waves" @click="trackEvent('booking_start', { source: 'footer_cta' })">{{ terms.home.cta.button }}</BaseButton>
        </div>
      </div>

      <div class="mt-6 grid gap-5 md:mt-12 md:grid-cols-[1.2fr_0.8fr_0.8fr] md:gap-8">
        <div>
          <p class="type-eyebrow type-eyebrow--wide text-sm">{{ terms.common.brand }}</p>
          <p class="mt-4 max-w-sm text-sm leading-7 text-white/55">
            {{ terms.home.footer.description }}
          </p>
        </div>
        <div>
          <p class="type-eyebrow text-xs text-white/45">{{ terms.common.info }}</p>
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
              <button type="button" class="transition hover:text-white hover:underline" @click="openFooterEmail">
                {{ shouldShowFooterEmail ? terms.home.contact.email : 'Email' }}
              </button>
            </p>
            <p>
              <a href="/blog/" class="transition hover:text-white hover:underline" @click="trackEvent('view_blog', { source: 'footer' })">
                {{ terms.home.journal.label }}
              </a>
            </p>
            <p>
              <NuxtLink to="/barbershop-odesa" class="transition hover:text-white hover:underline">
                {{ terms.common.localSeoPage }}
              </NuxtLink>
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
          <p class="type-eyebrow text-xs text-white/45">{{ terms.common.hours }}</p>
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
