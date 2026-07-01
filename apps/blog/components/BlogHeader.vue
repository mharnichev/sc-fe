<script setup lang="ts">
import type { LocaleCode } from '~/data/locale'
import logoNameDark from '../../barbershop/assets/images/main/sc-logo-name-dark.webp'

const { locale, localeOptions, setLocale, terms } = useBlogLocale()
const { openSubscribeModal } = useSubscribeModal()
const { trackBlogEvent } = useBlogAnalytics()
const isHeaderHidden = ref(false)
let lastScrollY = 0

const updateHeaderVisibility = () => {
  const currentScrollY = window.scrollY

  if (currentScrollY <= 120) {
    isHeaderHidden.value = false
    lastScrollY = currentScrollY
    return
  }

  const scrollDelta = currentScrollY - lastScrollY

  if (Math.abs(scrollDelta) < 6) {
    return
  }

  isHeaderHidden.value = scrollDelta > 0
  lastScrollY = currentScrollY
}

const handleSubscribeClick = () => {
  openSubscribeModal('', 'header')
}

const handleBookingClick = () => {
  trackBlogEvent('navigation_click', {
    destination: 'barbershop_booking',
    source: 'header',
  })
}

const handleLocaleClick = (localeCode: LocaleCode) => {
  trackBlogEvent('locale_select', {
    locale: localeCode,
    source: 'header',
  })
  setLocale(localeCode)
}

onMounted(() => {
  lastScrollY = window.scrollY
  updateHeaderVisibility()
  window.addEventListener('scroll', updateHeaderVisibility, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateHeaderVisibility)
})
</script>

<template>
  <header
    class="sticky top-0 z-40 overflow-hidden bg-neutral-950/90 backdrop-blur transition-transform duration-300 ease-out"
    :class="isHeaderHidden ? '-translate-y-full' : 'translate-y-0'"
  >
    <div class="site-container relative flex min-h-20 items-center justify-between gap-3 pt-2 sm:min-h-24 sm:pt-3">
      <div class="relative z-10 flex items-center gap-2">
        <BaseButton
          type="button"
          size="sm"
          @click="handleSubscribeClick"
        >
          {{ terms.subscribe }}
        </BaseButton>
        <BaseButton
          href="/#booking"
          variant="light"
          size="sm"
          effect="waves"
          @click="handleBookingClick"
        >
          {{ terms.bookAppointment }}
        </BaseButton>
      </div>

      <div class="relative z-10 flex items-center gap-1 rounded-full border border-white/10 bg-black/50 px-1 py-1 text-white">
        <button
          v-for="option in localeOptions"
          :key="option.code"
          type="button"
          :data-locale-code="option.code"
          class="rounded-full px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition-all duration-200 sm:px-3 sm:text-xs sm:tracking-[0.14em]"
          :class="locale === option.code ? 'bg-white text-neutral-950' : 'text-white/50 hover:text-white'"
          :aria-pressed="locale === option.code"
          @click="handleLocaleClick(option.code)"
        >
          <span class="sm:hidden">{{ option.shortLabel }}</span>
          <span class="hidden sm:inline">{{ option.label }}</span>
        </button>
      </div>

      <NuxtLink
        to="/"
        class="absolute left-1/2 top-1 hidden h-20 w-24 -translate-x-1/2 items-center justify-center overflow-hidden sm:top-2 sm:flex sm:h-[6.5rem] sm:w-[10.8rem]"
        :aria-label="terms.soulCutsHome"
      >
        <img
          :src="logoNameDark"
          :alt="terms.soulCutsLogoAlt"
          class="h-auto w-full object-contain"
        >
      </NuxtLink>
    </div>
  </header>
</template>
