<script setup lang="ts">
import { CheckIcon, ChevronDownIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/vue/24/outline'

interface ServiceMultiSelectOption {
  id: number | string
  name: string
  title_uk?: string | null
  title_en?: string | null
  description?: string | null
  description_uk?: string | null
  description_en?: string | null
  duration_minutes: number
  price: string | number
}

const props = withDefaults(defineProps<{
  modelValue: string[]
  services: ServiceMultiSelectOption[]
  placeholder?: string
  maxSelected?: number
  showLimit?: boolean
  showSelectedChips?: boolean
  disabled?: boolean
}>(), {
  placeholder: 'Пошук послуг',
  maxSelected: 5,
  showLimit: true,
  showSelectedChips: true,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const { serviceName, formatDuration, formatPrice } = useBookingFormatting()

const rootRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const open = ref(false)
const query = ref('')

const selectedSet = computed(() => new Set(props.modelValue.map(Number)))
const selectedServices = computed(() =>
  props.services.filter(service => selectedSet.value.has(Number(service.id))),
)

const normalizedQuery = computed(() => query.value.trim().toLowerCase())
const filteredServices = computed(() => {
  if (!normalizedQuery.value) return props.services

  return props.services.filter(service => {
    const haystack = [
      serviceName(service),
      service.title_en,
      service.description,
      service.description_uk,
      service.description_en,
      service.price,
      service.duration_minutes,
    ].filter(Boolean).join(' ').toLowerCase()

    return haystack.includes(normalizedQuery.value)
  })
})

const selectedDuration = computed(() =>
  selectedServices.value.reduce((total, service) => total + Number(service.duration_minutes || 0), 0),
)

const selectedPrice = computed(() =>
  selectedServices.value.reduce((total, service) => total + Number(service.price || 0), 0),
)

const limitReached = computed(() => props.showLimit && selectedServices.value.length >= props.maxSelected)

const serviceIsSelected = (service: ServiceMultiSelectOption) => selectedSet.value.has(Number(service.id))

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

const setValue = (value: string[]) => {
  emit('update:modelValue', [...new Set(value)])
}

const toggleService = (service: ServiceMultiSelectOption) => {
  const id = String(service.id)
  if (props.modelValue.includes(id)) {
    setValue(props.modelValue.filter(item => item !== id))
    return
  }
  if (limitReached.value) return

  setValue([...props.modelValue, id])
}

const removeService = (service: ServiceMultiSelectOption) => {
  setValue(props.modelValue.filter(item => item !== String(service.id)))
}

const clearAll = () => {
  setValue([])
  openMenu()
}

const selectAllFiltered = () => {
  const availableIds = filteredServices.value
    .map(service => String(service.id))
    .filter(id => !props.modelValue.includes(id))

  const nextValue = props.showLimit
    ? [...props.modelValue, ...availableIds].slice(0, props.maxSelected)
    : [...props.modelValue, ...availableIds]

  setValue(nextValue)
  openMenu()
}

const selectFirstFiltered = () => {
  const [first] = filteredServices.value
  if (first) toggleService(first)
}

const handleDocumentPointerDown = (event: PointerEvent) => {
  if (!rootRef.value || rootRef.value.contains(event.target as Node)) return
  closeMenu()
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
})
</script>

<template>
  <div ref="rootRef" class="relative">
    <button
      type="button"
      :disabled="disabled"
      class="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:bg-slate-50 disabled:opacity-70 sm:rounded-2xl sm:px-4 sm:py-3"
      @click="open ? closeMenu() : openMenu()"
    >
      <span class="min-w-0 flex-1">
        <span v-if="selectedServices.length" class="block truncate font-medium text-slate-900">
          {{ selectedServices.length }}<template v-if="showLimit">/{{ maxSelected }}</template> посл. · {{ formatDuration(selectedDuration) }} · {{ formatPrice(selectedPrice) }}
        </span>
        <span v-else class="block truncate text-slate-500">Виберіть послуги</span>
      </span>
      <ChevronDownIcon class="h-4 w-4 shrink-0 text-slate-500 transition" :class="open ? 'rotate-180' : ''" aria-hidden="true" />
    </button>

    <div v-if="showSelectedChips && selectedServices.length" class="mt-2 flex flex-wrap gap-2">
      <span
        v-for="service in selectedServices"
        :key="service.id"
        class="service-selection-chip inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
      >
        <span class="min-w-0 truncate">{{ serviceName(service) }}</span>
        <button
          type="button"
          class="service-selection-chip-remove inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition"
          :aria-label="`Прибрати ${serviceName(service)}`"
          @click="removeService(service)"
        >
          <XMarkIcon class="h-3 w-3" aria-hidden="true" />
        </button>
      </span>
    </div>

    <div v-if="open" class="booking-select-menu absolute z-[180] mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
      <div class="border-b border-slate-100 p-2">
        <div class="flex items-center gap-2">
          <div class="relative min-w-0 flex-1">
            <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              ref="searchInputRef"
              v-model="query"
              type="search"
              :placeholder="placeholder"
              class="multi-select-search-input min-h-9 w-full rounded-xl border-0 bg-slate-50 py-1.5 pl-9 pr-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500"
              @keydown.enter.prevent="selectFirstFiltered"
              @keydown.esc.prevent="closeMenu"
            >
          </div>
          <button
            type="button"
            class="multi-select-action-button multi-select-action-button--select"
            title="Вибрати всі"
            aria-label="Вибрати всі"
            :disabled="!filteredServices.length || (showLimit && limitReached)"
            @click="selectAllFiltered"
          >
            <CheckIcon class="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="multi-select-action-button multi-select-action-button--clear"
            title="Очистити"
            aria-label="Очистити"
            :disabled="!selectedServices.length"
            @click="clearAll"
          >
            <XMarkIcon class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div class="max-h-72 space-y-1 overflow-y-auto p-1.5">
        <button
          v-for="service in filteredServices"
          :key="service.id"
          type="button"
          class="multi-select-option flex w-full cursor-pointer items-start gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-sm transition"
          :class="[
            serviceIsSelected(service) ? 'is-selected' : '',
            limitReached && !serviceIsSelected(service) ? 'cursor-not-allowed opacity-50' : '',
          ]"
          role="checkbox"
          :aria-checked="serviceIsSelected(service)"
          :disabled="limitReached && !serviceIsSelected(service)"
          @click="toggleService(service)"
        >
          <input
            type="checkbox"
            class="multi-select-checkbox pointer-events-none mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 disabled:cursor-not-allowed"
            :checked="serviceIsSelected(service)"
            :disabled="limitReached && !serviceIsSelected(service)"
            tabindex="-1"
            aria-hidden="true"
          >
          <span class="min-w-0 flex-1">
            <span class="block font-medium text-slate-900">{{ serviceName(service) }}</span>
            <span class="block text-xs text-slate-500">{{ formatDuration(service.duration_minutes) }} · {{ formatPrice(service.price) }}</span>
          </span>
        </button>

        <p v-if="!filteredServices.length" class="px-3 py-6 text-center text-sm text-slate-500">
          Послуг не знайдено.
        </p>
        <p v-else-if="showLimit && limitReached" class="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
          Можна вибрати максимум {{ maxSelected }} послуг.
        </p>
      </div>
    </div>
  </div>
</template>
