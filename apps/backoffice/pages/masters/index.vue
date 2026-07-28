<script setup lang="ts">
import { CheckCircleIcon, FunnelIcon, NoSymbolIcon, PencilIcon, PlusIcon } from '@heroicons/vue/24/outline'
import { initials } from '@shared-utils'
import type { Master } from '~/composables/useBackofficeApi'
import type { MasterRatingStatistics } from '~/types/reviews'
import { formatRating } from '~/utils/reviews'

const api = useBackofficeApi()
const auth = useAuthStore()
const assetUrl = useAssetUrl()
const toast = useBaseToastNotification()
const { masterName, serviceName, normalizeItems, normalizeTotal, apiErrorMessage } = useBookingFormatting()

const isAdmin = computed(() => Boolean(auth.user?.is_superuser || auth.user?.role === 'admin'))
const page = ref(1)
const pageSize = 100
const filters = reactive({ search: '', is_active: '' })
const activeStatusOptions = [
  { value: '', label: 'Будь-який статус' },
  { value: 'true', label: 'Активні' },
  { value: 'false', label: 'Неактивні' },
]
const editing = ref<Master | null>(null)
const masterModalOpen = ref(false)
const togglingMaster = ref<Master | null>(null)
const togglePending = ref(false)

const { data, pending, error, refresh } = await useAsyncData(
  'admin-masters',
  () => {
    if (!isAdmin.value) return Promise.resolve([] as Master[])
    return api.adminGetMasters(page.value, pageSize, {
      search: filters.search || undefined,
      is_active: filters.is_active === '' ? null : filters.is_active === 'true',
    })
  },
  { watch: [page] },
)
const { data: redirectMasters, refresh: refreshRedirectMasters } = await useAsyncData(
  'admin-master-redirect-options',
  () => isAdmin.value ? api.adminGetMasters(1, pageSize, { is_active: true }) : Promise.resolve([] as Master[]),
)
const { data: ratingData, error: ratingError, refresh: refreshRatings } = await useAsyncData(
  'admin-master-review-ratings',
  () => isAdmin.value ? api.adminGetMasterRatings() : Promise.resolve([] as MasterRatingStatistics[]),
)

const masters = computed(() => normalizeItems(data.value))
const allKnownMasters = computed(() => {
  const byId = new Map<number, Master>()
  for (const master of [...normalizeItems(redirectMasters.value), ...masters.value]) {
    byId.set(master.id, master)
  }
  return Array.from(byId.values())
})
const total = computed(() => normalizeTotal(data.value))
const ratingsByMaster = computed(() => new Map((ratingData.value || []).map(item => [item.master_id, item])))
const isMasterActive = (master: Master) => Boolean(master.is_active ?? master.status !== 'неактивний')
const masterRedirectId = (master: Master) => master.bookingRedirectMasterId ?? master.booking_redirect_master_id ?? null
const masterRedirectLabel = (master: Master) => {
  const redirectId = masterRedirectId(master)
  if (!redirectId) return ''
  const target = allKnownMasters.value.find(item => item.id === redirectId)
  return target ? masterName(target) : `Майстер #${redirectId}`
}
const masterImageUrl = (master: Master) =>
  assetUrl(master.avatar || master.avatar_url || master.photo || master.photo_url)
const masterInitials = (master: Master) => initials(masterName(master)) || 'SC'
const masterPositionLabel = (master: Master) =>
  master.position_uk || ({
    ambassador: 'Амбасадор',
    senior_master: 'Старший Майстер',
    master: 'Майстер',
  } as Record<string, string>)[master.position || ''] || 'Позицію не вказано'

const openCreateMaster = () => {
  editing.value = null
  masterModalOpen.value = true
}

const editMaster = (master: Master) => {
  editing.value = master
  masterModalOpen.value = true
}

const handleMasterSaved = async (message: string) => {
  toast.success(message)
  editing.value = null
  await refresh()
  await refreshRedirectMasters()
  await refreshRatings()
}

const handleMasterModalUpdate = (value: boolean) => {
  masterModalOpen.value = value
  if (!value) editing.value = null
}

const toggleContextItems = computed(() => {
  if (!togglingMaster.value) return []
  return [
    { label: 'Майстер', value: masterName(togglingMaster.value) },
    { label: 'Поточний статус', value: isMasterActive(togglingMaster.value) ? 'активний' : 'неактивний' },
    { label: 'Новий статус', value: isMasterActive(togglingMaster.value) ? 'неактивний' : 'активний' },
  ]
})

const openToggleMasterConfirm = (master: Master) => {
  if (!isAdmin.value) return
  togglingMaster.value = master
}

const handleToggleConfirmUpdate = (value: boolean) => {
  if (!value && !togglePending.value) togglingMaster.value = null
}

const confirmToggleMaster = async () => {
  const master = togglingMaster.value
  if (!master) return

  togglePending.value = true
  try {
    await api.adminUpdateMaster(master.id, { is_active: !isMasterActive(master) })
    toast.success('Статус майстра оновлено.')
    togglingMaster.value = null
    await refresh()
    await refreshRedirectMasters()
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося оновити статус майстра.'))
  }
  finally {
    togglePending.value = false
  }
}

