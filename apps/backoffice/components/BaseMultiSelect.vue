<script setup lang="ts">
import TrashIcon from './TrashIcon.vue'
import { CheckIcon, QueueListIcon, ChevronDownIcon, MagnifyingGlassIcon, PhotoIcon, XMarkIcon } from '@heroicons/vue/24/outline'

export type BaseMultiSelectValue = string | number
export interface BaseMultiSelectOption {
  value: BaseMultiSelectValue
  label: string
  imageUrl?: string | null
  description?: string | null
  searchText?: string
  disabled?: boolean
  meta?: unknown
}

const props = withDefaults(defineProps<{
  modelValue: BaseMultiSelectValue[]
  options: BaseMultiSelectOption[]
  label?: string
  hint?: string
  error?: string
  placeholder?: string
  emptyLabel?: string
  searchPlaceholder?: string
  disabled?: boolean
  maxSelected?: number
  showLimit?: boolean
  showSelectedChips?: boolean
  menuClass?: string
  fieldClass?: string
  triggerClass?: string
}>(), {
  placeholder: 'Виберіть значення',
  emptyLabel: 'Нічого не знайдено.',
  searchPlaceholder: 'Пошук',
  maxSelected: 5,
  showLimit: false,
  showSelectedChips: true,
  menuClass: 'z-[180]',
})

const emit = defineEmits<{
  'update:modelValue': [value: BaseMultiSelectValue[]]
}>()

const rootRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const menuId = `multi-select-${useId()}`
const failedImages = ref(new Set<string>())
const open = ref(false)
const query = ref('')
let lastPointerType = ''
let tabNavigation = false

const rememberPointer = (event: PointerEvent) => {
  lastPointerType = event.pointerType
  tabNavigation = false
}
const resetPointer = () => { lastPointerType = '' }
const shouldFocusSearch = () => lastPointerType !== 'touch' && lastPointerType !== 'pen'

const keyFor = (value: BaseMultiSelectValue) => String(value)
const selectedKeys = computed(() => new Set(props.modelValue.map(keyFor)))
const selectedOptions = computed(() =>
  props.options.filter(option => selectedKeys.value.has(keyFor(option.value))),
)
const normalizedQuery = computed(() => query.value.trim().toLowerCase())
const filteredOptions = computed(() => {
  if (!normalizedQuery.value) return props.options

  return props.options.filter(option => {
    const haystack = [option.label, option.description, option.searchText]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(normalizedQuery.value)
  })
})

const limitReached = computed(() =>
  props.showLimit && selectedKeys.value.size >= props.maxSelected,
)

const summaryLabel = computed(() => {
  if (!selectedOptions.value.length) return props.placeholder
  return props.showLimit
    ? `${selectedOptions.value.length}/${props.maxSelected} вибрано`
    : `${selectedOptions.value.length} вибрано`
})

const isSelected = (option: BaseMultiSelectOption) => selectedKeys.value.has(keyFor(option.value))

