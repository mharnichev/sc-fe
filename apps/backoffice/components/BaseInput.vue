<script setup lang="ts">
defineOptions({ inheritAttrs: false })

type InputValue = string | number | null
type InputType = 'text' | 'number' | 'email' | 'password' | 'search' | 'tel' | 'time' | 'date' | 'url' | 'file'
type ClassValue = string | Record<string, boolean> | unknown[]

const props = withDefaults(defineProps<{
  modelValue?: InputValue
  value?: InputValue
  modelModifiers?: { number?: boolean, trim?: boolean }
  type?: InputType
  id?: string
  name?: string
  label?: string
  hint?: string
  error?: string
  placeholder?: string
  autocomplete?: string
  inputmode?: string
  min?: string | number
  max?: string | number
  step?: string | number
  maxlength?: string | number
  required?: boolean
  disabled?: boolean
  readonly?: boolean
  fieldClass?: string
  labelClass?: string
  labelContentClass?: string
  inputClass?: ClassValue
}>(), {
  modelModifiers: () => ({}),
  type: 'text',
  inputClass: 'w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm',
})

const emit = defineEmits<{
  'update:modelValue': [value: InputValue]
  input: [event: Event]
  change: [event: Event]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
  paste: [event: ClipboardEvent]
}>()

const attrs = useAttrs()
const passthroughAttrs = computed(() => {
  const { class: _class, ...rest } = attrs
  return rest
})
const attrsClass = computed(() => attrs.class)
const inputRef = ref<HTMLInputElement | null>(null)
const hasField = computed(() => Boolean(props.label || props.hint || props.error))

const fieldId = computed(() => props.id || (typeof props.name === 'string' ? props.name : undefined))
const normalizedValue = computed(() => props.modelValue ?? props.value ?? '')
const inputValue = computed(() => props.type === 'file' ? undefined : normalizedValue.value)

const castValue = (rawValue: string): InputValue => {
  const value = props.modelModifiers.trim ? rawValue.trim() : rawValue
  if (props.type === 'number' || props.modelModifiers.number) {
    if (value === '') return null
    const parsed = Number(value)
    return Number.isNaN(parsed) ? value : parsed
  }
  return value
}

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', castValue(target.value))
  emit('input', event)
}

defineExpose({
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
})
</script>

<template>
  <BaseField
    v-if="hasField || $slots.icon || $slots.label"
    :id="fieldId"
    :label="label"
    :hint="hint"
    :error="error"
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

    <input
      ref="inputRef"
      v-bind="passthroughAttrs"
      :id="fieldId"
      :value="inputValue"
      :type="type"
      :name="name"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :inputmode="inputmode"
      :min="min"
      :max="max"
      :step="step"
      :maxlength="maxlength"
      :required="required"
      :disabled="disabled"
      :readonly="readonly"
      :class="[inputClass, attrsClass]"
      @input="handleInput"
      @change="emit('change', $event)"
      @focus="emit('focus', $event)"
      @blur="emit('blur', $event)"
      @paste="emit('paste', $event)"
    >
  </BaseField>
  <input
    v-else
    ref="inputRef"
    v-bind="passthroughAttrs"
    :id="fieldId"
    :value="inputValue"
    :type="type"
    :name="name"
    :placeholder="placeholder"
    :autocomplete="autocomplete"
    :inputmode="inputmode"
    :min="min"
    :max="max"
    :step="step"
    :maxlength="maxlength"
    :required="required"
    :disabled="disabled"
    :readonly="readonly"
    :class="[inputClass, attrsClass]"
    @input="handleInput"
    @change="emit('change', $event)"
    @focus="emit('focus', $event)"
    @blur="emit('blur', $event)"
    @paste="emit('paste', $event)"
  >
</template>
