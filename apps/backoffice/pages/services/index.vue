<script setup lang="ts">
import { CheckCircleIcon, FunnelIcon, LanguageIcon, NoSymbolIcon, PencilIcon, PlusIcon, TagIcon } from '@heroicons/vue/24/outline'
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
const activeStatusOptions = [
  { value: '', label: 'Будь-який статус' },
  { value: 'true', label: 'Активні' },
  { value: 'false', label: 'Неактивні' },
]
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
        <p class="ui-eyebrow text-xs uppercase tracking-[0.22em] xl:text-sm xl:tracking-[0.3em]">Послуги</p>
        <h1 class="mt-1 text-2xl font-semibold text-ui-primary xl:mt-2 xl:text-3xl">Базові послуги</h1>
      </div>
      <BaseButton type="button" variant="create" size="sm" class="w-full sm:w-auto" @click="openCreateService">
        <PlusIcon class="h-4 w-4" aria-hidden="true" />
        Створити базову послугу
      </BaseButton>
    </div>

    <BaseCard as="section" padding="sm" class="space-y-3 xl:space-y-4">
      <div class="grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <BaseInput v-model="filters.search" placeholder="Пошук базових послуг" />
        <BaseSelect v-model="filters.is_active" :options="activeStatusOptions" menu-class="z-[220]" />
        <BaseButton variant="primary" @click="applyFilters">
          <FunnelIcon class="h-4 w-4" aria-hidden="true" />
          <span>Застосувати</span>
        </BaseButton>
      </div>
      <p v-if="error" class="ui-status-danger rounded-xl px-3 py-2 text-xs xl:rounded-2xl xl:px-4 xl:py-3 xl:text-sm">
        {{ apiErrorMessage(error, 'Не вдалося завантажити базові послуги з /backoffice/admin/services.') }}
      </p>
      <BaseCard variant="subtle" padding="sm" class="text-xs text-ui-secondary xl:text-sm">Total: {{ total }}</BaseCard>
      <BaseTable
        dense
        caption="Базові послуги"
        table-class="service-table"
        min-width="52rem"
        :loading="pending"
        loading-label="Завантаження базових послуг…"
        :empty="!services.length"
        empty-title="Базових послуг не знайдено"
      >
        <template #head>
          <tr class="text-xs uppercase">
            <th>Назва</th>
            <th>Тривалість</th>
            <th>Ціна</th>
            <th>Статус</th>
            <th><span class="sr-only">Дії</span></th>
          </tr>
        </template>
            <tr v-for="service in services" :key="service.id">
              <td data-label="Назва" class="service-name-cell px-3 py-2.5">
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
              <td data-label="Тривалість" class="text-ui-secondary">{{ formatDuration(service.duration_minutes) }}</td>
              <td data-label="Ціна" class="text-ui-secondary">{{ formatPrice(service.price) }}</td>
              <td data-label="Статус" class="px-3 py-2.5">
                <BaseBadge :tone="service.is_active ? 'success' : 'neutral'">
                  {{ service.is_active ? 'активний' : 'неактивний' }}
                </BaseBadge>
              </td>
              <td class="service-actions px-3 py-2.5">
                <div class="flex flex-wrap gap-1.5">
                  <BaseButton
                    variant="icon"
                    class="h-7 w-7"
                    aria-label="Редагувати базову послугу"
                    title="Редагувати"
                    @click="editService(service)"
                  >
                    <PencilIcon class="h-3.5 w-3.5" aria-hidden="true" />
                    <span class="sr-only">Редагувати</span>
                  </BaseButton>
                  <BaseButton
                    variant="icon"
                    class="h-7 w-7"
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
                  </BaseButton>
                  <BaseButton
                    variant="danger-icon"
                    class="h-7 w-7 p-0"
                    :disabled="deletingId === service.id || !service.is_active"
                    :aria-label="deletingId === service.id ? 'Деактивація базової послуги' : 'Видалити базову послугу'"
                    :title="deletingId === service.id ? 'Деактивація...' : 'Видалити'"
                    @click="deleteService(service)"
                  >
                    <TrashIcon class="h-3.5 w-3.5" aria-hidden="true" />
                    <span class="sr-only">{{ deletingId === service.id ? 'Деактивація...' : 'Видалити' }}</span>
                  </BaseButton>
                </div>
              </td>
            </tr>
      </BaseTable>
    </BaseCard>

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
