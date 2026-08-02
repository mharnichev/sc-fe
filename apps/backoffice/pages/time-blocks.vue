<script setup lang="ts">
import { ChevronDownIcon, FunnelIcon, LockOpenIcon, PlusIcon } from '@heroicons/vue/24/outline'
import { initials } from '@shared-utils'
import type { Master, MasterAvailabilityWindow, TimeBlock } from '~/composables/useBackofficeApi'

const api = useBackofficeApi()
const assetUrl = useAssetUrl()
const auth = useAuthStore()
const toast = useBaseToastNotification()
const {
  todayInput,
  addDaysInput,
  formatDateTime,
  toKyivIso,
  masterName,
  normalizeItems,
  apiErrorMessage,
} = useBookingFormatting()
const calendar = useBookingCalendar()

const isAdmin = computed(() => Boolean(auth.user?.is_superuser || auth.user?.role === 'admin'))
const filters = reactive({
  date_from: todayInput(),
  date_to: addDaysInput(todayInput(), 30),
  master_id: '',
})

const [{ data, pending, error, refresh }, { data: masters }] = await Promise.all([
  useAsyncData(
    'admin-time-blocks',
    async () => {
      const masterId = filters.master_id ? Number(filters.master_id) : null
      const [timeBlocks, availability] = await Promise.all([
        api.adminGetTimeBlocks(1, 200, {
          date_from: filters.date_from,
          date_to: filters.date_to,
          master_id: masterId,
        }),
        api.adminGetAvailability({
          date_from: toKyivIso(filters.date_from, calendar.workdayStart),
          date_to: toKyivIso(filters.date_to, calendar.workdayEnd),
          master_id: masterId,
        }),
      ])
      return { timeBlocks, availability }
    },
  ),
  useAsyncData('time-block-master-options', () => api.adminGetMasters(1, 200)),
])

const blocks = computed<TimeBlock[]>(() =>
  normalizeItems(data.value?.timeBlocks).filter(block => {
    const date = block.start_at.slice(0, 10)
    return (!filters.date_from || date >= filters.date_from) && (!filters.date_to || date <= filters.date_to)
  }),
)
const availabilityWindows = computed<MasterAvailabilityWindow[]>(() =>
  (data.value?.availability || []).filter(window => {
    const date = window.start_at.slice(0, 10)
    return (!filters.date_from || date >= filters.date_from) && (!filters.date_to || date <= filters.date_to)
  }),
)
const masterOptions = computed(() => normalizeItems(masters.value))
const deletingId = ref<number | null>(null)
const deletingAvailabilityId = ref<number | null>(null)
const timeBlockModalOpen = ref(false)
const availabilityModalOpen = ref(false)
const masterFilterOpen = ref(false)
const masterFilterRef = ref<HTMLElement | null>(null)
const selectedMaster = computed(() => masterOptions.value.find(master => String(master.id) === filters.master_id) || null)

const masterDisplayName = (master?: Master | null) => {
  if (!master) return 'Усі майстри'
  const firstName = master.first_name_uk || ''
  const lastName = master.last_name_uk || master.last_name || ''
  return [lastName, firstName].filter(Boolean).join(' ') || master.full_name_uk || master.full_name || master.name || masterName(master)
}

const masterImageUrl = (master?: Master | null) =>
  master ? assetUrl(master.avatar || master.avatar_url || master.photo || master.photo_url) : ''

const masterInitials = (master?: Master | null) => initials(masterDisplayName(master)) || 'SC'

const selectMasterFilter = (masterId: string) => {
  filters.master_id = masterId
  masterFilterOpen.value = false
}

const openCreateBlock = () => {
  timeBlockModalOpen.value = true
}

const openCreateAvailability = () => {
  availabilityModalOpen.value = true
}

const applyFilters = async () => {
  masterFilterOpen.value = false
  await refresh()
}

const handleBlockSaved = async (message: string) => {
  toast.success(message)
  await refresh()
}

const handleBlockModalUpdate = (value: boolean) => {
  timeBlockModalOpen.value = value
}

const handleAvailabilityModalUpdate = (value: boolean) => {
  availabilityModalOpen.value = value
}

const resolveMaster = (masterId?: number | null, embeddedMaster?: Master | null) =>
  embeddedMaster || masterOptions.value.find(master => master.id === masterId) || null