const setValue = (value: BaseMultiSelectValue[]) => {
  const seen = new Set<string>()
  if (props.disabled) return
  emit('update:modelValue', value.filter(item => {
    const key = keyFor(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }))
}

const selectableFiltered = computed(() => filteredOptions.value.filter(option => !option.disabled && !isSelected(option)))
const canSelectAll = computed(() => !props.disabled && selectableFiltered.value.length > 0 && !limitReached.value)
const canClear = computed(() => !props.disabled && props.modelValue.some(value =>
  !props.options.some(option => keyFor(option.value) === keyFor(value) && option.disabled),
))
const imageFailed = (option: BaseMultiSelectOption) => failedImages.value.has(option.imageUrl || '')
const markImageFailed = (option: BaseMultiSelectOption) => {
  failedImages.value.add(option.imageUrl || '')
}
const focusTrigger = () => rootRef.value?.querySelector<HTMLButtonElement>('[data-multiselect-trigger]')?.focus()
const focusSearch = async () => {
  await nextTick()
  if (open.value && !props.disabled) searchInputRef.value?.focus()
}

const openMenu = async (focus = true) => {
  if (props.disabled) return
  open.value = true
  if (focus) await focusSearch()
}

const toggleMenu = () => {
  if (open.value) closeMenu()
  else void openMenu(shouldFocusSearch())
}

const closeMenu = (restoreFocus = false) => {
  open.value = false
  query.value = ''
  if (restoreFocus) focusTrigger()
}

const toggleOption = (option: BaseMultiSelectOption) => {
  if (props.disabled || option.disabled) return
  if (isSelected(option)) {
    setValue(props.modelValue.filter(item => keyFor(item) !== keyFor(option.value)))
    return
  }
  if (limitReached.value) return

  setValue([...props.modelValue, option.value])
}

const removeOption = (option: BaseMultiSelectOption) => {
  if (props.disabled || option.disabled) return
  setValue(props.modelValue.filter(item => keyFor(item) !== keyFor(option.value)))
}

const clearAll = () => {
  if (!canClear.value) return
  if (shouldFocusSearch()) searchInputRef.value?.focus()
  setValue(props.modelValue.filter(value =>
    props.options.some(option => keyFor(option.value) === keyFor(value) && option.disabled),
  ))
}

const selectAllFiltered = () => {
  if (!canSelectAll.value) return
  if (shouldFocusSearch()) searchInputRef.value?.focus()
  const remaining = props.showLimit ? Math.max(0, props.maxSelected - selectedKeys.value.size) : Infinity
  setValue([...props.modelValue, ...selectableFiltered.value.slice(0, remaining).map(option => option.value)])
}

const selectFirstFiltered = () => {
  const first = filteredOptions.value.find(option => !option.disabled)
  if (first) toggleOption(first)
}

const handleDocumentKeydown = (event: KeyboardEvent) => {
  if (!open.value || event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  closeMenu(true)
}

const handleKeydown = (event: KeyboardEvent) => {
  resetPointer()
  tabNavigation = event.key === 'Tab'
}

const handleFocusOut = (event: FocusEvent) => {
  const nextTarget = event.relatedTarget
  const leftByTab = tabNavigation
  tabNavigation = false
  // Touch focus can temporarily fall back to the page before its click.
  if (!nextTarget || nextTarget === document.body || nextTarget === document.documentElement) {
    if (leftByTab) closeMenu()
    return
  }
  if (nextTarget instanceof Node && !rootRef.value?.contains(nextTarget)) closeMenu()
}

watch(() => props.disabled, disabled => { if (disabled) closeMenu() })

const handleDocumentPointerDown = (event: PointerEvent) => {
  if (!rootRef.value || rootRef.value.contains(event.target as Node)) return
  resetPointer()
  closeMenu()
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown, true)
})
</script>

