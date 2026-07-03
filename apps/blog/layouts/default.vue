<script setup lang="ts">
const { locale } = useBlogLocale()
const isPageTransitionVisible = usePageTransitionOverlay()
const route = useRoute()
const isPostsRoute = computed(() => route.path === '/posts' || route.path.startsWith('/posts/'))

useHead({
  htmlAttrs: {
    lang: () => locale.value,
  },
})
</script>

<template>
  <div class="min-h-screen bg-neutral-950 pb-[var(--blog-footer-height,620px)] text-neutral-100">
    <BlogHeader v-if="!isPostsRoute" />
    <PostBurgerMenu v-else />
    <main class="relative z-10 bg-neutral-950">
      <slot />
    </main>
    <BlogFooter />
    <LazyBlogSubscribeModal />
    <div
      data-testid="page-transition-overlay"
      class="pointer-events-none fixed inset-0 z-[9999] bg-black transition-opacity duration-300 ease-out"
      :class="isPageTransitionVisible ? 'opacity-100' : 'opacity-0'"
      aria-hidden="true"
    />
  </div>
</template>
