<script setup lang="ts">
import { CheckIcon, ChevronDownIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/vue/24/outline'

export type BaseMultiSelectValue = string | number
export interface BaseMultiSelectOption {
  value: BaseMultiSelectValue
  label: string
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
const open = ref(false)
const query = ref('')

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
  props.showLimit && selectedOptions.value.length >= props.maxSelected,
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
  emit('update:modelValue', value.filter(item => {
    const key = keyFor(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }))
}

const focusSearch = async () => {
  await nextTick()
  searchInputRef.value?.focus()
}

const openMenu = async () => {
  if (props.disabled) return
  open.value = true
  await focusSearch()
}

const closeMenu = () => {
  open.value = false
  query.value = ''
}

const toggleOption = (option: BaseMultiSelectOption) => {
  if (option.disabled) return
  if (isSelected(option)) {
    setValue(props.modelValue.filter(item => keyFor(item) !== keyFor(option.value)))
    return
  }
  if (limitReached.value) return

  setValue([...props.modelValue, option.value])
}

const removeOption = (option: BaseMultiSelectOption) => {
  setValue(props.modelValue.filter(item => keyFor(item) !== keyFor(option.value)))
}

const clearAll = () => {
  setValue([])
  openMenu()
}

const selectAllFiltered = () => {
  const available = filteredOptions.value
    .filter(option => !option.disabled && !isSelected(option))
    .map(option => option.value)
  const nextValue = props.showLimit
    ? [...props.modelValue, ...available].slice(0, props.maxSelected)
    : [...props.modelValue, ...available]

  setValue(nextValue)
  openMenu()
}

const selectFirstFiltered = () => {
  const first = filteredOptions.value.find(option => !option.disabled)
  if (first) toggleOption(first)
}

const handleDocumentPointerDown = (event: PointerEvent) => {
  if (!rootRef.value || rootRef.value.contains(event.target as Node)) return
  closeMenu()
}

onMounted(() => document.addEventListener('pointerdown', handleDocumentPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', handleDocumentPointerDown))
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

    <div ref="rootRef" class="relative">
      <BaseButton
        type="button"
        variant="unstyled"
        :disabled="disabled"
        class="backoffice-select-trigger flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:bg-slate-50 disabled:opacity-70 sm:rounded-2xl sm:px-4 sm:py-3"
        :class="triggerClass"
        @click="open ? closeMenu() : openMenu()"
      >
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

      <div v-if="showSelectedChips && selectedOptions.length" class="mt-2 flex flex-wrap gap-2">
        <span
          v-for="option in selectedOptions"
          :key="keyFor(option.value)"
          class="service-selection-chip inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
        >
          <slot name="chip" :option="option" :remove="() => removeOption(option)">
            <span class="min-w-0 truncate">{{ option.label }}</span>
          </slot>
          <BaseButton
            type="button"
            variant="unstyled"
            class="service-selection-chip-remove inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition"
            :aria-label="`Прибрати ${option.label}`"
            @click="removeOption(option)"
          >
            <XMarkIcon class="h-3 w-3" aria-hidden="true" />
          </BaseButton>
        </span>
      </div>

      <div v-if="open" class="booking-select-menu absolute mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl" :class="menuClass">
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
                @keydown.esc.prevent="closeMenu"
              />
            </div>
            <BaseButton
              type="button"
              variant="unstyled"
              class="multi-select-action-button multi-select-action-button--select"
              title="Вибрати всі"
              aria-label="Вибрати всі"
              :disabled="!filteredOptions.length || (showLimit && limitReached)"
              @click="selectAllFiltered"
            >
              <CheckIcon class="h-4 w-4" aria-hidden="true" />
            </BaseButton>
            <BaseButton
              type="button"
              variant="unstyled"
              class="multi-select-action-button multi-select-action-button--clear"
              title="Очистити"
              aria-label="Очистити"
              :disabled="!selectedOptions.length"
              @click="clearAll"
            >
              <XMarkIcon class="h-4 w-4" aria-hidden="true" />
            </BaseButton>
          </div>
        </div>

        <div class="max-h-72 space-y-1 overflow-y-auto p-1.5">
          <BaseButton
            v-for="option in filteredOptions"
            :key="keyFor(option.value)"
            type="button"
            variant="unstyled"
            class="multi-select-option flex w-full cursor-pointer items-start gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-sm transition"
            :class="[
              isSelected(option) ? 'is-selected' : '',
              (option.disabled || (limitReached && !isSelected(option))) ? 'cursor-not-allowed opacity-50' : '',
            ]"
            role="checkbox"
            :aria-checked="isSelected(option)"
            :disabled="option.disabled || (limitReached && !isSelected(option))"
            @click="toggleOption(option)"
          >
            <BaseCheckbox
              :model-value="isSelected(option)"
              class="multi-select-checkbox pointer-events-none mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 disabled:cursor-not-allowed"
              label-class="contents"
              tabindex="-1"
              aria-hidden="true"
              :disabled="option.disabled || (limitReached && !isSelected(option))"
            />
            <slot name="option" :option="option" :selected="isSelected(option)">
              <span class="min-w-0 flex-1">
                <span class="block font-medium text-slate-900">{{ option.label }}</span>
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
  </BaseField>
</template>
