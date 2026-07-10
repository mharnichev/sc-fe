<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(defineProps<{
  id?: string
  label?: string
  description?: string
  error?: string
  required?: boolean
  disabled?: boolean
}>(), {
  id: '',
  label: '',
  description: '',
  error: '',
  required: false,
  disabled: false,
})

const generatedId = useId()
const fieldId = computed(() => props.id || `field-${generatedId}`)
const descriptionId = computed(() => props.description ? `${fieldId.value}-description` : undefined)
const errorId = computed(() => props.error ? `${fieldId.value}-error` : undefined)
</script>

<template>
  <div class="base-field" :class="{ 'base-field--disabled': disabled, 'base-field--invalid': error }">
    <label v-if="label" class="base-field__label" :for="fieldId">
      <span>{{ label }}</span>
      <span v-if="required" aria-hidden="true">*</span>
    </label>

    <slot
      :id="fieldId"
      :description-id="descriptionId"
      :error-id="errorId"
      :invalid="Boolean(error)"
    />

    <p v-if="description" :id="descriptionId" class="base-field__description">
      {{ description }}
    </p>
    <p v-if="error" :id="errorId" class="base-field__error">
      {{ error }}
    </p>
  </div>
</template>
