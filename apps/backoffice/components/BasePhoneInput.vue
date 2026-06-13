<script setup lang="ts">
import { PhoneIcon } from '@heroicons/vue/24/outline'

const props = withDefaults(defineProps<{
  modelValue?: string | null
  label: string
  required?: boolean
  disabled?: boolean
  id?: string
  name?: string
  autocomplete?: string
  labelClass?: string
  labelContentClass?: string
  iconClass?: string
  inputClass?: string
}>(), {
  modelValue: '',
  autocomplete: 'tel',
  labelClass: 'space-y-1.5 text-sm text-slate-700',
  labelContentClass: 'flex items-center gap-2 font-medium',
  iconClass: 'h-4 w-4 text-cyan-700',
  inputClass: 'w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:px-4',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { formatPhone } = useUkrainianPhoneMask()
const focused = ref(false)

const setPhoneValue = (value: string | null | undefined, showPrefix = focused.value) => {
  emit('update:modelValue', formatPhone(value, showPrefix))
}

const inputValue = computed({
  get: () => formatPhone(props.modelValue, focused.value),
  set: value => setPhoneValue(value, true),
})

const handleFocus = () => {
  focused.value = true
  setPhoneValue(props.modelValue, true)
}

const handleBlur = () => {
  focused.value = false
  setPhoneValue(props.modelValue, false)
}

const handlePaste = (event: ClipboardEvent) => {
  const pastedText = event.clipboardData?.getData('text') || ''
  if (!/(?:\+?\s*3\s*8\s*0)/.test(pastedText)) return

  event.preventDefault()
  setPhoneValue(pastedText, true)
}
</script>

<template>
  <label :class="labelClass">
    <span :class="labelContentClass">
      <PhoneIcon :class="iconClass" aria-hidden="true" />
      {{ label }}
    </span>
    <input
      :id="id"
      v-model="inputValue"
      :name="name"
      :required="required"
      :disabled="disabled"
      type="tel"
      inputmode="tel"
      :autocomplete="autocomplete"
      placeholder="+380 XX XXX XX XX"
      maxlength="17"
      :class="inputClass"
      @focus="handleFocus"
      @blur="handleBlur"
      @paste="handlePaste"
    >
  </label>
</template>
