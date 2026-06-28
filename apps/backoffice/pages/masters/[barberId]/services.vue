<script setup lang="ts">
import { CheckCircleIcon, NoSymbolIcon, PencilIcon, PlusIcon, TrashIcon } from '@heroicons/vue/24/outline'
import type { MasterService, BaseService, Master } from '~/composables/useBackofficeApi'

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
const toast = useBaseToastNotification()
const {
  masterName,
  formatDuration,
  formatPrice,
  normalizeItems,
  serviceName,
  serviceNameEn,
  serviceDescriptionUk,
  serviceDescriptionEn,
  apiErrorMessage,
} = useBookingFormatting()

const barberId = computed(() => String(route.params.barberId))
const { data: masters } = await useAsyncData('admin-barber-service-master-options', () => api.adminGetMasters(1, 200))
const masterOptions = computed<Master[]>(() => normalizeItems(masters.value))
const selectedMaster = computed(() => masterOptions.value.find(master => String(master.id) === barberId.value) || null)

const editing = ref<MasterService | null>(null)
const deletingId = ref<number | string | null>(null)
const syncPending = ref(false)
const serviceModalOpen = ref(false)
const togglingService = ref<MasterService | null>(null)
const togglePending = ref(false)

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

const openCreateService = () => {
  editing.value = null
  serviceModalOpen.value = true
}

const editService = (service: MasterService) => {
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
    { label: 'Майстер', value: selectedMaster.value ? masterName(selectedMaster.value) : `#${barberId.value}` },
    { label: 'Послуга', value: serviceName(togglingService.value) },
    { label: 'Поточний статус', value: togglingService.value.is_active ? 'активна' : 'неактивна' },
    { label: 'Новий статус', value: togglingService.value.is_active ? 'неактивна' : 'активна' },
  ]
})

const openToggleServiceConfirm = (service: MasterService) => {
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
    await api.updateMasterService(barberId.value, service.id, { is_active: !service.is_active })
    toast.success('Статус послуги майстра оновлено.')
    togglingService.value = null
    await refresh()
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося оновити статус послуги майстра.'))
  }
  finally {
    togglePending.value = false
  }
}

const deleteService = async (service: MasterService) => {
  if (!confirm(`Disable service "${serviceName(service)}" for this barber? It will be removed from активний lists but kept in history.`)) return

  deletingId.value = service.id
  try {
    await api.deleteMasterService(barberId.value, service.id)
    toast.success('Послугу майстра вимкнено.')
    if (editing.value?.id === service.id) {
      editing.value = null
      serviceModalOpen.value = false
    }
    await refresh()
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося видалити послугу майстра.'))
  }
  finally {
    deletingId.value = null
  }
}

const syncDefaults = async () => {
  syncPending.value = true
  try {
    const result = await api.syncDefaultMasterServices(barberId.value)
    toast.success(`Synced ${result.created_count} missing default service${result.created_count === 1 ? '' : 's'}. Existing custom names and prices were not overwritten.`)
    await refresh()
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося синхронізувати типові послуги.'))
  }
  finally {
    syncPending.value = false
  }
}

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
      <div class="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <BaseButton type="button" class="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white" @click="openCreateService">
          <PlusIcon class="h-4 w-4" aria-hidden="true" />
          Створити послугу майстра
        </BaseButton>
        <BaseButton :disabled="syncPending" class="rounded-full border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 disabled:opacity-60" @click="syncDefaults">
          {{ syncPending ? 'Синхронізація...' : 'Синхронізувати відсутні типові послуги' }}
        </BaseButton>
      </div>
    </div>
    <p class="rounded-2xl bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
      Синхронізація додає лише відсутні активні базові послуги для цього майстра. Вона не перезаписує власні назви, ціни, тривалість або описи наявних послуг майстра.
    </p>

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
                <td data-label="Назва" class="px-4 py-3">
                  <p class="font-medium text-slate-900">{{ serviceName(service) }}</p>
                  <p class="mt-1 text-xs text-slate-500">{{ serviceDescriptionUk(service) || 'Без опису' }}</p>
                  <p class="mt-2 text-xs font-medium text-slate-700">{{ serviceNameEn(service) || 'Без англійської назви' }}</p>
                  <p class="mt-1 text-xs text-slate-500">{{ serviceDescriptionEn(service) || 'Без опису англійською' }}</p>
                </td>
                <td data-label="Тривалість" class="px-4 py-3 text-slate-700">{{ formatDuration(service.duration_minutes) }}</td>
                <td data-label="Ціна" class="px-4 py-3 text-slate-700">{{ formatPrice(service.price) }}</td>
                <td data-label="Джерело" class="px-4 py-3">
                  <span class="rounded-full px-3 py-1 text-xs font-medium" :class="service.source_type === 'base' ? 'bg-cyan-50 text-cyan-700' : 'bg-slate-100 text-slate-600'">
                    {{ service.source_type }}
                  </span>
                </td>
                <td data-label="Базова послуга" class="px-4 py-3 text-slate-500">
                  {{ service.base_service ? `${serviceName(service.base_service)} #${service.base_service.id}` : '-' }}
                </td>
                <td data-label="Статус" class="px-4 py-3">
                  <span class="rounded-full px-3 py-1 text-xs font-medium" :class="service.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">
                    {{ service.is_active ? 'активний' : 'неактивний' }}
                  </span>
                </td>
                <td data-label="Дії" class="px-4 py-3">
                  <div class="flex flex-wrap gap-2">
                    <BaseButton
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50"
                      aria-label="Редагувати послугу майстра"
                      title="Редагувати"
                      @click="editService(service)"
                    >
                      <PencilIcon class="h-4 w-4" aria-hidden="true" />
                      <span class="sr-only">Редагувати</span>
                    </BaseButton>
                    <BaseButton
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50"
                      :aria-label="service.is_active ? 'Деактивувати послугу майстра' : 'Активувати послугу майстра'"
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
                    </BaseButton>
                    <BaseButton
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                      :disabled="deletingId === service.id || !service.is_active"
                      :aria-label="deletingId === service.id ? 'Вимкнення послуги майстра' : 'Видалити послугу майстра'"
                      :title="deletingId === service.id ? 'Вимкнення...' : 'Видалити'"
                      @click="deleteService(service)"
                    >
                      <TrashIcon class="h-4 w-4" aria-hidden="true" />
                      <span class="sr-only">{{ deletingId === service.id ? 'Вимкнення...' : 'Видалити' }}</span>
                    </BaseButton>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
    </section>

    <MasterServiceFormModal
      :model-value="serviceModalOpen"
      :barber-id="barberId"
      :service="editing"
      :base-service-options="baseServiceOptions"
      @saved="handleServiceSaved"
      @update:model-value="handleServiceModalUpdate"
    />
    <ConfirmActionModal
      :model-value="Boolean(togglingService)"
      :title="togglingService?.is_active ? 'Деактивувати послугу майстра?' : 'Активувати послугу майстра?'"
      :message="togglingService?.is_active ? 'Ця послуга стане неактивною саме для вибраного майстра. Історія записів збережеться. Ви точно хочете виконати цю дію?' : 'Ця послуга знову стане активною для вибраного майстра. Ви точно хочете виконати цю дію?'"
      :confirm-label="togglingService?.is_active ? 'Так, деактивувати' : 'Так, активувати'"
      :context-items="toggleContextItems"
      :pending="togglePending"
      :destructive="Boolean(togglingService?.is_active)"
      @confirm="confirmToggleService"
      @update:model-value="handleToggleConfirmUpdate"
    />
  </div>
</template>
