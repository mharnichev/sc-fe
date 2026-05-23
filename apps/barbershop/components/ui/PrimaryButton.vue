<template>
  <NuxtLink
    :to="to"
    class="inline-flex items-center justify-center rounded-none bg-neutral-950 px-6 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-neutral-800"
  >
    <slot />
  </NuxtLink>
</template>

<script setup lang="ts">
defineProps<{
  to: string
}>()
</script>
