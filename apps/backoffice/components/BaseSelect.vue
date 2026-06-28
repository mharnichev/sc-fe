<script setup lang="ts">
import { CheckIcon, ChevronDownIcon } from '@heroicons/vue/24/outline'

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

const valuesMatch = (left: BaseSelectValue | undefined, right: BaseSelectValue | undefined) =>
  String(left ?? '') === String(right ?? '')

const selectedOption = computed(() =>
  props.options.find(option => valuesMatch(option.value, currentValue.value)) || null,
)

const selectedLabel = computed(() => selectedOption.value?.label || props.placeholder)

const selectOption = (option: BaseSelectOption) => {
  if (option.disabled) return
  emit('update:modelValue', option.value)
  open.value = false
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
  const availableBelow = Math.max(160, window.innerHeight - rect.bottom - viewportPadding - 8)

  menuStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 8}px`,
    left: `${left}px`,
    width: `${rect.width}px`,
    maxHeight: `${Math.min(288, availableBelow)}px`,
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
    :value="currentValue"
    :name="name"
    :required="required"
    :disabled="disabled"
    :class="attrsClass"
    @change="handleNativeChange"
  >
    <slot />
  </select>

  <BaseField
    v-else
    :label="label"
    :hint="hint"
    :error="error"
    :required="required"
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

    <select
      v-if="native"
      v-bind="passthroughAttrs"
      :value="currentValue"
      :name="name"
      :required="required"
      :disabled="disabled"
      :class="attrsClass"
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
        type="button"
        variant="unstyled"
        class="backoffice-select-trigger flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border border-slate-300 px-4 py-2.5 text-left text-sm transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        :class="triggerClass"
        :aria-expanded="open"
        :aria-label="ariaLabel"
        aria-haspopup="listbox"
        :disabled="disabled"
        @click="open = !open"
      >
        <span class="backoffice-select-label min-w-0 truncate font-medium" :class="selectedOption ? 'backoffice-select-label--selected' : 'backoffice-select-label--placeholder'">
          <slot name="selected" :option="selectedOption" :label="selectedLabel">
            {{ selectedLabel }}
          </slot>
        </span>
        <ChevronDownIcon class="backoffice-select-chevron h-4 w-4 shrink-0 transition" :class="{ 'rotate-180': open }" aria-hidden="true" />
      </BaseButton>

      <Teleport to="body">
        <div
          v-if="open"
          ref="menuRef"
          class="booking-select-menu overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-slate-900/5 md:rounded-2xl"
          :class="menuClass"
          :style="menuStyle"
          role="listbox"
        >
          <BaseButton
            v-for="option in options"
            :key="String(option.value ?? '')"
            type="button"
            variant="unstyled"
            class="flex w-full min-w-0 items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            :class="valuesMatch(currentValue, option.value) ? 'bg-slate-50 text-slate-900' : 'text-slate-700'"
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
