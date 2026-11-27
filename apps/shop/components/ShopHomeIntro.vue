<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const asset = useShopAsset()
const poster = asset('videos/soulcuts-poster.webp')
const fallback = asset('videos/soulcuts-fallback.mp4')
const source = ref('')
const hasPlayed = ref(false)
let preferredSource = ''
let motion: MediaQueryList | undefined
let frame = 0

const updateVideo = () => {
  if (motion?.matches) {
    hasPlayed.value = false
    source.value = ''
    return
  }

  source.value = preferredSource
}

onMounted(() => {
  motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  // Two animation frames leave a paint for the server-rendered poster before adding a video URL.
  frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(() => {
      const mobile = window.matchMedia('(max-width: 767px)').matches
      preferredSource = document.createElement('video').canPlayType('video/webm')
        ? asset(mobile ? 'videos/soulcuts-mobile-light.webm' : 'videos/soulcuts-desktop-light.webm')
        : fallback
      motion?.addEventListener('change', updateVideo)
      updateVideo()
    })
  })
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  motion?.removeEventListener('change', updateVideo)
})

const onVideoError = () => {
  hasPlayed.value = false
  if (source.value === fallback) {
    preferredSource = ''
  }
  else {
    preferredSource = fallback
  }
  updateVideo()
}
</script>

<template>
  <header class="shop-intro">
    <img
      :src="poster"
      alt=""
      class="shop-intro__media"
      fetchpriority="high"
    >
    <video
      v-if="source"
      :key="source"
      :src="source"
      class="shop-intro__media"
      :class="{ 'shop-intro__video--ready': hasPlayed }"
      aria-hidden="true"
      tabindex="-1"
      autoplay
      muted
      loop
      playsinline
      @playing="hasPlayed = true"
      @error="onVideoError"
    />
    <div class="shop-intro__content space-y-3">
      <slot />
    </div>
  </header>
</template>

<style scoped>
.shop-intro {
  position: relative;
  isolation: isolate;
  display: flex;
  min-height: clamp(28rem, 78svh, 58rem);
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 1rem;
  overflow: hidden;
  padding: clamp(1.25rem, 4vw, 3.5rem);
  padding-block-start: calc(var(--shop-header-offset, 7rem) + 1rem);
  background: #171717;
  color: #fff;
}

.shop-intro::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  background: linear-gradient(to bottom, transparent 48%, rgb(0 0 0 / 55%)), rgb(12 12 12 / 52%);
  content: '';
}

.shop-intro__media {
  position: absolute;
  z-index: -2;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

video.shop-intro__media {
  visibility: hidden;
}

video.shop-intro__video--ready {
  visibility: visible;
}

:slotted(h1) {
  color: inherit;
}
</style>
