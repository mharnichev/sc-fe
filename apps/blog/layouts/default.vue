<script setup lang="ts">
const { locale } = useBlogLocale()
const isPageTransitionVisible = usePageTransitionOverlay()
const shouldMountFooter = ref(false)
let footerIdleHandle: number | undefined

const mountFooter = () => {
  shouldMountFooter.value = true
}

const scheduleFooterMount = () => {
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
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', mountFooter)
  window.removeEventListener('pointerdown', mountFooter)
  window.removeEventListener('keydown', mountFooter)
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
</script>

<template>
  <div class="min-h-screen bg-neutral-950 pb-[var(--blog-footer-height,620px)] text-neutral-100">
    <BlogHeader />
    <main class="relative z-10 bg-neutral-950">
      <slot />
    </main>
    <ClientOnly v-if="shouldMountFooter">
      <BlogFooter />
    </ClientOnly>
    <LazyBlogSubscribeModal />
    <div
      data-testid="page-transition-overlay"
      class="fixed inset-0 z-[9999] bg-black transition-opacity duration-300 ease-out"
      :class="isPageTransitionVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'"
      :data-state="isPageTransitionVisible ? 'visible' : 'hidden'"
      aria-hidden="true"
    />
  </div>
</template>
