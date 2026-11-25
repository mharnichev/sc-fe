<script setup lang="ts">
const { locale } = useShopLocale()
const route = useRoute()
const isPageTransitionVisible = usePageTransitionOverlay()
const isHydrated = ref(false)
const headerState = ref<{ visible: boolean, height: number } | null>(null)

onMounted(() => {
  isHydrated.value = true
})

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
  <div class="shop-layout--fixed-header min-h-screen" :style="layoutStyle">
    <BaseHeader @visibility-change="handleHeaderVisibilityChange" />
    <main class="relative z-10 min-h-screen bg-white">
      <div class="site-container" :class="{ 'site-container--home': route.path === '/' }">
        <slot />
      </div>
      <HomeJournalSection v-if="route.path === '/'" class="home-journal-section" />
    </main>
    <div class="footer-reveal">
      <BaseFooter class="footer-reveal__content" />
    </div>
    <BaseBottomBar />
    <ClientOnly><ShopSupportLauncher /></ClientOnly>
    <BasePageTransitionOverlay :visible="isHydrated && isPageTransitionVisible" />
  </div>
</template>

<style scoped>
@media (width < 768px) {
  .shop-layout--fixed-header {
    --shop-header-offset: calc(3.8rem + env(safe-area-inset-top, 0px));
    padding-top: var(--shop-header-offset);
  }
}

.site-container--home {
  padding-bottom: 0;
}

.home-journal-section {
  margin-top: 4rem;
}

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
