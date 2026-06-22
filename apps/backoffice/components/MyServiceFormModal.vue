<script setup lang="ts">
import {
  ArrowPathIcon,
  BanknotesIcon,
  ChevronDownIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  LanguageIcon,
  PencilSquareIcon,
  PlusIcon,
  ScissorsIcon,
  ShieldCheckIcon,
  TagIcon,
} from '@heroicons/vue/24/outline'
import type { BaseService, MasterService, MasterServicePayload } from '~/composables/useBackofficeApi'

type ServiceFormMode = 'base' | 'custom'

interface MyServiceForm {
  mode: ServiceFormMode
  base_service_id: string
  name: string
  title_uk: string
  title_en: string
  description: string | null
  description_uk: string | null
  description_en: string | null
  duration_minutes: number | string | null
  price: number | string | null
  is_active: boolean
  is_army_client: boolean
}

const props = defineProps<{
  modelValue: boolean
  barberId: number | string | null
  service?: MasterService | null
  baseServiceOptions: BaseService[]
  useOwnEndpoint?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [message: string]
}>()

const api = useBackofficeApi()
const toast = useBaseToastNotification()
const { formatDuration, formatPrice, serviceName, apiErrorMessage } = useBookingFormatting()

const form = reactive<MyServiceForm>({
  mode: 'custom',
  base_service_id: '',
  name: '',
  title_uk: '',
  title_en: '',
  description: null,
  description_uk: null,
  description_en: null,
  duration_minutes: 30,
  price: 0,
  is_active: true,
  is_army_client: false,
})
const formError = ref('')
const saving = ref(false)

const editing = computed(() => props.service || null)
const canCreateFromBase = computed(() => props.baseServiceOptions.length > 0)
const selectedBaseService = computed(() =>
  props.baseServiceOptions.find(service => String(service.id) === form.base_service_id) || null,
)

const fillForm = (service?: MasterService | null) => {
  const mode = service
    ? service.source_type || (service.base_service_id ? 'base' : 'custom')
    : canCreateFromBase.value ? 'base' : 'custom'

  form.mode = mode
  form.base_service_id = service?.base_service_id ? String(service.base_service_id) : ''
  form.title_uk = service?.title_uk || service?.name || ''
  form.name = form.title_uk
  form.title_en = service?.title_en || ''
  form.description_uk = service?.description_uk || service?.description || null
  form.description = form.description_uk
  form.description_en = service?.description_en || null
  form.duration_minutes = service ? service.duration_minutes : mode === 'custom' ? 30 : null
  form.price = service ? Number(service.price) : mode === 'custom' ? 0 : null
  form.is_active = service?.is_active ?? true
  form.is_army_client = service?.is_army_client ?? service?.base_service?.is_army_client ?? false
  formError.value = ''
}

const close = () => {
  emit('update:modelValue', false)
}

const validate = () => {
  if (!props.barberId) return 'Ваш акаунт не прив’язаний до профілю майстра.'
  if (!editing.value && form.mode === 'base' && !form.base_service_id) return 'Виберіть базову послугу.'
  if (form.mode === 'custom') {
    if (!form.title_uk.trim()) return 'Назва українською обов’язкова.'
    if (!form.title_en.trim()) return 'Назва англійською обов’язкова.'
    if (!form.duration_minutes || Number(form.duration_minutes) <= 0) return 'Тривалість має бути більшою за 0.'
    if (form.price === null || Number(form.price) < 0) return 'Ціна має бути 0 або більше.'
  }
  if (form.mode === 'base') {
    if (form.duration_minutes !== null && form.duration_minutes !== '' && Number(form.duration_minutes) <= 0) return 'Перевизначена тривалість має бути більшою за 0.'
    if (form.price !== null && form.price !== '' && Number(form.price) < 0) return 'Перевизначена ціна має бути 0 або більше.'
  }
  return ''
}

const servicePayload = () => ({
  base_service_id: form.mode === 'base' && form.base_service_id ? Number(form.base_service_id) : null,
  name: form.title_uk.trim() || undefined,
  title_uk: form.title_uk.trim() || undefined,
  title_en: form.title_en.trim() || undefined,
  description: form.description_uk?.trim() || null,
  description_uk: form.description_uk?.trim() || null,
  description_en: form.description_en?.trim() || null,
  duration_minutes: form.duration_minutes === null || form.duration_minutes === '' ? undefined : Number(form.duration_minutes),
  price: form.price === null || form.price === '' ? undefined : Number(form.price),
  is_active: form.is_active,
  is_army_client: form.is_army_client,
})

const submitPayload = (): MasterServicePayload => {
  const payload = servicePayload()
  if (editing.value) {
    const { base_service_id: _baseServiceId, ...updatePayload } = payload
    return updatePayload
  }
  return payload
}

