<script setup lang="ts">
import favicon from '~/assets/sc-ico.ico'

useHead({
  link: [
    {
      rel: 'icon',
      type: 'image/x-icon',
      href: favicon,
    },
  ],
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
