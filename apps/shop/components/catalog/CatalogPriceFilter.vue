<script setup lang="ts">
const props = withDefaults(defineProps<{
  minLimit?: string | number | null
  maxLimit?: string | number | null
  minValue: string
  maxValue: string
  disabled?: boolean
}>(), {
  minLimit: 0,
  maxLimit: 0,
  disabled: false,
})

const emit = defineEmits<{
  'update:minValue': [value: string]
  'update:maxValue': [value: string]
  change: []
}>()

const toNumber = (value: string | number | null | undefined, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback

  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

const minBound = computed(() => toNumber(props.minLimit, 0))
const maxBound = computed(() => {
  const max = toNumber(props.maxLimit, minBound.value)
  return max > minBound.value ? max : minBound.value + 1
})

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const currentMin = computed(() => toNumber(props.minValue, minBound.value))
const currentMax = computed(() => toNumber(props.maxValue, maxBound.value))
const minPercent = computed(() =>
  clamp(((currentMin.value - minBound.value) / (maxBound.value - minBound.value)) * 100, 0, 100),
)
const maxPercent = computed(() =>
  clamp(((currentMax.value - minBound.value) / (maxBound.value - minBound.value)) * 100, 0, 100),
)

const setMin = (value: string | number, shouldCommit = false) => {
  const next = clamp(toNumber(value, minBound.value), minBound.value, currentMax.value)
  emit('update:minValue', String(Math.round(next)))
  if (shouldCommit) emit('change')
}

const setMax = (value: string | number, shouldCommit = false) => {
  const next = clamp(toNumber(value, maxBound.value), currentMin.value, maxBound.value)
  emit('update:maxValue', String(Math.round(next)))
  if (shouldCommit) emit('change')
}

const inputValue = (event: Event) => (event.target as HTMLInputElement | null)?.value || ''
const onMinInput = (event: Event) => setMin(inputValue(event))
const onMaxInput = (event: Event) => setMax(inputValue(event))
const onMinRangeChange = (event: Event) => setMin(inputValue(event), true)
const onMaxRangeChange = (event: Event) => setMax(inputValue(event), true)
</script>

<template>
  <div
    class="catalog-price-filter"
    :style="{
      '--catalog-price-left': minPercent,
      '--catalog-price-right': 100 - maxPercent,
    }"
  >
    <div class="catalog-price-filter__inputs">
      <input
        class="catalog-price-filter__input"
        :value="minValue"
        type="number"
        inputmode="decimal"
        :min="minBound"
        :max="maxBound"
        :placeholder="String(minBound)"
        :disabled="disabled"
        aria-label="Minimum price"
        @input="onMinInput"
        @change="emit('change')"
      >
      <span class="catalog-price-filter__dash" aria-hidden="true">-</span>
      <input
        class="catalog-price-filter__input"
        :value="maxValue"
        type="number"
        inputmode="decimal"
        :min="minBound"
        :max="maxBound"
        :placeholder="String(maxBound)"
        :disabled="disabled"
        aria-label="Maximum price"
        @input="onMaxInput"
        @change="emit('change')"
      >
    </div>

    <div class="catalog-price-filter__slider">
      <div class="catalog-price-filter__track" />
      <div class="catalog-price-filter__selected" />
      <input
        class="catalog-price-filter__range catalog-price-filter__range--min"
        type="range"
        :min="minBound"
        :max="maxBound"
        :value="currentMin"
        :disabled="disabled"
        aria-label="Minimum price"
        @input="onMinInput"
        @change="onMinRangeChange"
      >
      <input
        class="catalog-price-filter__range catalog-price-filter__range--max"
        type="range"
        :min="minBound"
        :max="maxBound"
        :value="currentMax"
        :disabled="disabled"
        aria-label="Maximum price"
        @input="onMaxInput"
        @change="onMaxRangeChange"
      >
    </div>
  </div>
</template>

<style scoped>
.catalog-price-filter {
  display: grid;
  gap: 1rem;
}

.catalog-price-filter__inputs {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
}

.catalog-price-filter__input {
  min-width: 0;
  width: 100%;
  border: 1px solid rgb(10 10 10 / 0.12);
  border-radius: 0;
  background: rgb(23 23 23 / 0.025);
  padding: 0.75rem 0.875rem;
  color: #0a0a0a;
  font-size: 0.875rem;
  outline: none;
}

.catalog-price-filter__input:focus-visible {
  border-color: rgb(10 10 10 / 0.32);
}

.catalog-price-filter__dash {
  color: #737373;
}

.catalog-price-filter__slider {
  --catalog-price-thumb-size: 1rem;
  --catalog-price-track-inset: calc(var(--catalog-price-thumb-size) / 2);

  position: relative;
  height: 1.25rem;
}

.catalog-price-filter__track,
.catalog-price-filter__selected {
  position: absolute;
  top: 50%;
  height: 0.375rem;
  border-radius: 9999px;
  transform: translateY(-50%);
}

.catalog-price-filter__track {
  right: var(--catalog-price-track-inset);
  left: var(--catalog-price-track-inset);
  background: #dddddd;
}

.catalog-price-filter__selected {
  right: calc(var(--catalog-price-track-inset) + (100% - var(--catalog-price-thumb-size)) * var(--catalog-price-right) / 100);
  left: calc(var(--catalog-price-track-inset) + (100% - var(--catalog-price-thumb-size)) * var(--catalog-price-left) / 100);
  background: #0a0a0a;
}

.catalog-price-filter__range {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 1.25rem;
  margin: 0;
  background: transparent;
  pointer-events: none;
  appearance: none;
}

.catalog-price-filter__range::-webkit-slider-thumb {
  width: var(--catalog-price-thumb-size);
  height: var(--catalog-price-thumb-size);
  border: 1px solid #ffffff;
  border-radius: 9999px;
  background: #0a0a0a;
  cursor: grab;
  pointer-events: auto;
  appearance: none;
}

.catalog-price-filter__range::-moz-range-thumb {
  width: var(--catalog-price-thumb-size);
  height: var(--catalog-price-thumb-size);
  border: 1px solid #ffffff;
  border-radius: 9999px;
  background: #0a0a0a;
  cursor: grab;
  pointer-events: auto;
}

.catalog-price-filter__range:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 0 0 4px rgb(10 10 10 / 0.18);
}

.catalog-price-filter__range:disabled {
  opacity: 0.6;
}
</style>
