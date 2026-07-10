<script setup lang="ts">
withDefaults(defineProps<{
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
      v-model="model"
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
