<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  description?: string
  compact?: boolean
}>(), {
  title: 'Нічого не знайдено',
})
</script>

<template>
  <div
    class="base-empty-state flex flex-col items-center justify-center text-center"
    :class="compact ? 'gap-2 px-4 py-6' : 'gap-3 px-5 py-10'"
    role="status"
  >
    <div v-if="$slots.icon" class="base-empty-state__icon flex h-11 w-11 items-center justify-center rounded-2xl">
      <slot name="icon" />
    </div>
    <div class="max-w-lg">
      <p class="font-semibold text-ui-primary">{{ title }}</p>
      <p v-if="description" class="mt-1 text-sm text-ui-muted">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="mt-1 flex flex-wrap justify-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
