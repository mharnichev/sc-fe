<script setup lang="ts">
import { CheckCircleIcon, NoSymbolIcon, PencilIcon, PlusIcon, TrashIcon } from '@heroicons/vue/24/outline'
import type { MasterService, BaseService, Master } from '~/composables/useBackofficeApi'

const api = useBackofficeApi()
const auth = useAuthStore()
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

const { data: publicMasters } = await useAsyncData('my-services-master-options', () => api.getPublicMasters())
const masterList = computed<Master[]>(() => publicMasters.value || [])
const { isBarber, linkedMaster } = useBackofficeAccess(masterList)
const barberId = computed(() => linkedMaster.value?.id || auth.user?.master_id || null)

definePageMeta({
  middleware: () => {
    const auth = useAuthStore()
    if (auth.user?.is_superuser || auth.user?.role === 'admin') {
      return navigateTo('/services')
    }
  },
})

const editing = ref<MasterService | null>(null)
const formError = ref('')
const successMessage = ref('')
const deletingId = ref<number | string | null>(null)
const serviceModalOpen = ref(false)
const togglingService = ref<MasterService | null>(null)
const togglePending = ref(false)

const [{ data, pending, error, refresh }, { data: baseServiceData }] = await Promise.all([
  useAsyncData(
    'my-barber-services',
    () => barberId.value ? api.getMyServices() : Promise.resolve([] as MasterService[]),
    { watch: [barberId] },
  ),
  useAsyncData('my-services-base-options', async () => {
    try {
      return await api.adminGetBaseServices(1, 200, { is_active: true })
    }
    catch {
      return [] as BaseService[]
    }
  }),
])

const services = computed(() => normalizeItems(data.value))
const baseServiceOptions = computed(() => normalizeItems(baseServiceData.value).filter(service => service.is_active))

const openCreateService = () => {
  if (!barberId.value) return
  editing.value = null
  formError.value = ''
  successMessage.value = ''
  serviceModalOpen.value = true
}

const editService = (service: MasterService) => {
  if (!barberId.value) return
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
    { label: 'Майстер', value: linkedMaster.value ? masterName(linkedMaster.value) : 'Ваш профіль майстра' },
    { label: 'Послуга', value: serviceName(togglingService.value) },
    { label: 'Поточний статус', value: togglingService.value.is_active ? 'активна' : 'неактивна' },
    { label: 'Новий статус', value: togglingService.value.is_active ? 'неактивна' : 'активна' },
  ]
})

const openToggleServiceConfirm = (service: MasterService) => {
  if (!barberId.value) return
  formError.value = ''
  successMessage.value = ''
  togglingService.value = service
}

const handleToggleConfirmUpdate = (value: boolean) => {
  if (!value && !togglePending.value) togglingService.value = null
}

const confirmToggleService = async () => {
  const service = togglingService.value
  if (!service || !barberId.value) return

  formError.value = ''
  successMessage.value = ''
  togglePending.value = true
  try {
    await api.updateMyService(service.id, { is_active: !service.is_active })
    successMessage.value = 'Статус послуги оновлено.'
    togglingService.value = null
    await refresh()
  }
  catch (cause) {
    formError.value = apiErrorMessage(cause, 'Не вдалося оновити статус послуги.')
  }
  finally {
    togglePending.value = false
  }
}

const deleteService = async (service: MasterService) => {
  if (!barberId.value || !confirm(`Disable service "${serviceName(service)}"? It will be removed from активний lists but kept in history.`)) return

  formError.value = ''
  successMessage.value = ''
  deletingId.value = service.id
  try {
    await api.deleteMasterService(barberId.value, service.id)
    successMessage.value = 'Послугу вимкнено.'
    if (editing.value?.id === service.id) {
      editing.value = null
      serviceModalOpen.value = false
    }
    await refresh()
  }
  catch (cause) {
    formError.value = apiErrorMessage(cause, 'Не вдалося видалити послугу.')
  }
  finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Майстер</p>
        <h1 class="mt-2 text-3xl font-semibold text-slate-900">Мої послуги</h1>
        <p v-if="linkedMaster" class="mt-2 text-sm text-slate-500">{{ masterName(linkedMaster) }}</p>
      </div>
      <button type="button" :disabled="!isBarber || !barberId" class="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60" @click="openCreateService">
        <PlusIcon class="h-4 w-4" aria-hidden="true" />
        Створити послугу
      </button>
    </div>

    <p v-if="!isBarber || !barberId" class="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
      Для керування особистими послугами потрібен доступ до профілю майстра.
    </p>

    <div class="space-y-3">
      <p v-if="formError" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{{ formError }}</p>
      <p v-if="successMessage" class="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ successMessage }}</p>
    </div>

    <section class="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
      <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ apiErrorMessage(error, 'Не вдалося завантажити послуги майстра.') }}
      </p>
      <div v-if="pending" class="text-sm text-slate-500">Завантаження послуг...</div>
      <div v-else-if="!services.length" class="text-sm text-slate-500">Послуг не знайдено.</div>
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
                  <button
                    class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50"
                    aria-label="Редагувати послугу"
                    title="Редагувати"
                    @click="editService(service)"
                  >
                    <PencilIcon class="h-4 w-4" aria-hidden="true" />
                    <span class="sr-only">Редагувати</span>
                  </button>
                  <button
                    class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50"
                    :aria-label="service.is_active ? 'Деактивувати послугу' : 'Активувати послугу'"
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
                    :aria-label="deletingId === service.id ? 'Вимкнення послуги' : 'Видалити послугу'"
                    :title="deletingId === service.id ? 'Вимкнення...' : 'Видалити'"
                    @click="deleteService(service)"
                  >
                    <TrashIcon class="h-4 w-4" aria-hidden="true" />
                    <span class="sr-only">{{ deletingId === service.id ? 'Вимкнення...' : 'Видалити' }}</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <MyServiceFormModal
      :model-value="serviceModalOpen"
      :barber-id="barberId"
      :service="editing"
      :base-service-options="baseServiceOptions"
      use-own-endpoint
      @saved="handleServiceSaved"
      @update:model-value="handleServiceModalUpdate"
    />
    <ConfirmActionModal
      :model-value="Boolean(togglingService)"
      :title="togglingService?.is_active ? 'Деактивувати послугу?' : 'Активувати послугу?'"
      :message="togglingService?.is_active ? 'Ця послуга стане неактивною у вашому профілі майстра. Історія записів збережеться. Ви точно хочете виконати цю дію?' : 'Ця послуга знову стане активною у вашому профілі майстра. Ви точно хочете виконати цю дію?'"
      :confirm-label="togglingService?.is_active ? 'Так, деактивувати' : 'Так, активувати'"
      :context-items="toggleContextItems"
      :pending="togglePending"
      :destructive="Boolean(togglingService?.is_active)"
      @confirm="confirmToggleService"
      @update:model-value="handleToggleConfirmUpdate"
    />
  </div>
</template>
