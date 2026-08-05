<script setup lang="ts">
import { ArrowPathIcon } from '@heroicons/vue/24/outline'
import { useId } from 'vue'
import type { CustomerSummary } from '~/composables/useBackofficeApi'

const props = withDefaults(defineProps<{
  modelValue?: string | null
  label: string
  required?: boolean
  disabled?: boolean
  id?: string
  name?: string
  autocomplete?: string
  labelClass?: string
  labelContentClass?: string
  iconClass?: string
  inputClass?: string
  debounceMs?: number
  minimumDigits?: number
  maxResults?: number
}>(), {
  modelValue: '',
  autocomplete: 'off',
  labelClass: 'space-y-1.5 text-sm text-slate-700',
  labelContentClass: 'flex items-center gap-2 font-medium',
  iconClass: 'h-4 w-4 text-cyan-700',
  inputClass: 'w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:px-4',
  debounceMs: 300,
  minimumDigits: 3,
  maxResults: 6,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  select: [customer: CustomerSummary]
}>()

const api = useBackofficeApi()
const { formatPhone, normalizePhone } = useUkrainianPhoneMask()
const rootRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const focused = ref(false)
const open = ref(false)
const pending = ref(false)
const errorMessage = ref('')
const customers = ref<CustomerSummary[]>([])
const activeIndex = ref(-1)
const menuStyle = ref<Record<string, string>>({})
const selectedPhone = ref('')
const generatedId = useId()
const fieldId = computed(() => props.id || `customer-phone-${generatedId}`)
const listboxId = computed(() => `${fieldId.value}-listbox`)
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let blurTimer: ReturnType<typeof setTimeout> | null = null
let requestSequence = 0

const normalizedQuery = computed(() => normalizePhone(props.modelValue))
const subscriberDigits = computed(() => normalizedQuery.value.replace(/^\+380/, ''))
const canSearch = computed(() => subscriberDigits.value.length >= props.minimumDigits)
const activeCustomer = computed(() => customers.value[activeIndex.value] || null)
const activeOptionId = computed(() => activeCustomer.value ? `${listboxId.value}-option-${activeCustomer.value.id}` : undefined)

const customerName = (customer: CustomerSummary) =>
  [customer.name, customer.surname].filter(Boolean).join(' ').trim() || `Клієнт #${customer.id}`

const clearDebounce = () => {
  if (!debounceTimer) return
  clearTimeout(debounceTimer)
  debounceTimer = null
}

const closeMenu = () => {
  open.value = false
  activeIndex.value = -1
}

const resetSearch = () => {
  clearDebounce()
  requestSequence += 1
  pending.value = false
  errorMessage.value = ''
  customers.value = []
  closeMenu()
}

const updateMenuPosition = () => {
  if (typeof window === 'undefined' || !rootRef.value) return

  const rect = rootRef.value.getBoundingClientRect()
  const viewportPadding = 16
  const gap = 8
  const spaceBelow = window.innerHeight - rect.bottom - viewportPadding - gap
  const spaceAbove = rect.top - viewportPadding - gap
  const placeAbove = spaceBelow < 160 && spaceAbove > spaceBelow
  const availableHeight = Math.max(120, Math.min(288, placeAbove ? spaceAbove : spaceBelow))
  const width = Math.min(rect.width, window.innerWidth - viewportPadding * 2)
  const left = Math.max(viewportPadding, Math.min(rect.left, window.innerWidth - width - viewportPadding))

  menuStyle.value = {
    position: 'fixed',
    left: `${left}px`,
    width: `${width}px`,
    maxHeight: `${availableHeight}px`,
    ...(placeAbove
      ? { bottom: `${window.innerHeight - rect.top + gap}px` }
      : { top: `${rect.bottom + gap}px` }),
  }
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

const searchCustomers = async (query: string, sequence: number) => {
  try {
    const response = await api.getCustomers(1, props.maxResults, {
      search: query,
      sort_by: 'name',
      sort_order: 'asc',
    })
    if (sequence !== requestSequence) return

    customers.value = response.items
    activeIndex.value = response.items.length ? 0 : -1
    errorMessage.value = ''
    open.value = focused.value && normalizedQuery.value === query
  }
  catch {
    if (sequence !== requestSequence) return
    customers.value = []
    activeIndex.value = -1
    errorMessage.value = 'Не вдалося знайти клієнта. Номер можна ввести вручну.'
    open.value = focused.value
  }
  finally {
    if (sequence === requestSequence) pending.value = false
  }
}

const scheduleSearch = () => {
  clearDebounce()
  const query = normalizedQuery.value

  if (!focused.value || props.disabled || !canSearch.value || query === selectedPhone.value) {
    resetSearch()
    return
  }

  const sequence = ++requestSequence
  pending.value = true
  errorMessage.value = ''
  customers.value = []
  activeIndex.value = -1
  open.value = true
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void searchCustomers(query, sequence)
  }, props.debounceMs)
}

