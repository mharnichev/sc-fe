<script setup lang="ts">
import { ArrowPathIcon, CalendarDaysIcon, ClockIcon, DocumentTextIcon, NoSymbolIcon, PlusIcon, UserCircleIcon } from '@heroicons/vue/24/outline'
import type { Master } from '~/composables/useBackofficeApi'

const props = defineProps<{
  modelValue: boolean
  masters: Master[]
  disabled?: boolean
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
  master_id: '',
  date: todayInput(),
  block_type: 'full_day',
  start_time: '09:00',
  end_time: '20:00',
  reason: '',
})
const formError = ref('')
const saving = ref(false)
const blockTypeOptions = [
  { value: 'full_day', label: 'Повний день' },
  { value: 'custom', label: 'Власний інтервал' },
]

const fillForm = () => {
  form.master_id = ''
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
  if (!form.master_id) return 'Майстер обов’язковий.'
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
    await api.adminCreateTimeBlock({
      master_id: Number(form.master_id),
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
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-[0.25em] text-cyan-700">Адмін</p>
          <h2 class="mt-2 text-2xl font-semibold text-slate-900">Створити блокування майстра</h2>
        </div>
        <ModalCloseButton @click="closeModal" />
      </div>
    </template>

    <template #body>
      <form class="space-y-5" @submit.prevent="submit">
        <MasterSelect
          v-model="form.master_id"
          :masters="masters"
          label="Майстер"
          placeholder="Виберіть майстра"
          required
          compact
          menu-class="z-[250]"
        >
          <template #icon>
            <UserCircleIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
          </template>
        </MasterSelect>

        <BaseCalendar
          v-model="form.date"
          label="Дата"
          required
          class="w-full rounded-2xl border border-slate-300 px-4 py-3"
          menu-class="z-[250]"
        >
          <template #icon>
            <CalendarDaysIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
          </template>
        </BaseCalendar>

        <BaseSelect
          v-model="form.block_type"
          :options="blockTypeOptions"
          label="Тип блокування"
          required
          menu-class="z-[250]"
        >
          <template #icon>
            <NoSymbolIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
          </template>
          <template #selected="{ option, label }">
            <span class="flex min-w-0 items-center gap-2">
              <CalendarDaysIcon v-if="option?.value === 'full_day'" class="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <ClockIcon v-else class="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <span class="min-w-0 truncate">{{ label }}</span>
            </span>
          </template>
          <template #option="{ option }">
            <span class="flex min-w-0 items-center gap-2">
              <CalendarDaysIcon v-if="option.value === 'full_day'" class="h-4 w-4 shrink-0" aria-hidden="true" />
              <ClockIcon v-else class="h-4 w-4 shrink-0" aria-hidden="true" />
              <span class="min-w-0 truncate font-medium">{{ option.label }}</span>
            </span>
          </template>
        </BaseSelect>

        <div class="grid gap-4 md:grid-cols-2">
          <BaseField label="Час початку" :disabled="form.block_type === 'full_day'">
            <template #icon>
              <ClockIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
            </template>
            <span class="relative block">
              <ClockIcon class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-current opacity-55" aria-hidden="true" />
              <BaseInput
                v-model="form.start_time"
                :disabled="form.block_type === 'full_day'"
                type="time"
                min="09:00"
                max="20:00"
                input-class="w-full rounded-2xl border border-slate-300 py-3 pl-11 pr-4 text-sm disabled:bg-slate-100"
              />
            </span>
          </BaseField>
          <BaseField label="Час завершення" :disabled="form.block_type === 'full_day'">
            <template #icon>
              <ClockIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
            </template>
            <span class="relative block">
              <ClockIcon class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-current opacity-55" aria-hidden="true" />
              <BaseInput
                v-model="form.end_time"
                :disabled="form.block_type === 'full_day'"
                type="time"
                min="09:00"
                max="20:00"
                input-class="w-full rounded-2xl border border-slate-300 py-3 pl-11 pr-4 text-sm disabled:bg-slate-100"
              />
            </span>
          </BaseField>
        </div>
        <BaseField label="Причина">
          <template #icon>
            <DocumentTextIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
          </template>
          <span class="relative block">
            <DocumentTextIcon class="pointer-events-none absolute left-4 top-4 h-4 w-4 text-current opacity-55" aria-hidden="true" />
            <BaseTextarea
              v-model="form.reason"
              rows="4"
              textarea-class="w-full rounded-2xl border border-slate-300 py-3 pl-11 pr-4 text-sm"
            />
          </span>
        </BaseField>
        <div class="backoffice-modal-actions">
          <BaseButton type="submit" :disabled="saving || disabled" class="backoffice-modal-action-button backoffice-modal-action-primary">
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
