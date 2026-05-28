<script setup lang="ts">
import { ArrowPathIcon, NoSymbolIcon, PlusIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import type { CalendarActionPayload, CalendarActionType, CalendarSelection } from '~/composables/useBookingCalendar'
import type { Service } from '~/composables/useBackofficeApi'

const props = defineProps<{
  modelValue: boolean
  selection: CalendarSelection | null
  services: Service[]
  masterName: string
  pending?: boolean
  error?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: CalendarActionPayload]
}>()

const {
  toKyivIso,
} = useBookingFormatting()
const calendar = useBookingCalendar()

const form = reactive({
  action: 'booking' as CalendarActionType,
  service_ids: [] as string[],
  date: '',
  start_time: '',
  end_time: '',
  customer_name: '',
  customer_phone: '',
  note: '',
})
const localError = ref('')

const resetForm = () => {
  form.action = 'booking'
  form.service_ids = []
  form.date = props.selection?.date || ''
  form.start_time = props.selection?.startTime || ''
  form.end_time = props.selection?.endTime || ''
  form.customer_name = ''
  form.customer_phone = ''
  form.note = ''
  localError.value = ''
}

const close = () => {
  emit('update:modelValue', false)
}

const validate = () => {
  if (!form.date || !form.start_time || !form.end_time) return 'Виберіть початок і завершення інтервалу.'
  if (calendar.isMonday(form.date)) return 'Понеділок — вихідний день.'
  if (form.start_time >= form.end_time) return 'Час початку має бути раніше часу завершення.'
  if (form.start_time < calendar.workdayStart || form.end_time > calendar.workdayEnd) {
    return `Інтервал має бути в межах ${calendar.workdayStart}-${calendar.workdayEnd}.`
  }
  if (form.action === 'booking') {
    if (!form.service_ids.length) return 'Виберіть хоча б одну послугу для ручного бронювання.'
    if (!form.customer_name.trim()) return 'Ім’я клієнта обов’язкове.'
    if (!form.customer_phone.trim()) return 'Телефон клієнта обов’язковий.'
  }
  return ''
}

const submit = () => {
  localError.value = validate()
  if (localError.value) return
  const serviceIds = form.action === 'booking' ? form.service_ids.map(Number).filter(Number.isFinite) : []

  emit('submit', {
    action: form.action,
    service_id: serviceIds[0] || null,
    service_ids: serviceIds,
    customer_name: form.customer_name.trim(),
    customer_phone: form.customer_phone.trim(),
    customer_email: '',
    note: form.note.trim(),
    start_at: toKyivIso(form.date, form.start_time),
    end_at: toKyivIso(form.date, form.end_time),
  })
}

watch(
  () => props.modelValue,
  open => {
    if (open) resetForm()
  },
)

watch(
  () => props.selection,
  () => {
    if (props.modelValue) resetForm()
  },
)
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    max-width-class="max-w-3xl"
    @update:model-value="emit('update:modelValue', $event)"
    @close="localError = ''"
  >
    <template #head="{ close: closeModal }">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-cyan-700 xl:text-sm xl:tracking-[0.25em]">Календар</p>
          <h2 class="mt-1 truncate text-xl font-semibold text-slate-900 xl:mt-2 xl:text-2xl">Новий інтервал</h2>
        </div>
        <button type="button" class="shrink-0 rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-700 xl:px-4 xl:py-2 xl:text-sm" @click="closeModal">
          Закрити
        </button>
      </div>
    </template>

    <template #body>
      <form class="space-y-3 xl:space-y-5" @submit.prevent="submit">
        <div class="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 xl:gap-2 xl:rounded-2xl">
          <button
            type="button"
            class="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-xs font-medium leading-tight transition xl:min-h-11 xl:gap-2 xl:rounded-xl xl:px-3 xl:py-2 xl:text-sm"
            :class="form.action === 'booking' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-950'"
            @click="form.action = 'booking'"
          >
            <PlusIcon class="h-4 w-4" aria-hidden="true" />
            Ручне бронювання
          </button>
          <button
            type="button"
            class="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-xs font-medium leading-tight transition xl:min-h-11 xl:gap-2 xl:rounded-xl xl:px-3 xl:py-2 xl:text-sm"
            :class="form.action === 'block' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-950'"
            @click="form.action = 'block'"
          >
            <NoSymbolIcon class="h-4 w-4" aria-hidden="true" />
            Блокування часу
          </button>
        </div>

        <div class="grid grid-cols-2 gap-2 md:grid-cols-3 xl:gap-4">
          <label class="col-span-2 space-y-1 text-xs text-slate-700 md:col-span-1 xl:space-y-2 xl:text-sm">
            <span class="font-medium">Дата</span>
            <input v-model="form.date" required type="date" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3">
          </label>
          <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="font-medium">Початок</span>
            <input v-model="form.start_time" required type="time" :min="calendar.workdayStart" :max="calendar.workdayEnd" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3">
          </label>
          <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="font-medium">Завершення</span>
            <input v-model="form.end_time" required type="time" :min="calendar.workdayStart" :max="calendar.workdayEnd" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3">
          </label>
        </div>

        <div v-if="form.action === 'booking'" class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
          <span class="font-medium">Послуги</span>
          <ServiceMultiSelect v-model="form.service_ids" :services="services" />
        </div>

        <div v-if="form.action === 'booking'" class="grid gap-2 md:grid-cols-2 xl:gap-4">
          <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="font-medium">Ім’я клієнта</span>
            <input v-model="form.customer_name" required class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3">
          </label>
          <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="font-medium">Телефон клієнта</span>
            <input v-model="form.customer_phone" required inputmode="tel" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3">
          </label>
        </div>

        <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
          <span class="font-medium">{{ form.action === 'booking' ? 'Коментар' : 'Причина' }}</span>
          <textarea v-model="form.note" rows="2" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3" />
        </label>

        <p v-if="localError || error" class="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600 xl:rounded-2xl xl:px-4 xl:py-3 xl:text-sm">
          {{ localError || error }}
        </p>

        <div class="grid gap-2 border-t border-slate-200 pt-3 sm:grid-cols-3 xl:gap-3 xl:pt-5">
          <button
            type="submit"
            :disabled="pending"
            class="inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium disabled:opacity-60 xl:gap-2 xl:px-5 xl:py-3 xl:text-sm"
            :class="form.action === 'booking' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100' : 'bg-slate-100 text-slate-800 ring-1 ring-slate-400 hover:bg-slate-200'"
          >
            <component :is="form.action === 'booking' ? PlusIcon : NoSymbolIcon" v-if="!pending" class="h-4 w-4" aria-hidden="true" />
            {{ pending ? 'Збереження...' : form.action === 'booking' ? 'Створити бронювання' : 'Заблокувати час' }}
          </button>
          <button type="button" class="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 xl:gap-2 xl:px-5 xl:py-3 xl:text-sm" @click="resetForm">
            <ArrowPathIcon class="h-4 w-4" aria-hidden="true" />
            Скинути
          </button>
          <button type="button" class="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-rose-300 px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-50 xl:gap-2 xl:px-5 xl:py-3 xl:text-sm" @click="close">
            <XMarkIcon class="h-4 w-4" aria-hidden="true" />
            Скасувати
          </button>
        </div>
      </form>
    </template>
  </BaseModal>
</template>
