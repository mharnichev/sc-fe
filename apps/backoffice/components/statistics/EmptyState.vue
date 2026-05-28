<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-center xl:rounded-2xl xl:px-4 xl:py-8">
    <p class="text-sm font-medium text-slate-900 xl:text-base">{{ title }}</p>
    <p v-if="description" class="mt-1 text-xs leading-5 text-slate-500 xl:mt-2 xl:text-sm xl:leading-6">{{ description }}</p>
  </div>
</template>
