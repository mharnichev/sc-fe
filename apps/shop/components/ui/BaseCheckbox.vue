<script setup lang="ts">
withDefaults(defineProps<{
  id?: string
  label: string
  description?: string
  name?: string
  disabled?: boolean
  required?: boolean
}>(), {
  id: '',
  description: '',
  name: '',
  disabled: false,
  required: false,
})

const model = defineModel<boolean>({ default: false })
</script>

<template>
  <label class="base-choice" :class="{ 'base-choice--disabled': disabled }" :for="id || undefined">
    <input
      :id="id || undefined"
      v-model="model"
      class="base-choice__input"
      type="checkbox"
      :name="name || undefined"
      :disabled="disabled"
      :required="required"
    >
    <span class="base-choice__mark" aria-hidden="true" />
    <span class="base-choice__body">
      <span class="base-choice__label">{{ label }}</span>
      <span v-if="description" class="base-choice__description">{{ description }}</span>
    </span>
  </label>
</template>
