<script setup lang="ts">
import { useId } from 'vue'
import { sanitizeInput } from '~/utils/inputSafety'
const props = withDefaults(defineProps<{
  label: string; options: Array<{ value: string; label: string }>; loading?: boolean; error?: string;
  placeholder?: string; disabled?: boolean; required?: boolean; emptyText?: string; loadingText?: string; retryText?: string
}>(), { loading: false, error: '', placeholder: '', disabled: false, required: false, emptyText: '', loadingText: '', retryText: '' })
const model = defineModel<string>({ default: '' })
const emit = defineEmits<{ select: [value: string]; retry: [] }>()
const id = `autocomplete-${useId()}`
const open = ref(false)
const active = ref(-1)
watch(() => props.options, () => { active.value = -1 })
const onInput = (event: Event) => {
  if ((event as InputEvent).isComposing) return
  const input = event.target as HTMLInputElement
  input.value = sanitizeInput(input.value, 'address')
  model.value = input.value
  open.value = true
  active.value = -1
}
const choose = (index: number) => {
  const option = props.options[index]
  if (!option) return
  model.value = option.label
  emit('select', option.value)
  open.value = false
  active.value = -1
}
const focusout = (event: FocusEvent) => {
  if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) open.value = false
}
const keydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') { open.value = false; return }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    open.value = true
    if (!props.options.length) return
    active.value = active.value < 0
      ? (event.key === 'ArrowDown' ? 0 : props.options.length - 1)
      : (active.value + (event.key === 'ArrowDown' ? 1 : -1) + props.options.length) % props.options.length
    nextTick(() => document.getElementById(`${id}-option-${active.value}`)?.scrollIntoView({ block: 'nearest' }))
  }
  if (event.key === 'Enter' && open.value) {
    event.preventDefault()
    choose(active.value)
  }
}
</script>

<template>
  <BaseField v-slot="{ id: fieldId, descriptionId, errorId, invalid }" :id="id" :label="label" :error="error" :required="required" :disabled="disabled">
    <div class="base-autocomplete" @focusout="focusout">
      <input :id="fieldId" :value="model" maxlength="160" class="base-control" :class="{ 'base-control--invalid': invalid }"
        role="combobox" aria-autocomplete="list" :aria-expanded="open && !disabled" :aria-controls="`${id}-list`"
        :aria-activedescendant="open && active >= 0 ? `${id}-option-${active}` : undefined"
        :aria-describedby="[descriptionId, errorId].filter(Boolean).join(' ') || undefined" :aria-invalid="invalid || undefined"
        :aria-busy="loading" :placeholder="placeholder" :disabled="disabled" :required="required" autocomplete="off"
        @focus="open = true" @input="onInput" @compositionend="onInput" @keydown="keydown">
      <div v-if="open && !disabled" class="base-autocomplete__popup">
        <ul :id="`${id}-list`" role="listbox" :aria-label="label" class="base-autocomplete__list">
          <li v-for="(option, index) in options" :id="`${id}-option-${index}`" :key="option.value" role="option"
            :aria-selected="index === active" class="base-autocomplete__option" :class="{ 'is-active': index === active }"
            @mousedown.prevent @click="choose(index)">{{ option.label }}</li>
        </ul>
        <p v-if="loading || (!options.length && !error)" role="status" class="base-autocomplete__status">{{ loading ? loadingText : emptyText }}</p>
        <BaseButton v-if="error" variant="text" size="sm" @mousedown.prevent @click="emit('retry')">{{ retryText }}</BaseButton>
      </div>
    </div>
  </BaseField>
</template>

<style scoped>
.base-autocomplete { position: relative; min-width: 0; }
.base-autocomplete__popup { position: absolute; z-index: 25; top: 100%; width: 100%; background: white; border: 1px solid #ddd; box-shadow: 0 6px 16px #0001; }
.base-autocomplete__list { max-height: 17rem; overflow-y: auto; overscroll-behavior: contain; padding: 0; margin: 0; list-style: none; }
.base-autocomplete__option { padding: .8rem; cursor: pointer; line-height: 1.4; overflow-wrap: anywhere; }
.base-autocomplete__option:hover, .base-autocomplete__option.is-active { background: #eee; }
.base-autocomplete__status { margin: 0; padding: .8rem; color: #666; font-size: .85rem; }
.base-control:focus-visible { outline: 2px solid #555 !important; outline-offset: 2px; }
</style>
