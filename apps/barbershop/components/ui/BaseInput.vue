<script setup lang="ts">
import { useAttrs } from 'vue'
import { formatPhoneInput } from '~/composables/usePhoneMask'

const props = withDefaults(defineProps<{
  label: string
  type?: 'text' | 'tel' | 'email'
  required?: boolean
  disabled?: boolean
  phoneMask?: boolean
}>(), {
  type: 'text',
  required: false,
  disabled: false,
  phoneMask: false,
})

defineOptions({ inheritAttrs: false })

const model = defineModel<string>({ default: '' })
const attrs = useAttrs()

const handleInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  const value = props.phoneMask ? formatPhoneInput(input.value) : input.value
  input.value = value
  model.value = value
}
</script>

<template>
  <label class="base-input grid gap-1.5 text-sm font-semibold text-neutral-800">
    <span>{{ label }}</span>
    <span class="relative block">
      <span v-if="$slots.icon" class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-400" aria-hidden="true">
        <slot name="icon" />
      </span>
      <input
        v-bind="attrs"
        :value="model"
        :type="type"
        :required="required"
        :disabled="disabled"
        class="min-h-11 w-full border-0 bg-stone-100 py-2.5 pr-3 text-sm font-normal text-neutral-950 outline-none transition placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-neutral-950/20 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
        :class="$slots.icon ? 'pl-10' : 'pl-3'"
        @input="handleInput"
      >
    </span>
  </label>
</template>