<template>
  <BaseField
    :label="label"
    :hint="hint"
    :error="error"
    :disabled="disabled"
    :root-class="fieldClass || 'space-y-1.5 text-sm text-slate-700'"
    as="div"
  >
    <template v-if="$slots.icon" #icon>
      <slot name="icon" />
    </template>
    <template v-if="$slots.label" #label>
      <slot name="label" />
    </template>

    <div ref="rootRef" @pointerdown="rememberPointer" @pointercancel="resetPointer" @click="resetPointer" @keydown="handleKeydown" @focusout="handleFocusOut">
      <div class="relative">
        <BaseButton
          type="button"
          variant="unstyled"
          :disabled="disabled"
          class="backoffice-select-trigger flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:bg-slate-50 disabled:opacity-70 sm:rounded-2xl sm:px-4 sm:py-3"
          :class="triggerClass"
          data-multiselect-trigger
          :aria-expanded="open"
          :aria-controls="open ? menuId : undefined"
          @keydown.down.prevent="openMenu()"
          @click="toggleMenu"
        >
          <span v-if="label" class="sr-only">{{ label }}: </span>
          <span class="min-w-0 flex-1">
            <span v-if="selectedOptions.length" class="block truncate font-medium text-slate-900">
              <slot name="summary" :selected-options="selectedOptions" :summary-label="summaryLabel">
                {{ summaryLabel }}
              </slot>
            </span>
            <span v-else class="block truncate text-slate-500">{{ placeholder }}</span>
          </span>
          <ChevronDownIcon class="h-4 w-4 shrink-0 text-slate-500 transition" :class="open ? 'rotate-180' : ''" aria-hidden="true" />
        </BaseButton>

        <div v-if="open" :id="menuId" role="group" :aria-label="label || placeholder" class="booking-select-menu multi-select-menu absolute mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl" :class="menuClass">
          <div class="border-b border-slate-100 p-2">
            <div class="flex items-center gap-2">
              <div class="relative min-w-0 flex-1">
                <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <BaseInput
                  ref="searchInputRef"
                  v-model="query"
                  type="search"
                  :placeholder="searchPlaceholder"
                  input-class="multi-select-search-input min-h-9 w-full rounded-xl border-0 bg-slate-50 py-1.5 pl-9 pr-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500"
                  field-class=""
                  @keydown.enter.prevent="selectFirstFiltered"
                />
              </div>
              <BaseButton
                type="button"
                variant="unstyled"
                class="multi-select-done inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                aria-label="Закрити список"
                title="Закрити список"
                @click="closeMenu(true)"
              >
                <CheckIcon class="h-5 w-5" aria-hidden="true" />
              </BaseButton>
            </div>
            <div class="mt-2 grid grid-cols-2 gap-2">
              <BaseButton
                type="button"
                class="multi-select-bulk multi-select-bulk--select inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="!canSelectAll"
                @click="selectAllFiltered"
              >
                <QueueListIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
                <span class="whitespace-nowrap">Вибрати всі<span v-if="normalizedQuery" class="hidden sm:inline"> знайдені</span></span>
              </BaseButton>
              <BaseButton
                type="button"
                class="multi-select-bulk multi-select-bulk--clear inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="!canClear"
                @click="clearAll"
              >
                <TrashIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Прибрати всі</span>
              </BaseButton>
              <span class="col-span-2 text-right text-xs text-ui-muted" aria-live="polite">{{ summaryLabel }}</span>
            </div>
          </div>

          <div class="multi-select-options max-h-60 overflow-y-auto overscroll-contain p-1">
            <BaseButton
              v-for="option in filteredOptions"
              :key="keyFor(option.value)"
              type="button"
              variant="unstyled"
              class="multi-select-option flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition"
              :class="[
                isSelected(option) ? 'is-selected' : '',
                (option.disabled || (limitReached && !isSelected(option))) ? 'cursor-not-allowed opacity-50' : '',
              ]"
              role="checkbox"
              :aria-checked="isSelected(option)"
              :disabled="option.disabled || (limitReached && !isSelected(option))"
              @click="toggleOption(option)"
            >
              <span
                class="multi-select-check inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                :class="isSelected(option) ? 'is-checked' : ''"
                aria-hidden="true"
              ><CheckIcon v-if="isSelected(option)" class="h-3 w-3" /></span>
              <slot name="option" :option="option" :selected="isSelected(option)">
                <span v-if="option.imageUrl !== undefined" class="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-ui-subtle text-ui-muted">
                  <img v-if="option.imageUrl && !imageFailed(option)" :src="option.imageUrl" alt="" loading="lazy" class="h-full w-full object-contain" @error="markImageFailed(option)">
                  <PhotoIcon v-else class="h-4 w-4" aria-hidden="true" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block break-words font-medium text-slate-900">{{ option.label }}</span>
                  <span v-if="option.description" class="block text-xs text-slate-500">{{ option.description }}</span>
                </span>
              </slot>
            </BaseButton>

            <p v-if="!filteredOptions.length" class="px-3 py-6 text-center text-sm text-slate-500">
              {{ emptyLabel }}
            </p>
            <p v-else-if="showLimit && limitReached" class="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
              Можна вибрати максимум {{ maxSelected }}.
            </p>
          </div>
        </div>
      </div>
      <div v-if="showSelectedChips && selectedOptions.length" class="multi-select-chips mt-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto overscroll-contain rounded-lg p-0.5" role="group" tabindex="0" :aria-label="`Вибрані значення: ${selectedOptions.length}`">
        <span
          v-for="option in selectedOptions"
          :key="keyFor(option.value)"
          class="service-selection-chip inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium"
        >
          <slot name="chip" :option="option" :remove="() => removeOption(option)">
            <span v-if="option.imageUrl !== undefined" class="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded bg-ui-subtle">
              <img v-if="option.imageUrl && !imageFailed(option)" :src="option.imageUrl" alt="" loading="lazy" class="h-full w-full object-contain" @error="markImageFailed(option)">
              <PhotoIcon v-else class="h-3 w-3" aria-hidden="true" />
            </span>
            <span class="min-w-0 truncate">{{ option.label }}</span>
          </slot>
          <BaseButton
            type="button"
            variant="unstyled"
            class="service-selection-chip-remove inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition"
            :aria-label="`Прибрати ${option.label}`"
            :disabled="disabled || option.disabled"
            @click="removeOption(option)"
          >
            <XMarkIcon class="h-3 w-3" aria-hidden="true" />
          </BaseButton>
        </span>
      </div>

    </div>
  </BaseField>
