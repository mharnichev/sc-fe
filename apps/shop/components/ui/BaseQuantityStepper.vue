<script setup lang="ts">
import { boundedInteger } from '~/utils/inputSafety'
const props = withDefaults(defineProps<{
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  disableIncrease?: boolean
  ariaLabel?: string
  variant?: 'default' | 'stacked'
}>(), {
  min: 0,
  max: 999,
  step: 1,
  disabled: false,
  disableIncrease: false,
  ariaLabel: '',
  variant: 'default',
})

const model = defineModel<number>({ default: 0 })
const { terms } = useShopLocale()

const resolvedAriaLabel = computed(() => props.ariaLabel || terms.value.quantity.label)

const clamp = (value: number) => boundedInteger(value, props.min, Math.min(props.max, 999))
const update = (value: number) => {
  model.value = clamp(value)
}
const onInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  // Clearing the field is a draft, not an instruction to remove the cart item.
  if (!input.value || !Number.isInteger(input.valueAsNumber)) return
  update(input.valueAsNumber)
  input.value = String(model.value)
}
const onBlur = (event: Event) => {
  update(Number.isFinite(model.value) ? model.value : props.min)
  ;(event.target as HTMLInputElement).value = String(model.value)
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
      :value="model"
      @input="onInput"
      class="base-quantity-stepper__input"
      type="number"
      :min="min"
      :max="Math.min(max, 999)"
      :step="step"
      :disabled="disabled"
      :aria-label="resolvedAriaLabel"
      @blur="onBlur"
    >
    <button
      class="base-quantity-stepper__button"
      type="button"
      :disabled="disabled || disableIncrease || model >= max"
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
