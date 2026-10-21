<script setup lang="ts">
import { sanitizeInput, inputLimits, type InputRule } from '~/utils/inputSafety'

const props = withDefaults(defineProps<{
  accessibleLabel?: string
  rule?: InputRule
  id?: string
  label?: string
  description?: string
  error?: string
  type?: 'text' | 'email' | 'tel' | 'search' | 'url' | 'password' | 'number' | 'date' | 'datetime-local'
  name?: string
  placeholder?: string
  autocomplete?: string
  inputmode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search'
  required?: boolean
  disabled?: boolean
  min?: string | number
  max?: string | number
  step?: string | number
  tone?: 'light' | 'dark'
}>(), {
  id: '',
  label: '',
  description: '',
  error: '',
  type: 'text',
  name: '',
  placeholder: '',
  autocomplete: undefined,
  inputmode: undefined,
  required: false,
  disabled: false,
  min: undefined,
  max: undefined,
  step: undefined,
  tone: 'light',
})

const model = defineModel<string | number>({ default: '' })
const resolvedRule = computed<InputRule>(() => props.rule || (props.autocomplete === 'one-time-code' ? 'otp' : props.type === 'email' ? 'email' : props.type === 'tel' ? 'phone' : props.type === 'search' ? 'search' : 'text'))
const nativeValue = computed(() => ['number', 'date', 'datetime-local', 'password'].includes(props.type))
const onInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  if ((event as InputEvent).isComposing) return
  // Do not turn an invalid pasted OTP into a different, valid code.
  const value = nativeValue.value || ['otp', 'email'].includes(resolvedRule.value) ? input.value : sanitizeInput(input.value, resolvedRule.value)
  input.value = value
  model.value = props.type === 'number' && value !== '' && Number.isFinite(input.valueAsNumber)
    ? input.valueAsNumber : value
  if (props.type === 'number') nextTick(() => { input.value = String(model.value) })
}
</script>

<template>
  <BaseField
    v-slot="{ id: fieldId, descriptionId, errorId, invalid }"
    :id="id"
    :label="label"
    :description="description"
    :error="error"
    :required="required"
    :disabled="disabled"
  >
    <div class="base-input__control" :class="{ 'base-input__control--trailing': $slots.trailing }">
    <input
      :id="fieldId"
      :aria-label="accessibleLabel"
      :value="model"
      :maxlength="nativeValue || resolvedRule === 'otp' ? undefined : inputLimits[resolvedRule]"
      :pattern="resolvedRule === 'otp' ? '[0-9]{6}' : undefined"
      @input="onInput"
      @compositionend="onInput"
      class="base-control"
      :class="[
        `base-control--${tone}`,
        { 'base-control--invalid': invalid },
      ]"
      :type="type"
      :name="name || undefined"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :inputmode="inputmode"
      :required="required"
      :disabled="disabled"
      :min="min"
      :max="max"
      :step="step"
      :aria-describedby="[descriptionId, errorId].filter(Boolean).join(' ') || undefined"
      :aria-invalid="invalid || undefined"
    >
    <div v-if="$slots.trailing" class="base-input__trailing"><slot name="trailing" /></div>
    </div>
  </BaseField>
</template>

<style scoped>
.base-input__control { position: relative; }
.base-input__control--trailing input { padding-right: 3.5rem; }
.base-input__trailing { position: absolute; inset: 0 0 0 auto; display: flex; align-items: stretch; }
</style>
