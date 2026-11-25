<script setup lang="ts">
const { locale } = useTerms()
const shouldMountFloatingActions = ref(false)
const isPhoneViewport = ref(false)
let phoneViewport: MediaQueryList | undefined

const updatePhoneViewport = () => {
  isPhoneViewport.value = phoneViewport?.matches ?? false
}

const mountFloatingActions = () => {
  shouldMountFloatingActions.value = true
}

onMounted(() => {
  phoneViewport = window.matchMedia('(width < 576px)')
  updatePhoneViewport()
  phoneViewport.addEventListener('change', updatePhoneViewport)
  window.addEventListener('scroll', mountFloatingActions, { once: true, passive: true })
  window.addEventListener('pointerdown', mountFloatingActions, { once: true })
  window.addEventListener('keydown', mountFloatingActions, { once: true })
})

onBeforeUnmount(() => {
  phoneViewport?.removeEventListener('change', updatePhoneViewport)
  window.removeEventListener('scroll', mountFloatingActions)
  window.removeEventListener('pointerdown', mountFloatingActions)
  window.removeEventListener('keydown', mountFloatingActions)
})

useHead({
  htmlAttrs: {
    lang: () => locale.value,
  },
})

if (import.meta.server) {
  useLocalBusinessStructuredData()
}
</script>

<template>
  <div class="min-h-screen bg-neutral-950 text-neutral-950">
    <Header />
    <main class="relative z-10 bg-stone-100">
      <slot />
    </main>
    <div id="contact" data-header-theme="dark" class="h-0 bg-neutral-950" aria-hidden="true" />
    <div class="footer-reveal">
      <Footer class="footer-reveal__content" />
    </div>
    <ClientOnly>
      <LazyCookieConsentBanner v-if="shouldMountFloatingActions" />
      <LazyFloatingBookingDrawer v-if="isPhoneViewport || shouldMountFloatingActions" />
    </ClientOnly>
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine) {
  @supports (animation-timeline: view()) {
    .footer-reveal {
      position: relative;
      z-index: 0;
      view-timeline: --footer-reveal block;
    }

    .footer-reveal__content {
      animation: footer-reveal 1ms linear both;
      animation-timeline: --footer-reveal;
      animation-range: entry;
    }

    .footer-reveal:focus-within .footer-reveal__content {
      animation-name: none;
    }
  }
}

@keyframes footer-reveal {
  from { transform: translateY(-50%); }
  to { transform: translateY(0); }
}
</style>
