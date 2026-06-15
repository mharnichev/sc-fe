<script setup lang="ts">
import { LockOpenIcon, PlusIcon, TrashIcon } from '@heroicons/vue/24/outline'
import type { Master, MasterAvailabilityWindow, TimeBlock } from '~/composables/useBackofficeApi'

const api = useBackofficeApi()
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

const openCreateBlock = () => {
  timeBlockModalOpen.value = true
}

const openCreateAvailability = () => {
  availabilityModalOpen.value = true
}

const applyFilters = async () => {
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
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Адмін</p>
        <h1 class="mt-2 text-3xl font-semibold text-slate-900">Доступність майстрів</h1>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          :disabled="!isAdmin"
          class="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
          @click="openCreateAvailability"
        >
          <LockOpenIcon class="h-4 w-4" aria-hidden="true" />
          Відкрити час
        </button>
        <button
          type="button"
          :disabled="!isAdmin"
          class="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
          @click="openCreateBlock"
        >
          <PlusIcon class="h-4 w-4" aria-hidden="true" />
          Блокування
        </button>
      </div>
    </div>

    <p v-if="!isAdmin" class="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
      Для керування доступністю майстрів потрібен доступ адміністратора.
    </p>

    <section class="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div class="grid gap-3 md:grid-cols-4">
        <input v-model="filters.date_from" type="date" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
        <input v-model="filters.date_to" type="date" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
        <select v-model="filters.master_id" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
          <option value="">Усі майстри</option>
          <option v-for="master in masterOptions" :key="master.id" :value="String(master.id)">{{ masterName(master) }}</option>
        </select>
        <button class="rounded-full bg-slate-950 px-4 py-3 text-sm font-medium text-white" @click="applyFilters">Застосувати</button>
      </div>

      <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ apiErrorMessage(error, 'Не вдалося завантажити доступність.') }}
      </p>
      <div v-if="pending" class="text-sm text-slate-500">Завантаження доступності...</div>
    </section>

    <section class="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-xl font-semibold text-slate-900">Відкрито для запису</h2>
        <button
          type="button"
          :disabled="!isAdmin"
          class="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
          @click="openCreateAvailability"
        >
          <LockOpenIcon class="h-4 w-4" aria-hidden="true" />
          Додати
        </button>
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
          <button
            class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-300 text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
            :disabled="deletingAvailabilityId === window.id || !isAdmin"
            :aria-label="deletingAvailabilityId === window.id ? 'Закриття доступності' : 'Закрити доступність'"
            :title="deletingAvailabilityId === window.id ? 'Закриття...' : 'Закрити'"
            @click="deleteAvailability(window.id)"
          >
            <TrashIcon class="h-5 w-5" aria-hidden="true" />
            <span class="sr-only">{{ deletingAvailabilityId === window.id ? 'Закриття...' : 'Закрити' }}</span>
          </button>
        </article>
      </div>
    </section>

    <section class="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-xl font-semibold text-slate-900">Блокування часу</h2>
        <button
          type="button"
          :disabled="!isAdmin"
          class="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          @click="openCreateBlock"
        >
          <PlusIcon class="h-4 w-4" aria-hidden="true" />
          Додати
        </button>
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
          <button
            class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-300 text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
            :disabled="deletingId === block.id || !isAdmin"
            :aria-label="deletingId === block.id ? 'Видалення блокування часу' : 'Видалити блокування часу'"
            :title="deletingId === block.id ? 'Видалення...' : 'Видалити'"
            @click="deleteBlock(block.id)"
          >
            <TrashIcon class="h-5 w-5" aria-hidden="true" />
            <span class="sr-only">{{ deletingId === block.id ? 'Видалення...' : 'Видалити' }}</span>
          </button>
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
