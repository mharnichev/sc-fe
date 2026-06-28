<script setup lang="ts">
defineOptions({ inheritAttrs: false })

type CheckboxValue = string | number | boolean

const props = withDefaults(defineProps<{
  modelValue?: boolean | CheckboxValue[]
  value?: CheckboxValue
  checked?: boolean
  label?: string
  disabled?: boolean
  required?: boolean
  inputClass?: string
  labelClass?: string
}>(), {
  value: true,
  inputClass: 'h-4 w-4 rounded border-slate-300',
  labelClass: 'inline-flex items-center gap-2 text-sm text-slate-700',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean | CheckboxValue[]]
  change: [event: Event]
}>()

const attrs = useAttrs()
const passthroughAttrs = computed(() => {
  const { class: _class, ...rest } = attrs
  return rest
})
const attrsClass = computed(() => attrs.class)

const isChecked = computed(() => {
  if (typeof props.checked === 'boolean') return props.checked
  if (Array.isArray(props.modelValue)) return props.modelValue.includes(props.value)
  return Boolean(props.modelValue)
})
const hasLabel = computed(() => Boolean(props.label))

const updateValue = (event: Event) => {
  const checked = (event.target as HTMLInputElement).checked
  if (Array.isArray(props.modelValue)) {
    const next = checked
      ? [...props.modelValue, props.value]
      : props.modelValue.filter(item => item !== props.value)
    emit('update:modelValue', next)
  } else {
    emit('update:modelValue', checked)
  }
  emit('change', event)
}
</script>

<template>
  <label v-if="hasLabel || $slots.default" :class="[labelClass, disabled ? 'opacity-70' : '']">
    <input
      v-bind="passthroughAttrs"
      type="checkbox"
      :checked="isChecked"
      :disabled="disabled"
      :required="required"
      :value="value"
      :class="[inputClass, attrsClass]"
      @change="updateValue"
    >
    <slot>{{ label }}</slot>
  </label>
  <input
    v-else
    v-bind="passthroughAttrs"
    type="checkbox"
    :checked="isChecked"
    :disabled="disabled"
    :required="required"
    :value="value"
    :class="[inputClass, attrsClass]"
    @change="updateValue"
  >
</template>
