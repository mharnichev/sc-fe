<script setup lang="ts">
import idemNaBukviLogo from '~/assets/idem-na-bukvi-white.png'

const youtubeUrl = 'https://www.youtube.com/@idemnabukvy/featured'
const marqueeItems = Array.from({ length: 10 }, (_, index) => index)
const marqueeTextLines = [
  'Тут ми висвітлюємо та розвиваємо культуру українського барберінгу. Приєднуйся!',
]
</script>

<template>
  <section class="overflow-hidden bg-stone-100" aria-label="Idem na bukvi YouTube">
    <div class="idem-marquee bg-white">
      <div class="idem-marquee__track">
        <a
          v-for="item in marqueeItems"
          :key="item"
          :href="youtubeUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="idem-marquee__item"
          aria-label="Відкрити YouTube канал Idem na bukvi"
        >
          <img :src="idemNaBukviLogo" alt="Idem na bukvi" class="h-[3.75rem] w-auto shrink-0 object-contain md:h-[4.75rem]">
          <span class="max-w-[12rem] text-[10px] font-semibold uppercase leading-[1.05] tracking-normal text-neutral-950 md:text-xs">
            <span v-for="line in marqueeTextLines" :key="line" class="block">
              {{ line }}
            </span>
          </span>
        </a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.idem-marquee {
  overflow: hidden;
}

.idem-marquee__track {
  display: flex;
  width: max-content;
  animation: idem-marquee 36s linear infinite;
  will-change: transform;
}

.idem-marquee:hover .idem-marquee__track {
  animation-play-state: paused;
}

.idem-marquee__item {
  display: inline-flex;
  min-width: max-content;
  align-items: center;
  gap: 0.25rem;
  padding: 0;
  text-decoration: none;
  transition:
    background-color 180ms ease,
    opacity 180ms ease;
}

.idem-marquee__item:hover {
  background-color: rgb(245 245 244);
}

@keyframes idem-marquee {
  from {
    transform: translate3d(0, 0, 0);
  }

  to {
    transform: translate3d(-50%, 0, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .idem-marquee__track {
    animation: none;
    transform: none;
  }
}
</style>
