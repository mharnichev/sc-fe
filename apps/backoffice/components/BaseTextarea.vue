<script setup lang="ts">
import { useId } from 'vue'

defineOptions({ inheritAttrs: false })

type ClassValue = string | Record<string, boolean> | unknown[]

const props = withDefaults(defineProps<{
  modelValue?: string | null
  value?: string | null
  modelModifiers?: { trim?: boolean }
  id?: string
  name?: string
  label?: string
  hint?: string
  error?: string
  placeholder?: string
  rows?: string | number
  maxlength?: string | number
  required?: boolean
  disabled?: boolean
  readonly?: boolean
  fieldClass?: string
  labelClass?: string
  labelContentClass?: string
  textareaClass?: ClassValue
}>(), {
  modelModifiers: () => ({}),
  rows: 4,
  textareaClass: 'base-control px-4 py-3 text-sm',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  input: [event: Event]
  change: [event: Event]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
}>()

const attrs = useAttrs()
const passthroughAttrs = computed(() => {
  const { class: _class, ...rest } = attrs
  return rest
})
const attrsClass = computed(() => attrs.class)
const hasField = computed(() => Boolean(props.label || props.hint || props.error))
const generatedId = useId()
const fieldId = computed(() => props.id || (typeof props.name === 'string' ? props.name : undefined) || (hasField.value ? `base-textarea-${generatedId}` : undefined))
const hintId = computed(() => props.hint && fieldId.value ? `${fieldId.value}-hint` : undefined)
const errorId = computed(() => props.error && fieldId.value ? `${fieldId.value}-error` : undefined)
const describedBy = computed(() => errorId.value || hintId.value)

const handleInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement
  emit('update:modelValue', props.modelModifiers.trim ? target.value.trim() : target.value)
  emit('input', event)
}
</script>

<template>
  <BaseField
    v-if="hasField || $slots.icon || $slots.label"
    :id="fieldId"
    :label="label"
    :hint="hint"
    :error="error"
    :hint-id="hintId"
    :error-id="errorId"
    :required="required"
    :disabled="disabled"
    :root-class="fieldClass"
    :label-class="labelClass"
    :label-content-class="labelContentClass"
  >
    <template v-if="$slots.icon" #icon>
      <slot name="icon" />
    </template>
    <template v-if="$slots.label" #label>
      <slot name="label" />
    </template>

    <textarea
      v-bind="passthroughAttrs"
      :id="fieldId"
      :value="modelValue ?? value ?? ''"
      :name="name"
      :placeholder="placeholder"
      :rows="rows"
      :maxlength="maxlength"
      :required="required"
      :disabled="disabled"
      :readonly="readonly"
      :aria-describedby="describedBy"
      :aria-invalid="error ? true : undefined"
      :class="[textareaClass, attrsClass]"
      @input="handleInput"
      @change="emit('change', $event)"
      @focus="emit('focus', $event)"
      @blur="emit('blur', $event)"
    />
  </BaseField>
  <textarea
    v-else
    v-bind="passthroughAttrs"
    :id="fieldId"
    :value="modelValue ?? value ?? ''"
    :name="name"
    :placeholder="placeholder"
    :rows="rows"
    :maxlength="maxlength"
    :required="required"
    :disabled="disabled"
    :readonly="readonly"
    :aria-describedby="describedBy"
    :aria-invalid="error ? true : undefined"
    :class="[textareaClass, attrsClass]"
    @input="handleInput"
    @change="emit('change', $event)"
    @focus="emit('focus', $event)"
    @blur="emit('blur', $event)"
  />
</template>
