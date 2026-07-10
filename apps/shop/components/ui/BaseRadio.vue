<script setup lang="ts">
const props = withDefaults(defineProps<{
  id?: string
  label: string
  description?: string
  name?: string
  value: string | number | boolean
  disabled?: boolean
  required?: boolean
}>(), {
  id: '',
  description: '',
  name: '',
  disabled: false,
  required: false,
})

const model = defineModel<string | number | boolean | null>({ default: null })

const handleChange = () => {
  model.value = props.value
}
</script>

<template>
  <label class="base-choice" :class="{ 'base-choice--disabled': disabled }" :for="id || undefined">
    <input
      :id="id || undefined"
      class="base-choice__input"
      type="radio"
      :name="name || undefined"
      :value="value"
      :checked="model === value"
      :disabled="disabled"
      :required="required"
      @change="handleChange"
    >
    <span class="base-choice__mark base-choice__mark--radio" aria-hidden="true" />
    <span class="base-choice__body">
      <span class="base-choice__label">{{ label }}</span>
      <span v-if="description" class="base-choice__description">{{ description }}</span>
    </span>
  </label>
</template>
