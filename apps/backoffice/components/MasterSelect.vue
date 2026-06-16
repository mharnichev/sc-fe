<script setup lang="ts">
import { ChevronDownIcon, UserCircleIcon } from '@heroicons/vue/24/outline'
import { initials } from '@shared-utils'
import type { Master } from '~/composables/useBackofficeApi'

const props = withDefaults(defineProps<{
  modelValue?: string | number | null
  masters?: Master[]
  placeholder?: string
  allLabel?: string
  valueType?: 'string' | 'number'
  disabled?: boolean
  menuClass?: string
}>(), {
  masters: () => [],
  placeholder: 'Оберіть майстра',
  allLabel: '',
  valueType: 'string',
  menuClass: 'z-[220]',
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number | null]
}>()

const assetUrl = useAssetUrl()
const { masterName } = useBookingFormatting()
const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const selectedMaster = computed(() =>
  props.masters.find(master => String(master.id) === String(props.modelValue ?? '')) || null,
)

const emptyLabel = computed(() => props.allLabel || props.placeholder)

const masterDisplayName = (master?: Master | null) => {
  if (!master) return emptyLabel.value
  const firstName = master.first_name_uk || master.name || ''
  const lastName = master.last_name_uk || master.last_name || ''
  const explicitName = [firstName, lastName].filter(Boolean).join(' ')
  return explicitName || master.full_name_uk || master.full_name || masterName(master)
}

const masterImageUrl = (master?: Master | null) =>
  master ? assetUrl(master.avatar || master.avatar_url || master.photo || master.photo_url) : ''

const masterInitials = (master?: Master | null) => initials(masterDisplayName(master)) || 'SC'

const emitMasterValue = (master: Master | null) => {
  if (!master) {
    emit('update:modelValue', props.valueType === 'number' ? null : '')
    open.value = false
    return
  }
  emit('update:modelValue', props.valueType === 'number' ? Number(master.id) : String(master.id))
  open.value = false
}

const closeOnOutsideClick = (event: MouseEvent) => {
  const target = event.target
  if (!(target instanceof Node) || rootRef.value?.contains(target)) return
  open.value = false
}

onMounted(() => document.addEventListener('click', closeOnOutsideClick))
onBeforeUnmount(() => document.removeEventListener('click', closeOnOutsideClick))
</script>

<template>
  <div ref="rootRef" class="relative min-w-0">
    <button
      type="button"
      class="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border border-slate-300 px-4 py-2.5 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :disabled="disabled"
      @click="open = !open"
    >
      <span class="flex min-w-0 items-center gap-3">
        <span class="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
          <img v-if="masterImageUrl(selectedMaster)" :src="masterImageUrl(selectedMaster)" :alt="masterDisplayName(selectedMaster)" class="h-full w-full object-cover">
          <span v-else-if="selectedMaster">{{ masterInitials(selectedMaster) }}</span>
          <UserCircleIcon v-else class="h-4 w-4" aria-hidden="true" />
        </span>
        <span class="min-w-0">
          <span class="block truncate font-medium text-slate-900">{{ masterDisplayName(selectedMaster) }}</span>
          <span v-if="selectedMaster?.position_uk" class="block truncate text-xs text-slate-500">{{ selectedMaster.position_uk }}</span>
        </span>
      </span>
      <ChevronDownIcon class="h-4 w-4 shrink-0 text-slate-400 transition" :class="{ 'rotate-180': open }" aria-hidden="true" />
    </button>

    <div
      v-if="open"
      class="booking-select-menu absolute mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl md:rounded-2xl"
      :class="menuClass"
      role="listbox"
    >
      <button
        v-if="allLabel"
        type="button"
        class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm"
        :class="!modelValue ? 'bg-slate-50' : ''"
        @click="emitMasterValue(null)"
      >
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          <UserCircleIcon class="h-4 w-4" aria-hidden="true" />
        </span>
        <span class="min-w-0 truncate font-medium">{{ allLabel }}</span>
      </button>
      <button
        v-for="master in masters"
        :key="master.id"
        type="button"
        class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm"
        :class="String(modelValue ?? '') === String(master.id) ? 'bg-slate-50' : ''"
        @click="emitMasterValue(master)"
      >
        <span class="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
          <img v-if="masterImageUrl(master)" :src="masterImageUrl(master)" :alt="masterDisplayName(master)" class="h-full w-full object-cover">
          <span v-else>{{ masterInitials(master) }}</span>
        </span>
        <span class="min-w-0">
          <span class="block truncate font-medium">{{ masterDisplayName(master) }}</span>
          <span v-if="master.position_uk" class="block truncate text-xs text-slate-500">{{ master.position_uk }}</span>
        </span>
      </button>
    </div>
  </div>
</template>
