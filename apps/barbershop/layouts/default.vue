<script setup lang="ts">
const { locale } = useTerms()
const shouldMountFloatingActions = ref(false)
const shouldMountFooter = ref(false)
let footerIdleHandle: number | undefined
let footerLoadScheduled = false

const mountFloatingActions = () => {
  shouldMountFloatingActions.value = true
}

const mountFooter = () => {
  shouldMountFooter.value = true
}

const scheduleFooterMount = () => {
  if (footerLoadScheduled) return

  footerLoadScheduled = true
  const schedule = () => {
    if (shouldMountFooter.value) return

    if (typeof window.requestIdleCallback === 'function') {
      footerIdleHandle = window.requestIdleCallback(mountFooter, { timeout: 3500 })
      return
    }

    footerIdleHandle = window.setTimeout(mountFooter, 2200)
  }

  if (document.readyState === 'complete') {
    schedule()
  }
  else {
    window.addEventListener('load', schedule, { once: true })
  }
}

onMounted(() => {
  scheduleFooterMount()
  window.addEventListener('scroll', mountFooter, { once: true, passive: true })
  window.addEventListener('pointerdown', mountFooter, { once: true })
  window.addEventListener('keydown', mountFooter, { once: true })
  window.addEventListener('scroll', mountFloatingActions, { once: true, passive: true })
  window.addEventListener('pointerdown', mountFloatingActions, { once: true })
  window.addEventListener('keydown', mountFloatingActions, { once: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', mountFooter)
  window.removeEventListener('pointerdown', mountFooter)
  window.removeEventListener('keydown', mountFooter)
  window.removeEventListener('scroll', mountFloatingActions)
  window.removeEventListener('pointerdown', mountFloatingActions)
  window.removeEventListener('keydown', mountFloatingActions)
  if (footerIdleHandle !== undefined) {
    window.cancelIdleCallback?.(footerIdleHandle)
    window.clearTimeout(footerIdleHandle)
  }
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
  <div class="min-h-screen bg-neutral-950 pb-[var(--barbershop-footer-height,620px)] text-neutral-950">
    <Header />
    <main class="relative z-10 bg-stone-100">
      <slot />
    </main>
    <div id="contact" data-header-theme="dark" class="h-0 bg-neutral-950" aria-hidden="true" />
    <ClientOnly v-if="shouldMountFooter">
      <Footer />
    </ClientOnly>
    <ClientOnly v-if="shouldMountFloatingActions">
      <LazyCookieConsentBanner />
      <LazyFloatingBookingDrawer />
    </ClientOnly>
  </div>
</template>
