<script setup lang="ts">
import { ChevronDownIcon } from '@heroicons/vue/24/outline'

type SelectValue = string | number | null

const props = withDefaults(defineProps<{
  modelValue?: SelectValue
  options: Array<{ value: SelectValue, label: string }>
  disabled?: boolean
  placeholder?: string
  menuClass?: string
}>(), {
  modelValue: '',
  placeholder: 'Оберіть значення',
  menuClass: 'z-[220]',
})

const emit = defineEmits<{
  'update:modelValue': [value: SelectValue]
}>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const selectedOption = computed(() =>
  props.options.find(option => String(option.value ?? '') === String(props.modelValue ?? '')) || null,
)

const selectedLabel = computed(() => selectedOption.value?.label || props.placeholder)

const selectOption = (value: SelectValue) => {
  emit('update:modelValue', value)
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
      <span class="min-w-0 truncate font-medium" :class="selectedOption ? 'text-slate-900' : 'text-slate-500'">
        {{ selectedLabel }}
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
        v-for="option in options"
        :key="String(option.value ?? '')"
        type="button"
        class="flex w-full min-w-0 items-center rounded-xl px-3 py-2 text-left text-sm transition hover:bg-slate-50"
        :class="String(modelValue ?? '') === String(option.value ?? '') ? 'bg-slate-50 text-slate-900' : 'text-slate-700'"
        role="option"
        :aria-selected="String(modelValue ?? '') === String(option.value ?? '')"
        @click="selectOption(option.value)"
      >
        <span class="min-w-0 truncate font-medium">{{ option.label }}</span>
      </button>
    </div>
  </div>
</template>
