<script setup lang="ts">
const { locale } = useShopLocale()
const isPageTransitionVisible = usePageTransitionOverlay()
const headerState = ref<{ visible: boolean, height: number } | null>(null)

const layoutStyle = computed(() => {
  if (!headerState.value) return

  return {
    '--shop-header-offset': headerState.value.visible
      ? `${headerState.value.height}px`
      : '0px',
  }
})

const handleHeaderVisibilityChange = (state: { visible: boolean, height: number }) => {
  headerState.value = state
}

useHead({
  htmlAttrs: {
    lang: () => locale.value,
  },
})
</script>

<template>
  <div class="min-h-screen" :style="layoutStyle">
    <BaseHeader @visibility-change="handleHeaderVisibilityChange" />
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
