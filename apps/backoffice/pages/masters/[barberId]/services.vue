<script setup lang="ts">
import type { MasterService, MasterServicePayload, BaseService, Master } from '~/composables/useBackofficeApi'

definePageMeta({
  middleware: () => {
    const auth = useAuthStore()
    if (!auth.user?.is_superuser && auth.user?.role !== 'admin') {
      return navigateTo('/')
    }
  },
})

const route = useRoute()
const api = useBackofficeApi()
const { masterName, formatDuration, formatPrice, normalizeItems, apiErrorMessage } = useBookingFormatting()

const barberId = computed(() => String(route.params.barberId))
const { data: masters } = await useAsyncData('admin-barber-service-master-options', () => api.adminGetMasters(1, 200))
const masterOptions = computed<Master[]>(() => normalizeItems(masters.value))
const selectedMaster = computed(() => masterOptions.value.find(master => String(master.id) === barberId.value) || null)

type ServiceFormMode = 'base' | 'custom'
interface MasterServiceForm {
  mode: ServiceFormMode
  base_service_id: string
  name: string
  description: string | null
  duration_minutes: number | string | null
  price: number | string | null
  is_active: boolean
}

const form = reactive<MasterServiceForm>({
  mode: 'base',
  base_service_id: '',
  name: '',
  description: null,
  duration_minutes: null,
  price: null,
  is_active: true,
})
const editing = ref<MasterService | null>(null)
const formError = ref('')
const successMessage = ref('')
const saving = ref(false)
const deletingId = ref<number | string | null>(null)
const syncPending = ref(false)

const [{ data, pending, error, refresh }, { data: baseServiceData }] = await Promise.all([
  useAsyncData(
    'admin-barber-services',
    () => api.getMasterServices(barberId.value),
    { watch: [barberId] },
  ),
  useAsyncData('admin-barber-service-base-options', () => api.adminGetBaseServices(1, 200, { is_active: true })),
])

const services = computed(() => normalizeItems(data.value))
const baseServiceOptions = computed<BaseService[]>(() => normalizeItems(baseServiceData.value).filter(service => service.is_active))

const resetForm = () => {
  editing.value = null
  form.mode = 'base'
  form.base_service_id = ''
  form.name = ''
  form.description = null
  form.duration_minutes = null
  form.price = null
  form.is_active = true
  formError.value = ''
}

const editService = (service: MasterService) => {
  editing.value = service
  form.mode = service.source_type || (service.base_service_id ? 'base' : 'custom')
  form.base_service_id = service.base_service_id ? String(service.base_service_id) : ''
  form.name = service.name
  form.description = service.description || null
  form.duration_minutes = service.duration_minutes
  form.price = Number(service.price)
  form.is_active = service.is_active
  formError.value = ''
}

const validate = () => {
  if (!editing.value && form.mode === 'base' && !form.base_service_id) return 'Виберіть базову послугу.'
  if (form.mode === 'custom') {
    if (!form.name.trim()) return 'Назва обов’язкова.'
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
  name: form.name.trim() || undefined,
  description: form.description?.trim() || null,
  duration_minutes: form.duration_minutes === null || form.duration_minutes === '' ? undefined : Number(form.duration_minutes),
  price: form.price === null || form.price === '' ? undefined : Number(form.price),
  is_active: form.is_active,
})

const submitPayload = (): MasterServicePayload => {
  const payload = servicePayload()
  if (editing.value && form.mode === 'base') {
    const { base_service_id: _baseServiceId, ...updatePayload } = payload
    return updatePayload
  }
  return payload
}

const submit = async () => {
  formError.value = validate()
  successMessage.value = ''
  if (formError.value) return
  saving.value = true

  try {
    if (editing.value) {
      await api.updateMasterService(barberId.value, editing.value.id, submitPayload())
      successMessage.value = 'Послугу майстра оновлено.'
    }
    else {
      await api.createMasterService(barberId.value, servicePayload())
      successMessage.value = 'Послугу майстра створено.'
    }
    resetForm()
    await refresh()
  }
  catch (cause) {
    formError.value = apiErrorMessage(cause, 'Не вдалося зберегти послугу майстра.')
  }
  finally {
    saving.value = false
  }
}

const toggleService = async (service: MasterService) => {
  formError.value = ''
  successMessage.value = ''
  try {
    await api.updateMasterService(barberId.value, service.id, { is_active: !service.is_active })
    successMessage.value = 'Статус послуги майстра оновлено.'
    await refresh()
  }
  catch (cause) {
    formError.value = apiErrorMessage(cause, 'Не вдалося оновити статус послуги майстра.')
  }
}

const deleteService = async (service: MasterService) => {
  if (!confirm(`Disable service "${service.name}" for this barber? It will be removed from активний lists but kept in history.`)) return

  formError.value = ''
  successMessage.value = ''
  deletingId.value = service.id
  try {
    await api.deleteMasterService(barberId.value, service.id)
    successMessage.value = 'Послугу майстра вимкнено.'
    if (editing.value?.id === service.id) resetForm()
    await refresh()
  }
  catch (cause) {
    formError.value = apiErrorMessage(cause, 'Не вдалося видалити послугу майстра.')
  }
  finally {
    deletingId.value = null
  }
}

