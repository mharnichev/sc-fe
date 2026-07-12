<script setup lang="ts">
const props = withDefaults(defineProps<{
  tag?: string
  block?: boolean
  threshold?: number
}>(), {
  block: false,
  threshold: 0.35,
})

const root = ref<HTMLElement | null>(null)
const isVisible = ref(false)
const rootTag = computed(() => props.tag || (props.block ? 'div' : 'span'))
const contentTag = computed(() => props.block ? 'div' : 'span')
let observer: IntersectionObserver | undefined

onMounted(() => {
  if (!root.value || !('IntersectionObserver' in window)) {
    isVisible.value = true
    return
  }

  observer = new IntersectionObserver(
    entries => {
      if (!entries.some(entry => entry.isIntersecting)) return

      isVisible.value = true
      observer?.disconnect()
      observer = undefined
    },
    {
      threshold: props.threshold,
      rootMargin: '0px 0px -8% 0px',
    },
  )

  observer.observe(root.value)
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <component
    :is="rootTag"
    ref="root"
    class="base-scribble-outline"
    :class="{ 'base-scribble-outline--block': block }"
  >
    <component :is="contentTag" class="base-scribble-outline__content"><slot /></component>
    <svg
      v-if="isVisible"
      class="base-scribble-outline__scribble"
      viewBox="0 0 420 170"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        class="base-scribble-outline__path"
        d="M20 88 C14 24 94 10 205 13 C330 16 404 35 410 83 C416 133 316 157 198 153 C79 149 12 128 20 88 Z"
      />
      <path
        class="base-scribble-outline__path base-scribble-outline__path--second"
        d="M25 93 C8 39 89 18 196 17 C318 15 397 30 407 78 C420 132 321 162 202 157 C80 152 15 132 25 93 Z"
      />
    </svg>
  </component>
</template>

<style scoped>
.base-scribble-outline {
  position: relative;
  isolation: isolate;
  display: inline-block;
  max-width: 100%;
}

.base-scribble-outline--block {
  display: block;
  width: 100%;
}

.base-scribble-outline__content {
  position: relative;
  z-index: 1;
}

.base-scribble-outline__scribble {
  pointer-events: none;
  position: absolute;
  inset: -0.22em -0.38em;
  z-index: 2;
  width: calc(100% + 0.76em);
  height: calc(100% + 0.44em);
  overflow: visible;
}

.base-scribble-outline__path {
  --path-length: 980;
  fill: none;
  stroke: #c01818;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: var(--path-length);
  stroke-dashoffset: var(--path-length);
  opacity: 0.95;
  filter: drop-shadow(0 0 2px rgb(192 24 24 / 0.35));
  animation: base-scribble-outline-draw 601ms cubic-bezier(0.58, 0.02, 0.26, 1) both;
}

.base-scribble-outline__path--second {
  stroke-width: 2;
  opacity: 0.75;
  animation-delay: 129ms;
}

@keyframes base-scribble-outline-draw {
  from {
    stroke-dashoffset: var(--path-length);
  }

  to {
    stroke-dashoffset: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .base-scribble-outline__path {
    animation: none;
    stroke-dashoffset: 0;
  }
}
</style>
