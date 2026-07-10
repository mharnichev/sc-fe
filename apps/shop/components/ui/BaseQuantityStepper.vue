<script setup lang="ts">
const props = withDefaults(defineProps<{
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  ariaLabel?: string
}>(), {
  min: 0,
  max: Number.POSITIVE_INFINITY,
  step: 1,
  disabled: false,
  ariaLabel: '',
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
  <div class="base-quantity-stepper" :aria-label="resolvedAriaLabel">
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
