<script setup lang="ts">
defineProps<{
  eyebrow?: string
  title: string
  description?: string
  scribbleTitle?: boolean
}>()
</script>

<template>
  <section class="space-y-4">
    <p v-if="eyebrow" class="type-eyebrow type-eyebrow--wide text-xs">
      <BaseScribbleOutline v-if="scribbleTitle">{{ eyebrow }}</BaseScribbleOutline>
      <template v-else>{{ eyebrow }}</template>
    </p>
    <div class="space-y-2">
      <h2 class="section-title type-title-strong">
        {{ title }}
      </h2>
      <p v-if="description" class="section-subtitle max-w-2xl text-stone-600">
        {{ description }}
      </p>
    </div>
    <slot />
  </section>
</template>
