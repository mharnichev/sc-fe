<script setup lang="ts">
withDefaults(defineProps<{ as?: 'div' | 'section' }>(), { as: 'div' })
</script>

<template>
  <component :is="as" class="scroll-parallax">
    <div class="scroll-parallax__media" aria-hidden="true">
      <slot name="media" />
    </div>
    <slot />
  </component>
</template>

<style scoped>
.scroll-parallax {
  position: relative;
  isolation: isolate;
  overflow: hidden;
}

.scroll-parallax__media {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}

@media (prefers-reduced-motion: no-preference) {
  @supports (animation-timeline: view()) {
    .scroll-parallax {
      view-timeline: --scroll-parallax block;
    }

    .scroll-parallax__media {
      transform-origin: bottom center;
      animation: scroll-parallax-shift 1ms linear both;
      animation-timeline: --scroll-parallax;
      animation-range: cover;
    }
  }
}

@keyframes scroll-parallax-shift {
  from { transform: scale(1.3); }
  to { transform: translateY(30%) scale(1.3); }
}
</style>
