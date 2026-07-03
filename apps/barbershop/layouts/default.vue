<script setup lang="ts">
const { locale } = useTerms()
const shouldMountFloatingActions = ref(false)

const mountFloatingActions = () => {
  shouldMountFloatingActions.value = true
}

onMounted(() => {
  if (window.location.hash === '#booking' || window.location.hash === '#booking-stepper') {
    mountFloatingActions()
    return
  }

  window.addEventListener('scroll', mountFloatingActions, { once: true, passive: true })
  window.addEventListener('pointerdown', mountFloatingActions, { once: true })
  window.addEventListener('keydown', mountFloatingActions, { once: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', mountFloatingActions)
  window.removeEventListener('pointerdown', mountFloatingActions)
  window.removeEventListener('keydown', mountFloatingActions)
})

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
    <ClientOnly v-if="shouldMountFloatingActions">
      <LazyCookieConsentBanner />
      <LazyFloatingBookingDrawer />
    </ClientOnly>
  </div>
</template>