const submit = async () => {
  formError.value = validate()
  const barberId = props.barberId
  if (formError.value || !barberId) {
    if (formError.value) toast.warning(formError.value)
    return
  }
  saving.value = true

  try {
    if (editing.value) {
      if (props.useOwnEndpoint) {
        await api.updateMyService(editing.value.id, submitPayload())
      }
      else {
        await api.updateMasterService(barberId, editing.value.id, submitPayload())
      }
      emit('saved', 'Послугу оновлено.')
    }
    else {
      await api.createMasterService(barberId, servicePayload())
      emit('saved', 'Послугу створено.')
    }
    close()
  }
  catch (cause) {
    formError.value = apiErrorMessage(cause, 'Не вдалося зберегти послугу.')
    toast.error(formError.value)
  }
  finally {
    saving.value = false
  }
}

const resetForm = () => {
  fillForm(editing.value)
}

watch(
  () => form.mode,
  mode => {
    if (editing.value) return
    form.base_service_id = ''
    form.duration_minutes = mode === 'custom' ? 30 : null
    form.price = mode === 'custom' ? 0 : null
    form.name = ''
    form.title_uk = ''
    form.title_en = ''
    form.description = null
    form.description_uk = null
    form.description_en = null
    form.is_army_client = false
  },
)

watch(
  () => form.base_service_id,
  () => {
    if (editing.value || form.mode !== 'base') return
    form.is_army_client = selectedBaseService.value?.is_army_client ?? false
  },
)

watch(
  () => [props.modelValue, props.service, canCreateFromBase.value] as const,
  ([open, service]) => {
    if (open) fillForm(service)
  },
  { immediate: true },
)
</script>

