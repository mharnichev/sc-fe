<script setup lang="ts">
import { CheckCircleIcon, LanguageIcon, NoSymbolIcon, PencilIcon, PlusIcon, TagIcon, TrashIcon } from '@heroicons/vue/24/outline'
import type { MasterService, BaseService, Master } from '~/composables/useBackofficeApi'

const api = useBackofficeApi()
const auth = useAuthStore()
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
  serviceModalOpen.value = true
}

const editService = (service: MasterService) => {
  if (!barberId.value) return
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
    { label: 'Майстер', value: linkedMaster.value ? masterName(linkedMaster.value) : 'Ваш профіль майстра' },
    { label: 'Послуга', value: serviceName(togglingService.value) },
    { label: 'Поточний статус', value: togglingService.value.is_active ? 'активна' : 'неактивна' },
    { label: 'Новий статус', value: togglingService.value.is_active ? 'неактивна' : 'активна' },
  ]
})

const openToggleServiceConfirm = (service: MasterService) => {
  if (!barberId.value) return
  togglingService.value = service
}

const handleToggleConfirmUpdate = (value: boolean) => {
  if (!value && !togglePending.value) togglingService.value = null
}

const confirmToggleService = async () => {
  const service = togglingService.value
  if (!service || !barberId.value) return

  togglePending.value = true
  try {
    await api.updateMyService(service.id, { is_active: !service.is_active })
    toast.success('Статус послуги оновлено.')
    togglingService.value = null
    await refresh()
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося оновити статус послуги.'))
  }
  finally {
    togglePending.value = false
  }
}

