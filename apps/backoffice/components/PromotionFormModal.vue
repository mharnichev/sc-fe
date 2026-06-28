<script setup lang="ts">
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  CheckIcon,
  DocumentTextIcon,
  LanguageIcon,
  ReceiptPercentIcon,
  TagIcon,
  TicketIcon,
  UserGroupIcon,
} from '@heroicons/vue/24/outline'
import type { BaseService, Master, Promotion, PromotionEligibilityType, PromotionPayload } from '~/composables/useBackofficeApi'

const props = defineProps<{
  modelValue: boolean
  promotion?: Promotion | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [message: string]
}>()

const api = useBackofficeApi()
const toast = useBaseToastNotification()
const { apiErrorMessage, normalizeItems } = useBookingFormatting()

type PromotionForm = Omit<PromotionPayload, 'starts_at' | 'ends_at'> & {
  starts_at: string
  ends_at: string
}

const form = reactive<PromotionForm>({
  code: '',
  name_uk: '',
  name_en: '',
  description_uk: null,
  description_en: null,
  discount_type: 'percent',
  discount_percent: 15,
  eligibility_type: 'all_customers',
  inactive_days: null,
  starts_at: '',
  ends_at: '',
  applies_to_all_masters: true,
  master_ids: [],
  applies_to_all_services: true,
  base_service_ids: [],
  is_active: true,
})
const formError = ref('')
const saving = ref(false)
const scopeLoading = ref(false)
const masterOptions = ref<Master[]>([])
const baseServiceOptions = ref<BaseService[]>([])

const editing = computed(() => props.promotion || null)
const eligibilityOptions: { value: PromotionEligibilityType, label: string }[] = [
  { value: 'all_customers', label: 'Усі клієнти' },
  { value: 'inactive_customers', label: 'Неактивні клієнти' },
  { value: 'military_customers', label: 'Військові клієнти' },
]

const normalizeNumberIds = (values?: Array<number | string> | null) =>
  Array.from(new Set((values || []).map(value => Number(value)).filter(Number.isFinite)))

const selectedBaseServiceIdStrings = computed<string[]>({
  get: () => form.base_service_ids.map(String),
  set: values => {
    form.base_service_ids = normalizeNumberIds(values)
  },
})

const loadScopeOptions = async () => {
  if (masterOptions.value.length && baseServiceOptions.value.length) return
  scopeLoading.value = true
  try {
    const [mastersResponse, servicesResponse] = await Promise.all([
      api.adminGetMasters(1, 200, { is_active: true }),
      api.adminGetBaseServices(1, 200, { is_active: true }),
    ])
    masterOptions.value = normalizeItems(mastersResponse)
    baseServiceOptions.value = normalizeItems(servicesResponse)
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося завантажити майстрів або послуги для акції.'))
  }
  finally {
    scopeLoading.value = false
  }
}

const toDateTimeLocal = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

const toIsoOrNull = (value: string) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const normalizeCode = (value: string) => value.trim().toUpperCase()

const fillForm = (promotion?: Promotion | null) => {
  form.code = promotion?.code || ''
  form.name_uk = promotion?.name_uk || ''
  form.name_en = promotion?.name_en || ''
  form.description_uk = promotion?.description_uk || null
  form.description_en = promotion?.description_en || null
  form.discount_type = promotion?.discount_type || 'percent'
  form.discount_percent = promotion?.discount_percent || 15
  form.eligibility_type = promotion?.eligibility_type || 'all_customers'
  form.inactive_days = promotion?.inactive_days ?? (form.eligibility_type === 'inactive_customers' ? 90 : null)
  form.starts_at = toDateTimeLocal(promotion?.starts_at)
  form.ends_at = toDateTimeLocal(promotion?.ends_at)
  form.applies_to_all_masters = promotion?.applies_to_all_masters ?? true
  form.master_ids = normalizeNumberIds(promotion?.master_ids)
  form.applies_to_all_services = promotion?.applies_to_all_services ?? true
  form.base_service_ids = normalizeNumberIds(promotion?.base_service_ids)
  form.is_active = promotion?.is_active ?? true
  formError.value = ''
}

const close = () => {
  emit('update:modelValue', false)
}

const validate = () => {
  const code = normalizeCode(form.code)
  if (!code || code.length < 3) return 'Код акції має містити щонайменше 3 символи.'
  if (!/^[A-Z0-9_-]+$/.test(code)) return 'Код може містити лише A-Z, 0-9, "_" і "-".'
  if (!form.name_uk.trim()) return 'Назва українською обов’язкова.'
  if (!form.name_en.trim()) return 'Назва англійською обов’язкова.'
  if (!form.discount_percent || form.discount_percent < 1 || form.discount_percent > 100) return 'Знижка має бути від 1 до 100%.'
  if (form.eligibility_type === 'inactive_customers' && (!form.inactive_days || form.inactive_days < 1)) {
    return 'Для неактивних клієнтів вкажіть кількість днів без візиту.'
  }
  if (!form.applies_to_all_masters && !form.master_ids.length) return 'Виберіть майстрів для акції.'
  if (!form.applies_to_all_services && !form.base_service_ids.length) return 'Виберіть базові послуги для акції.'
  if (form.starts_at && form.ends_at && new Date(form.ends_at).getTime() <= new Date(form.starts_at).getTime()) {
    return 'Дата завершення має бути пізніше дати старту.'
  }
  return ''
}

