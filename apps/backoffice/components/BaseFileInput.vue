<script setup lang="ts">
import { ArrowUpTrayIcon, CheckCircleIcon, PhotoIcon } from '@heroicons/vue/24/outline'
import { useId } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: File | null
  id?: string
  label?: string
  hint?: string
  accept?: string
  disabled?: boolean
  required?: boolean
}>(), {
  modelValue: null,
  label: '',
  hint: '',
  accept: 'image/*,video/*',
})

const emit = defineEmits<{
  'update:modelValue': [file: File | null]
}>()

const generatedId = useId()
const inputId = computed(() => props.id || `base-file-input-${generatedId}`)
const inputRef = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const localError = ref('')
const fileName = computed(() => props.modelValue?.name || '')

const acceptsFile = (file: File) => {
  const rules = props.accept.split(',').map(rule => rule.trim().toLowerCase()).filter(Boolean)
  if (!rules.length) return true

  const fileNameValue = file.name.toLowerCase()
  const fileType = file.type.toLowerCase()
  return rules.some((rule) => {
    if (rule.startsWith('.')) return fileNameValue.endsWith(rule)
    if (rule.endsWith('/*')) return fileType.startsWith(rule.slice(0, -1))
    return fileType === rule
  })
}

const selectFile = (file: File | null) => {
  localError.value = ''
  if (file && !acceptsFile(file)) {
    localError.value = 'Цей формат файлу не підтримується.'
    if (inputRef.value) inputRef.value.value = ''
    return
  }
  emit('update:modelValue', file)
}

const handleChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  selectFile(input.files?.[0] || null)
}

const handleDrop = (event: DragEvent) => {
  dragging.value = false
  if (props.disabled) return
  selectFile(event.dataTransfer?.files?.[0] || null)
}

watch(() => props.modelValue, (file) => {
  if (!file && inputRef.value) inputRef.value.value = ''
})
</script>

<template>
  <BaseField
    as="div"
    :id="inputId"
    :label="label"
    :hint="localError || hint"
    :error="localError"
    :required="required"
    :disabled="disabled"
    root-class="base-file-field space-y-2 text-sm"
    label-class="base-field__label font-medium text-ui-secondary"
  >
    <template #icon>
      <slot name="icon">
        <PhotoIcon class="h-4 w-4 text-ui-accent" aria-hidden="true" />
      </slot>
    </template>

    <label
      :for="inputId"
      class="base-file-input"
      :class="{
        'base-file-input--dragging': dragging,
        'base-file-input--selected': fileName,
        'base-file-input--disabled': disabled,
      }"
      @dragenter.prevent="dragging = true"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="handleDrop"
    >
      <input
        :id="inputId"
        ref="inputRef"
        type="file"
        class="sr-only"
        :accept="accept"
        :disabled="disabled"
        :required="required"
        @change="handleChange"
      >

      <span class="base-file-input__icon" aria-hidden="true">
        <CheckCircleIcon v-if="fileName" class="h-5 w-5" />
        <ArrowUpTrayIcon v-else class="h-5 w-5" />
      </span>

      <span class="min-w-0 flex-1">
        <span class="base-file-input__title">
          {{ fileName || 'Завантажити файл' }}
        </span>
        <span class="base-file-input__description">
          {{ fileName ? 'Файл готовий до збереження' : 'Натисніть або перетягніть сюди' }}
        </span>
      </span>

      <span class="base-file-input__action" aria-hidden="true">
        {{ fileName ? 'Замінити' : 'Обрати' }}
      </span>
    </label>
  </BaseField>
</template>

<style scoped>
.base-file-input {
  display: flex;
  min-height: 5rem;
  cursor: pointer;
  align-items: center;
  gap: 0.75rem;
  overflow: hidden;
  border: 1px solid var(--bo-border-strong);
  border-radius: 1rem;
  padding: 0.75rem;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--bo-surface-elevated) 94%, transparent), color-mix(in srgb, var(--bo-control) 86%, transparent));
  color: var(--bo-text-primary);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--bo-text-primary) 7%, transparent);
  backdrop-filter: blur(16px) saturate(125%);
  transition: border-color 200ms ease, background 200ms ease, box-shadow 200ms ease, transform 200ms ease;
}

.base-file-input:hover:not(.base-file-input--disabled),
.base-file-input--dragging {
  border-color: var(--bo-focus-border);
  background: color-mix(in srgb, var(--bo-control-hover) 88%, var(--bo-surface));
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--bo-text-primary) 10%, transparent), 0 8px 24px color-mix(in srgb, var(--bo-shadow-color) 55%, transparent);
  transform: translateY(-1px);
}

.base-file-input:focus-within {
  border-color: var(--bo-focus-border);
  box-shadow: 0 0 0 3px var(--bo-focus-ring);
}

.base-file-input--selected {
  border-color: color-mix(in srgb, var(--bo-success) 48%, var(--bo-border));
  background: color-mix(in srgb, var(--bo-success-surface) 55%, var(--bo-surface));
}

.base-file-input--disabled {
  cursor: not-allowed;
  border-color: var(--bo-disabled-border);
  background: var(--bo-disabled-bg);
  color: var(--bo-disabled-text);
}

.base-file-input__icon {
  display: inline-flex;
  height: 2.5rem;
  width: 2.5rem;
  flex: none;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--bo-accent) 30%, var(--bo-border));
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--bo-accent) 12%, transparent);
  color: var(--bo-accent);
}

.base-file-input__title,
.base-file-input__description {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.base-file-input__title {
  font-size: 0.875rem;
  font-weight: 650;
  color: var(--bo-text-primary);
}

.base-file-input__description {
  margin-top: 0.2rem;
  font-size: 0.75rem;
  color: var(--bo-text-muted);
}

.base-file-input__action {
  flex: none;
  border: 1px solid color-mix(in srgb, var(--bo-accent) 34%, transparent);
  border-radius: 999px;
  padding: 0.45rem 0.7rem;
  background: color-mix(in srgb, var(--bo-accent) 14%, transparent);
  font-size: 0.75rem;
  font-weight: 650;
  color: var(--bo-accent);
}

@media (max-width: 639px) {
  .base-file-input__action {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .base-file-input {
    transition: none;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .base-file-input {
    background: var(--bo-surface);
    backdrop-filter: none;
  }
}

@media (forced-colors: active) {
  .base-file-input,
  .base-file-input__icon,
  .base-file-input__action {
    border-color: CanvasText;
  }
}
</style>
