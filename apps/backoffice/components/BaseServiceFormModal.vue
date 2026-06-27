<script setup lang="ts">
import {
  ArrowPathIcon,
  BanknotesIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  DocumentTextIcon,
  LanguageIcon,
  TagIcon,
} from '@heroicons/vue/24/outline'
import type { BaseService, BaseServicePayload } from '~/composables/useBackofficeApi'

const props = defineProps<{
  modelValue: boolean
  service?: BaseService | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [message: string]
}>()

const api = useBackofficeApi()
const toast = useBaseToastNotification()
const { apiErrorMessage } = useBookingFormatting()

const form = reactive<BaseServicePayload>({
  name: '',
  title_uk: '',
  title_en: '',
  description: null,
  description_uk: null,
  description_en: null,
  duration_minutes: 30,
  price: 0,
  is_active: true,
})
const formError = ref('')
const saving = ref(false)

const editing = computed(() => props.service || null)

const fillForm = (service?: BaseService | null) => {
  form.title_uk = service?.title_uk || service?.name || ''
  form.name = form.title_uk
  form.title_en = service?.title_en || ''
  form.description_uk = service?.description_uk || service?.description || null
  form.description = form.description_uk
  form.description_en = service?.description_en || null
  form.duration_minutes = service?.duration_minutes || 30
  form.price = service ? Number(service.price) : 0
  form.is_active = service?.is_active ?? true
  formError.value = ''
}

const close = () => {
  emit('update:modelValue', false)
}

const validate = () => {
  if (!form.title_uk.trim()) return 'Назва українською обов’язкова.'
  if (!form.title_en.trim()) return 'Назва англійською обов’язкова.'
  if (!form.duration_minutes || Number(form.duration_minutes) <= 0) return 'Тривалість має бути більшою за 0.'
  if (Number(form.price) < 0) return 'Ціна має бути 0 або більше.'
  return ''
}

const servicePayload = () => ({
  ...form,
  name: form.title_uk.trim(),
  title_uk: form.title_uk.trim(),
  title_en: form.title_en.trim(),
  description: form.description_uk?.trim() || null,
  description_uk: form.description_uk?.trim() || null,
  description_en: form.description_en?.trim() || null,
  duration_minutes: Number(form.duration_minutes),
  price: Number(form.price),
})

const submit = async () => {
  formError.value = validate()
  if (formError.value) {
    toast.warning(formError.value)
    return
  }
  saving.value = true

  try {
    if (editing.value) {
      await api.adminUpdateBaseService(editing.value.id, servicePayload())
      emit('saved', 'Базову послугу оновлено.')
    }
    else {
      await api.adminCreateBaseService(servicePayload())
      emit('saved', 'Базову послугу створено.')
    }
    close()
  }
  catch (cause) {
    formError.value = apiErrorMessage(cause, 'Не вдалося зберегти базову послугу.')
    toast.error(formError.value)
  }
  finally {
    saving.value = false
  }
}

watch(
  () => [props.modelValue, props.service] as const,
  ([open, service]) => {
    if (open) fillForm(service)
  },
  { immediate: true },
)
</script>

<template>
  <BaseModal :model-value="modelValue" max-width-class="max-w-2xl" @update:model-value="emit('update:modelValue', $event)" @close="formError = ''">
    <template #head="{ close: closeModal }">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-[0.25em] text-cyan-700">Послуги</p>
          <h2 class="mt-2 text-2xl font-semibold text-slate-900">{{ editing ? 'Редагувати базову послугу' : 'Створити базову послугу' }}</h2>
        </div>
        <ModalCloseButton @click="closeModal" />
      </div>
    </template>

    <template #body>
      <form class="space-y-5" @submit.prevent="submit">
        <div class="grid gap-4 md:grid-cols-2">
          <label class="space-y-2 text-sm text-slate-700">
            <span class="inline-flex items-center gap-2 font-medium">
              <TagIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
              Назва українською
            </span>
            <span class="relative block">
              <TagIcon class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-current opacity-55" aria-hidden="true" />
              <input v-model="form.title_uk" required class="w-full rounded-2xl border border-slate-300 py-3 pl-11 pr-4">
            </span>
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="inline-flex items-center gap-2 font-medium">
              <LanguageIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
              Назва англійською
            </span>
            <span class="relative block">
              <LanguageIcon class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-current opacity-55" aria-hidden="true" />
              <input v-model="form.title_en" required class="w-full rounded-2xl border border-slate-300 py-3 pl-11 pr-4">
            </span>
          </label>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="space-y-2 text-sm text-slate-700">
            <span class="inline-flex items-center gap-2 font-medium">
              <DocumentTextIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
              Опис українською
            </span>
            <span class="relative block">
              <DocumentTextIcon class="pointer-events-none absolute left-4 top-4 h-4 w-4 text-current opacity-55" aria-hidden="true" />
              <textarea v-model="form.description_uk" rows="4" class="w-full rounded-2xl border border-slate-300 py-3 pl-11 pr-4" />
            </span>
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="inline-flex items-center gap-2 font-medium">
              <DocumentTextIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
              Опис англійською
            </span>
            <span class="relative block">
              <DocumentTextIcon class="pointer-events-none absolute left-4 top-4 h-4 w-4 text-current opacity-55" aria-hidden="true" />
              <textarea v-model="form.description_en" rows="4" class="w-full rounded-2xl border border-slate-300 py-3 pl-11 pr-4" />
            </span>
          </label>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="space-y-2 text-sm text-slate-700">
            <span class="inline-flex items-center gap-2 font-medium">
              <ClockIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
              Тривалість, хвилини
            </span>
            <span class="relative block">
              <ClockIcon class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-current opacity-55" aria-hidden="true" />
              <input v-model.number="form.duration_minutes" required type="number" min="1" class="w-full rounded-2xl border border-slate-300 py-3 pl-11 pr-4">
            </span>
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="inline-flex items-center gap-2 font-medium">
              <BanknotesIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
              Ціна
            </span>
            <span class="relative block">
              <BanknotesIcon class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-current opacity-55" aria-hidden="true" />
              <input v-model.number="form.price" required type="number" min="0" step="0.01" class="w-full rounded-2xl border border-slate-300 py-3 pl-11 pr-4">
            </span>
          </label>
        </div>
        <label class="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
          <CheckCircleIcon class="h-5 w-5 shrink-0" aria-hidden="true" />
          <input v-model="form.is_active" type="checkbox" class="h-4 w-4 rounded border-slate-300">
          <span class="min-w-0">Послуга активна</span>
        </label>
        <div class="backoffice-modal-actions">
          <button type="submit" :disabled="saving" class="backoffice-modal-action-button backoffice-modal-action-primary">
            <CheckIcon v-if="!saving" class="h-4 w-4" aria-hidden="true" />
            {{ saving ? 'Збереження...' : 'Зберегти послугу' }}
          </button>
          <button type="button" class="backoffice-modal-action-button backoffice-modal-action-secondary" @click="fillForm(editing)">
            <ArrowPathIcon class="h-4 w-4" aria-hidden="true" />
            Скинути
          </button>
        </div>
      </form>
    </template>
  </BaseModal>
</template>