<template>
  <BaseModal :model-value="modelValue" max-width-class="max-w-3xl" @update:model-value="emit('update:modelValue', $event)" @close="formError = ''">
    <template #head="{ close: closeModal }">
      <div class="flex flex-wrap items-start justify-between gap-3 xl:gap-4">
        <div>
          <p class="text-xs uppercase tracking-[0.2em] text-cyan-700 xl:text-sm xl:tracking-[0.25em]">Мої послуги</p>
          <h2 class="mt-1 text-xl font-semibold text-slate-900 xl:mt-2 xl:text-2xl">{{ editing ? 'Редагувати послугу' : 'Створити послугу' }}</h2>
        </div>
        <ModalCloseButton @click="closeModal" />
      </div>
    </template>

    <template #body>
      <form class="space-y-3 xl:space-y-5" @submit.prevent="submit">
        <fieldset v-if="!editing" class="space-y-2 rounded-xl border border-slate-200 p-3 xl:space-y-3 xl:rounded-2xl xl:p-4">
          <legend class="px-1 text-xs font-medium text-slate-700 xl:text-sm">
            <span class="inline-flex items-center gap-1.5">
              <PlusIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
              Тип створення
            </span>
          </legend>
          <div class="flex flex-wrap gap-2 xl:gap-3">
            <label v-if="canCreateFromBase" class="flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-700 xl:px-4 xl:py-2 xl:text-sm">
              <ScissorsIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
              <input v-model="form.mode" type="radio" value="base" class="h-4 w-4">
              З базової послуги
            </label>
            <label class="flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-700 xl:px-4 xl:py-2 xl:text-sm">
              <PencilSquareIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
              <input v-model="form.mode" type="radio" value="custom" class="h-4 w-4">
              Власна
            </label>
          </div>
        </fieldset>
        <label v-if="!editing && form.mode === 'base'" class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
          <span class="inline-flex items-center gap-1.5 font-medium">
            <ScissorsIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
            Базова послуга
          </span>
          <span class="relative block">
            <ScissorsIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-current opacity-55 xl:left-4" aria-hidden="true" />
            <select v-model="form.base_service_id" required class="w-full appearance-none rounded-xl border border-slate-300 py-2 pl-10 pr-10 text-sm xl:rounded-2xl xl:py-3 xl:pl-11 xl:pr-12">
              <option value="">Виберіть базову послугу</option>
              <option v-for="service in baseServiceOptions" :key="service.id" :value="String(service.id)">
                {{ serviceName(service) }} / {{ service.title_en || 'без англ. назви' }} · {{ formatDuration(service.duration_minutes) }} · {{ formatPrice(service.price) }}
              </option>
            </select>
            <ChevronDownIcon class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-current opacity-55 xl:right-4" aria-hidden="true" />
          </span>
        </label>
        <div class="grid gap-2 md:grid-cols-2 xl:gap-4">
          <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="inline-flex items-center gap-1.5 font-medium">
              <TagIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
              Назва українською
            </span>
            <span class="relative block">
              <TagIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-current opacity-55 xl:left-4" aria-hidden="true" />
              <input v-model="form.title_uk" :required="form.mode === 'custom'" :placeholder="form.mode === 'base' && !editing ? 'Необов’язкове перевизначення' : ''" class="w-full rounded-xl border border-slate-300 py-2 pl-10 pr-3 text-sm xl:rounded-2xl xl:py-3 xl:pl-11 xl:pr-4">
            </span>
          </label>
          <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="inline-flex items-center gap-1.5 font-medium">
              <LanguageIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
              Назва англійською
            </span>
            <span class="relative block">
              <LanguageIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-current opacity-55 xl:left-4" aria-hidden="true" />
              <input v-model="form.title_en" :required="form.mode === 'custom'" :placeholder="form.mode === 'base' && !editing ? 'Необов’язкове перевизначення' : ''" class="w-full rounded-xl border border-slate-300 py-2 pl-10 pr-3 text-sm xl:rounded-2xl xl:py-3 xl:pl-11 xl:pr-4">
            </span>
          </label>
        </div>
        <div class="grid gap-2 md:grid-cols-2 xl:gap-4">
          <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="inline-flex items-center gap-1.5 font-medium">
              <DocumentTextIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
              Опис українською
            </span>
            <span class="relative block">
              <DocumentTextIcon class="pointer-events-none absolute left-3 top-3 h-4 w-4 text-current opacity-55 xl:left-4 xl:top-4" aria-hidden="true" />
              <textarea v-model="form.description_uk" rows="3" :placeholder="form.mode === 'base' && !editing ? 'Необов’язкове перевизначення' : ''" class="w-full rounded-xl border border-slate-300 py-2 pl-10 pr-3 text-sm xl:rounded-2xl xl:py-3 xl:pl-11 xl:pr-4" />
            </span>
          </label>
          <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="inline-flex items-center gap-1.5 font-medium">
              <DocumentTextIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
              Опис англійською
            </span>
            <span class="relative block">
              <DocumentTextIcon class="pointer-events-none absolute left-3 top-3 h-4 w-4 text-current opacity-55 xl:left-4 xl:top-4" aria-hidden="true" />
              <textarea v-model="form.description_en" rows="3" :placeholder="form.mode === 'base' && !editing ? 'Необов’язкове перевизначення' : ''" class="w-full rounded-xl border border-slate-300 py-2 pl-10 pr-3 text-sm xl:rounded-2xl xl:py-3 xl:pl-11 xl:pr-4" />
            </span>
          </label>
        </div>
        <div class="grid gap-2 md:grid-cols-2 xl:gap-4">
          <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="inline-flex items-center gap-1.5 font-medium">
              <ClockIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
              Тривалість, хвилини
            </span>
            <span class="relative block">
              <ClockIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-current opacity-55 xl:left-4" aria-hidden="true" />
              <input v-model.number="form.duration_minutes" :required="form.mode === 'custom'" type="number" min="1" :placeholder="form.mode === 'base' && !editing ? 'Базове значення' : ''" class="w-full rounded-xl border border-slate-300 py-2 pl-10 pr-3 text-sm xl:rounded-2xl xl:py-3 xl:pl-11 xl:pr-4">
            </span>
          </label>
          <label class="space-y-1 text-xs text-slate-700 xl:space-y-2 xl:text-sm">
            <span class="inline-flex items-center gap-1.5 font-medium">
              <BanknotesIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
              Ціна
            </span>
            <span class="relative block">
              <BanknotesIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-current opacity-55 xl:left-4" aria-hidden="true" />
              <input v-model.number="form.price" :required="form.mode === 'custom'" type="number" min="0" step="0.01" :placeholder="form.mode === 'base' && !editing ? 'Базове значення' : ''" class="w-full rounded-xl border border-slate-300 py-2 pl-10 pr-3 text-sm xl:rounded-2xl xl:py-3 xl:pl-11 xl:pr-4">
            </span>
          </label>
        </div>
        <div class="grid gap-2 sm:grid-cols-2 xl:gap-3">
          <label class="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 xl:gap-3 xl:rounded-2xl xl:px-4 xl:py-3 xl:text-sm">
            <CheckCircleIcon class="h-4 w-4 shrink-0 text-cyan-700 xl:h-5 xl:w-5" aria-hidden="true" />
            <input v-model="form.is_active" type="checkbox" class="h-4 w-4 rounded border-slate-300">
            <span class="min-w-0">Послуга активна</span>
          </label>
          <label class="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 xl:gap-3 xl:rounded-2xl xl:px-4 xl:py-3 xl:text-sm">
            <ShieldCheckIcon class="h-4 w-4 shrink-0 text-cyan-700 xl:h-5 xl:w-5" aria-hidden="true" />
            <input v-model="form.is_army_client" type="checkbox" class="h-4 w-4 rounded border-slate-300">
            <span class="min-w-0">Послуга для військових</span>
          </label>
        </div>
        <p v-if="editing?.base_service" class="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500 xl:rounded-2xl xl:px-4 xl:py-3 xl:text-sm">
          Зміни цієї послуги впливають лише на вашу особисту копію. Базова послуга: {{ serviceName(editing.base_service) }}.
        </p>
        <div class="backoffice-modal-actions">
          <button type="submit" :disabled="saving || !barberId" class="backoffice-modal-action-button backoffice-modal-action-primary">
            <PlusIcon v-if="!editing && !saving" class="h-4 w-4" aria-hidden="true" />
            <PencilSquareIcon v-else-if="editing && !saving" class="h-4 w-4" aria-hidden="true" />
            {{ saving ? 'Збереження...' : 'Зберегти послугу' }}
          </button>
          <button type="button" class="backoffice-modal-action-button backoffice-modal-action-secondary" @click="resetForm">
            <ArrowPathIcon class="h-4 w-4" aria-hidden="true" />
            Скинути
          </button>
        </div>
      </form>
    </template>
  </BaseModal>
</template>
