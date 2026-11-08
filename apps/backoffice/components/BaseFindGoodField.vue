<script setup lang="ts">
import { CameraIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/vue/24/outline'

const props = withDefaults(defineProps<{
  modelValue: string
  label: string
  placeholder?: string
  hint?: string
  error?: string
  maxlength?: number
  disabled?: boolean
  loading?: boolean
  searchWhileLoading?: boolean
  showScan?: boolean
  scanLabel?: string
  showSubmit?: boolean
  submitLabel?: string
  requireValue?: boolean
  showClear?: boolean
  clearLabel?: string
  searchbox?: boolean
  lookupBarcode?: (code: string) => Promise<{ barcode?: string | null }>
}>(), {
  showScan: true,
  scanLabel: 'Сканувати штрихкод',
  submitLabel: 'Знайти',
  clearLabel: 'Очистити пошук',
})
const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: []
  clear: []
  scan: [code: string]
  cameraOpen: []
}>()
const id = useId()
const input = ref<{ focus: () => void } | null>(null)
const cameraOpen = ref(false)
const route = useRoute()
const actions = computed(() => Number(props.showScan) + Number(props.showSubmit) + Number(props.showClear))
const focus = () => input.value?.focus()
const cannotSubmit = computed(() => props.disabled || (props.loading && !props.searchWhileLoading) || (props.requireValue && !props.modelValue.trim()))
const submit = () => { if (!cannotSubmit.value) emit('submit') }
const clear = async () => {
  emit('clear')
  await nextTick()
  focus()
}
const openCamera = () => {
  if (props.disabled || props.loading) return
  emit('cameraOpen')
  cameraOpen.value = true
}
const closeCamera = async () => {
  cameraOpen.value = false
  await nextTick()
  focus()
}
const scanned = (code: string) => {
  if (!props.disabled && !props.loading) emit('scan', code)
  void closeCamera()
}
watch(() => props.disabled || props.loading, blocked => { if (blocked) cameraOpen.value = false })
watch(() => route.fullPath, () => { cameraOpen.value = false })
defineExpose({ focus })
</script>

<template>
  <BaseField :id="id" as="div" :hint="hint" :hint-id="id + '-hint'" :error="error" :error-id="id + '-error'" :disabled="disabled" root-class="min-w-0 space-y-1 text-sm">
    <template #icon><MagnifyingGlassIcon class="h-4 w-4 shrink-0 text-ui-secondary" aria-hidden="true" /></template>
    <template #label><label :for="id">{{ label }}</label></template>
    <div class="relative min-w-0">
      <BaseInput
        :id="id"
        ref="input"
        :model-value="modelValue"
        :placeholder="placeholder"
        :maxlength="maxlength"
        :disabled="disabled"
        :aria-busy="loading || undefined"
        :role="searchbox ? 'searchbox' : undefined"
        :aria-invalid="!!error || undefined"
        :aria-describedby="error ? id + '-error' : hint ? id + '-hint' : undefined"
        input-class="base-control pl-3 text-base"
        autocomplete="off"
        :style="{ paddingRight: actions ? (actions * 44 + 4) + 'px' : '0.75rem' }"
        @update:model-value="emit('update:modelValue', String($event ?? ''))"
        @keydown.enter.prevent="submit"
      />
      <div v-if="actions" class="absolute inset-y-0 right-0 flex items-center">
        <BaseButton v-if="showClear" type="button" variant="ghost" class="!h-11 !w-11 !p-0" :aria-label="clearLabel" :title="clearLabel" :disabled="disabled" @click="clear">
          <XMarkIcon class="h-5 w-5" aria-hidden="true" />
        </BaseButton>
        <BaseButton v-if="showSubmit" type="button" variant="ghost" class="!h-11 !w-11 !p-0" :aria-label="submitLabel" :title="submitLabel" :disabled="cannotSubmit" @click="submit">
          <MagnifyingGlassIcon class="h-5 w-5" aria-hidden="true" />
        </BaseButton>
        <BaseButton v-if="showScan" type="button" variant="ghost" class="!h-11 !w-11 !p-0" :aria-label="scanLabel" :title="scanLabel" :disabled="disabled || loading" @click="openCamera">
          <CameraIcon class="h-5 w-5" aria-hidden="true" />
        </BaseButton>
      </div>
    </div>
  </BaseField>
  <InventoryBarcodeCamera v-if="cameraOpen" :lookup-barcode="lookupBarcode" @close="closeCamera" @recognized="scanned" />
</template>
