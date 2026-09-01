<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue?: boolean
  checked?: boolean
  label?: string
  disabled?: boolean
  loading?: boolean
  loadingLabel?: string
  required?: boolean
  rootClass?: string
  labelClass?: string
}>(), {
  loading: false,
  loadingLabel: 'Оновлення…',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  change: [event: Event]
}>()

const attrs = useAttrs()
const passthroughAttrs = computed(() => {
  const { class: _class, ...rest } = attrs
  return rest
})
const attrsClass = computed(() => attrs.class)
const isChecked = computed(() => typeof props.checked === 'boolean' ? props.checked : Boolean(props.modelValue))
const isUnavailable = computed(() => Boolean(props.disabled || props.loading))

const updateValue = (event: Event) => {
  emit('update:modelValue', (event.target as HTMLInputElement).checked)
  emit('change', event)
}
</script>

<template>
  <label
    class="base-toggle__root"
    :class="[
      rootClass,
      attrsClass,
      disabled ? 'base-toggle__root--disabled' : '',
      loading ? 'base-toggle__root--loading' : '',
    ]"
    :aria-busy="loading || undefined"
  >
    <input
      v-bind="passthroughAttrs"
      type="checkbox"
      role="switch"
      class="base-toggle__input"
      :checked="isChecked"
      :disabled="isUnavailable"
      :required="required"
      @change="updateValue"
    >
    <span class="base-toggle__track" :aria-hidden="loading ? undefined : true">
      <span class="base-toggle__thumb" />
      <BaseLoader
        v-if="loading"
        as="span"
        class="base-toggle__loader"
        :label="loadingLabel"
        label-class="sr-only"
        size="sm"
        inline
      />
    </span>
    <span v-if="label || $slots.default" class="base-toggle__label" :class="labelClass">
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>
