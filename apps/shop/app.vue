<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <div class="app-modal-teleport" />
  <ClientOnly>
    <GlobalModals />
    <ShopToast />
  </ClientOnly>
</template>
