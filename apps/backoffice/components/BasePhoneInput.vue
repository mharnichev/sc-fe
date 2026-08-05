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
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
  keydown: [event: KeyboardEvent]
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

const handleFocus = (event: FocusEvent) => {
  focused.value = true
  setPhoneValue(props.modelValue, true)
  emit('focus', event)
}

const handleBlur = (event: FocusEvent) => {
  focused.value = false
  setPhoneValue(props.modelValue, false)
  emit('blur', event)
}

const handleKeydown = (event: KeyboardEvent) => emit('keydown', event)

const handlePaste = (event: ClipboardEvent) => {
  const pastedText = event.clipboardData?.getData('text') || ''
  if (!/(?:\+?\s*3\s*8\s*0)/.test(pastedText)) return

  event.preventDefault()
  setPhoneValue(pastedText, true)
}
</script>

<template>
  <BaseInput
    :id="id"
    v-model="inputValue"
    :name="name"
    :label="label"
    :required="required"
    :disabled="disabled"
    type="tel"
    inputmode="tel"
    :autocomplete="autocomplete"
    placeholder="+380 XX XXX XX XX"
    maxlength="17"
    :field-class="labelClass"
    :label-content-class="labelContentClass"
    :input-class="inputClass"
    @focus="handleFocus"
    @blur="handleBlur"
    @keydown="handleKeydown"
    @paste="handlePaste"
  >
    <template #icon>
      <PhoneIcon :class="iconClass" aria-hidden="true" />
    </template>
  </BaseInput>
</template>
