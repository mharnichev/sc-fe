<script setup lang="ts">
import { NuxtPage } from '#components'
import CabinetShell from '~/components/cabinet/CabinetShell.vue'

const contentTransition = { name: 'cabinet-content', mode: 'out-in' as const }
</script>

<template>
  <CabinetShell>
    <NuxtPage :transition="contentTransition" />
  </CabinetShell>
</template>

<style>
.cabinet-content-enter-active {
  transition: opacity 240ms ease-out, transform 240ms ease-out;
}
.cabinet-content-leave-active {
  transition: opacity 120ms ease-in;
}
.cabinet-content-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.cabinet-content-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .cabinet-content-enter-active,
  .cabinet-content-leave-active {
    transition: none;
  }
  .cabinet-content-enter-from {
    transform: none;
  }
}
</style>
