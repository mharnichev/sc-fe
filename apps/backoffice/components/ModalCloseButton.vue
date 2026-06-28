<script setup lang="ts">
import { XMarkIcon } from '@heroicons/vue/24/outline'

defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <BaseButton
    type="button"
    class="backoffice-modal-close-button"
    :disabled="disabled"
    aria-label="Закрити"
    title="Закрити"
    @click="emit('click')"
  >
    <XMarkIcon class="h-5 w-5" aria-hidden="true" />
  </BaseButton>
</template>
