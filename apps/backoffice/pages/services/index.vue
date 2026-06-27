<script setup lang="ts">
import { CheckCircleIcon, FunnelIcon, LanguageIcon, NoSymbolIcon, PencilIcon, PlusIcon, TagIcon, TrashIcon } from '@heroicons/vue/24/outline'
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
const toast = useBaseToastNotification()
const {
  formatDuration,
  formatPrice,
  normalizeItems,
  normalizeTotal,
  serviceName,
  serviceNameEn,
  serviceDescriptionUk,
  serviceDescriptionEn,
  apiErrorMessage,
} = useBookingFormatting()

const page = ref(1)
const pageSize = 100
const filters = reactive({ search: '', is_active: '' })
const editing = ref<BaseService | null>(null)
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
  serviceModalOpen.value = true
}

const editService = (service: BaseService) => {
  editing.value = service
  serviceModalOpen.value = true
}

const handleServiceSaved = async (message: string) => {
  toast.success(message)
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
    { label: 'Послуга', value: serviceName(togglingService.value) },
    { label: 'Поточний статус', value: togglingService.value.is_active ? 'активна' : 'неактивна' },
    { label: 'Новий статус', value: togglingService.value.is_active ? 'неактивна' : 'активна' },
  ]
})

const openToggleServiceConfirm = (service: BaseService) => {
  togglingService.value = service
}

const handleToggleConfirmUpdate = (value: boolean) => {
  if (!value && !togglePending.value) togglingService.value = null
}

const confirmToggleService = async () => {
  const service = togglingService.value
  if (!service) return

  togglePending.value = true
  try {
    await api.adminUpdateBaseService(service.id, { is_active: !service.is_active })
    toast.success('Статус базової послуги оновлено.')
    togglingService.value = null
    await refresh()
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося оновити статус базової послуги.'))
  }
  finally {
    togglePending.value = false
  }
}

