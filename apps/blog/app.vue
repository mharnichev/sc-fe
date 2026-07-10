<script setup lang="ts">
import favicon from '../barbershop/assets/sc-ico.ico'

useHead({
  link: [
    {
      rel: 'icon',
      type: 'image/x-icon',
      href: favicon,
    },
    {
      rel: 'preload',
      as: 'font',
      type: 'font/woff2',
      href: '/fonts/cy-grotesk/cy-grotesk-key-400.c28dc18eed.woff2',
      crossorigin: 'anonymous',
    },
    {
      rel: 'preload',
      as: 'font',
      type: 'font/woff2',
      href: '/fonts/cy-grotesk/cy-grotesk-key-700.b99354bb8a.woff2',
      crossorigin: 'anonymous',
    },
    {
      rel: 'preload',
      as: 'font',
      type: 'font/woff2',
      href: '/fonts/cy-grotesk/cy-grotesk-key-900.8c05da4989.woff2',
      crossorigin: 'anonymous',
    },
  ],
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
