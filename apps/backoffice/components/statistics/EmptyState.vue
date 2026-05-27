<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
    <p class="font-medium text-slate-900">{{ title }}</p>
    <p v-if="description" class="mt-2 text-sm leading-6 text-slate-500">{{ description }}</p>
  </div>
</template>