const deleteBlock = async (blockId: number) => {
  if (!confirm(`Видалити time block #${blockId}?`)) return
  deletingId.value = blockId
  try {
    await api.adminDeleteTimeBlock(blockId)
    toast.success('Блокування часу видалено.')
    await refresh()
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося видалити блокування часу.'))
  }
  finally {
    deletingId.value = null
  }
}

const deleteAvailability = async (windowId: number) => {
  if (!confirm(`Закрити доступність #${windowId}?`)) return
  deletingAvailabilityId.value = windowId
  try {
    await api.adminDeleteAvailabilityWindow(windowId)
    toast.success('Доступність закрито.')
    await refresh()
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося закрити доступність.'))
  }
  finally {
    deletingAvailabilityId.value = null
  }
}

const closeMasterFilterOnOutsideClick = (event: MouseEvent) => {
  const target = event.target
  if (!(target instanceof Node) || masterFilterRef.value?.contains(target)) return
  masterFilterOpen.value = false
}

onMounted(() => document.addEventListener('click', closeMasterFilterOnOutsideClick))
onBeforeUnmount(() => document.removeEventListener('click', closeMasterFilterOnOutsideClick))
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Адмін</p>
        <h1 class="mt-2 text-3xl font-semibold text-slate-900">Доступність майстрів</h1>
      </div>
      <div class="flex flex-wrap gap-2">
        <BaseButton
          type="button"
          :disabled="!isAdmin"
          class="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
          @click="openCreateAvailability"
        >
          <LockOpenIcon class="h-4 w-4" aria-hidden="true" />
          Відкрити час
        </BaseButton>
        <BaseButton
          type="button"
          :disabled="!isAdmin"
          class="time-block-create-button inline-flex items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-medium transition disabled:opacity-60"
          @click="openCreateBlock"
        >
          <PlusIcon class="h-4 w-4" aria-hidden="true" />
          Блокування
        </BaseButton>
      </div>
    </div>

    <p v-if="!isAdmin" class="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
      Для керування доступністю майстрів потрібен доступ адміністратора.
    </p>

    <section class="relative z-30 space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div class="grid gap-3 md:grid-cols-4">
        <BaseCalendar v-model="filters.date_from" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
        <BaseCalendar v-model="filters.date_to" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
        <div ref="masterFilterRef" class="relative z-40 min-w-0">
          <BaseButton
            type="button"
            class="backoffice-select-trigger flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border border-slate-300 px-4 py-2 text-left text-sm transition focus:outline-none"
            :aria-expanded="masterFilterOpen"
            aria-haspopup="listbox"
            @click="masterFilterOpen = !masterFilterOpen"
          >
            <span class="flex min-w-0 items-center gap-2">
              <span class="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[0.65rem] font-semibold text-slate-600 ring-1 ring-slate-200">
                <img v-if="masterImageUrl(selectedMaster)" :src="masterImageUrl(selectedMaster)" :alt="masterDisplayName(selectedMaster)" class="h-full w-full object-cover">
                <span v-else>{{ selectedMaster ? masterInitials(selectedMaster) : 'SC' }}</span>
              </span>
              <span class="min-w-0 truncate font-medium text-slate-900">{{ masterDisplayName(selectedMaster) }}</span>
            </span>
            <ChevronDownIcon class="backoffice-select-chevron h-4 w-4 shrink-0 transition" :class="{ 'rotate-180': masterFilterOpen }" aria-hidden="true" />
          </BaseButton>
          <div
            v-if="masterFilterOpen"
            class="booking-select-menu absolute z-[300] mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl md:rounded-2xl"
            role="listbox"
          >
            <BaseButton
              type="button"
              class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm"
              :class="!filters.master_id ? 'bg-slate-50' : ''"
              @click="selectMasterFilter('')"
            >
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">SC</span>
              <span class="min-w-0 truncate font-medium">Усі майстри</span>
            </BaseButton>
            <BaseButton
              v-for="master in masterOptions"
              :key="master.id"
              type="button"
              class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm"
              :class="filters.master_id === String(master.id) ? 'bg-slate-50' : ''"
              @click="selectMasterFilter(String(master.id))"
            >
              <span class="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                <img v-if="masterImageUrl(master)" :src="masterImageUrl(master)" :alt="masterDisplayName(master)" class="h-full w-full object-cover">
                <span v-else>{{ masterInitials(master) }}</span>
              </span>
              <span class="min-w-0">
                <span class="block truncate font-medium">{{ masterDisplayName(master) }}</span>
                <span v-if="master.position_uk" class="block truncate text-xs text-slate-500">{{ master.position_uk }}</span>
              </span>
            </BaseButton>
          </div>
        </div>
        <BaseButton class="backoffice-modal-action-button backoffice-modal-action-primary" @click="applyFilters">
          <FunnelIcon class="h-4 w-4" aria-hidden="true" />
          <span>Застосувати</span>
        </BaseButton>
      </div>

      <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ apiErrorMessage(error, 'Не вдалося завантажити доступність.') }}
      </p>
      <div v-if="pending" class="text-sm text-slate-500">Завантаження доступності...</div>
    </section>

    <section class="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-xl font-semibold text-slate-900">Відкрито для запису</h2>
        <BaseButton
          type="button"
          :disabled="!isAdmin"
          class="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
          @click="openCreateAvailability"
        >
          <LockOpenIcon class="h-4 w-4" aria-hidden="true" />
          Додати
        </BaseButton>
      </div>
      <div v-if="pending" class="text-sm text-slate-500">Завантаження відкритих інтервалів...</div>
      <div v-else-if="!availabilityWindows.length" class="text-sm text-slate-500">У цьому діапазоні дат немає відкритих інтервалів.</div>
      <div v-else class="divide-y divide-slate-100">
        <article v-for="window in availabilityWindows" :key="window.id" class="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p class="font-medium text-slate-900">{{ masterName(resolveMaster(window.master_id, window.master)) }}</p>
            <p class="text-sm text-slate-500">{{ formatDateTime(window.start_at) }} - {{ formatDateTime(window.end_at) }}</p>
            <p class="text-xs text-emerald-700">Готовий приймати клієнтів</p>
          </div>
          <BaseButton
            class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-300 text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
            :disabled="deletingAvailabilityId === window.id || !isAdmin"
            :aria-label="deletingAvailabilityId === window.id ? 'Закриття доступності' : 'Закрити доступність'"
            :title="deletingAvailabilityId === window.id ? 'Закриття...' : 'Закрити'"
            @click="deleteAvailability(window.id)"
          >
            <TrashIcon class="h-5 w-5" aria-hidden="true" />
            <span class="sr-only">{{ deletingAvailabilityId === window.id ? 'Закриття...' : 'Закрити' }}</span>
          </BaseButton>
        </article>
      </div>
    </section>

    <section class="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-xl font-semibold text-slate-900">Блокування часу</h2>
        <BaseButton
          type="button"
          :disabled="!isAdmin"
          class="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          @click="openCreateBlock"
        >
          <PlusIcon class="h-4 w-4" aria-hidden="true" />
          Додати
        </BaseButton>
      </div>
      <div v-if="pending" class="text-sm text-slate-500">Завантаження блокувань часу...</div>
      <div v-else-if="!blocks.length" class="text-sm text-slate-500">У цьому діапазоні дат немає блокувань часу.</div>
      <div v-else class="divide-y divide-slate-100">
        <article v-for="block in blocks" :key="block.id" class="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p class="font-medium text-slate-900">{{ masterName(resolveMaster(block.master_id, block.master)) }}</p>
            <p class="text-sm text-slate-500">{{ formatDateTime(block.start_at) }} - {{ formatDateTime(block.end_at) }}</p>
            <p class="text-xs text-slate-500">{{ block.reason || 'Без причини' }}</p>
          </div>
          <BaseButton
            class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-300 text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
            :disabled="deletingId === block.id || !isAdmin"
            :aria-label="deletingId === block.id ? 'Видалення блокування часу' : 'Видалити блокування часу'"
            :title="deletingId === block.id ? 'Видалення...' : 'Видалити'"
            @click="deleteBlock(block.id)"
          >
            <TrashIcon class="h-5 w-5" aria-hidden="true" />
            <span class="sr-only">{{ deletingId === block.id ? 'Видалення...' : 'Видалити' }}</span>
          </BaseButton>
        </article>
      </div>
    </section>

    <AvailabilityWindowFormModal
      :model-value="availabilityModalOpen"
      admin
      :masters="masterOptions"
      :disabled="!isAdmin"
      @saved="handleBlockSaved"
      @update:model-value="handleAvailabilityModalUpdate"
    />
    <TimeBlockFormModal
      :model-value="timeBlockModalOpen"
      :masters="masterOptions"
      :disabled="!isAdmin"
      @saved="handleBlockSaved"
      @update:model-value="handleBlockModalUpdate"
    />
  </div>
</template>
