<script setup lang="ts">
import { useAttrs } from 'vue'

withDefaults(defineProps<{
  id?: string
  name?: string
  rows?: number
  maxlength?: number
  placeholder?: string
  disabled?: boolean
}>(), {
  id: undefined,
  name: undefined,
  rows: 4,
  maxlength: undefined,
  placeholder: undefined,
  disabled: false,
})

defineOptions({
  inheritAttrs: false,
})

const model = defineModel<string>({ default: '' })
const attrs = useAttrs()
</script>

<template>
  <textarea
    v-bind="attrs"
    :id="id"
    v-model="model"
    :name="name"
    :rows="rows"
    :maxlength="maxlength"
    :placeholder="placeholder"
    :disabled="disabled"
    class="w-full resize-y bg-stone-100 px-4 py-3 text-base leading-7 text-neutral-950 outline-none transition placeholder:text-stone-400 focus-visible:ring-2 focus-visible:ring-neutral-950/25 disabled:cursor-not-allowed disabled:opacity-60"
  />
</template>
