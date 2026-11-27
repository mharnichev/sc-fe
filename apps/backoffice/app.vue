<script setup lang="ts">
useBackofficeTheme()
</script>

<template>
  <NuxtLoadingIndicator color="var(--bo-accent)" />
  <NetworkStatus />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <BaseToastNotification />
</template>
