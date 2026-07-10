<script setup lang="ts">
const { locale } = useShopLocale()
const isPageTransitionVisible = usePageTransitionOverlay()

useHead({
  htmlAttrs: {
    lang: () => locale.value,
  },
})
</script>

<template>
  <div class="min-h-screen pb-[var(--shop-footer-height,620px)]">
    <BaseHeader />
    <main class="relative z-10 min-h-screen">
      <div class="site-container">
        <slot />
      </div>
    </main>
    <BaseFooter />
    <BaseBottomBar />
    <div
      data-testid="page-transition-overlay"
      class="pointer-events-none fixed inset-0 z-[9999] bg-black transition-opacity duration-300 ease-out"
      :class="isPageTransitionVisible ? 'opacity-100' : 'opacity-0'"
      aria-hidden="true"
    />
  </div>
</template>
