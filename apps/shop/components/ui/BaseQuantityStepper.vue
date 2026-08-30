<script setup lang="ts">
const props = withDefaults(defineProps<{
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  ariaLabel?: string
  variant?: 'default' | 'stacked'
}>(), {
  min: 0,
  max: Number.POSITIVE_INFINITY,
  step: 1,
  disabled: false,
  ariaLabel: '',
  variant: 'default',
})

const model = defineModel<number>({ default: 0 })
const { terms } = useShopLocale()

const resolvedAriaLabel = computed(() => props.ariaLabel || terms.value.quantity.label)

const clamp = (value: number) => Math.min(props.max, Math.max(props.min, value))
const update = (value: number) => {
  model.value = clamp(value)
}
</script>

<template>
  <div
    :class="['base-quantity-stepper', `base-quantity-stepper--${variant}`]"
    :aria-label="resolvedAriaLabel"
  >
    <button
      class="base-quantity-stepper__button"
      type="button"
      :disabled="disabled || model <= min"
      :aria-label="terms.quantity.decrease"
      @click="update(model - step)"
    >
      -
    </button>
    <input
      v-model.number="model"
      class="base-quantity-stepper__input"
      type="number"
      :min="min"
      :max="Number.isFinite(max) ? max : undefined"
      :step="step"
      :disabled="disabled"
      :aria-label="resolvedAriaLabel"
      @blur="update(Number.isFinite(model) ? model : min)"
    >
    <button
      class="base-quantity-stepper__button"
      type="button"
      :disabled="disabled || model >= max"
      :aria-label="terms.quantity.increase"
      @click="update(model + step)"
    >
      +
    </button>
  </div>
</template>

<style scoped>
.base-quantity-stepper--stacked {
  grid-template-columns: 2.6rem 2rem;
  grid-template-rows: repeat(2, 1.4rem);
  border: 0;
  border-radius: 0.75rem;
  background: #f7f7f7;
}

.base-quantity-stepper--stacked .base-quantity-stepper__button {
  height: 1.4rem;
  background: transparent;
  color: #0a0a0a;
  font-size: 1rem;
  font-weight: 500;
}

.base-quantity-stepper--stacked .base-quantity-stepper__button:first-of-type {
  grid-column: 2;
  grid-row: 2;
}

.base-quantity-stepper--stacked .base-quantity-stepper__button:last-of-type {
  grid-column: 2;
  grid-row: 1;
}

.base-quantity-stepper--stacked .base-quantity-stepper__input {
  grid-column: 1;
  grid-row: 1 / span 2;
  height: 2.8rem;
  border: 0;
  background: transparent;
  font-size: 1rem;
  font-weight: 500;
}

.base-quantity-stepper--stacked .base-quantity-stepper__button:not(:disabled):hover,
.base-quantity-stepper--stacked .base-quantity-stepper__button:not(:disabled):focus-visible {
  background: rgb(10 10 10 / 0.06);
  color: #0a0a0a;
}

.base-quantity-stepper--stacked .base-quantity-stepper__button:disabled {
  background: transparent;
}
</style>
