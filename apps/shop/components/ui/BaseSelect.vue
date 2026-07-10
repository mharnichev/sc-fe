<script setup lang="ts">
export interface BaseSelectOption {
  label: string
  value: string | number
  disabled?: boolean
}

withDefaults(defineProps<{
  id?: string
  label?: string
  description?: string
  error?: string
  name?: string
  placeholder?: string
  options?: BaseSelectOption[]
  required?: boolean
  disabled?: boolean
}>(), {
  id: '',
  label: '',
  description: '',
  error: '',
  name: '',
  placeholder: '',
  options: () => [],
  required: false,
  disabled: false,
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
    <select
      :id="fieldId"
      v-model="model"
      class="base-control"
      :class="{ 'base-control--invalid': invalid }"
      :name="name || undefined"
      :required="required"
      :disabled="disabled"
      :aria-describedby="[descriptionId, errorId].filter(Boolean).join(' ') || undefined"
      :aria-invalid="invalid || undefined"
    >
      <option v-if="placeholder" value="">{{ placeholder }}</option>
      <slot>
        <option
          v-for="option in options"
          :key="String(option.value)"
          :value="option.value"
          :disabled="option.disabled"
        >
          {{ option.label }}
        </option>
      </slot>
    </select>
  </BaseField>
</template>
