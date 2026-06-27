<script setup lang="ts">
import { CheckIcon, ChevronDownIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { initials } from '@shared-utils'
import type { Master } from '~/composables/useBackofficeApi'

const props = withDefaults(defineProps<{
  modelValue: number[]
  masters: Master[]
  placeholder?: string
  disabled?: boolean
}>(), {
  placeholder: 'Пошук майстрів',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: number[]]
}>()

const assetUrl = useAssetUrl()
const { masterName } = useBookingFormatting()

const rootRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const open = ref(false)
const query = ref('')

const masterDisplayName = (master?: Master | null) => {
  if (!master) return 'Майстра не вибрано'
  const firstName = master.first_name_uk || master.name || ''
  const lastName = master.last_name_uk || master.last_name || ''
  const explicitName = [firstName, lastName].filter(Boolean).join(' ')
  return explicitName || master.full_name_uk || master.full_name || masterName(master)
}

const masterImageUrl = (master?: Master | null) =>
  master ? assetUrl(master.avatar || master.avatar_url || master.photo || master.photo_url) : ''

const masterInitials = (master?: Master | null) => initials(masterDisplayName(master)) || 'SC'

const selectedSet = computed(() => new Set(props.modelValue.map(Number)))
const selectedMasters = computed(() =>
  props.masters.filter(master => selectedSet.value.has(Number(master.id))),
)

const normalizedQuery = computed(() => query.value.trim().toLowerCase())
const filteredMasters = computed(() => {
  if (!normalizedQuery.value) return props.masters

  return props.masters.filter(master => {
    const haystack = [
      masterDisplayName(master),
      master.full_name,
      master.full_name_uk,
      master.full_name_en,
      master.position_uk,
      master.position_en,
      master.email,
      master.phone,
    ].filter(Boolean).join(' ').toLowerCase()

    return haystack.includes(normalizedQuery.value)
  })
})

const masterIsSelected = (master: Master) => selectedSet.value.has(Number(master.id))

const setValue = (value: number[]) => {
  emit('update:modelValue', [...new Set(value.map(Number).filter(Number.isFinite))])
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

const toggleMaster = (master: Master) => {
  const id = Number(master.id)
  if (!Number.isFinite(id)) return
  if (selectedSet.value.has(id)) {
    setValue(props.modelValue.filter(item => Number(item) !== id))
    return
  }

  setValue([...props.modelValue, id])
}

const clearAll = () => {
  setValue([])
  openMenu()
}

const selectAllFiltered = () => {
  setValue([...props.modelValue, ...filteredMasters.value.map(master => Number(master.id))])
  openMenu()
}

const selectFirstFiltered = () => {
  const [first] = filteredMasters.value
  if (first) toggleMaster(first)
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
        <span v-if="selectedMasters.length" class="block truncate font-medium text-slate-900">
          {{ selectedMasters.length }} майстр.
        </span>
        <span v-else class="block truncate text-slate-500">Виберіть майстрів</span>
      </span>
      <ChevronDownIcon class="h-4 w-4 shrink-0 text-slate-500 transition" :class="open ? 'rotate-180' : ''" aria-hidden="true" />
    </button>

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
            :disabled="!filteredMasters.length"
            @click="selectAllFiltered"
          >
            <CheckIcon class="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="multi-select-action-button multi-select-action-button--clear"
            title="Очистити"
            aria-label="Очистити"
            :disabled="!selectedMasters.length"
            @click="clearAll"
          >
            <XMarkIcon class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div class="max-h-72 space-y-1 overflow-y-auto p-1.5">
        <button
          v-for="master in filteredMasters"
          :key="master.id"
          type="button"
          class="multi-select-option flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-sm transition"
          :class="masterIsSelected(master) ? 'is-selected' : ''"
          role="checkbox"
          :aria-checked="masterIsSelected(master)"
          @click="toggleMaster(master)"
        >
          <input
            type="checkbox"
            class="multi-select-checkbox pointer-events-none h-4 w-4 shrink-0 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
            :checked="masterIsSelected(master)"
            tabindex="-1"
            aria-hidden="true"
          >
          <span class="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
            <img v-if="masterImageUrl(master)" :src="masterImageUrl(master)" :alt="masterDisplayName(master)" class="h-full w-full object-cover">
            <span v-else>{{ masterInitials(master) }}</span>
          </span>
          <span class="min-w-0 flex-1">
            <span class="block font-medium text-slate-900">{{ masterDisplayName(master) }}</span>
            <span v-if="master.position_uk" class="block truncate text-xs text-slate-500">{{ master.position_uk }}</span>
          </span>
        </button>

        <p v-if="!filteredMasters.length" class="px-3 py-6 text-center text-sm text-slate-500">
          Майстрів не знайдено.
        </p>
      </div>
    </div>
  </div>
</template>