</template>

<style scoped>
.booking-select-menu .multi-select-done {
  background: #15803d !important;
  color: #fff !important;
}
.booking-select-menu .multi-select-done:hover:not(:disabled) {
  background: #166534 !important;
  color: #fff !important;
}
.booking-select-menu .multi-select-bulk {
  border: 1px solid;
  transition: background-color 0.18s ease, border-color 0.18s ease;
}
.booking-select-menu .multi-select-bulk--select {
  border-color: color-mix(in srgb, #0d9488 45%, transparent);
  background: color-mix(in srgb, #0d9488 14%, var(--select-menu-bg)) !important;
  color: color-mix(in srgb, var(--text-primary) 65%, #0d9488) !important;
}
.booking-select-menu .multi-select-bulk--clear {
  border-color: color-mix(in srgb, #e11d48 40%, transparent);
  background: color-mix(in srgb, #e11d48 12%, var(--select-menu-bg)) !important;
  color: color-mix(in srgb, var(--text-primary) 65%, #e11d48) !important;
}
.booking-select-menu .multi-select-bulk--select:hover:not(:disabled) {
  background: color-mix(in srgb, #0d9488 24%, var(--select-menu-bg)) !important;
  color: color-mix(in srgb, var(--text-primary) 75%, #0d9488) !important;
}
.booking-select-menu .multi-select-bulk--clear:hover:not(:disabled) {
  background: color-mix(in srgb, #e11d48 22%, var(--select-menu-bg)) !important;
  color: color-mix(in srgb, var(--text-primary) 75%, #e11d48) !important;
}
.booking-select-menu .multi-select-done:hover:not(:disabled) :deep(svg),
.booking-select-menu .multi-select-bulk:hover:not(:disabled) :deep(*) {
  color: inherit !important;
}
.multi-select-check {
  border-color: var(--input-border);
}
.multi-select-check.is-checked {
  border-color: var(--accent-text);
  background: var(--accent-text);
  color: var(--solid-control-text, #fff);
}
.multi-select-options {
  max-height: min(15rem, 40dvh);
}
@media (pointer: coarse) {
  :global(.base-modal__panel .multi-select-menu) {
    position: static;
  }
}
.multi-select-chips {
  scrollbar-width: thin;
}
</style>
