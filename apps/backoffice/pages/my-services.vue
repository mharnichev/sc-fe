<script setup lang="ts">
import { CheckCircleIcon, LanguageIcon, NoSymbolIcon, PencilIcon, PlusIcon, TagIcon } from '@heroicons/vue/24/outline'
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
      <BaseButton type="button" :disabled="!isBarber || !barberId" class="backoffice-page-create-button inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium disabled:opacity-60 sm:w-auto xl:min-h-11 xl:gap-2 xl:px-5 xl:py-3 xl:text-sm" @click="openCreateService">
        <PlusIcon class="h-4 w-4" aria-hidden="true" />
        Створити послугу
      </BaseButton>
    </div>

    <p v-if="!isBarber || !barberId" class="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700 xl:rounded-2xl xl:px-4 xl:py-3 xl:text-sm">
      Для керування особистими послугами потрібен доступ до профілю майстра.
    </p>

    <section class="space-y-3 rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm xl:space-y-4 xl:rounded-[1.5rem] xl:p-4">
      <p v-if="error" class="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600 xl:rounded-2xl xl:px-4 xl:py-3 xl:text-sm">
        {{ apiErrorMessage(error, 'Не вдалося завантажити послуги майстра.') }}
      </p>
      <BaseTable
        dense
        caption="Мої послуги"
        table-class="service-table"
        min-width="68rem"
        :loading="pending"
        loading-label="Завантаження послуг…"
        :empty="!services.length"
        empty-title="Послуг не знайдено"
      >
        <template #head>
            <tr>
              <th>Назва</th>
              <th>Тривалість</th>
              <th>Ціна</th>
              <th>Джерело</th>
              <th>Базова послуга</th>
              <th>Статус</th>
              <th><span class="sr-only">Дії</span></th>
            </tr>
        </template>
            <tr v-for="service in services" :key="service.id">
              <td class="service-name-cell">
                <div class="min-w-0 text-left">
                  <p class="flex min-w-0 items-start gap-1.5 font-medium leading-snug text-ui-primary">
                    <TagIcon class="mt-0.5 h-3.5 w-3.5 shrink-0 text-ui-accent" aria-hidden="true" />
                    <span class="min-w-0 break-words">{{ serviceName(service) }}</span>
                  </p>
                  <p class="mt-0.5 break-words text-xs leading-5 text-ui-muted">{{ serviceDescriptionUk(service) || 'Без опису' }}</p>
                  <p class="mt-1.5 flex min-w-0 items-start gap-1.5 text-xs font-medium leading-5 text-ui-secondary">
                    <LanguageIcon class="mt-0.5 h-3.5 w-3.5 shrink-0 text-ui-muted" aria-hidden="true" />
                    <span class="min-w-0 break-words">{{ serviceNameEn(service) || 'Без англійської назви' }}</span>
                  </p>
                  <p class="mt-0.5 break-words text-xs leading-5 text-ui-muted">{{ serviceDescriptionEn(service) || 'Без опису англійською' }}</p>
                </div>
              </td>
              <td class="text-ui-secondary">{{ formatDuration(service.duration_minutes) }}</td>
              <td class="text-ui-secondary">{{ formatPrice(service.price) }}</td>
              <td>
                <BaseBadge :tone="service.source_type === 'base' ? 'info' : 'neutral'">
                  {{ service.source_type }}
                </BaseBadge>
              </td>
              <td class="text-ui-muted">
                {{ service.base_service ? `${serviceName(service.base_service)} #${service.base_service.id}` : '-' }}
              </td>
              <td>
                <BaseBadge :tone="service.is_active ? 'success' : 'neutral'">
                  {{ service.is_active ? 'активний' : 'неактивний' }}
                </BaseBadge>
              </td>
              <td class="service-actions">
                <div class="flex flex-wrap gap-1.5">
                  <BaseButton
                    variant="icon"
                    class="h-7 w-7"
                    aria-label="Редагувати послугу"
                    title="Редагувати"
                    @click="editService(service)"
                  >
                    <PencilIcon class="h-3.5 w-3.5" aria-hidden="true" />
                    <span class="sr-only">Редагувати</span>
                  </BaseButton>
                  <BaseButton
                    variant="icon"
                    class="h-7 w-7"
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
                  </BaseButton>
                  <BaseButton
                    variant="danger-icon"
                    class="h-7 w-7 p-0"
                    :disabled="deletingId === service.id || !service.is_active"
                    :aria-label="deletingId === service.id ? 'Вимкнення послуги' : 'Видалити послугу'"
                    :title="deletingId === service.id ? 'Вимкнення...' : 'Видалити'"
                    @click="deleteService(service)"
                  >
                    <TrashIcon class="h-3.5 w-3.5" aria-hidden="true" />
                    <span class="sr-only">{{ deletingId === service.id ? 'Вимкнення...' : 'Видалити' }}</span>
                  </BaseButton>
                </div>
              </td>
            </tr>
      </BaseTable>
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