const promotionPayload = (): PromotionPayload => ({
  code: normalizeCode(form.code),
  name_uk: form.name_uk.trim(),
  name_en: form.name_en.trim(),
  description_uk: form.description_uk?.trim() || null,
  description_en: form.description_en?.trim() || null,
  discount_type: 'percent',
  discount_percent: Number(form.discount_percent),
  eligibility_type: form.eligibility_type,
  inactive_days: form.eligibility_type === 'inactive_customers' ? Number(form.inactive_days || 90) : null,
  starts_at: toIsoOrNull(form.starts_at),
  ends_at: toIsoOrNull(form.ends_at),
  applies_to_all_masters: form.applies_to_all_masters,
  master_ids: form.applies_to_all_masters ? [] : normalizeNumberIds(form.master_ids),
  applies_to_all_services: form.applies_to_all_services,
  base_service_ids: form.applies_to_all_services ? [] : normalizeNumberIds(form.base_service_ids),
  is_active: form.is_active,
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
      await api.adminUpdatePromotion(editing.value.id, promotionPayload())
      emit('saved', 'Акцію оновлено.')
    }
    else {
      await api.adminCreatePromotion(promotionPayload())
      emit('saved', 'Акцію створено.')
    }
    close()
  }
  catch (cause) {
    formError.value = apiErrorMessage(cause, 'Не вдалося зберегти акцію.')
    toast.error(formError.value)
  }
  finally {
    saving.value = false
  }
}

watch(
  () => [props.modelValue, props.promotion] as const,
  ([open, promotion]) => {
    if (open) {
      fillForm(promotion)
      void loadScopeOptions()
    }
  },
  { immediate: true },
)

watch(
  () => form.eligibility_type,
  (value) => {
    if (value === 'inactive_customers' && !form.inactive_days) form.inactive_days = 90
    if (value !== 'inactive_customers') form.inactive_days = null
  },
)

watch(
  () => form.applies_to_all_masters,
  value => {
    if (value) form.master_ids = []
  },
)

watch(
  () => form.applies_to_all_services,
  value => {
    if (value) form.base_service_ids = []
  },
)
</script>

