<script setup lang="ts">
import type { FeedbackFaceName, FeedbackStateKind } from './feedback-faces'
import FeedbackFace from './FeedbackFace.vue'

const props = withDefaults(defineProps<{
  title: string
  description?: string
  kind?: FeedbackStateKind
  face?: FeedbackFaceName
  seed?: string | number
  compact?: boolean
}>(), {
  description: '',
  kind: 'empty',
  face: undefined,
  seed: '',
  compact: false,
})

const facesByKind: Record<FeedbackStateKind, FeedbackFaceName[]> = {
  empty: ['sad-droopy-face'],
  search: ['sad-droopy-face'],
  error: ['sad-droopy-face'],
  unavailable: ['sad-droopy-face'],
  success: ['bashful-smile', 'broad-toothy-grin', 'cheeky-tongue', 'content-smile', 'freckled-cheeky-grin', 'freckled-toothy-grin', 'goofy-long-tongue', 'joyful-heart-grin', 'laughing-open-mouth'],
}

const stableIndex = (value: string, length: number) => {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash) % length
}

const selectedFace = computed<FeedbackFaceName>(() => {
  if (props.face) return props.face
  const options = facesByKind[props.kind]
  return options[stableIndex(String(props.seed || props.title), options.length)] || options[0]!
})
</script>

<template>
  <div
    class="feedback-state"
    :class="[`feedback-state--${kind}`, { 'feedback-state--compact': compact }]"
    role="status"
  >
    <FeedbackFace class="feedback-state__face" :name="selectedFace" />
    <div class="feedback-state__copy">
      <h2 class="feedback-state__title">{{ title }}</h2>
      <p v-if="description" class="feedback-state__description">{{ description }}</p>
    </div>
    <div v-if="$slots.default" class="feedback-state__actions">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.feedback-state {
  --feedback-face-cutout: var(--feedback-state-surface, #fff);
  display: grid;
  width: 100%;
  min-height: 18rem;
  align-content: center;
  justify-items: center;
  gap: 1rem;
  padding: 2rem;
  color: var(--feedback-state-color, currentColor);
  text-align: center;
}

.feedback-state__face {
  width: min(9rem, 36vw);
}

.feedback-state__copy {
  display: grid;
  justify-items: center;
  gap: 0.55rem;
}

.feedback-state__title {
  margin: 0;
  color: inherit;
  font-size: clamp(1.25rem, 2vw, 1.75rem);
  font-weight: 800;
  line-height: 1.08;
}

.feedback-state__description {
  max-width: 34rem;
  margin: 0;
  color: color-mix(in srgb, currentColor 62%, transparent);
  font-size: 0.95rem;
  line-height: 1.65;
}

.feedback-state__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.feedback-state--compact {
  min-height: 0;
  gap: 0.65rem;
  padding: 1.25rem;
}

.feedback-state--compact .feedback-state__face {
  width: min(5.25rem, 24vw);
}

.feedback-state--compact .feedback-state__title {
  font-size: 1rem;
}

.feedback-state--compact .feedback-state__description {
  font-size: 0.82rem;
  line-height: 1.5;
}

@media (prefers-reduced-motion: no-preference) {
  .feedback-state__face {
    animation: feedback-face-arrive 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }
}

@keyframes feedback-face-arrive {
  from {
    opacity: 0;
    transform: translateY(0.5rem) scale(0.96);
  }
}
</style>
