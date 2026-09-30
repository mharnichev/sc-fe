<script setup lang="ts">
const props = withDefaults(defineProps<{
  label: string
  name: string
  value: boolean
  disabled?: boolean
}>(), {
  disabled: false,
})

const model = defineModel<boolean>({ required: true })
</script>

<template>
  <label
    class="flex cursor-pointer items-center gap-2 border-0 bg-transparent p-2 text-xs text-neutral-700 transition"
    :class="[
      model === value ? 'text-neutral-950' : 'text-neutral-600 hover:text-neutral-950',
      disabled ? 'cursor-not-allowed opacity-55' : '',
    ]"
  >
    <input
      class="sr-only"
      type="radio"
      :name="name"
      :value="value"
      :checked="model === value"
      :disabled="disabled"
      @change="model = props.value"
    >
    <span v-if="$slots.icon" class="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">
      <slot name="icon" />
    </span>
    <span class="min-w-0 flex-1 font-semibold leading-4">{{ label }}</span>
    <span class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border" :class="model === value ? 'border-neutral-950' : 'border-neutral-400'" aria-hidden="true">
      <span v-if="model === value" class="h-2 w-2 rounded-full bg-neutral-950" />
    </span>
  </label>
</template>
