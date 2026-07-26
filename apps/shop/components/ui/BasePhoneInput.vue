<script setup lang="ts">
const props = withDefaults(defineProps<{
  id?: string
  label?: string
  description?: string
  error?: string
  name?: string
  placeholder?: string
  autocomplete?: string
  required?: boolean
  disabled?: boolean
  tone?: 'light' | 'dark'
}>(), {
  id: '',
  label: '',
  description: '',
  error: '',
  name: '',
  placeholder: '+380 XX XXX XX XX',
  autocomplete: 'tel',
  required: false,
  disabled: false,
  tone: 'light',
})

const model = defineModel<string>({ default: '' })

const phonePrefix = '+380'
const prefixDigits = '380'
const subscriberDigitsLimit = 9

const extractSubscriberDigits = (value: string) => {
  let digits = value.replace(/\D/g, '')

  if (!digits) return ''

  while (digits.startsWith(prefixDigits) && digits.length > prefixDigits.length) {
    digits = digits.slice(prefixDigits.length)
  }

  if (prefixDigits.startsWith(digits)) return ''
  if (digits.startsWith('80')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = digits.slice(1)

  return digits.slice(0, subscriberDigitsLimit)
}

const formatPhone = (value: string) => {
  const subscriberDigits = extractSubscriberDigits(value)
  if (!subscriberDigits) return value ? phonePrefix : ''

  const groups = [
    subscriberDigits.slice(0, 2),
    subscriberDigits.slice(2, 5),
    subscriberDigits.slice(5, 7),
    subscriberDigits.slice(7, 9),
  ].filter(Boolean)

  return `${phonePrefix} ${groups.join(' ')}`
}

const inputValue = computed({
  get: () => formatPhone(model.value),
  set: value => {
    model.value = formatPhone(String(value))
  },
})
</script>

<template>
  <BaseInput
    :id="props.id"
    v-model="inputValue"
    :label="props.label"
    :description="props.description"
    :error="props.error"
    type="tel"
    :name="props.name"
    :placeholder="props.placeholder"
    :autocomplete="props.autocomplete"
    inputmode="tel"
    :required="props.required"
    :disabled="props.disabled"
    :tone="props.tone"
  />
</template>
