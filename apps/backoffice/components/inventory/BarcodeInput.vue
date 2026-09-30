<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { shouldSuppressBarcodeSubmission } from '~/utils/inventory'

const props = withDefaults(defineProps<{
  modelValue?: string
  label?: string
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  autoFocus?: boolean
  duplicateWindowMs?: number
  match?: { id: number, name: string, sku?: string | null, barcode?: string | null } | null
  notFound?: boolean
  error?: string | null
}>(), {
  modelValue: '',
  label: 'Штрихкод',
  placeholder: 'Скануйте або введіть штрихкод',
  duplicateWindowMs: 900,
  match: null,
  notFound: false,
  error: null,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: [barcode: string]
  clear: []
}>()

const inputRef = ref<{ focus: () => void } | null>(null)
const lastSubmittedBarcode = ref('')
const lastSubmittedAt = ref(0)
const inputSinceSubmit = ref(true)

const focus = () => inputRef.value?.focus()

const submit = () => {
  const barcode = props.modelValue.trim()
  if (!barcode || props.disabled || props.loading) return

  const now = Date.now()
  if (!inputSinceSubmit.value && shouldSuppressBarcodeSubmission(barcode, lastSubmittedBarcode.value, now, lastSubmittedAt.value, props.duplicateWindowMs)) return
  lastSubmittedBarcode.value = barcode
  lastSubmittedAt.value = now
  inputSinceSubmit.value = false
  emit('submit', barcode)
  // Leave the control ready for the next keyboard-wedge scan. The matched
  // product is rendered from `match`, so keeping the raw code is unnecessary.
  emit('update:modelValue', '')
  void nextTick(focus)
}

const updateValue = (value: string | number | null) => {
  const barcode = String(value || '')
  if (barcode) inputSinceSubmit.value = true
  if (barcode !== props.modelValue) {
    lastSubmittedBarcode.value = ''
    lastSubmittedAt.value = 0
  }
  emit('update:modelValue', barcode)
}

const clear = async () => {
  lastSubmittedBarcode.value = ''
  lastSubmittedAt.value = 0
  inputSinceSubmit.value = false
  emit('update:modelValue', '')
  emit('clear')
  await nextTick()
  focus()
}

onMounted(() => {
  if (props.autoFocus && !props.disabled) focus()
})

watch(() => props.disabled, (disabled) => {
  if (props.autoFocus && !disabled) nextTick(focus)
})

defineExpose({ focus })
</script>

<template>
  <section class="space-y-2" aria-live="polite">
    <div class="flex gap-2">
      <BaseInput
        ref="inputRef"
        :model-value="modelValue"
        :label="label"
        :placeholder="placeholder"
        autocomplete="off"
        inputmode="text"
        :disabled="disabled"
        :error="error || undefined"
        class="min-w-0 flex-1"
        @update:model-value="updateValue"
        @keydown.enter.prevent="submit"
      />
      <BaseButton
        type="button"
        variant="primary"
        :loading="loading"
        :disabled="disabled || !modelValue.trim()"
        class="self-end"
        @click="submit"
      >
        Знайти
      </BaseButton>
      <BaseButton
        v-if="modelValue || match || notFound"
        type="button"
        variant="secondary"
        :disabled="disabled"
        class="self-end"
        @click="clear"
      >
        Скинути
      </BaseButton>
    </div>

    <p v-if="match" class="rounded-lg border border-[var(--bo-border)] bg-[var(--bo-success-surface)] px-3 py-2 text-sm text-[var(--bo-success-text)]">
      Знайдено: <span class="font-medium">{{ match.name }}</span><span v-if="match.sku"> · {{ match.sku }}</span>
    </p>
    <p v-else-if="notFound" class="rounded-lg border border-[var(--bo-border)] bg-[var(--bo-warning-surface)] px-3 py-2 text-sm text-[var(--bo-warning-text)]">
      Товар із таким штрихкодом не знайдено. Відскануйте або введіть інший код.
    </p>
  </section>
</template>
