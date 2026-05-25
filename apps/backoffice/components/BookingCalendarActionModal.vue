<script setup lang="ts">
import { NoSymbolIcon, PlusIcon } from '@heroicons/vue/24/outline'
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
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-[0.25em] text-cyan-700">Календар</p>
          <h2 class="mt-2 text-2xl font-semibold text-slate-900">Новий інтервал</h2>
          <p class="mt-1 text-sm text-slate-500">{{ masterName }}</p>
        </div>
        <button type="button" class="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700" @click="closeModal">
          Закрити
        </button>
      </div>
    </template>

    <template #body>
      <form class="space-y-5" @submit.prevent="submit">
        <div class="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition"
            :class="form.action === 'booking' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-950'"
            @click="form.action = 'booking'"
          >
            <PlusIcon class="h-4 w-4" aria-hidden="true" />
            Ручне бронювання
          </button>
          <button
            type="button"
            class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition"
            :class="form.action === 'block' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-950'"
            @click="form.action = 'block'"
          >
            <NoSymbolIcon class="h-4 w-4" aria-hidden="true" />
            Блокування часу
          </button>
        </div>

        <div class="grid gap-4 md:grid-cols-3">
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">Дата</span>
            <input v-model="form.date" required type="date" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">Початок</span>
            <input v-model="form.start_time" required type="time" :min="calendar.workdayStart" :max="calendar.workdayEnd" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">Завершення</span>
            <input v-model="form.end_time" required type="time" :min="calendar.workdayStart" :max="calendar.workdayEnd" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
          </label>
        </div>

        <label v-if="form.action === 'booking'" class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">Послуга</span>
          <select v-model="form.service_id" required class="w-full rounded-2xl border border-slate-300 px-4 py-3">
            <option value="">Виберіть послугу</option>
            <option v-for="service in services" :key="service.id" :value="String(service.id)">
              {{ serviceName(service) }} · {{ formatDuration(service.duration_minutes) }} · {{ formatPrice(service.price) }}
            </option>
          </select>
        </label>

        <div v-if="form.action === 'booking'" class="grid gap-4 md:grid-cols-2">
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">Ім’я клієнта</span>
            <input v-model="form.customer_name" required class="w-full rounded-2xl border border-slate-300 px-4 py-3">
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">Телефон клієнта</span>
            <input v-model="form.customer_phone" required inputmode="tel" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
          </label>
        </div>

        <label class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">{{ form.action === 'booking' ? 'Коментар' : 'Причина' }}</span>
          <textarea v-model="form.note" rows="4" class="w-full rounded-2xl border border-slate-300 px-4 py-3" />
        </label>

        <p v-if="localError || error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {{ localError || error }}
        </p>

        <div class="flex flex-wrap gap-3 border-t border-slate-200 pt-5">
          <button
            type="submit"
            :disabled="pending"
            class="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            <component :is="form.action === 'booking' ? PlusIcon : NoSymbolIcon" v-if="!pending" class="h-4 w-4" aria-hidden="true" />
            {{ pending ? 'Збереження...' : form.action === 'booking' ? 'Створити бронювання' : 'Заблокувати час' }}
          </button>
          <button type="button" class="rounded-full border border-slate-300 px-5 py-3 text-sm" @click="resetForm">
            Скинути
          </button>
          <button type="button" class="rounded-full border border-slate-300 px-5 py-3 text-sm" @click="close">
            Скасувати
          </button>
        </div>
      </form>
    </template>
  </BaseModal>
</template>
