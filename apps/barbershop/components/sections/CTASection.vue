<script setup lang="ts">
import logoNameDark from '~/assets/images/main/sc-logo-name-dark.webp'
import logoVinylDark from '~/assets/logo-vinyl-dark.webp'

const { terms } = useTerms()
</script>

<template>
  <section id="contact" data-header-theme="dark" class="section-y-large bg-neutral-950 text-white">
    <div class="site-container grid gap-8 lg:grid-cols-[minmax(0,1fr)_18.7rem] lg:items-end lg:gap-12">
      <div class="order-2 lg:order-2" data-reveal="soft">
        <div class="relative mx-auto aspect-square w-full max-w-[min(72vw,16rem)] lg:mx-0 lg:max-w-[18.7rem]" aria-label="Soul Cuts">
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
      <div class="order-1 w-full space-y-4 md:space-y-6 lg:order-1" data-reveal="soft" data-reveal-delay="140">
        <SectionLabel>{{ terms.home.cta.label }}</SectionLabel>
        <h2 class="mt-4 w-full text-2xl font-semibold uppercase leading-tight md:mt-6 md:text-4xl">
          {{ terms.home.cta.title }}
        </h2>
        <p class="text-base leading-7 text-white/65 md:leading-8">
          {{ terms.home.cta.text }}
        </p>
        <BaseButton to="#booking" variant="light" effect="waves">{{ terms.home.cta.button }}</BaseButton>
      </div>
    </div>
  </section>
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
