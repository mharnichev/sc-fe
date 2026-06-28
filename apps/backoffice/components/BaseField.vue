<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  id?: string
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
  rootClass: 'space-y-1.5 text-sm text-slate-700',
  labelClass: 'font-medium',
  labelContentClass: 'inline-flex items-center gap-2',
  hintClass: 'text-xs text-slate-500',
  errorClass: 'text-xs text-rose-600',
})

const componentTag = computed(() => props.as)
</script>

<template>
  <component
    :is="componentTag"
    :for="as === 'label' ? undefined : id"
    :class="[rootClass, disabled ? 'opacity-70' : '']"
  >
    <span
      v-if="label || $slots.label || $slots.icon"
      :class="[labelClass, labelContentClass]"
    >
      <slot name="icon" />
      <slot name="label">
        {{ label }}
      </slot>
      <span v-if="required" aria-hidden="true" class="text-rose-500">*</span>
    </span>

    <slot :id="id" />

    <p v-if="error" :class="errorClass">
      {{ error }}
    </p>
    <p v-else-if="hint" :class="hintClass">
      {{ hint }}
    </p>
  </component>
</template>