<template>
  <BaseModal :model-value="modelValue" max-width-class="max-w-3xl" @update:model-value="emit('update:modelValue', $event)" @close="formError = ''">
    <template #head="{ close: closeModal }">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-[0.25em] text-cyan-700">Акції</p>
          <h2 class="mt-2 text-2xl font-semibold text-slate-900">{{ editing ? 'Редагувати акцію' : 'Створити акцію' }}</h2>
        </div>
        <ModalCloseButton @click="closeModal" />
      </div>
    </template>

    <template #body>
      <form class="space-y-5" @submit.prevent="submit">
        <div v-if="formError" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {{ formError }}
        </div>

        <div class="grid gap-4 md:grid-cols-[0.8fr_1fr_1fr]">
          <label class="space-y-2 text-sm text-slate-700">
            <span class="inline-flex items-center gap-2 font-medium">
              <TicketIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
              Код
            </span>
            <span class="relative block">
              <TicketIcon class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-current opacity-55" aria-hidden="true" />
              <BaseInput v-model="form.code" required placeholder="COMEBACK15" class="w-full rounded-2xl border border-slate-300 py-3 pl-11 pr-4 uppercase" />
            </span>
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="inline-flex items-center gap-2 font-medium">
              <TagIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
              Назва українською
            </span>
            <span class="relative block">
              <TagIcon class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-current opacity-55" aria-hidden="true" />
              <BaseInput v-model="form.name_uk" required class="w-full rounded-2xl border border-slate-300 py-3 pl-11 pr-4" />
            </span>
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="inline-flex items-center gap-2 font-medium">
              <LanguageIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
              Назва англійською
            </span>
            <span class="relative block">
              <LanguageIcon class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-current opacity-55" aria-hidden="true" />
              <BaseInput v-model="form.name_en" required class="w-full rounded-2xl border border-slate-300 py-3 pl-11 pr-4" />
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
              <BaseTextarea v-model="form.description_uk" rows="4" class="w-full rounded-2xl border border-slate-300 py-3 pl-11 pr-4" />
            </span>
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="inline-flex items-center gap-2 font-medium">
              <DocumentTextIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
              Опис англійською
            </span>
            <span class="relative block">
              <DocumentTextIcon class="pointer-events-none absolute left-4 top-4 h-4 w-4 text-current opacity-55" aria-hidden="true" />
              <BaseTextarea v-model="form.description_en" rows="4" class="w-full rounded-2xl border border-slate-300 py-3 pl-11 pr-4" />
            </span>
          </label>
        </div>

        <div class="grid gap-4 md:grid-cols-3">
          <label class="space-y-2 text-sm text-slate-700">
            <span class="inline-flex items-center gap-2 font-medium">
              <ReceiptPercentIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
              Знижка, %
            </span>
            <span class="relative block">
              <ReceiptPercentIcon class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-current opacity-55" aria-hidden="true" />
              <BaseInput v-model.number="form.discount_percent" required type="number" min="1" max="100" class="w-full rounded-2xl border border-slate-300 py-3 pl-11 pr-4" />
            </span>
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="inline-flex items-center gap-2 font-medium">
              <UserGroupIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
              Аудиторія
            </span>
            <BaseSelect v-model="form.eligibility_type" :options="eligibilityOptions" aria-label="Аудиторія акції" menu-class="z-[260]" />
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="inline-flex items-center gap-2 font-medium">
              <CalendarDaysIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
              Днів без візиту
            </span>
            <BaseInput v-model.number="form.inactive_days"
              type="number"
              min="1"
              max="3650"
              :disabled="form.eligibility_type !== 'inactive_customers'"
              class="w-full rounded-2xl border border-slate-300 px-4 py-3" />
          </label>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <label class="space-y-2 text-sm text-slate-700">
            <span class="inline-flex items-center gap-2 font-medium">
              <CalendarDaysIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
              Початок дії
            </span>
            <BaseCalendar v-model="form.starts_at" class="w-full rounded-2xl border border-slate-300 px-4 py-3" mode="datetime" />
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="inline-flex items-center gap-2 font-medium">
              <CalendarDaysIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
              Завершення дії
            </span>
            <BaseCalendar v-model="form.ends_at" class="w-full rounded-2xl border border-slate-300 px-4 py-3" mode="datetime" />
          </label>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <fieldset class="space-y-3 rounded-2xl border border-slate-200 p-4">
            <legend class="px-1 text-sm font-medium text-slate-700">
              <span class="inline-flex items-center gap-2">
                <UserGroupIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
                Майстри
              </span>
            </legend>
            <label class="flex items-center gap-3 text-sm font-medium text-slate-700">
              <BaseCheckbox v-model="form.applies_to_all_masters" class="h-4 w-4 rounded border-slate-300" />
              Усі майстри
            </label>
            <MasterMultiSelect
              v-if="!form.applies_to_all_masters"
              v-model="form.master_ids"
              :masters="masterOptions"
              :disabled="scopeLoading"
              placeholder="Пошук майстра"
            />
            <p v-if="scopeLoading && !form.applies_to_all_masters" class="text-xs text-slate-500">
              Завантажуємо майстрів...
            </p>
          </fieldset>

          <fieldset class="space-y-3 rounded-2xl border border-slate-200 p-4">
            <legend class="px-1 text-sm font-medium text-slate-700">
              <span class="inline-flex items-center gap-2">
                <TagIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
                Послуги
              </span>
            </legend>
            <label class="flex items-center gap-3 text-sm font-medium text-slate-700">
              <BaseCheckbox v-model="form.applies_to_all_services" class="h-4 w-4 rounded border-slate-300" />
              Усі базові послуги
            </label>
            <ServiceMultiSelect
              v-if="!form.applies_to_all_services"
              v-model="selectedBaseServiceIdStrings"
              :services="baseServiceOptions"
              :show-limit="false"
              :show-selected-chips="false"
              :disabled="scopeLoading"
              placeholder="Пошук послуги"
            />
            <p v-if="scopeLoading && !form.applies_to_all_services" class="text-xs text-slate-500">
              Завантажуємо послуги...
            </p>
          </fieldset>
        </div>

        <label class="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
          <CheckCircleIcon class="h-5 w-5 shrink-0" aria-hidden="true" />
          <BaseCheckbox v-model="form.is_active" class="h-4 w-4 rounded border-slate-300" />
          <span class="min-w-0">Акція активна</span>
        </label>

        <div class="backoffice-modal-actions">
          <BaseButton type="submit" :disabled="saving" class="backoffice-modal-action-button backoffice-modal-action-primary">
            <CheckIcon v-if="!saving" class="h-4 w-4" aria-hidden="true" />
            {{ saving ? 'Збереження...' : 'Зберегти акцію' }}
          </BaseButton>
          <BaseButton type="button" class="backoffice-modal-action-button backoffice-modal-action-secondary" @click="fillForm(editing)">
            <ArrowPathIcon class="h-4 w-4" aria-hidden="true" />
            Скинути
          </BaseButton>
        </div>
      </form>
    </template>
  </BaseModal>
</template>
