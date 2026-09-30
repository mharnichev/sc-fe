<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  required?: boolean
  disabled?: boolean
}>(), {
  required: false,
  disabled: false,
})

const model = defineModel<boolean>({ default: false })
</script>

<template>
  <label
    class="base-checkbox flex cursor-pointer items-start gap-2.5 rounded-none border bg-transparent p-3 text-sm leading-5 text-neutral-700 transition"
    :class="[
      model ? 'border-neutral-950' : 'border-neutral-200 hover:border-neutral-400',
      disabled ? 'cursor-not-allowed opacity-55' : '',
    ]"
  >
    <input v-model="model" class="sr-only" type="checkbox" :required="required" :disabled="disabled">
    <span v-if="$slots.icon" class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-neutral-700" aria-hidden="true">
      <slot name="icon" />
    </span>
    <span class="min-w-0 flex-1">{{ label }}</span>
    <span class="base-checkbox__mark mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-none border border-neutral-400 bg-transparent text-neutral-950" :class="model ? 'border-neutral-950' : ''" aria-hidden="true">
      <svg v-if="model" class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
        <path d="m3 8.2 3.1 3.1L13 4.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>
  </label>
</template>

<style scoped>
.base-checkbox,
.base-checkbox__mark {
  border-radius: 0 !important;
}
</style>