const deleteService = async (service: BaseService) => {
  if (!confirm(`Деактивувати base service "${serviceName(service)}"? Existing barber services keep their custom values.`)) return

  deletingId.value = service.id
  try {
    await api.adminDeleteBaseService(service.id)
    toast.success('Базову послугу деактивовано.')
    if (editing.value?.id === service.id) editing.value = null
    await refresh()
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося видалити базову послугу.'))
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
  <div class="space-y-4 xl:space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-xs uppercase tracking-[0.22em] text-cyan-700 xl:text-sm xl:tracking-[0.3em]">Послуги</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900 xl:mt-2 xl:text-3xl">Базові послуги</h1>
      </div>
      <button type="button" class="backoffice-page-create-button inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition sm:w-auto xl:min-h-10 xl:gap-2 xl:px-4 xl:py-2.5 xl:text-sm" @click="openCreateService">
        <PlusIcon class="h-4 w-4" aria-hidden="true" />
        Створити базову послугу
      </button>
    </div>

    <section class="space-y-3 rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm xl:space-y-4 xl:rounded-[1.5rem] xl:p-4">
      <div class="grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <input v-model="filters.search" placeholder="Пошук базових послуг" class="rounded-xl border border-slate-300 px-3 py-2.5 text-sm xl:rounded-2xl xl:px-4">
        <select v-model="filters.is_active" class="rounded-xl border border-slate-300 px-3 py-2.5 text-sm xl:rounded-2xl xl:px-4">
          <option value="">Будь-який статус</option>
          <option value="true">Активні</option>
          <option value="false">Неактивні</option>
        </select>
        <button class="backoffice-modal-action-button backoffice-modal-action-primary" @click="applyFilters">
          <FunnelIcon class="h-4 w-4" aria-hidden="true" />
          <span>Застосувати</span>
        </button>
      </div>
      <p v-if="error" class="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600 xl:rounded-2xl xl:px-4 xl:py-3 xl:text-sm">
        {{ apiErrorMessage(error, 'Не вдалося завантажити базові послуги з /backoffice/admin/services.') }}
      </p>
      <p class="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 xl:text-sm">Total: {{ total }}</p>
      <div v-if="pending" class="text-xs text-slate-500 xl:text-sm">Завантаження базових послуг...</div>
      <div v-else-if="!services.length" class="text-xs text-slate-500 xl:text-sm">Базових послуг не знайдено.</div>
      <div v-else class="overflow-x-auto">
        <table class="service-table min-w-full divide-y divide-slate-100 text-left text-sm">
          <thead class="text-xs uppercase text-slate-500">
            <tr>
              <th class="px-3 py-2.5 font-medium">Назва</th>
              <th class="px-3 py-2.5 font-medium">Тривалість</th>
              <th class="px-3 py-2.5 font-medium">Ціна</th>
              <th class="px-3 py-2.5 font-medium">Статус</th>
              <th class="px-3 py-2.5 font-medium"><span class="sr-only">Дії</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="service in services" :key="service.id">
              <td data-label="Назва" class="service-name-cell px-3 py-2.5">
                <div class="min-w-0 text-left">
                  <p class="flex min-w-0 items-start gap-1.5 font-medium leading-snug text-slate-900">
                    <TagIcon class="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-700" aria-hidden="true" />
                    <span class="min-w-0 break-words">{{ serviceName(service) }}</span>
                  </p>
                  <p class="mt-0.5 break-words text-xs leading-5 text-slate-500">{{ serviceDescriptionUk(service) || 'Без опису' }}</p>
                  <p class="mt-1.5 flex min-w-0 items-start gap-1.5 text-xs font-medium leading-5 text-slate-700">
                    <LanguageIcon class="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                    <span class="min-w-0 break-words">{{ serviceNameEn(service) || 'Без англійської назви' }}</span>
                  </p>
                  <p class="mt-0.5 break-words text-xs leading-5 text-slate-500">{{ serviceDescriptionEn(service) || 'Без опису англійською' }}</p>
                </div>
              </td>
              <td data-label="Тривалість" class="px-3 py-2.5 text-slate-700">{{ formatDuration(service.duration_minutes) }}</td>
              <td data-label="Ціна" class="px-3 py-2.5 text-slate-700">{{ formatPrice(service.price) }}</td>
              <td data-label="Статус" class="px-3 py-2.5">
                <span class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="service.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">
                  {{ service.is_active ? 'активний' : 'неактивний' }}
                </span>
              </td>
              <td class="service-actions px-3 py-2.5">
                <div class="flex flex-wrap gap-1.5">
                  <button
                    class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50"
                    aria-label="Редагувати базову послугу"
                    title="Редагувати"
                    @click="editService(service)"
                  >
                    <PencilIcon class="h-3.5 w-3.5" aria-hidden="true" />
                    <span class="sr-only">Редагувати</span>
                  </button>
                  <button
                    class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50"
                    :aria-label="service.is_active ? 'Деактивувати базову послугу' : 'Активувати базову послугу'"
                    :title="service.is_active ? 'Деактивувати' : 'Активувати'"
                    @click="openToggleServiceConfirm(service)"
                  >
                    <template v-if="service.is_active">
                      <NoSymbolIcon class="h-3.5 w-3.5" aria-hidden="true" />
                      <span class="sr-only">Деактивувати</span>
                    </template>
                    <template v-else>
                      <CheckCircleIcon class="h-3.5 w-3.5" aria-hidden="true" />
                      <span class="sr-only">Активувати</span>
                    </template>
                  </button>
                  <button
                    class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-200 text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                    :disabled="deletingId === service.id || !service.is_active"
                    :aria-label="deletingId === service.id ? 'Деактивація базової послуги' : 'Видалити базову послугу'"
                    :title="deletingId === service.id ? 'Деактивація...' : 'Видалити'"
                    @click="deleteService(service)"
                  >
                    <TrashIcon class="h-3.5 w-3.5" aria-hidden="true" />
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
