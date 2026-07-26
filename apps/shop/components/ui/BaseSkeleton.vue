<script setup lang="ts">
withDefaults(defineProps<{
  width?: string
  height?: string
  radius?: string
}>(), {
  width: '100%',
  height: '1rem',
  radius: '0',
})
</script>

<template>
  <span
    class="base-skeleton"
    :style="{ width, height, borderRadius: radius }"
    aria-hidden="true"
  />
</template>

<style scoped>
.base-skeleton {
  position: relative;
  display: block;
  flex: 0 0 auto;
  overflow: hidden;
  background: #eeeeea;
}

.base-skeleton::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.65), transparent);
  content: "";
  animation: base-skeleton-shimmer 1.2s infinite;
}

@keyframes base-skeleton-shimmer {
  from {
    transform: translateX(-100%);
  }

  to {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .base-skeleton::after {
    animation: none;
  }
}
</style>
