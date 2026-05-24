<script setup lang="ts">
import { PlusIcon } from '@heroicons/vue/24/outline'
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
const { apiErrorMessage } = useBookingFormatting()

const form = reactive<BaseServicePayload>({
  name: '',
  description: null,
  duration_minutes: 30,
  price: 0,
  is_active: true,
})
const formError = ref('')
const saving = ref(false)

const editing = computed(() => props.service || null)

const fillForm = (service?: BaseService | null) => {
  form.name = service?.name || ''
  form.description = service?.description || null
  form.duration_minutes = service?.duration_minutes || 30
  form.price = service ? Number(service.price) : 0
  form.is_active = service?.is_active ?? true
  formError.value = ''
}

const close = () => {
  emit('update:modelValue', false)
}

const validate = () => {
  if (!form.name.trim()) return 'Назва обов’язкова.'
  if (!form.duration_minutes || Number(form.duration_minutes) <= 0) return 'Тривалість має бути більшою за 0.'
  if (Number(form.price) < 0) return 'Ціна має бути 0 або більше.'
  return ''
}

const servicePayload = () => ({
  ...form,
  name: form.name.trim(),
  description: form.description?.trim() || null,
  duration_minutes: Number(form.duration_minutes),
  price: Number(form.price),
})

const submit = async () => {
  formError.value = validate()
  if (formError.value) return
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
        <button type="button" class="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700" @click="closeModal">
          Закрити
        </button>
      </div>
    </template>

    <template #body>
      <form class="space-y-5" @submit.prevent="submit">
        <label class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">Назва</span>
          <input v-model="form.name" required class="w-full rounded-2xl border border-slate-300 px-4 py-3">
        </label>
        <label class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">Опис</span>
          <textarea v-model="form.description" rows="4" class="w-full rounded-2xl border border-slate-300 px-4 py-3" />
        </label>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">Тривалість, хвилини</span>
            <input v-model.number="form.duration_minutes" required type="number" min="1" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">Ціна</span>
            <input v-model.number="form.price" required type="number" min="0" step="0.01" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
          </label>
        </div>
        <label class="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
          <input v-model="form.is_active" type="checkbox" class="h-4 w-4 rounded border-slate-300">
          Послуга активна
        </label>
        <div class="flex flex-wrap gap-3">
          <button type="submit" :disabled="saving" class="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60">
            <PlusIcon v-if="!editing && !saving" class="h-4 w-4" aria-hidden="true" />
            {{ saving ? 'Збереження...' : 'Зберегти послугу' }}
          </button>
          <button type="button" class="rounded-full border border-slate-300 px-5 py-3 text-sm" @click="fillForm(editing)">
            Скинути
          </button>
        </div>
        <p v-if="formError" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{{ formError }}</p>
      </form>
    </template>
  </BaseModal>
</template>
