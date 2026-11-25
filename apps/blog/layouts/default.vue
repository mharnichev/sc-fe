<script setup lang="ts">
const { locale } = useBlogLocale()
const isPageTransitionVisible = usePageTransitionOverlay()

useHead({
  htmlAttrs: {
    lang: () => locale.value,
  },
})
</script>

<template>
  <div class="min-h-screen bg-neutral-950 text-neutral-100">
    <BlogHeader />
    <main class="relative z-10 bg-neutral-950">
      <slot />
    </main>
    <div class="footer-reveal">
      <BlogFooter class="footer-reveal__content" />
    </div>
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

<style scoped>
@media (prefers-reduced-motion: no-preference) {
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