const syncDefaults = async () => {
  formError.value = ''
  successMessage.value = ''
  syncPending.value = true
  try {
    const result = await api.syncDefaultMasterServices(barberId.value)
    successMessage.value = `Synced ${result.created_count} missing default service${result.created_count === 1 ? '' : 's'}. Existing custom names and prices were not overwritten.`
    await refresh()
  }
  catch (cause) {
    formError.value = apiErrorMessage(cause, 'Не вдалося синхронізувати типові послуги.')
  }
  finally {
    syncPending.value = false
  }
}

watch(
  () => form.mode,
  mode => {
    if (editing.value) return
    form.base_service_id = ''
    form.duration_minutes = mode === 'custom' ? 30 : null
    form.price = mode === 'custom' ? 0 : null
    form.name = ''
    form.description = null
  },
)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <NuxtLink to="/masters" class="text-sm font-medium text-cyan-700">Назад до майстрів</NuxtLink>
        <p class="mt-4 text-sm uppercase tracking-[0.3em] text-cyan-700">Адмін</p>
        <h1 class="mt-2 text-3xl font-semibold text-slate-900">
          {{ selectedMaster ? `${masterName(selectedMaster)} Services` : `Майстер #${barberId} Services` }}
        </h1>
      </div>
      <button :disabled="syncPending" class="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60" @click="syncDefaults">
        {{ syncPending ? 'Синхронізація...' : 'Синхронізувати відсутні типові послуги' }}
      </button>
    </div>
    <p class="rounded-2xl bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
      Синхронізація додає лише відсутні активні базові послуги для цього майстра. Вона не перезаписує власні назви, ціни, тривалість або описи наявних послуг майстра.
    </p>

    <section class="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <form class="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm" @submit.prevent="submit">
        <h2 class="text-xl font-semibold text-slate-900">{{ editing ? 'Редагувати послугу майстра' : 'Створити послугу майстра' }}</h2>
        <fieldset v-if="!editing" class="space-y-3 rounded-2xl border border-slate-200 p-4">
          <legend class="px-1 text-sm font-medium text-slate-700">Тип створення</legend>
          <div class="flex flex-wrap gap-3">
            <label class="flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700">
              <input v-model="form.mode" type="radio" value="base" class="h-4 w-4">
              З базової послуги
            </label>
            <label class="flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700">
              <input v-model="form.mode" type="radio" value="custom" class="h-4 w-4">
              Власна
            </label>
          </div>
        </fieldset>
        <label v-if="!editing && form.mode === 'base'" class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">Базова послуга</span>
          <select v-model="form.base_service_id" required class="w-full rounded-2xl border border-slate-300 px-4 py-3">
            <option value="">Виберіть базову послугу</option>
            <option v-for="service in baseServiceOptions" :key="service.id" :value="String(service.id)">
              {{ service.name }} · {{ formatDuration(service.duration_minutes) }} · {{ formatPrice(service.price) }}
            </option>
          </select>
        </label>
        <label class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">Назва</span>
          <input v-model="form.name" :required="form.mode === 'custom'" :placeholder="form.mode === 'base' && !editing ? 'Необов’язкове перевизначення' : ''" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
        </label>
        <label class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">Опис</span>
          <textarea v-model="form.description" rows="4" :placeholder="form.mode === 'base' && !editing ? 'Необов’язкове перевизначення' : ''" class="w-full rounded-2xl border border-slate-300 px-4 py-3" />
        </label>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">Тривалість, хвилини</span>
            <input v-model.number="form.duration_minutes" :required="form.mode === 'custom'" type="number" min="1" :placeholder="form.mode === 'base' && !editing ? 'Базове значення' : ''" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">Ціна</span>
            <input v-model.number="form.price" :required="form.mode === 'custom'" type="number" min="0" step="0.01" :placeholder="form.mode === 'base' && !editing ? 'Базове значення' : ''" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
          </label>
        </div>
        <label class="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
          <input v-model="form.is_active" type="checkbox" class="h-4 w-4 rounded border-slate-300">
          Послуга активна
        </label>
        <p v-if="editing?.base_service" class="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Based on {{ editing.base_service.name }}. Редагуватиing this service changes only this barber's personal copy.
        </p>
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
        <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {{ apiErrorMessage(error, 'Не вдалося завантажити послуги майстра.') }}
        </p>
        <div v-if="pending" class="text-sm text-slate-500">Завантаження послуг майстра...</div>
        <div v-else-if="!services.length" class="text-sm text-slate-500">Послуг майстра не знайдено.</div>
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead class="text-xs uppercase text-slate-500">
              <tr>
                <th class="px-4 py-3 font-medium">Назва</th>
                <th class="px-4 py-3 font-medium">Тривалість</th>
                <th class="px-4 py-3 font-medium">Ціна</th>
                <th class="px-4 py-3 font-medium">Джерело</th>
                <th class="px-4 py-3 font-medium">Базова послуга</th>
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
                  <span class="rounded-full px-3 py-1 text-xs font-medium" :class="service.source_type === 'base' ? 'bg-cyan-50 text-cyan-700' : 'bg-slate-100 text-slate-600'">
                    {{ service.source_type }}
                  </span>
                </td>
                <td class="px-4 py-3 text-slate-500">
                  {{ service.base_service ? `${service.base_service.name} #${service.base_service.id}` : '-' }}
                </td>
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
                      {{ deletingId === service.id ? 'Вимкнення...' : 'Видалити' }}
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
