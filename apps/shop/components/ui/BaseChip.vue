<script setup lang="ts">
withDefaults(defineProps<{
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
}>(), {
  type: 'button',
  disabled: false,
})
</script>

<template>
  <button class="base-chip" :type="type" :disabled="disabled">
    <span class="base-chip__content"><slot /></span>
    <span v-if="$slots.trailing" class="base-chip__trailing">
      <slot name="trailing" />
    </span>
  </button>
</template>

<style scoped>
.base-chip {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 0.25rem;
  white-space: normal;
}

.base-chip__content {
  min-width: 0;
  overflow-wrap: anywhere;
  text-align: left;
  word-break: break-word;
}

.base-chip__trailing {
  display: inline-flex;
  flex: 0 0 auto;
}
</style>
