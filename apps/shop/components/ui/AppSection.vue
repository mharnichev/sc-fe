<script setup lang="ts">
defineProps<{
  eyebrow?: string
  title: string
  description?: string
}>()
</script>

<template>
  <section class="space-y-4">
    <p v-if="eyebrow" class="text-xs font-semibold uppercase tracking-[0.3em] text-amber-600">
      {{ eyebrow }}
    </p>
    <div class="space-y-2">
      <h2 class="text-3xl font-semibold text-stone-900">
        {{ title }}
      </h2>
      <p v-if="description" class="max-w-2xl text-sm leading-7 text-stone-600">
        {{ description }}
      </p>
    </div>
    <slot />
  </section>
</template>
