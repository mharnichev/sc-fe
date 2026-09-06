<script setup lang="ts">
import { CheckIcon, ChevronDownIcon } from '@heroicons/vue/24/outline'
import { useId } from 'vue'

defineOptions({ inheritAttrs: false })

export type BaseSelectValue = string | number | boolean | null
export interface BaseSelectOption {
  value: BaseSelectValue
  label: string
  disabled?: boolean
  meta?: unknown
}

const props = withDefaults(defineProps<{
  modelValue?: BaseSelectValue
  value?: BaseSelectValue
  options?: BaseSelectOption[]
  native?: boolean
  id?: string
  name?: string
  label?: string
  hint?: string
  error?: string
  required?: boolean
  disabled?: boolean
  placeholder?: string
  menuClass?: string
  ariaLabel?: string
  fieldClass?: string
  triggerClass?: string
}>(), {
  modelValue: undefined,
  value: undefined,
  options: () => [],
  placeholder: 'Оберіть значення',
  menuClass: 'z-[220]',
})

const emit = defineEmits<{
  'update:modelValue': [value: BaseSelectValue]
  change: [event: Event]
}>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const menuStyle = ref<Record<string, string>>({})
const attrs = useAttrs()
const passthroughAttrs = computed(() => {
  const { class: _class, ...rest } = attrs
  return rest
})
const attrsClass = computed(() => attrs.class)
const hasField = computed(() => Boolean(props.label || props.hint || props.error))
const currentValue = computed(() => props.modelValue ?? props.value ?? '')
const generatedId = useId()
const fieldId = computed(() => props.id || props.name || `base-select-${generatedId}`)
const labelId = computed(() => `${fieldId.value}-label`)
const hintId = computed(() => props.hint ? `${fieldId.value}-hint` : undefined)
const errorId = computed(() => props.error ? `${fieldId.value}-error` : undefined)
const describedBy = computed(() => errorId.value || hintId.value)
const listboxId = computed(() => `${fieldId.value}-listbox`)
const valueId = computed(() => `${fieldId.value}-value`)

const valuesMatch = (left: BaseSelectValue | undefined, right: BaseSelectValue | undefined) =>
  String(left ?? '') === String(right ?? '')

const selectedOption = computed(() =>
  props.options.find(option => valuesMatch(option.value, currentValue.value)) || null,
)

const selectedLabel = computed(() => selectedOption.value?.label || props.placeholder)

const selectOption = async (option: BaseSelectOption) => {
  if (option.disabled) return
  emit('update:modelValue', option.value)
  open.value = false
  await nextTick()
  rootRef.value?.querySelector<HTMLButtonElement>('button')?.focus()
}

const focusMenuOption = (position: 'first' | 'last' | 'selected' | number = 'selected') => {
  const optionButtons = Array.from(menuRef.value?.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)') || [])
  if (!optionButtons.length) return

  let index = typeof position === 'number'
    ? position
    : position === 'last'
      ? optionButtons.length - 1
      : position === 'selected'
        ? optionButtons.findIndex(button => button.getAttribute('aria-selected') === 'true')
        : 0

  if (index < 0) index = 0
  optionButtons[Math.min(Math.max(index, 0), optionButtons.length - 1)]?.focus()
}

const openAndFocus = async (position: 'first' | 'last' | 'selected') => {
  if (props.disabled) return
  open.value = true
  await nextTick()
  focusMenuOption(position)
}

const closeAndFocusTrigger = async () => {
  open.value = false
  await nextTick()
  rootRef.value?.querySelector<HTMLButtonElement>('button')?.focus()
}

const handleTriggerKeydown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    void openAndFocus(event.key === 'ArrowDown' ? 'selected' : 'last')
    return
  }
  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    open.value = false
  }
}

const handleMenuKeydown = (event: KeyboardEvent) => {
  const optionButtons = Array.from(menuRef.value?.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)') || [])
  const activeIndex = optionButtons.indexOf(document.activeElement as HTMLButtonElement)

  if (event.key === 'Escape') {
    event.preventDefault()
    void closeAndFocusTrigger()
    return
  }
  if (event.key === 'Tab') {
    open.value = false
    return
  }
  if (!optionButtons.length) return
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return

  event.preventDefault()
  if (event.key === 'Home') focusMenuOption('first')
  else if (event.key === 'End') focusMenuOption('last')
  else focusMenuOption(event.key === 'ArrowDown'
    ? (activeIndex + 1) % optionButtons.length
    : (activeIndex - 1 + optionButtons.length) % optionButtons.length)
}

const updateMenuPosition = () => {
  if (typeof window === 'undefined') return
  const trigger = rootRef.value
  if (!trigger) return

  const rect = trigger.getBoundingClientRect()
  const viewportPadding = 16
  const left = Math.max(
    viewportPadding,
    Math.min(rect.left, window.innerWidth - rect.width - viewportPadding),
  )
  const menuGap = 8
  const availableBelow = Math.max(0, window.innerHeight - rect.bottom - viewportPadding - menuGap)
  const availableAbove = Math.max(0, rect.top - viewportPadding - menuGap)
  const opensAbove = availableBelow < 160 && availableAbove > availableBelow
  const availableHeight = opensAbove ? availableAbove : availableBelow

  menuStyle.value = {
    position: 'fixed',
    top: opensAbove ? 'auto' : `${rect.bottom + menuGap}px`,
    bottom: opensAbove ? `${window.innerHeight - rect.top + menuGap}px` : 'auto',
    left: `${left}px`,
    width: `${rect.width}px`,
    maxHeight: `${Math.max(48, Math.min(288, availableHeight))}px`,
  }
}