const deleteService = async (service: MasterService) => {
  if (!barberId.value || !confirm(`Disable service "${serviceName(service)}"? It will be removed from активний lists but kept in history.`)) return

  deletingId.value = service.id
  try {
    await api.deleteMasterService(barberId.value, service.id)
    toast.success('Послугу вимкнено.')
    if (editing.value?.id === service.id) {
      editing.value = null
      serviceModalOpen.value = false
    }
    await refresh()
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося видалити послугу.'))
  }
  finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div class="space-y-3 xl:space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3 xl:gap-4">
      <div>
        <p class="text-xs uppercase tracking-[0.22em] text-cyan-700 xl:text-sm xl:tracking-[0.3em]">Майстер</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900 xl:mt-2 xl:text-3xl">Мої послуги</h1>
        <p v-if="linkedMaster" class="mt-1 text-xs text-slate-500 xl:mt-2 xl:text-sm">{{ masterName(linkedMaster) }}</p>
      </div>
      <button type="button" :disabled="!isBarber || !barberId" class="backoffice-page-create-button inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium disabled:opacity-60 sm:w-auto xl:min-h-11 xl:gap-2 xl:px-5 xl:py-3 xl:text-sm" @click="openCreateService">
        <PlusIcon class="h-4 w-4" aria-hidden="true" />
        Створити послугу
      </button>
    </div>

    <p v-if="!isBarber || !barberId" class="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700 xl:rounded-2xl xl:px-4 xl:py-3 xl:text-sm">
      Для керування особистими послугами потрібен доступ до профілю майстра.
    </p>

    <section class="space-y-3 rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm xl:space-y-4 xl:rounded-[1.5rem] xl:p-4">
      <p v-if="error" class="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600 xl:rounded-2xl xl:px-4 xl:py-3 xl:text-sm">
        {{ apiErrorMessage(error, 'Не вдалося завантажити послуги майстра.') }}
      </p>
      <div v-if="pending" class="text-xs text-slate-500 xl:text-sm">Завантаження послуг...</div>
      <div v-else-if="!services.length" class="text-xs text-slate-500 xl:text-sm">Послуг не знайдено.</div>
      <div v-else>
        <div class="grid gap-1.5 xl:hidden">
          <article
            v-for="service in services"
            :key="service.id"
            class="rounded-xl border border-slate-200 bg-white px-2.5 py-2 shadow-sm"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="flex min-w-0 items-start gap-1.5 break-words text-sm font-semibold leading-snug text-slate-900">
                  <TagIcon class="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-700" aria-hidden="true" />
                  <span class="min-w-0 break-words">{{ serviceName(service) }}</span>
                </p>
                <p class="mt-0.5 line-clamp-2 break-words text-xs leading-5 text-slate-500">{{ serviceDescriptionUk(service) || 'Без опису' }}</p>
                <span v-if="service.is_army_client" class="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[0.68rem] font-medium text-amber-700">
                  Для військових
                </span>
              </div>
              <span class="shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-medium" :class="service.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">
                {{ service.is_active ? 'активна' : 'неактивна' }}
              </span>
            </div>

            <div class="mt-1.5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-1.5 text-xs text-slate-600">
              <div class="min-w-0 rounded-lg bg-slate-50 px-2 py-1">
                <span class="block truncate text-[0.65rem] uppercase tracking-[0.04em] text-slate-400">Тривалість</span>
                <span class="block min-w-0 truncate font-medium text-slate-800">{{ formatDuration(service.duration_minutes) }}</span>
              </div>
              <div class="min-w-0 rounded-lg bg-slate-50 px-2 py-1">
                <span class="block truncate text-[0.65rem] uppercase tracking-[0.04em] text-slate-400">Ціна</span>
                <span class="block min-w-0 truncate font-medium text-slate-800">{{ formatPrice(service.price) }}</span>
              </div>
            </div>

            <div class="mt-1.5 flex items-center justify-between gap-2">
              <span class="min-w-0 truncate rounded-full px-2 py-0.5 text-[0.68rem] font-medium" :class="service.source_type === 'base' ? 'bg-cyan-50 text-cyan-700' : 'bg-slate-100 text-slate-600'">
                {{ service.source_type === 'base' ? 'Базова' : service.source_type }}
              </span>
              <div class="flex shrink-0 gap-1.5">
                <button
                  class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50"
                  aria-label="Редагувати послугу"
                  title="Редагувати"
                  @click="editService(service)"
                >
                  <PencilIcon class="h-3.5 w-3.5" aria-hidden="true" />
                  <span class="sr-only">Редагувати</span>
                </button>
                <button
                  class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50"
                  :aria-label="service.is_active ? 'Деактивувати послугу' : 'Активувати послугу'"
                  :title="service.is_active ? 'Деактивувати' : 'Активувати'"
                  @click="openToggleServiceConfirm(service)"
                >
                  <NoSymbolIcon v-if="service.is_active" class="h-3.5 w-3.5" aria-hidden="true" />
                  <CheckCircleIcon v-else class="h-3.5 w-3.5" aria-hidden="true" />
                  <span class="sr-only">{{ service.is_active ? 'Деактивувати' : 'Активувати' }}</span>
                </button>
                <button
                  class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-200 text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                  :disabled="deletingId === service.id || !service.is_active"
                  :aria-label="deletingId === service.id ? 'Вимкнення послуги' : 'Видалити послугу'"
                  :title="deletingId === service.id ? 'Вимкнення...' : 'Видалити'"
                  @click="deleteService(service)"
                >
                  <TrashIcon class="h-3.5 w-3.5" aria-hidden="true" />
                  <span class="sr-only">{{ deletingId === service.id ? 'Вимкнення...' : 'Видалити' }}</span>
                </button>
              </div>
            </div>
          </article>
        </div>
        <div class="hidden overflow-x-auto xl:block">
          <table class="service-table min-w-full divide-y divide-slate-100 text-left text-sm">
          <thead class="text-xs uppercase text-slate-500">
            <tr>
              <th class="px-3 py-2.5 font-medium">Назва</th>
              <th class="px-3 py-2.5 font-medium">Тривалість</th>
              <th class="px-3 py-2.5 font-medium">Ціна</th>
              <th class="px-3 py-2.5 font-medium">Джерело</th>
              <th class="px-3 py-2.5 font-medium">Базова послуга</th>
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
                  <span v-if="service.is_army_client" class="mt-2 inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                    Для військових
                  </span>
                </div>
              </td>
              <td data-label="Тривалість" class="px-3 py-2.5 text-slate-700">{{ formatDuration(service.duration_minutes) }}</td>
              <td data-label="Ціна" class="px-3 py-2.5 text-slate-700">{{ formatPrice(service.price) }}</td>
              <td data-label="Джерело" class="px-3 py-2.5">
                <span class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="service.source_type === 'base' ? 'bg-cyan-50 text-cyan-700' : 'bg-slate-100 text-slate-600'">
                  {{ service.source_type }}
                </span>
              </td>
              <td data-label="Базова послуга" class="px-3 py-2.5 text-slate-500">
                {{ service.base_service ? `${serviceName(service.base_service)} #${service.base_service.id}` : '-' }}
              </td>
              <td data-label="Статус" class="px-3 py-2.5">
                <span class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="service.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">
                  {{ service.is_active ? 'активний' : 'неактивний' }}
                </span>
              </td>
              <td class="service-actions px-3 py-2.5">
                <div class="flex flex-wrap gap-1.5">
                  <button
                    class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50"
                    aria-label="Редагувати послугу"
                    title="Редагувати"
                    @click="editService(service)"
                  >
                    <PencilIcon class="h-3.5 w-3.5" aria-hidden="true" />
                    <span class="sr-only">Редагувати</span>
                  </button>
                  <button
                    class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50"
                    :aria-label="service.is_active ? 'Деактивувати послугу' : 'Активувати послугу'"
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
                    :aria-label="deletingId === service.id ? 'Вимкнення послуги' : 'Видалити послугу'"
                    :title="deletingId === service.id ? 'Вимкнення...' : 'Видалити'"
                    @click="deleteService(service)"
                  >
                    <TrashIcon class="h-3.5 w-3.5" aria-hidden="true" />
                    <span class="sr-only">{{ deletingId === service.id ? 'Вимкнення...' : 'Видалити' }}</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
          </table>
        </div>
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
