<script setup lang="ts">
import logoNameDark from '../../barbershop/assets/images/main/sc-logo-name-dark.webp'
import logoVinylDark from '../../barbershop/assets/logo-vinyl-dark.webp'

const { locale, localeOptions, setLocale, terms } = useBlogLocale()
</script>

<template>
  <header class="sticky top-0 z-40 overflow-hidden border-b border-neutral-800 bg-neutral-950/90 backdrop-blur">
    <div class="site-container relative flex min-h-20 items-center justify-between gap-3 pt-2 sm:min-h-24 sm:pt-3">
      <a
        href="#newsletter"
        class="relative z-10 inline-flex min-h-9 items-center justify-center border border-red-500 bg-red-500 px-2 text-[10px] font-bold uppercase tracking-[0.1em] text-white transition hover:border-red-600 hover:bg-red-600 sm:min-h-10 sm:px-4 sm:text-xs sm:tracking-[0.14em]"
      >
        {{ terms.subscribe }}
      </a>

      <div class="relative z-10 flex items-center gap-1 rounded-full border border-white/10 bg-black/50 px-1 py-1 text-white">
        <button
          v-for="option in localeOptions"
          :key="option.code"
          type="button"
          :data-locale-code="option.code"
          class="rounded-full px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition-all duration-200 sm:px-3 sm:text-xs sm:tracking-[0.14em]"
          :class="locale === option.code ? 'bg-white text-neutral-950' : 'text-white/50 hover:text-white'"
          :aria-pressed="locale === option.code"
          @click="setLocale(option.code)"
        >
          <span class="sm:hidden">{{ option.shortLabel }}</span>
          <span class="hidden sm:inline">{{ option.label }}</span>
        </button>
      </div>

      <NuxtLink
        to="/"
        class="absolute left-1/2 top-1 block h-20 w-24 -translate-x-1/2 overflow-hidden sm:top-2 sm:h-[6.5rem] sm:w-[10.8rem]"
        aria-label="Soul Cuts home"
      >
        <img
          :src="logoVinylDark"
          alt=""
          class="header-vinyl-spin absolute bottom-[-3.25rem] left-1/2 h-[6.5rem] w-[6.5rem] -translate-x-1/2 object-contain opacity-90 sm:bottom-[-3.75rem] sm:h-[7.5rem] sm:w-[7.5rem]"
          aria-hidden="true"
        >
        <img
          :src="logoNameDark"
          alt="Soul Cuts"
          class="relative z-10 mx-auto mt-7 h-auto w-full object-contain sm:mt-8"
        >
      </NuxtLink>
    </div>
  </header>
</template>

<style scoped>
.header-vinyl-spin {
  animation: header-vinyl-spin 18s linear infinite;
}

@keyframes header-vinyl-spin {
  from {
    transform: translateX(-50%) rotate(0deg);
  }

  to {
    transform: translateX(-50%) rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .header-vinyl-spin {
    animation: none;
  }
}
</style>
