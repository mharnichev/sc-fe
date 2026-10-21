<script setup lang="ts">
import { sanitizeInput, inputLimits, type InputRule } from '~/utils/inputSafety'
const props = withDefaults(defineProps<{
  rule?: Extract<InputRule, 'message' | 'review' | 'note'>
  id?: string
  label?: string
  description?: string
  error?: string
  name?: string
  placeholder?: string
  rows?: number
  required?: boolean
  disabled?: boolean
  tone?: 'light' | 'dark'
}>(), {
  rule: 'message',
  id: '',
  label: '',
  description: '',
  error: '',
  name: '',
  placeholder: '',
  rows: 4,
  required: false,
  disabled: false,
  tone: 'light',
})

const model = defineModel<string>({ default: '' })
const onInput = (event: Event) => {
  const input = event.target as HTMLTextAreaElement
  if ((event as InputEvent).isComposing) return
  input.value = sanitizeInput(input.value, props.rule)
  model.value = input.value
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
    <textarea
      :id="fieldId"
      :value="model"
      :maxlength="inputLimits[rule]"
      :minlength="rule === 'message' ? 10 : rule === 'review' ? 3 : undefined"
      @input="onInput"
      @compositionend="onInput"
      class="base-control base-control--textarea"
      :class="[
        `base-control--${tone}`,
        { 'base-control--invalid': invalid },
      ]"
      :name="name || undefined"
      :placeholder="placeholder"
      :rows="rows"
      :required="required"
      :disabled="disabled"
      :aria-describedby="[descriptionId, errorId].filter(Boolean).join(' ') || undefined"
      :aria-invalid="invalid || undefined"
    />
  </BaseField>
</template>
