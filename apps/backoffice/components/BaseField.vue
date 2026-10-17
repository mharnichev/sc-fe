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

const compactFieldHints = inject<boolean>('compactFieldHints', false)
const compactHint = computed(() => compactFieldHints && Boolean(props.hint) && !props.error)
const componentTag = computed(() => compactFieldHints ? 'div' : props.as)
</script>

<template>
  <component
    :is="componentTag"
    :for="!compactFieldHints && as === 'label' ? id : undefined"
    :class="[rootClass, disabled ? 'opacity-70' : '']"
  >
    <span
      v-if="label || $slots.label || $slots.icon"
      :id="compactFieldHints ? undefined : labelId"
      :class="[labelClass, compactFieldHints ? 'flex w-full min-w-0 items-center gap-1' : labelContentClass]"
    >
      <component v-if="compactFieldHints" :is="as === 'label' ? 'label' : 'span'"
        :id="labelId"
        :for="as === 'label' ? id : undefined"
        :class="[labelContentClass, 'min-w-0 flex-1 [&>svg]:shrink-0']">
        <slot name="icon" />
        <span class="min-w-0 break-words"><slot name="label">{{ label }}</slot></span>
        <span v-if="required" aria-hidden="true" class="base-field__required">*</span>
      </component>
      <template v-else>
        <slot name="icon" />
        <slot name="label">{{ label }}</slot>
        <span v-if="required" aria-hidden="true" class="base-field__required">*</span>
      </template>
      <BaseFieldHelp v-if="compactHint" :text="hint!" :label="label" />
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
    <p v-else-if="hint" :id="hintId" :class="compactHint ? 'sr-only' : hintClass">
      {{ hint }}
    </p>
  </component>
</template>
