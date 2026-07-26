<script setup lang="ts">
const route = useRoute()

if (route.path === '/checkout') {
  await navigateTo('/checkout/purchase', { redirectCode: 302, replace: true })
}
</script>

<template>
  <NuxtPage />
</template>
