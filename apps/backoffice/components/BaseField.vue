<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  id?: string
  labelId?: string
  hintId?: string
  errorId?: string
  label?: string
  hint?: string
  error?: string
  required?: boolean
  disabled?: boolean
  as?: 'label' | 'div'
  rootClass?: string
  labelClass?: string
  labelContentClass?: string
  hintClass?: string
  errorClass?: string
}>(), {
  as: 'label',
  rootClass: 'base-field space-y-1.5 text-sm',
  labelClass: 'base-field__label font-medium',
  labelContentClass: 'inline-flex items-center gap-2',
  hintClass: 'base-field__hint text-xs',
  errorClass: 'base-field__error text-xs',
})

const componentTag = computed(() => props.as)
</script>

<template>
  <component
    :is="componentTag"
    :for="as === 'label' ? id : undefined"
    :class="[rootClass, disabled ? 'opacity-70' : '']"
  >
    <span
      v-if="label || $slots.label || $slots.icon"
      :id="labelId"
      :class="[labelClass, labelContentClass]"
    >
      <slot name="icon" />
      <slot name="label">
        {{ label }}
      </slot>
      <span v-if="required" aria-hidden="true" class="base-field__required">*</span>
    </span>

    <slot
      :id="id"
      :label-id="labelId"
      :hint-id="hintId"
      :error-id="errorId"
    />

    <p v-if="error" :id="errorId" :class="errorClass" aria-live="polite">
      {{ error }}
    </p>
    <p v-else-if="hint" :id="hintId" :class="hintClass">
      {{ hint }}
    </p>
  </component>
</template>
