<script setup lang="ts">
import { ArrowPathIcon, LockOpenIcon } from '@heroicons/vue/24/outline'
import type { Master } from '~/composables/useBackofficeApi'

const props = withDefaults(defineProps<{
  modelValue: boolean
  admin?: boolean
  masters?: Master[]
  disabled?: boolean
}>(), {
  admin: false,
  masters: () => [],
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [message: string]
}>()

const api = useBackofficeApi()
const toast = useBaseToastNotification()
const calendar = useBookingCalendar()
const {
  todayInput,
  toKyivIso,
  masterName,
  apiErrorMessage,
} = useBookingFormatting()

const form = reactive({
  master_id: '',
  date: todayInput(),
  window_type: 'full_day',
  start_time: calendar.workdayStart,
  end_time: calendar.workdayEnd,
})
const formError = ref('')
const saving = ref(false)

const addCalendarMonthsInput = (dateInput: string, months: number) => {
  const [year, month, day] = dateInput.split('-').map(Number)
  const monthIndex = month - 1 + months
  const nextYear = year + Math.floor(monthIndex / 12)
  const nextMonthIndex = ((monthIndex % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(nextYear, nextMonthIndex + 1, 0, 12)).getUTCDate()
  return `${nextYear}-${String(nextMonthIndex + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

const horizonEnd = computed(() => addCalendarMonthsInput(todayInput(), 2))

const fillForm = () => {
  form.master_id = ''
  form.date = todayInput()
  form.window_type = 'full_day'
  form.start_time = calendar.workdayStart
  form.end_time = calendar.workdayEnd
  formError.value = ''
}

const close = () => {
  emit('update:modelValue', false)
}

watch(
  () => form.window_type,
  value => {
    if (value === 'full_day') {
      form.start_time = calendar.workdayStart
      form.end_time = calendar.workdayEnd
    }
  },
)

const validate = () => {
  if (props.admin && !form.master_id) return 'Майстер обов’язковий.'
  if (!form.date) return 'Дата обов’язкова.'
  if (calendar.isMonday(form.date)) return 'Понеділок — вихідний день.'
  if (form.date < todayInput()) return 'Минулі дні не можна відкривати для запису.'
  if (form.date > horizonEnd.value) return 'Доступність можна відкривати лише на найближчі 2 місяці.'
  if (!form.window_type) return 'Тип доступності обов’язковий.'
  if (!form.start_time || !form.end_time) return 'Час початку й завершення обов’язкові.'
  if (form.start_time >= form.end_time) return 'Час початку має бути раніше часу завершення.'
  if (form.start_time < calendar.workdayStart || form.end_time > calendar.workdayEnd) {
    return `Інтервал має бути в межах ${calendar.workdayStart}-${calendar.workdayEnd}.`
  }
  if (new Date(toKyivIso(form.date, form.end_time)).getTime() <= Date.now()) return 'Минулий час не можна відкривати для запису.'
  return ''
}

const submit = async () => {
  formError.value = validate()
  if (formError.value) {
    toast.warning(formError.value)
    return
  }

  saving.value = true
  const payload = {
    start_at: toKyivIso(form.date, form.window_type === 'full_day' ? calendar.workdayStart : form.start_time),
    end_at: toKyivIso(form.date, form.window_type === 'full_day' ? calendar.workdayEnd : form.end_time),
  }

  try {
    if (props.admin) {
      await api.adminCreateAvailabilityWindow({
        master_id: Number(form.master_id),
        ...payload,
      })
    }
    else {
      await api.createMyAvailabilityWindow(payload)
    }
    emit('saved', 'Доступність відкрито для запису.')
    close()
  }
  catch (cause) {
    formError.value = apiErrorMessage(cause, 'Не вдалося відкрити доступність.')
    toast.error(formError.value)
  }
  finally {
    saving.value = false
  }
}

watch(
  () => props.modelValue,
  open => {
    if (open) fillForm()
  },
  { immediate: true },
)
</script>

<template>
  <BaseModal :model-value="modelValue" max-width-class="max-w-2xl" @update:model-value="emit('update:modelValue', $event)" @close="formError = ''">
    <template #head="{ close: closeModal }">
      <div class="flex flex-wrap items-start justify-between gap-3 xl:gap-4">
        <div>
          <p class="text-xs uppercase tracking-[0.2em] text-cyan-700 xl:text-sm xl:tracking-[0.25em]">{{ admin ? 'Адмін' : 'Доступність' }}</p>
          <h2 class="mt-1 text-xl font-semibold text-slate-900 xl:mt-2 xl:text-2xl">Відкрити для запису</h2>
        </div>
        <ModalCloseButton @click="closeModal" />
      </div>
    </template>

    <template #body>
      <form class="space-y-3 xl:space-y-5" @submit.prevent="submit">
        <label v-if="admin" class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
          <span class="font-medium">Майстер</span>
          <select v-model="form.master_id" required class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3">
            <option value="">Виберіть майстра</option>
            <option v-for="master in masters" :key="master.id" :value="String(master.id)">{{ masterName(master) }}</option>
          </select>
        </label>

        <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
          <span class="font-medium">Дата</span>
          <input v-model="form.date" required type="date" :min="todayInput()" :max="horizonEnd" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3">
        </label>

        <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
          <span class="font-medium">Тип доступності</span>
          <select v-model="form.window_type" required class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3">
            <option value="full_day">Повний день 09:00-20:00</option>
            <option value="custom">Власний інтервал</option>
          </select>
        </label>

        <div class="grid gap-2 md:grid-cols-2 xl:gap-4">
          <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="font-medium">Час початку</span>
            <input v-model="form.start_time" :disabled="form.window_type === 'full_day'" type="time" :min="calendar.workdayStart" :max="calendar.workdayEnd" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 xl:rounded-2xl xl:px-4 xl:py-3">
          </label>
          <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="font-medium">Час завершення</span>
            <input v-model="form.end_time" :disabled="form.window_type === 'full_day'" type="time" :min="calendar.workdayStart" :max="calendar.workdayEnd" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 xl:rounded-2xl xl:px-4 xl:py-3">
          </label>
        </div>

        <p v-if="formError" class="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600 xl:rounded-2xl xl:px-4 xl:py-3 xl:text-sm">{{ formError }}</p>

        <div class="backoffice-modal-actions">
          <button type="submit" :disabled="saving || disabled" class="backoffice-modal-action-button backoffice-modal-action-success">
            <LockOpenIcon v-if="!saving" class="h-4 w-4" aria-hidden="true" />
            {{ saving ? 'Відкриття...' : 'Відкрити для запису' }}
          </button>
          <button type="button" class="backoffice-modal-action-button backoffice-modal-action-secondary" @click="fillForm">
            <ArrowPathIcon class="h-4 w-4" aria-hidden="true" />
            Скинути
          </button>
        </div>
      </form>
    </template>
  </BaseModal>
</template>
