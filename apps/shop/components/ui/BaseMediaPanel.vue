<template>
  <div class="overflow-hidden bg-neutral-200">
    <img :src="src" :alt="alt" class="h-full min-h-[22rem] w-full object-cover" loading="lazy">
  </div>
</template>

<script setup lang="ts">
defineProps<{
  src: string
  alt: string
}>()
</script>
