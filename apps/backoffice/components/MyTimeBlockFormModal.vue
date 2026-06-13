<script setup lang="ts">
import { ArrowPathIcon, PlusIcon } from '@heroicons/vue/24/outline'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [message: string]
}>()

const api = useBackofficeApi()
const toast = useBaseToastNotification()
const {
  todayInput,
  toKyivIso,
  apiErrorMessage,
} = useBookingFormatting()

const form = reactive({
  date: todayInput(),
  block_type: 'full_day',
  start_time: '09:00',
  end_time: '20:00',
  reason: '',
})
const formError = ref('')
const saving = ref(false)

const fillForm = () => {
  form.date = todayInput()
  form.block_type = 'full_day'
  form.start_time = '09:00'
  form.end_time = '20:00'
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
      form.start_time = '09:00'
      form.end_time = '20:00'
    }
  },
)

const validate = () => {
  if (!form.date) return 'Дата обов’язкова.'
  if (!form.block_type) return 'Тип блокування обов’язковий.'
  if (form.block_type === 'custom') {
    if (!form.start_time || !form.end_time) return 'Час початку й завершення обов’язкові.'
    if (form.start_time >= form.end_time) return 'Час початку має бути раніше часу завершення.'
    if (form.start_time < '09:00' || form.end_time > '20:00') return 'Власний інтервал має бути в межах 09:00-20:00.'
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
      start_at: toKyivIso(form.date, form.block_type === 'full_day' ? '09:00' : form.start_time),
      end_at: toKyivIso(form.date, form.block_type === 'full_day' ? '20:00' : form.end_time),
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
          <span class="font-medium">Дата</span>
          <input v-model="form.date" required type="date" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3">
        </label>
        <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
          <span class="font-medium">Тип блокування</span>
          <select v-model="form.block_type" required class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3">
            <option value="full_day">Повний день</option>
            <option value="custom">Власний інтервал</option>
          </select>
        </label>
        <div class="grid gap-2 md:grid-cols-2 xl:gap-4">
          <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="font-medium">Час початку</span>
            <input v-model="form.start_time" :disabled="form.block_type === 'full_day'" type="time" min="09:00" max="20:00" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 xl:rounded-2xl xl:px-4 xl:py-3">
          </label>
          <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="font-medium">Час завершення</span>
            <input v-model="form.end_time" :disabled="form.block_type === 'full_day'" type="time" min="09:00" max="20:00" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 xl:rounded-2xl xl:px-4 xl:py-3">
          </label>
        </div>
        <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
          <span class="font-medium">Причина</span>
          <textarea v-model="form.reason" rows="3" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm xl:rounded-2xl xl:px-4 xl:py-3" />
        </label>
        <div class="backoffice-modal-actions">
          <button type="submit" :disabled="saving" class="backoffice-modal-action-button backoffice-modal-action-primary">
            <PlusIcon v-if="!saving" class="h-4 w-4" aria-hidden="true" />
            {{ saving ? 'Створення...' : 'Створити блокування' }}
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
