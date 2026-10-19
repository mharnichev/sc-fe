<script setup lang="ts">
defineProps<{ label: string }>()
const open = ref(false)
</script>
<template>
  <BaseAccordion v-model="open" class="base-disclosure" summary-class="base-disclosure__summary" content-class="base-disclosure__content">
    <template #summary>{{ label }}</template>
    <slot />
  </BaseAccordion>
</template>
<style scoped>
.base-disclosure { min-width: 0; }
:deep(.base-disclosure__summary) { cursor: pointer; width: fit-content; max-width: 100%; font-size: .85rem; font-weight: 700; padding: .35rem 0; }
:deep(.base-disclosure__summary:focus-visible) { outline: 2px solid currentColor; outline-offset: 3px; }
:deep(.base-disclosure__content) { display: grid; gap: .65rem; padding-top: .5rem; }
</style>
