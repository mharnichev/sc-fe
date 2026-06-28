<script setup lang="ts">
defineOptions({ inheritAttrs: false })

type RadioValue = string | number | boolean

const props = withDefaults(defineProps<{
  modelValue?: RadioValue | null
  value?: RadioValue
  label?: string
  checked?: boolean
  disabled?: boolean
  required?: boolean
  srOnly?: boolean
  inputClass?: string
  labelClass?: string
}>(), {
  value: true,
  inputClass: 'h-4 w-4',
  labelClass: 'inline-flex items-center gap-2 text-sm text-slate-700',
})

const emit = defineEmits<{
  'update:modelValue': [value: RadioValue]
  change: [event: Event]
}>()

const attrs = useAttrs()
const passthroughAttrs = computed(() => {
  const { class: _class, ...rest } = attrs
  return rest
})
const attrsClass = computed(() => attrs.class)

const isChecked = computed(() =>
  typeof props.checked === 'boolean' ? props.checked : props.modelValue === props.value,
)
const hasLabel = computed(() => Boolean(props.label))

const updateValue = (event: Event) => {
  emit('update:modelValue', props.value)
  emit('change', event)
}
</script>

<template>
  <label v-if="hasLabel || $slots.default" :class="[labelClass, disabled ? 'opacity-70' : '']">
    <input
      v-bind="passthroughAttrs"
      type="radio"
      :checked="isChecked"
      :disabled="disabled"
      :required="required"
      :value="value"
      :class="[srOnly ? 'sr-only' : inputClass, attrsClass]"
      @change="updateValue"
    >
    <slot>{{ label }}</slot>
  </label>
  <input
    v-else
    v-bind="passthroughAttrs"
    type="radio"
    :checked="isChecked"
    :disabled="disabled"
    :required="required"
    :value="value"
    :class="[srOnly ? 'sr-only' : inputClass, attrsClass]"
    @change="updateValue"
  >
</template>
