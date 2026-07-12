<script setup lang="ts">
import {
  ArrowPathIcon,
  DocumentTextIcon,
  IdentificationIcon,
  PencilSquareIcon,
  UserCircleIcon,
} from '@heroicons/vue/24/outline'
import type { Customer, CustomerUpdatePayload } from '~/composables/useBackofficeApi'

const props = defineProps<{
  modelValue: boolean
  customer: Customer
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [customer: Customer]
}>()

const api = useBackofficeApi()
const toast = useBaseToastNotification()
const { isAdmin } = useBackofficeAccess()
const { normalizePhone, isCompletePhone } = useUkrainianPhoneMask()

const form = reactive({
  phone: '',
  name: '',
  notes: '',
})
const formError = ref('')
const saving = ref(false)

const fillForm = () => {
  form.phone = props.customer.phone || ''
  form.name = props.customer.name || ''
  form.notes = props.customer.notes || ''
  formError.value = ''
}

const close = () => emit('update:modelValue', false)

const errorMessage = (error: unknown) => {
  if (typeof error === 'object' && error && 'data' in error) {
    const data = (error as { data?: { detail?: unknown } }).data
    if (data?.detail) return String(data.detail)
  }
  return 'Не вдалося зберегти дані клієнта.'
}

const submit = async () => {
  if (!isAdmin.value) {
    formError.value = 'Редагувати дані клієнта може лише адміністратор.'
    toast.error(formError.value)
    return
  }

  if (!isCompletePhone(form.phone)) {
    formError.value = 'Вкажіть повний номер телефону у форматі +380.'
    toast.warning(formError.value)
    return
  }

  saving.value = true
  formError.value = ''
  const payload: CustomerUpdatePayload = {
    phone: normalizePhone(form.phone),
    name: form.name.trim() || null,
    notes: form.notes.trim() || null,
  }

  try {
    const updatedCustomer = await api.updateCustomer(props.customer.id, payload)
    emit('saved', updatedCustomer)
    close()
    toast.success('Дані клієнта оновлено.')
  }
  catch (error: unknown) {
    formError.value = errorMessage(error)
    toast.error(formError.value)
  }
  finally {
    saving.value = false
  }
}

watch(
  () => props.modelValue,
  (opened) => {
    if (opened) fillForm()
  },
  { immediate: true },
)
</script>

<template>
  <BaseModal :model-value="modelValue" max-width-class="max-w-xl" @update:model-value="emit('update:modelValue', $event)" @close="formError = ''">
    <template #head="{ close: closeModal }">
      <div class="flex items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-2.5">
          <span class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
            <UserCircleIcon class="h-5 w-5" aria-hidden="true" />
          </span>
          <div class="min-w-0">
            <p class="type-eyebrow text-[0.68rem] text-cyan-700">Клієнти</p>
            <h2 class="mt-0.5 text-lg font-semibold leading-tight text-slate-900 sm:text-xl">Редагувати клієнта</h2>
          </div>
        </div>
        <ModalCloseButton @click="closeModal" />
      </div>
    </template>

    <template #body>
      <form class="space-y-4" @submit.prevent="submit">
        <BasePhoneInput v-model="form.phone" label="Телефон" required />

        <BaseInput
          v-model="form.name"
          label="Імʼя"
          autocomplete="given-name"
          maxlength="100"
          input-class="w-full rounded-xl border border-slate-300 px-3 py-2.5 sm:px-4"
        >
          <template #icon>
            <IdentificationIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
          </template>
        </BaseInput>

        <BaseTextarea
          v-model="form.notes"
          label="Нотатки"
          rows="4"
          textarea-class="w-full rounded-xl border border-slate-300 px-3 py-2.5 sm:px-4"
        >
          <template #icon>
            <DocumentTextIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
          </template>
        </BaseTextarea>

        <p v-if="formError" class="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {{ formError }}
        </p>

        <div class="backoffice-modal-actions">
          <BaseButton type="submit" :loading="saving" class="backoffice-modal-action-button backoffice-modal-action-primary">
            <PencilSquareIcon v-if="!saving" class="h-4 w-4" aria-hidden="true" />
            {{ saving ? 'Збереження...' : 'Зберегти зміни' }}
          </BaseButton>
          <BaseButton type="button" class="backoffice-modal-action-button backoffice-modal-action-secondary" :disabled="saving" @click="fillForm">
            <ArrowPathIcon class="h-4 w-4" aria-hidden="true" />
            Скинути
          </BaseButton>
        </div>
      </form>
    </template>
  </BaseModal>
</template>
