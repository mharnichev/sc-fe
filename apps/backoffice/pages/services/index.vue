<script setup lang="ts">
import { CheckCircleIcon, NoSymbolIcon, PencilIcon, PlusIcon, TrashIcon } from '@heroicons/vue/24/outline'
import type { BaseService } from '~/composables/useBackofficeApi'

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
const editing = ref<BaseService | null>(null)
const formError = ref('')
const successMessage = ref('')
const deletingId = ref<number | string | null>(null)
const serviceModalOpen = ref(false)
const togglingService = ref<BaseService | null>(null)
const togglePending = ref(false)

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

const openCreateService = () => {
  editing.value = null
  formError.value = ''
  successMessage.value = ''
  serviceModalOpen.value = true
}

const editService = (service: BaseService) => {
  editing.value = service
  formError.value = ''
  successMessage.value = ''
  serviceModalOpen.value = true
}

const handleServiceSaved = async (message: string) => {
  successMessage.value = message
  formError.value = ''
  editing.value = null
  await refresh()
}

const handleServiceModalUpdate = (value: boolean) => {
  serviceModalOpen.value = value
  if (!value) editing.value = null
}

const toggleContextItems = computed(() => {
  if (!togglingService.value) return []
  return [
    { label: 'Послуга', value: togglingService.value.name },
    { label: 'Поточний статус', value: togglingService.value.is_active ? 'активна' : 'неактивна' },
    { label: 'Новий статус', value: togglingService.value.is_active ? 'неактивна' : 'активна' },
  ]
})

const openToggleServiceConfirm = (service: BaseService) => {
  formError.value = ''
  successMessage.value = ''
  togglingService.value = service
}

const handleToggleConfirmUpdate = (value: boolean) => {
  if (!value && !togglePending.value) togglingService.value = null
}

const confirmToggleService = async () => {
  const service = togglingService.value
  if (!service) return

  formError.value = ''
  successMessage.value = ''
  togglePending.value = true
  try {
    await api.adminUpdateBaseService(service.id, { is_active: !service.is_active })
    successMessage.value = 'Статус базової послуги оновлено.'
    togglingService.value = null
    await refresh()
  }
  catch (cause) {
    formError.value = apiErrorMessage(cause, 'Не вдалося оновити статус базової послуги.')
  }
  finally {
    togglePending.value = false
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
    if (editing.value?.id === service.id) editing.value = null
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
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Послуги</p>
        <h1 class="mt-2 text-3xl font-semibold text-slate-900">Базові послуги</h1>
      </div>
      <button type="button" class="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white" @click="openCreateService">
        <PlusIcon class="h-4 w-4" aria-hidden="true" />
        Створити базову послугу
      </button>
    </div>

    <p v-if="formError" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{{ formError }}</p>
    <p v-if="successMessage" class="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ successMessage }}</p>

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
              <td data-label="Назва" class="px-4 py-3">
                <p class="font-medium text-slate-900">{{ service.name }}</p>
                <p class="mt-1 text-xs text-slate-500">{{ service.description || 'Без опису' }}</p>
              </td>
              <td data-label="Тривалість" class="px-4 py-3 text-slate-700">{{ formatDuration(service.duration_minutes) }}</td>
              <td data-label="Ціна" class="px-4 py-3 text-slate-700">{{ formatPrice(service.price) }}</td>
              <td data-label="Статус" class="px-4 py-3">
                <span class="rounded-full px-3 py-1 text-xs font-medium" :class="service.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">
                  {{ service.is_active ? 'активний' : 'неактивний' }}
                </span>
              </td>
              <td data-label="Дії" class="px-4 py-3">
                <div class="flex flex-wrap gap-2">
                  <button
                    class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50"
                    aria-label="Редагувати базову послугу"
                    title="Редагувати"
                    @click="editService(service)"
                  >
                    <PencilIcon class="h-4 w-4" aria-hidden="true" />
                    <span class="sr-only">Редагувати</span>
                  </button>
                  <button
                    class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50"
                    :aria-label="service.is_active ? 'Деактивувати базову послугу' : 'Активувати базову послугу'"
                    :title="service.is_active ? 'Деактивувати' : 'Активувати'"
                    @click="openToggleServiceConfirm(service)"
                  >
                    <template v-if="service.is_active">
                      <NoSymbolIcon class="h-4 w-4" aria-hidden="true" />
                      <span class="sr-only">Деактивувати</span>
                    </template>
                    <template v-else>
                      <CheckCircleIcon class="h-4 w-4" aria-hidden="true" />
                      <span class="sr-only">Активувати</span>
                    </template>
                  </button>
                  <button
                    class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                    :disabled="deletingId === service.id || !service.is_active"
                    :aria-label="deletingId === service.id ? 'Деактивація базової послуги' : 'Видалити базову послугу'"
                    :title="deletingId === service.id ? 'Деактивація...' : 'Видалити'"
                    @click="deleteService(service)"
                  >
                    <TrashIcon class="h-4 w-4" aria-hidden="true" />
                    <span class="sr-only">{{ deletingId === service.id ? 'Деактивація...' : 'Видалити' }}</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <BaseServiceFormModal
      :model-value="serviceModalOpen"
      :service="editing"
      @saved="handleServiceSaved"
      @update:model-value="handleServiceModalUpdate"
    />
    <ConfirmActionModal
      :model-value="Boolean(togglingService)"
      :title="togglingService?.is_active ? 'Деактивувати базову послугу?' : 'Активувати базову послугу?'"
      :message="togglingService?.is_active ? 'Ця базова послуга стане неактивною для нових налаштувань. Наявні персональні послуги майстрів не будуть перезаписані. Ви точно хочете виконати цю дію?' : 'Ця базова послуга знову стане доступною для використання. Ви точно хочете виконати цю дію?'"
      :confirm-label="togglingService?.is_active ? 'Так, деактивувати' : 'Так, активувати'"
      :context-items="toggleContextItems"
      :pending="togglePending"
      :destructive="Boolean(togglingService?.is_active)"
      @confirm="confirmToggleService"
      @update:model-value="handleToggleConfirmUpdate"
    />
  </div>
</template>