const castNativeValue = (select: HTMLSelectElement): BaseSelectValue => {
  const selectedOptionElement = select.selectedOptions[0] as (HTMLOptionElement & { _value?: unknown }) | undefined
  if (selectedOptionElement && '_value' in selectedOptionElement) {
    const value = selectedOptionElement._value
    if (['string', 'number', 'boolean'].includes(typeof value) || value === null) return value as BaseSelectValue
  }
  const value = select.value
  const option = props.options.find(item => String(item.value ?? '') === value)
  if (option) return option.value
  return value
}

const handleNativeChange = (event: Event) => {
  emit('update:modelValue', castNativeValue(event.target as HTMLSelectElement))
  emit('change', event)
}

const closeOnOutsideClick = (event: MouseEvent) => {
  const target = event.target
  if (!(target instanceof Node) || rootRef.value?.contains(target) || menuRef.value?.contains(target)) return
  open.value = false
}

const addPositionListeners = () => {
  if (typeof window === 'undefined') return
  window.addEventListener('resize', updateMenuPosition)
  window.addEventListener('scroll', updateMenuPosition, true)
}

const removePositionListeners = () => {
  if (typeof window === 'undefined') return
  window.removeEventListener('resize', updateMenuPosition)
  window.removeEventListener('scroll', updateMenuPosition, true)
}

watch(open, async value => {
  if (!value) {
    removePositionListeners()
    return
  }
  await nextTick()
  updateMenuPosition()
  addPositionListeners()
})

onMounted(() => document.addEventListener('click', closeOnOutsideClick))
onBeforeUnmount(() => {
  document.removeEventListener('click', closeOnOutsideClick)
  removePositionListeners()
})
</script>

<template>
  <select
    v-if="native && !(hasField || $slots.icon || $slots.label)"
    v-bind="passthroughAttrs"
    :id="fieldId"
    :value="currentValue"
    :name="name"
    :required="required"
    :disabled="disabled"
    :class="['base-control px-4 py-2.5 text-sm', attrsClass]"
    @change="handleNativeChange"
  >
    <slot />
  </select>

  <BaseField
    v-else
    :label="label"
    :hint="hint"
    :error="error"
    :id="fieldId"
    :label-id="labelId"
    :hint-id="hintId"
    :error-id="errorId"
    :required="required"
    :disabled="disabled"
    :root-class="fieldClass || 'base-field space-y-1.5 text-sm'"
    as="div"
  >
    <template v-if="$slots.icon" #icon>
      <slot name="icon" />
    </template>
    <template v-if="$slots.label" #label>
      <slot name="label" />
    </template>

    <select
      v-if="native"
      v-bind="passthroughAttrs"
      :id="fieldId"
      :value="currentValue"
      :name="name"
      :required="required"
      :disabled="disabled"
      :aria-describedby="describedBy"
      :aria-invalid="error ? true : undefined"
      :class="['base-control px-4 py-2.5 text-sm', attrsClass]"
      @change="handleNativeChange"
    >
      <slot />
    </select>

    <div
      v-else
      ref="rootRef"
      class="relative min-w-0"
      :style="open ? { zIndex: 50000 } : undefined"
    >
      <BaseButton
        :id="fieldId"
        type="button"
        variant="unstyled"
        class="base-select__trigger base-control flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm disabled:cursor-not-allowed"
        :class="triggerClass"
        :aria-expanded="open"
        :aria-label="ariaLabel || (!hasField ? selectedLabel : undefined)"
        :aria-labelledby="hasField && !ariaLabel ? `${labelId} ${valueId}` : undefined"
        :aria-describedby="describedBy"
        :aria-invalid="error ? true : undefined"
        :aria-controls="listboxId"
        aria-haspopup="listbox"
        :disabled="disabled"
        @click="open = !open"
        @keydown="handleTriggerKeydown"
      >
        <span :id="valueId" class="backoffice-select-label min-w-0 truncate font-medium" :class="selectedOption ? 'backoffice-select-label--selected' : 'backoffice-select-label--placeholder'">
          <slot name="selected" :option="selectedOption" :label="selectedLabel">
            {{ selectedLabel }}
          </slot>
        </span>
        <ChevronDownIcon class="backoffice-select-chevron h-4 w-4 shrink-0 transition" :class="{ 'rotate-180': open }" aria-hidden="true" />
      </BaseButton>

      <Teleport to="body">
        <div
          v-if="open"
          :id="listboxId"
          ref="menuRef"
          class="booking-select-menu base-select__menu overflow-y-auto rounded-xl p-1.5 md:rounded-2xl"
          :class="menuClass"
          :style="menuStyle"
          role="listbox"
          :aria-labelledby="hasField ? labelId : undefined"
          @keydown="handleMenuKeydown"
        >
          <BaseButton
            v-for="option in options"
            :key="String(option.value ?? '')"
            type="button"
            variant="unstyled"
            class="base-select__option flex w-full min-w-0 items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50"
            :class="{ 'is-selected': valuesMatch(currentValue, option.value) }"
            :disabled="option.disabled"
            role="option"
            :aria-selected="valuesMatch(currentValue, option.value)"
            @click="selectOption(option)"
          >
            <slot name="option" :option="option" :selected="valuesMatch(currentValue, option.value)">
              <span class="min-w-0 truncate font-medium">{{ option.label }}</span>
            </slot>
            <CheckIcon
              v-if="valuesMatch(currentValue, option.value)"
              class="backoffice-select-check h-4 w-4 shrink-0 text-cyan-600"
              aria-hidden="true"
            />
          </BaseButton>
        </div>
      </Teleport>
    </div>
  </BaseField>
</template>
