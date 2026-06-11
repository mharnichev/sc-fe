<script setup lang="ts">
import { CheckIcon, ChevronDownIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import type { Service } from '~/composables/useBackofficeApi'

const props = withDefaults(defineProps<{
  modelValue: string[]
  services: Service[]
  placeholder?: string
  maxSelected?: number
  disabled?: boolean
}>(), {
  placeholder: 'Пошук послуг',
  maxSelected: 5,
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

const limitReached = computed(() => selectedServices.value.length >= props.maxSelected)

const serviceIsSelected = (service: Service) => selectedSet.value.has(Number(service.id))

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

const toggleService = (service: Service) => {
  const id = String(service.id)
  if (props.modelValue.includes(id)) {
    setValue(props.modelValue.filter(item => item !== id))
    return
  }
  if (limitReached.value) return

  setValue([...props.modelValue, id])
}

const removeService = (service: Service) => {
  setValue(props.modelValue.filter(item => item !== String(service.id)))
}

const clearAll = () => {
  setValue([])
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
          {{ selectedServices.length }}/{{ maxSelected }} посл. · {{ formatDuration(selectedDuration) }} · {{ formatPrice(selectedPrice) }}
        </span>
        <span v-else class="block truncate text-slate-500">Виберіть послуги</span>
      </span>
      <ChevronDownIcon class="h-4 w-4 shrink-0 text-slate-500 transition" :class="open ? 'rotate-180' : ''" aria-hidden="true" />
    </button>

    <div v-if="selectedServices.length" class="mt-2 flex flex-wrap gap-2">
      <span
        v-for="service in selectedServices"
        :key="service.id"
        class="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-800 ring-1 ring-cyan-100"
      >
        <span class="min-w-0 truncate">{{ serviceName(service) }}</span>
        <button
          type="button"
          class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-cyan-700 transition hover:bg-cyan-100"
          :aria-label="`Прибрати ${serviceName(service)}`"
          @click="removeService(service)"
        >
          <XMarkIcon class="h-3 w-3" aria-hidden="true" />
        </button>
      </span>
    </div>

    <div v-if="open" class="booking-select-menu absolute z-[180] mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
      <div class="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <MagnifyingGlassIcon class="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <input
          ref="searchInputRef"
          v-model="query"
          type="search"
          :placeholder="placeholder"
          class="min-h-9 flex-1 border-0 p-0 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:ring-0"
          @keydown.enter.prevent="selectFirstFiltered"
          @keydown.esc.prevent="closeMenu"
        >
        <button
          v-if="selectedServices.length"
          type="button"
          class="rounded-full px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"
          @click="clearAll"
        >
          Очистити
        </button>
      </div>

      <div class="max-h-72 overflow-y-auto p-1">
        <button
          v-for="service in filteredServices"
          :key="service.id"
          type="button"
          class="flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-slate-50"
          :class="[
            serviceIsSelected(service) ? 'bg-cyan-50/70' : '',
            limitReached && !serviceIsSelected(service) ? 'cursor-not-allowed opacity-50' : '',
          ]"
          :disabled="limitReached && !serviceIsSelected(service)"
          @click="toggleService(service)"
        >
          <span class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border" :class="serviceIsSelected(service) ? 'border-cyan-600 bg-cyan-600 text-white' : 'border-slate-300 text-transparent'">
            <CheckIcon class="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block font-medium text-slate-900">{{ serviceName(service) }}</span>
            <span class="block text-xs text-slate-500">{{ formatDuration(service.duration_minutes) }} · {{ formatPrice(service.price) }}</span>
          </span>
        </button>

        <p v-if="!filteredServices.length" class="px-3 py-6 text-center text-sm text-slate-500">
          Послуг не знайдено.
        </p>
        <p v-else-if="limitReached" class="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
          Можна вибрати максимум {{ maxSelected }} послуг.
        </p>
      </div>
    </div>
  </div>
</template>
