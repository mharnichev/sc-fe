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
  <div class="min-h-screen" :style="layoutStyle">
    <BaseHeader @visibility-change="handleHeaderVisibilityChange" />
    <main class="relative z-10 min-h-screen">
      <div class="site-container" :class="{ 'site-container--home': route.path === '/' }">
        <slot />
      </div>
      <HomeJournalSection v-if="route.path === '/'" class="home-journal-section" />
    </main>
    <BaseFooter />
    <BaseBottomBar />
    <ClientOnly><ShopSupportLauncher /></ClientOnly>
    <BasePageTransitionOverlay :visible="isHydrated && isPageTransitionVisible" />
  </div>
</template>

<style scoped>
.site-container--home {
  padding-bottom: 0;
}

.home-journal-section {
  margin-top: 4rem;
}
</style>
