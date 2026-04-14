<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
}>()
</script>

<template>
  <div class="rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-sm">
    <p class="text-sm text-stone-500">
      {{ label }}
    </p>
    <p class="mt-2 text-3xl font-semibold text-stone-900">
      {{ value }}
    </p>
  </div>
</template>
