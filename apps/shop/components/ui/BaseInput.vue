<script setup lang="ts">
withDefaults(defineProps<{
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
    <input
      :id="fieldId"
      v-model="model"
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
  </BaseField>
</template>
