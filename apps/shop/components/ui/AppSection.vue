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
      {{ eyebrow }}
    </p>
    <div class="space-y-2">
      <h2 class="type-page-title text-3xl text-stone-900">
        <BaseScribbleOutline v-if="scribbleTitle">
          {{ title }}
        </BaseScribbleOutline>
        <template v-else>{{ title }}</template>
      </h2>
      <p v-if="description" class="max-w-2xl text-sm leading-7 text-stone-600">
        {{ description }}
      </p>
    </div>
    <slot />
  </section>
</template>