const applyFilters = async () => {
  if (!isAdmin.value) return
  page.value = 1
  if (page.value === 1) await refresh()
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="ui-eyebrow text-sm uppercase tracking-[0.3em]">Адмін</p>
        <h1 class="mt-2 text-3xl font-semibold text-ui-primary">Майстри</h1>
      </div>
      <BaseButton
        type="button"
        variant="create"
        :disabled="!isAdmin"
        size="lg"
        class="w-full sm:w-auto"
        @click="openCreateMaster"
      >
        <PlusIcon class="h-4 w-4" aria-hidden="true" />
        Створити майстра
      </BaseButton>
    </div>

    <p v-if="!isAdmin" class="ui-status-warning rounded-2xl px-4 py-3 text-sm">
      Для керування майстрами потрібен доступ адміністратора.
    </p>

    <BaseCard as="section" padding="lg" class="space-y-5">
      <div class="grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <BaseInput v-model="filters.search" placeholder="Пошук майстрів" />
        <BaseSelect v-model="filters.is_active" :options="activeStatusOptions" menu-class="z-[220]" />
        <BaseButton variant="primary" @click="applyFilters">
          <FunnelIcon class="h-4 w-4" aria-hidden="true" />
          <span>Застосувати</span>
        </BaseButton>
      </div>
      <p v-if="error" class="ui-status-danger rounded-2xl px-4 py-3 text-sm">
        {{ apiErrorMessage(error, 'Не вдалося завантажити майстрів.') }}
      </p>
      <p v-if="ratingError" class="ui-status-warning rounded-2xl px-4 py-3 text-sm">Рейтинги майстрів недоступні: потрібен backend aggregate contract.</p>
      <BaseCard variant="subtle" padding="sm" class="text-sm text-ui-secondary">Total: {{ total }}</BaseCard>
      <BaseLoader v-if="pending" label="Завантаження майстрів…" />
      <BaseEmptyState v-else-if="!masters.length" compact title="Майстрів не знайдено" />
      <div v-else class="divide-y divide-ui">
        <article v-for="master in masters" :key="master.id" class="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center">
          <div class="flex items-start gap-3">
            <img
              v-if="masterImageUrl(master)"
              :src="masterImageUrl(master)"
              :alt="masterName(master)"
              class="h-14 w-14 shrink-0 rounded-2xl object-cover"
              loading="lazy"
            >
            <div v-else class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-ui-subtle text-sm font-semibold text-ui-muted">
              {{ masterInitials(master) }}
            </div>
            <div>
              <p class="font-medium text-ui-primary">{{ masterName(master) }}</p>
              <p class="text-sm text-ui-muted">{{ masterPositionLabel(master) }}</p>
              <p class="text-sm text-ui-muted">{{ master.phone || master.email || 'Без контактів' }}</p>
              <p v-if="masterRedirectId(master)" class="text-sm text-ui-muted">Онлайн-запис → {{ masterRedirectLabel(master) }}</p>
              <p class="text-xs text-ui-muted">{{ master.services?.map(service => serviceName(service)).join(', ') || 'Немає призначених послуг' }}</p>
              <p v-if="ratingsByMaster.get(master.id)" class="mt-2 text-xs text-ui-secondary">
                <span class="font-semibold ui-status-warning rounded-full px-2 py-0.5">{{ formatRating(ratingsByMaster.get(master.id)?.approved_average_rating) }} ★</span>
                · {{ ratingsByMaster.get(master.id)?.approved_review_count }} схвалено
                · {{ ratingsByMaster.get(master.id)?.pending_review_count }} очікують
              </p>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <BaseBadge :tone="isMasterActive(master) ? 'success' : 'neutral'">
              {{ isMasterActive(master) ? 'активний' : 'неактивний' }}
            </BaseBadge>
            <NuxtLink class="base-button base-button--neutral min-h-8 px-3 py-1.5 text-xs" :to="`/masters/${master.id}/services`">Послуги</NuxtLink>
            <BaseButton
              variant="icon"
              class="h-8 w-8"
              aria-label="Редагувати майстра"
              title="Редагувати"
              @click="editMaster(master)"
            >
              <PencilIcon class="h-4 w-4" aria-hidden="true" />
              <span class="sr-only">Редагувати</span>
            </BaseButton>
            <BaseButton
              variant="icon"
              class="h-8 w-8"
              :disabled="!isAdmin"
              :aria-label="isMasterActive(master) ? 'Деактивувати майстра' : 'Активувати майстра'"
              :title="isMasterActive(master) ? 'Деактивувати' : 'Активувати'"
              @click="openToggleMasterConfirm(master)"
            >
              <template v-if="isMasterActive(master)">
                <NoSymbolIcon class="h-4 w-4" aria-hidden="true" />
                <span class="sr-only">Деактивувати</span>
              </template>
              <template v-else>
                <CheckCircleIcon class="h-4 w-4" aria-hidden="true" />
                <span class="sr-only">Активувати</span>
              </template>
            </BaseButton>
          </div>
        </article>
      </div>
    </BaseCard>

    <MasterFormModal
      :model-value="masterModalOpen"
      :master="editing"
      :masters="allKnownMasters"
      :disabled="!isAdmin"
      @saved="handleMasterSaved"
      @update:model-value="handleMasterModalUpdate"
    />
    <ConfirmActionModal
      :model-value="Boolean(togglingMaster)"
      :title="togglingMaster && isMasterActive(togglingMaster) ? 'Деактивувати майстра?' : 'Активувати майстра?'"
      :message="togglingMaster && isMasterActive(togglingMaster) ? 'Майстер стане неактивним і не має використовуватися для нових операцій. Ви точно впевнені, що хочете деактивувати цього майстра?' : 'Майстер знову стане активним і доступним для роботи. Ви точно впевнені, що хочете активувати цього майстра?'"
      :confirm-label="togglingMaster && isMasterActive(togglingMaster) ? 'Так, деактивувати' : 'Так, активувати'"
      :context-items="toggleContextItems"
      :pending="togglePending"
      :destructive="Boolean(togglingMaster && isMasterActive(togglingMaster))"
      @confirm="confirmToggleMaster"
      @update:model-value="handleToggleConfirmUpdate"
    />
  </div>
</template>
