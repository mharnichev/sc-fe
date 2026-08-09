<script setup lang="ts">
import { ArrowPathIcon, CalendarDaysIcon, ClockIcon, DocumentTextIcon, NoSymbolIcon, PlusIcon } from '@heroicons/vue/24/outline'

const props = defineProps<{
  modelValue: boolean
}>()

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
  apiErrorMessage,
} = useBookingFormatting()

const form = reactive({
  date: todayInput(),
  block_type: 'full_day',
  start_time: calendar.workdayStart,
  end_time: calendar.workdayEnd,
  reason: '',
})
const formError = ref('')
const saving = ref(false)

const fillForm = () => {
  form.date = todayInput()
  form.block_type = 'full_day'
  form.start_time = calendar.workdayStart
  form.end_time = calendar.workdayEnd
  form.reason = ''
  formError.value = ''
}

const close = () => {
  emit('update:modelValue', false)
}

watch(
  () => form.block_type,
  value => {
    if (value === 'full_day') {
      form.start_time = calendar.workdayStart
      form.end_time = calendar.workdayEnd
    }
  },
)

const validate = () => {
  if (!form.date) return 'Дата обов’язкова.'
  if (!form.block_type) return 'Тип блокування обов’язковий.'
  if (form.block_type === 'custom') {
    if (!form.start_time || !form.end_time) return 'Час початку й завершення обов’язкові.'
    if (form.start_time >= form.end_time) return 'Час початку має бути раніше часу завершення.'
    if (form.start_time < calendar.workdayStart || form.end_time > calendar.workdayEnd) {
      return `Власний інтервал має бути в межах ${calendar.workdayStart}-${calendar.workdayEnd}.`
    }
  }
  return ''
}

const submit = async () => {
  formError.value = validate()
  if (formError.value) {
    toast.warning(formError.value)
    return
  }
  saving.value = true

  try {
    await api.createMyTimeBlock({
      start_at: toKyivIso(form.date, form.block_type === 'full_day' ? calendar.workdayStart : form.start_time),
      end_at: toKyivIso(form.date, form.block_type === 'full_day' ? calendar.workdayEnd : form.end_time),
      reason: form.reason.trim() || null,
    })
    emit('saved', 'Блокування часу створено.')
    close()
  }
  catch (cause) {
    formError.value = apiErrorMessage(cause, 'Не вдалося створити блокування часу.')
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
          <p class="text-xs uppercase tracking-[0.2em] text-cyan-700 xl:text-sm xl:tracking-[0.25em]">Доступність</p>
          <h2 class="mt-1 text-xl font-semibold text-slate-900 xl:mt-2 xl:text-2xl">Створити блокування</h2>
        </div>
        <ModalCloseButton @click="closeModal" />
      </div>
    </template>

    <template #body>
      <form class="space-y-3 xl:space-y-5" @submit.prevent="submit">
        <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
          <span class="inline-flex items-center gap-1.5 font-medium">
            <CalendarDaysIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
            Дата
          </span>
          <span class="relative block">
            <CalendarDaysIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-current opacity-55 xl:left-4" aria-hidden="true" />
            <BaseCalendar v-model="form.date" required class="w-full rounded-xl border border-slate-300 py-2 pl-10 pr-3 text-sm xl:rounded-2xl xl:py-3 xl:pl-11 xl:pr-4" />
          </span>
        </label>
        <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
          <span class="inline-flex items-center gap-1.5 font-medium">
            <NoSymbolIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
            Тип блокування
          </span>
          <div class="grid gap-2 sm:grid-cols-2">
            <label
              class="flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition xl:rounded-2xl xl:px-4 xl:py-3"
              :class="form.block_type === 'full_day' ? 'border-cyan-400 bg-cyan-500/15 text-cyan-700' : 'border-slate-300 text-slate-700 hover:border-cyan-300'"
            >
              <BaseRadioButton v-model="form.block_type" required value="full_day" class="sr-only" />
              <CalendarDaysIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Повний день</span>
            </label>
            <label
              class="flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition xl:rounded-2xl xl:px-4 xl:py-3"
              :class="form.block_type === 'custom' ? 'border-cyan-400 bg-cyan-500/15 text-cyan-700' : 'border-slate-300 text-slate-700 hover:border-cyan-300'"
            >
              <BaseRadioButton v-model="form.block_type" required value="custom" class="sr-only" />
              <ClockIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Власний інтервал</span>
            </label>
          </div>
        </label>
        <div class="grid gap-2 md:grid-cols-2 xl:gap-4">
          <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="inline-flex items-center gap-1.5 font-medium">
              <ClockIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
              Час початку
            </span>
            <span class="relative block">
              <ClockIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-current opacity-55 xl:left-4" aria-hidden="true" />
              <BaseInput v-model="form.start_time" :disabled="form.block_type === 'full_day'" type="time" :min="calendar.workdayStart" :max="calendar.workdayEnd" class="w-full rounded-xl border border-slate-300 py-2 pl-10 pr-3 text-sm disabled:bg-slate-100 xl:rounded-2xl xl:py-3 xl:pl-11 xl:pr-4" />
            </span>
          </label>
          <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="inline-flex items-center gap-1.5 font-medium">
              <ClockIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
              Час завершення
            </span>
            <span class="relative block">
              <ClockIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-current opacity-55 xl:left-4" aria-hidden="true" />
              <BaseInput v-model="form.end_time" :disabled="form.block_type === 'full_day'" type="time" :min="calendar.workdayStart" :max="calendar.workdayEnd" class="w-full rounded-xl border border-slate-300 py-2 pl-10 pr-3 text-sm disabled:bg-slate-100 xl:rounded-2xl xl:py-3 xl:pl-11 xl:pr-4" />
            </span>
          </label>
        </div>
        <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
          <span class="inline-flex items-center gap-1.5 font-medium">
            <DocumentTextIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
            Причина
          </span>
          <span class="relative block">
            <DocumentTextIcon class="pointer-events-none absolute left-3 top-3 h-4 w-4 text-current opacity-55 xl:left-4 xl:top-4" aria-hidden="true" />
            <BaseTextarea v-model="form.reason" rows="3" class="w-full rounded-xl border border-slate-300 py-2 pl-10 pr-3 text-sm xl:rounded-2xl xl:py-3 xl:pl-11 xl:pr-4" />
          </span>
        </label>
        <div class="backoffice-modal-actions">
          <BaseButton type="submit" :disabled="saving" class="backoffice-modal-action-button backoffice-modal-action-primary">
            <PlusIcon v-if="!saving" class="h-4 w-4" aria-hidden="true" />
            {{ saving ? 'Створення...' : 'Створити блокування' }}
          </BaseButton>
          <BaseButton type="button" class="backoffice-modal-action-button backoffice-modal-action-secondary" @click="fillForm">
            <ArrowPathIcon class="h-4 w-4" aria-hidden="true" />
            Скинути
          </BaseButton>
        </div>
      </form>
    </template>
  </BaseModal>
</template>
