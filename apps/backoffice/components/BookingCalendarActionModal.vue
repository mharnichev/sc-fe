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
  serviceName,
  formatDuration,
  formatPrice,
} = useBookingFormatting()
const calendar = useBookingCalendar()

const form = reactive({
  action: 'booking' as CalendarActionType,
  service_id: '',
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
  form.service_id = ''
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
    if (!form.service_id) return 'Виберіть послугу для ручного бронювання.'
    if (!form.customer_name.trim()) return 'Ім’я клієнта обов’язкове.'
    if (!form.customer_phone.trim()) return 'Телефон клієнта обов’язковий.'
  }
  return ''
}

const submit = () => {
  localError.value = validate()
  if (localError.value) return

  emit('submit', {
    action: form.action,
    service_id: form.action === 'booking' ? Number(form.service_id) : null,
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
          <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-cyan-700 sm:text-sm sm:tracking-[0.25em]">Календар</p>
          <h2 class="mt-1 truncate text-xl font-semibold text-slate-900 sm:mt-2 sm:text-2xl">Новий інтервал</h2>
        </div>
        <button type="button" class="shrink-0 rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 sm:px-4 sm:py-2" @click="closeModal">
          Закрити
        </button>
      </div>
    </template>

    <template #body>
      <form class="space-y-3 sm:space-y-5" @submit.prevent="submit">
        <div class="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:gap-2 sm:rounded-2xl">
          <button
            type="button"
            class="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition sm:min-h-11 sm:gap-2 sm:rounded-xl sm:px-3"
            :class="form.action === 'booking' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-950'"
            @click="form.action = 'booking'"
          >
            <PlusIcon class="h-4 w-4" aria-hidden="true" />
            Ручне бронювання
          </button>
          <button
            type="button"
            class="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition sm:min-h-11 sm:gap-2 sm:rounded-xl sm:px-3"
            :class="form.action === 'block' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-950'"
            @click="form.action = 'block'"
          >
            <NoSymbolIcon class="h-4 w-4" aria-hidden="true" />
            Блокування часу
          </button>
        </div>

        <div class="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4">
          <label class="col-span-2 space-y-1 text-sm text-slate-700 sm:space-y-2 md:col-span-1">
            <span class="font-medium">Дата</span>
            <input v-model="form.date" required type="date" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm sm:rounded-2xl sm:px-4 sm:py-3">
          </label>
          <label class="space-y-1 text-sm text-slate-700 sm:space-y-2">
            <span class="font-medium">Початок</span>
            <input v-model="form.start_time" required type="time" :min="calendar.workdayStart" :max="calendar.workdayEnd" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm sm:rounded-2xl sm:px-4 sm:py-3">
          </label>
          <label class="space-y-1 text-sm text-slate-700 sm:space-y-2">
            <span class="font-medium">Завершення</span>
            <input v-model="form.end_time" required type="time" :min="calendar.workdayStart" :max="calendar.workdayEnd" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm sm:rounded-2xl sm:px-4 sm:py-3">
          </label>
        </div>

        <label v-if="form.action === 'booking'" class="space-y-1 text-sm text-slate-700 sm:space-y-2">
          <span class="font-medium">Послуга</span>
          <select v-model="form.service_id" required class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm sm:rounded-2xl sm:px-4 sm:py-3">
            <option value="">Виберіть послугу</option>
            <option v-for="service in services" :key="service.id" :value="String(service.id)">
              {{ serviceName(service) }} · {{ formatDuration(service.duration_minutes) }} · {{ formatPrice(service.price) }}
            </option>
          </select>
        </label>

        <div v-if="form.action === 'booking'" class="grid gap-2 md:grid-cols-2 md:gap-4">
          <label class="space-y-1 text-sm text-slate-700 sm:space-y-2">
            <span class="font-medium">Ім’я клієнта</span>
            <input v-model="form.customer_name" required class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm sm:rounded-2xl sm:px-4 sm:py-3">
          </label>
          <label class="space-y-1 text-sm text-slate-700 sm:space-y-2">
            <span class="font-medium">Телефон клієнта</span>
            <input v-model="form.customer_phone" required inputmode="tel" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm sm:rounded-2xl sm:px-4 sm:py-3">
          </label>
        </div>

        <label class="space-y-1 text-sm text-slate-700 sm:space-y-2">
          <span class="font-medium">{{ form.action === 'booking' ? 'Коментар' : 'Причина' }}</span>
          <textarea v-model="form.note" rows="3" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm sm:rounded-2xl sm:px-4 sm:py-3" />
        </label>

        <p v-if="localError || error" class="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600 sm:rounded-2xl sm:px-4 sm:py-3">
          {{ localError || error }}
        </p>

        <div class="grid gap-2 border-t border-slate-200 pt-3 sm:gap-3 sm:pt-5">
          <button
            type="submit"
            :disabled="pending"
            class="inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-60 sm:py-3"
            :class="form.action === 'booking' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100' : 'bg-slate-100 text-slate-800 ring-1 ring-slate-400 hover:bg-slate-200'"
          >
            <component :is="form.action === 'booking' ? PlusIcon : NoSymbolIcon" v-if="!pending" class="h-4 w-4" aria-hidden="true" />
            {{ pending ? 'Збереження...' : form.action === 'booking' ? 'Створити бронювання' : 'Заблокувати час' }}
          </button>
          <button type="button" class="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 sm:py-3" @click="resetForm">
            <ArrowPathIcon class="h-4 w-4" aria-hidden="true" />
            Скинути
          </button>
          <button type="button" class="inline-flex w-full items-center justify-center gap-2 rounded-full border border-rose-300 px-5 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-50 sm:py-3" @click="close">
            <XMarkIcon class="h-4 w-4" aria-hidden="true" />
            Скасувати
          </button>
        </div>
      </form>
    </template>
  </BaseModal>
</template>
