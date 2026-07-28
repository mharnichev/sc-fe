<script setup lang="ts">
import { QuestionMarkCircleIcon } from '@heroicons/vue/24/outline'
import { getCurrentInstance, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  title: string
  summary: string
  formula?: string
  trigger?: string
  action?: string
  note?: string
}>()

const root = ref<HTMLElement | null>(null)
const visible = ref(false)
const pinned = ref(false)
const tooltipId = `dashboard-metric-help-${getCurrentInstance()?.uid ?? 'unknown'}`

const show = () => {
  visible.value = true
}

const hideUnlessPinned = () => {
  if (!pinned.value) visible.value = false
}

const toggle = () => {
  pinned.value = !pinned.value
  visible.value = pinned.value
}

const close = () => {
  pinned.value = false
  visible.value = false
}

const handleBlur = () => {
  close()
}

const handleDocumentPointerDown = (event: PointerEvent) => {
  if (root.value?.contains(event.target as Node)) return
  close()
}

const handleDocumentKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && visible.value) close()
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
})
</script>

<template>
  <span
    ref="root"
    class="dashboard-metric-help"
    @mouseenter="show"
    @mouseleave="hideUnlessPinned"
  >
    <button
      type="button"
      class="dashboard-metric-help__button"
      :aria-label="`Як рахується: ${title}`"
      :aria-expanded="visible"
      :aria-describedby="visible ? tooltipId : undefined"
      @click.stop="toggle"
      @focus="show"
      @blur="handleBlur"
    >
      <QuestionMarkCircleIcon class="h-4 w-4" aria-hidden="true" />
    </button>

    <span
      v-if="visible"
      :id="tooltipId"
      class="dashboard-metric-help__tooltip"
      role="tooltip"
    >
      <strong class="dashboard-metric-help__title">{{ title }}</strong>
      <span class="dashboard-metric-help__summary">{{ summary }}</span>
      <span v-if="formula" class="dashboard-metric-help__row">
        <span class="dashboard-metric-help__eyebrow">Формула</span>
        {{ formula }}
      </span>
      <span v-if="trigger" class="dashboard-metric-help__row">
        <span class="dashboard-metric-help__eyebrow">Коли звернути увагу</span>
        {{ trigger }}
      </span>
      <span v-if="action" class="dashboard-metric-help__row">
        <span class="dashboard-metric-help__eyebrow">Що зробити</span>
        {{ action }}
      </span>
      <span v-if="note" class="dashboard-metric-help__note">{{ note }}</span>
    </span>
  </span>
</template>

<style scoped>
.dashboard-metric-help {
  position: relative;
  display: inline-flex;
  flex: none;
  vertical-align: middle;
}

.dashboard-metric-help__button {
  display: inline-flex;
  min-width: 1.75rem;
  min-height: 1.75rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  color: currentColor;
  opacity: 0.72;
  transition:
    background-color 150ms ease,
    opacity 150ms ease;
}

.dashboard-metric-help__button:hover,
.dashboard-metric-help__button:focus-visible,
.dashboard-metric-help__button[aria-expanded='true'] {
  background: color-mix(in srgb, currentColor 12%, transparent);
  opacity: 1;
}

.dashboard-metric-help__button:focus-visible {
  outline: 2px solid var(--bo-focus-border);
  outline-offset: 2px;
}

.dashboard-metric-help__tooltip {
  position: absolute;
  z-index: 60;
  top: calc(100% + 0.5rem);
  right: 0;
  display: grid;
  width: min(22rem, calc(100vw - 2rem));
  gap: 0.55rem;
  border: 1px solid var(--bo-help-border);
  border-radius: 1rem;
  padding: 0.9rem;
  background: var(--bo-help-surface);
  color: var(--bo-help-text);
  box-shadow: 0 18px 45px var(--bo-help-shadow);
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.45;
  letter-spacing: normal;
  text-align: left;
  text-transform: none;
  white-space: normal;
}

.dashboard-metric-help__title {
  color: var(--bo-help-text);
  font-size: 0.875rem;
}

.dashboard-metric-help__summary {
  color: var(--bo-help-text-secondary);
}

.dashboard-metric-help__row {
  display: grid;
  gap: 0.2rem;
  border-top: 1px solid var(--bo-help-border);
  padding-top: 0.55rem;
}

.dashboard-metric-help__eyebrow {
  color: var(--bo-help-accent);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.dashboard-metric-help__note {
  color: var(--bo-help-text-muted);
  font-size: 0.7rem;
}

@media (max-width: 640px) {
  .dashboard-metric-help__tooltip {
    position: fixed;
    top: 50%;
    right: 1rem;
    left: 1rem;
    width: auto;
    max-height: calc(100dvh - 2rem);
    overflow-y: auto;
    transform: translateY(-50%);
  }
}
</style>
