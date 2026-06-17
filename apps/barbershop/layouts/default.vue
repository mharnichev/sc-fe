<script setup lang="ts">
const { locale } = useTerms()

useHead({
  htmlAttrs: {
    lang: () => locale.value,
  },
})

useLocalBusinessStructuredData()
</script>

<template>
  <div class="min-h-screen bg-neutral-950 pb-[var(--barbershop-footer-height,620px)] text-neutral-950">
    <Header />
    <main class="relative z-10 bg-stone-100">
      <slot />
    </main>
    <div id="contact" data-header-theme="dark" class="h-0 bg-neutral-950" aria-hidden="true" />
    <Footer />
    <ClientOnly>
      <CookieConsentBanner />
      <FloatingBookingDrawer />
    </ClientOnly>
  </div>
</template>
