<script setup lang="ts">
const props = defineProps<{ value: number; min: number; max: number; disabled?: boolean; accessibleLabel: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: number]; change: [] }>()
const onInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  const value = Number(input.value)
  const safe = Math.min(props.max, Math.max(props.min, Number.isFinite(value) ? Math.round(value) : props.min))
  input.value = String(safe)
  emit('update:modelValue', safe)
  nextTick(() => { input.value = String(props.value) })
}
</script>
<template>
  <input type="range" :value="value" :min="min" :max="max" step="1" :disabled="disabled" :aria-label="accessibleLabel" @input="onInput" @change="emit('change')">
</template>
