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
    <BlogFooter />
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
