<script setup lang="ts">
import { feedbackFaces, type FeedbackFaceName } from './feedback-faces'

const props = withDefaults(defineProps<{
  name?: FeedbackFaceName
  label?: string
}>(), {
  name: 'puzzled-pucker',
  label: '',
})

const markup = computed(() => feedbackFaces[props.name])
</script>

<template>
  <span
    class="feedback-face"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
    v-html="markup"
  />
</template>

<style scoped>
.feedback-face {
  display: inline-flex;
  width: 100%;
  aspect-ratio: 1;
  color: inherit;
  line-height: 0;
}

.feedback-face :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
