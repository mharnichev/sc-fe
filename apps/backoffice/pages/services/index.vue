<script setup lang="ts">
import type { BaseService, BaseServicePayload } from '~/composables/useBackofficeApi'

definePageMeta({
  middleware: () => {
    const auth = useAuthStore()
    if (!auth.user?.is_superuser && auth.user?.role !== 'admin') {
      return navigateTo('/')
    }
  },
})

const api = useBackofficeApi()
const { formatDuration, formatPrice, normalizeItems, normalizeTotal, apiErrorMessage } = useBookingFormatting()

const page = ref(1)
const pageSize = 100
const filters = reactive({ search: '', is_active: '' })
const form = reactive<BaseServicePayload>({
  name: '',
  description: null,
  duration_minutes: 30,
  price: 0,
  is_active: true,
})
const editing = ref<BaseService | null>(null)
const formError = ref('')
const successMessage = ref('')
const saving = ref(false)
const deletingId = ref<number | string | null>(null)

const { data, pending, error, refresh } = await useAsyncData(
  'admin-base-services',
  () => api.adminGetBaseServices(page.value, pageSize, {
    search: filters.search || undefined,
    is_active: filters.is_active === '' ? null : filters.is_active === 'true',
  }),
  { watch: [page] },
)

const services = computed(() => normalizeItems(data.value))
const total = computed(() => normalizeTotal(data.value))

const resetForm = () => {
  editing.value = null
  form.name = ''
  form.description = null
  form.duration_minutes = 30
  form.price = 0
  form.is_active = true
  formError.value = ''
}

const editService = (service: BaseService) => {
  editing.value = service
  form.name = service.name
  form.description = service.description || null
  form.duration_minutes = service.duration_minutes
  form.price = Number(service.price)
  form.is_active = service.is_active
  formError.value = ''
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
  successMessage.value = ''
  if (formError.value) return
  saving.value = true

  try {
    if (editing.value) {
      await api.adminUpdateBaseService(editing.value.id, servicePayload())
      successMessage.value = 'Базову послугу оновлено.'
    }
    else {
      await api.adminCreateBaseService(servicePayload())
      successMessage.value = 'Базову послугу створено.'
    }
    resetForm()
    await refresh()
  }
  catch (cause) {
    formError.value = apiErrorMessage(cause, 'Не вдалося зберегти базову послугу.')
  }
  finally {
    saving.value = false
  }
}

const toggleService = async (service: BaseService) => {
  formError.value = ''
  successMessage.value = ''
  try {
    await api.adminUpdateBaseService(service.id, { is_active: !service.is_active })
    successMessage.value = 'Статус базової послуги оновлено.'
    await refresh()
  }
  catch (cause) {
    formError.value = apiErrorMessage(cause, 'Не вдалося оновити статус базової послуги.')
  }
}

const deleteService = async (service: BaseService) => {
  if (!confirm(`Деактивувати base service "${service.name}"? Existing barber services keep their custom values.`)) return

  formError.value = ''
  successMessage.value = ''
  deletingId.value = service.id
  try {
    await api.adminDeleteBaseService(service.id)
    successMessage.value = 'Базову послугу деактивовано.'
    if (editing.value?.id === service.id) resetForm()
    await refresh()
  }
  catch (cause) {
    formError.value = apiErrorMessage(cause, 'Не вдалося видалити базову послугу.')
  }
  finally {
    deletingId.value = null
  }
}

const applyFilters = async () => {
  page.value = 1
  if (page.value === 1) await refresh()
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Послуги</p>
      <h1 class="mt-2 text-3xl font-semibold text-slate-900">Базові послуги</h1>
    </div>

    <section class="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <form class="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm" @submit.prevent="submit">
        <h2 class="text-xl font-semibold text-slate-900">{{ editing ? 'Редагувати базову послугу' : 'Створити базову послугу' }}</h2>
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
          <button type="submit" :disabled="saving" class="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60">
            {{ saving ? 'Збереження...' : 'Зберегти послугу' }}
          </button>
          <button type="button" class="rounded-full border border-slate-300 px-5 py-3 text-sm" @click="resetForm">Скинути</button>
        </div>
        <p v-if="formError" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{{ formError }}</p>
        <p v-if="successMessage" class="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ successMessage }}</p>
      </form>

      <section class="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div class="grid gap-3 md:grid-cols-[1fr_180px_auto]">
          <input v-model="filters.search" placeholder="Пошук базових послуг" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
          <select v-model="filters.is_active" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
            <option value="">Будь-який статус</option>
            <option value="true">Активні</option>
            <option value="false">Неактивні</option>
          </select>
          <button class="rounded-full bg-slate-950 px-4 py-3 text-sm font-medium text-white" @click="applyFilters">Застосувати</button>
        </div>
        <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {{ apiErrorMessage(error, 'Не вдалося завантажити базові послуги з /backoffice/admin/services.') }}
        </p>
        <p class="rounded-[1.25rem] bg-slate-50 px-4 py-3 text-sm text-slate-600">Total: {{ total }}</p>
        <div v-if="pending" class="text-sm text-slate-500">Завантаження базових послуг...</div>
        <div v-else-if="!services.length" class="text-sm text-slate-500">Базових послуг не знайдено.</div>
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead class="text-xs uppercase text-slate-500">
              <tr>
                <th class="px-4 py-3 font-medium">Назва</th>
                <th class="px-4 py-3 font-medium">Тривалість</th>
                <th class="px-4 py-3 font-medium">Ціна</th>
                <th class="px-4 py-3 font-medium">Статус</th>
                <th class="px-4 py-3 font-medium">Дії</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="service in services" :key="service.id">
                <td class="px-4 py-3">
                  <p class="font-medium text-slate-900">{{ service.name }}</p>
                  <p class="mt-1 text-xs text-slate-500">{{ service.description || 'Без опису' }}</p>
                </td>
                <td class="px-4 py-3 text-slate-700">{{ formatDuration(service.duration_minutes) }}</td>
                <td class="px-4 py-3 text-slate-700">{{ formatPrice(service.price) }}</td>
                <td class="px-4 py-3">
                  <span class="rounded-full px-3 py-1 text-xs font-medium" :class="service.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">
                    {{ service.is_active ? 'активний' : 'неактивний' }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-2">
                    <button class="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700" @click="editService(service)">Редагувати</button>
                    <button class="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700" @click="toggleService(service)">
                      {{ service.is_active ? 'Деактивувати' : 'Активувати' }}
                    </button>
                    <button class="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 disabled:opacity-60" :disabled="deletingId === service.id || !service.is_active" @click="deleteService(service)">
                      {{ deletingId === service.id ? 'Деактивація...' : 'Видалити' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </section>
  </div>
</template>
