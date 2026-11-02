<script setup lang="ts">
defineProps<{ visible: boolean }>()
const shopAsset = useShopAsset()
</script>

<template>
  <div
    data-testid="page-transition-overlay"
    class="page-transition-overlay"
    :class="{ 'is-visible': visible }"
    :data-state="visible ? 'visible' : 'hidden'"
    aria-hidden="true"
  >
    <div class="page-transition-overlay__logo">
      <img :src="shopAsset('/soulcuts/sc-logo-name-dark.webp')" alt="" width="220" height="63" fetchpriority="high">
    </div>
  </div>
</template>

<style scoped>
.page-transition-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  background: #000;
  opacity: 0;
  pointer-events: none;
  transition: opacity 300ms ease-out;
}
.page-transition-overlay.is-visible { opacity: 1; pointer-events: auto; }
.page-transition-overlay__logo { width: min(220px, 55vw); opacity: 0; transition: opacity 300ms ease; }
.is-visible .page-transition-overlay__logo { opacity: 1; transition-delay: 700ms; }
.page-transition-overlay__logo img {
  display: block;
  width: 100%;
  height: auto;
}
.is-visible .page-transition-overlay__logo img {
  animation: soulcuts-loading-pulse 1800ms ease-in-out 700ms infinite;
}
@keyframes soulcuts-loading-pulse {
  0%, 100% { opacity: 0.65; transform: scale(0.97); }
  50% { opacity: 1; transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .page-transition-overlay, .page-transition-overlay__logo { transition: none; }
  .is-visible .page-transition-overlay__logo img { animation: none; }
}
</style>