const updateValue = (value: string) => {
  if (normalizePhone(value) !== selectedPhone.value) selectedPhone.value = ''
  emit('update:modelValue', value)
}

const selectCustomer = (customer: CustomerSummary) => {
  selectedPhone.value = normalizePhone(customer.phone)
  emit('update:modelValue', customer.phone)
  emit('select', customer)
  pending.value = false
  customers.value = []
  closeMenu()
}

const moveActiveOption = (direction: 1 | -1) => {
  if (!customers.value.length) return
  const nextIndex = activeIndex.value + direction
  activeIndex.value = (nextIndex + customers.value.length) % customers.value.length
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    closeMenu()
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (!open.value && canSearch.value) open.value = true
    if (!customers.value.length) return
    event.preventDefault()
    moveActiveOption(event.key === 'ArrowDown' ? 1 : -1)
    return
  }
  if (event.key === 'Enter' && open.value && activeCustomer.value) {
    event.preventDefault()
    selectCustomer(activeCustomer.value)
  }
}

const handleFocus = () => {
  focused.value = true
  scheduleSearch()
}

const handleBlur = () => {
  focused.value = false
  if (blurTimer) clearTimeout(blurTimer)
  blurTimer = setTimeout(() => {
    const activeElement = document.activeElement
    if (!rootRef.value?.contains(activeElement) && !menuRef.value?.contains(activeElement)) closeMenu()
  }, 0)
}

const handleDocumentPointerDown = (event: PointerEvent) => {
  const target = event.target
  if (!(target instanceof Node) || rootRef.value?.contains(target) || menuRef.value?.contains(target)) return
  closeMenu()
}

watch(() => props.modelValue, () => {
  if (focused.value) scheduleSearch()
})

watch(open, async isOpen => {
  removePositionListeners()
  if (!isOpen) return
  await nextTick()
  updateMenuPosition()
  addPositionListeners()
})

onMounted(() => document.addEventListener('pointerdown', handleDocumentPointerDown))
onBeforeUnmount(() => {
  clearDebounce()
  if (blurTimer) clearTimeout(blurTimer)
  requestSequence += 1
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  removePositionListeners()
})
</script>

<template>
  <div ref="rootRef" class="min-w-0">
    <BasePhoneInput
      :id="fieldId"
      :model-value="modelValue"
      :name="name"
      :label="label"
      :required="required"
      :disabled="disabled"
      :autocomplete="autocomplete"
      :label-class="labelClass"
      :label-content-class="labelContentClass"
      :icon-class="iconClass"
      :input-class="inputClass"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="open"
      :aria-controls="open ? listboxId : undefined"
      :aria-activedescendant="activeOptionId"
      :aria-busy="pending || undefined"
      @update:model-value="updateValue"
      @focus="handleFocus"
      @blur="handleBlur"
      @keydown="handleKeydown"
    />

    <Teleport to="body">
      <div
        v-if="open"
        :id="listboxId"
        ref="menuRef"
        class="booking-select-menu base-select__menu z-[50020] overflow-y-auto rounded-xl p-1.5 md:rounded-2xl"
        :style="menuStyle"
        role="listbox"
        :aria-label="`Знайдені клієнти для ${label}`"
      >
        <div v-if="pending" class="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-500" role="status">
          <ArrowPathIcon class="h-4 w-4 animate-spin" aria-hidden="true" />
          Пошук клієнта...
        </div>
        <p v-else-if="errorMessage" class="px-3 py-2.5 text-sm text-rose-600" role="status">
          {{ errorMessage }}
        </p>
        <p v-else-if="!customers.length" class="px-3 py-2.5 text-sm text-slate-500" role="status">
          Клієнта з таким номером не знайдено.
        </p>
        <template v-else>
          <BaseButton
            v-for="(customer, index) in customers"
            :id="`${listboxId}-option-${customer.id}`"
            :key="customer.id"
            type="button"
            variant="unstyled"
            class="base-select__option flex w-full min-w-0 items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition"
            :class="{ 'is-selected': index === activeIndex }"
            role="option"
            :aria-selected="index === activeIndex"
            tabindex="-1"
            @pointerdown.prevent="selectCustomer(customer)"
            @mouseenter="activeIndex = index"
          >
            <span class="min-w-0 truncate font-medium">{{ customerName(customer) }}</span>
            <span class="shrink-0 text-xs text-slate-500">{{ formatPhone(customer.phone) }}</span>
          </BaseButton>
        </template>
      </div>
    </Teleport>
  </div>
</template>
