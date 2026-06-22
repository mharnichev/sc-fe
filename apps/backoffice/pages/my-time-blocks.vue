<script setup lang="ts">
import { ChatBubbleLeftRightIcon, ClockIcon, FunnelIcon, LockOpenIcon, PlusIcon, TrashIcon } from '@heroicons/vue/24/outline'
import type { MasterAvailabilityWindow, TimeBlock } from '~/composables/useBackofficeApi'

const api = useBackofficeApi()
const toast = useBaseToastNotification()
const {
  todayInput,
  addDaysInput,
  formatDateTime,
  toKyivIso,
  normalizeItems,
  apiErrorMessage,
} = useBookingFormatting()
const calendar = useBookingCalendar()

definePageMeta({
  middleware: () => {
    const auth = useAuthStore()
    if (auth.user?.is_superuser || auth.user?.role === 'admin') {
      return navigateTo('/time-blocks')
    }
  },
})

const filters = reactive({
  date_from: todayInput(),
  date_to: addDaysInput(todayInput(), 30),
})

const { data, pending, error, refresh } = await useAsyncData(
  'my-time-blocks',
  async () => {
    const [timeBlocks, availability] = await Promise.all([
      api.getMyTimeBlocks({
        date_from: filters.date_from,
        date_to: filters.date_to,
      }),
      api.getMyAvailability({
        date_from: toKyivIso(filters.date_from, calendar.workdayStart),
        date_to: toKyivIso(filters.date_to, calendar.workdayEnd),
      }),
    ])
    return { timeBlocks, availability }
  },
)

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
const deletingId = ref<number | null>(null)
const deletingAvailabilityId = ref<number | null>(null)
const timeBlockModalOpen = ref(false)
const availabilityModalOpen = ref(false)
const telegramConnectLoading = ref(false)
const telegramConnectLink = ref<string | null>(null)

const openCreateBlock = () => {
  timeBlockModalOpen.value = true
}

const openCreateAvailability = () => {
  availabilityModalOpen.value = true
}

const openTelegramConnect = async () => {
  telegramConnectLoading.value = true
  try {
    const response = await api.getMyMasterTelegramConnectLink()
    telegramConnectLink.value = response.connect_link
    if (import.meta.client) {
      window.open(response.connect_link, '_blank', 'noopener,noreferrer')
    }
    toast.success(response.telegram_connected ? 'Telegram вже підключено. Посилання оновлено.' : 'Посилання для Telegram створено.')
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося створити посилання для Telegram.'))
  }
  finally {
    telegramConnectLoading.value = false
  }
}

const copyTelegramConnectLink = async () => {
  if (!telegramConnectLink.value || !import.meta.client) return
  try {
    await navigator.clipboard.writeText(telegramConnectLink.value)
    toast.success('Посилання скопійовано.')
  }
  catch {
    toast.error('Не вдалося скопіювати посилання.')
  }
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

const deleteBlock = async (blockId: number) => {
  if (!confirm(`Видалити time block #${blockId}?`)) return
  deletingId.value = blockId
  try {
    await api.deleteMyTimeBlock(blockId)
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
    await api.deleteMyAvailabilityWindow(windowId)
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
  <div class="space-y-3 xl:space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3 xl:gap-4">
      <div>
        <p class="text-xs uppercase tracking-[0.22em] text-cyan-700 xl:text-sm xl:tracking-[0.3em]">Доступність</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900 xl:mt-2 xl:text-3xl">Моя доступність</h1>
        <p class="mt-1 text-xs text-slate-500 xl:mt-2 xl:text-sm">Відкривайте час для запису й блокуйте недоступні інтервали в межах 09:00-20:00.</p>
      </div>
      <div class="flex w-full flex-wrap gap-2 sm:w-auto">
        <button type="button" class="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full border border-cyan-300 px-3 py-2 text-xs font-medium text-cyan-700 transition hover:border-cyan-700 hover:bg-cyan-700 hover:text-white disabled:opacity-60 sm:flex-none xl:min-h-11 xl:gap-2 xl:px-5 xl:py-3 xl:text-sm" :disabled="telegramConnectLoading" @click="openTelegramConnect">
          <ChatBubbleLeftRightIcon class="h-4 w-4" aria-hidden="true" />
          {{ telegramConnectLoading ? 'Створення...' : 'Підключити TG' }}
        </button>
        <button type="button" class="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-emerald-700 sm:flex-none xl:min-h-11 xl:gap-2 xl:px-5 xl:py-3 xl:text-sm" @click="openCreateAvailability">
          <LockOpenIcon class="h-4 w-4" aria-hidden="true" />
          Відкрити час
        </button>
        <button type="button" class="time-block-create-button inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium sm:flex-none xl:min-h-11 xl:gap-2 xl:px-5 xl:py-3 xl:text-sm" @click="openCreateBlock">
          <PlusIcon class="h-4 w-4" aria-hidden="true" />
          Блокування
        </button>
      </div>
    </div>

    <section v-if="telegramConnectLink" class="rounded-[1.25rem] border border-cyan-200 bg-cyan-50 p-3 xl:rounded-[1.75rem] xl:p-5">
      <div class="flex flex-wrap items-center gap-2">
        <a :href="telegramConnectLink" target="_blank" rel="noopener noreferrer" class="min-w-0 flex-1 truncate text-xs font-medium text-cyan-800 underline decoration-cyan-300 underline-offset-4 xl:text-sm">
          {{ telegramConnectLink }}
        </a>
        <button type="button" class="inline-flex min-h-8 items-center justify-center rounded-full border border-cyan-300 px-3 py-1.5 text-xs font-medium text-cyan-800 transition hover:border-cyan-700 hover:bg-cyan-700 hover:text-white xl:px-4 xl:py-2 xl:text-sm" @click="copyTelegramConnectLink">
          Копіювати
        </button>
      </div>
    </section>

    <section class="space-y-3 rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm xl:space-y-5 xl:rounded-[1.75rem] xl:p-6">
      <div class="flex flex-wrap items-end justify-between gap-3 xl:gap-4">
        <h2 class="text-base font-semibold text-slate-900 xl:text-xl">Період</h2>
        <div class="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:w-auto sm:grid-cols-[auto_auto_auto] xl:gap-3">
          <label class="min-w-0 space-y-1 text-xs text-slate-600">
            <span class="inline-flex items-center gap-1.5">
              <ClockIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
              Від
            </span>
            <span class="relative block">
              <ClockIcon class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-current opacity-55 xl:left-3" aria-hidden="true" />
              <input v-model="filters.date_from" type="date" class="min-h-9 min-w-0 w-full rounded-xl border border-slate-300 py-1.5 pl-8 pr-2 text-xs xl:rounded-2xl xl:py-2 xl:pl-9 xl:pr-3 xl:text-sm">
            </span>
          </label>
          <label class="min-w-0 space-y-1 text-xs text-slate-600">
            <span class="inline-flex items-center gap-1.5">
              <ClockIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
              До
            </span>
            <span class="relative block">
              <ClockIcon class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-current opacity-55 xl:left-3" aria-hidden="true" />
              <input v-model="filters.date_to" type="date" class="min-h-9 min-w-0 w-full rounded-xl border border-slate-300 py-1.5 pl-8 pr-2 text-xs xl:rounded-2xl xl:py-2 xl:pl-9 xl:pr-3 xl:text-sm">
            </span>
          </label>
          <button class="backoffice-modal-action-button backoffice-modal-action-primary col-span-2 sm:col-span-1" @click="applyFilters">
            <FunnelIcon class="h-4 w-4" aria-hidden="true" />
            <span>Застосувати</span>
          </button>
        </div>
      </div>

      <p v-if="error" class="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600 xl:rounded-2xl xl:px-4 xl:py-3 xl:text-sm">
        {{ apiErrorMessage(error, 'Не вдалося завантажити доступність.') }}
      </p>

      <div v-if="pending" class="text-xs text-slate-500 xl:text-sm">Завантаження доступності...</div>
    </section>

    <section class="space-y-3 rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm xl:space-y-5 xl:rounded-[1.75rem] xl:p-6">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-base font-semibold text-slate-900 xl:text-xl">Відкрито для запису</h2>
        <button type="button" class="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:border-emerald-600 hover:bg-emerald-600 hover:text-white xl:px-4 xl:py-2 xl:text-sm" @click="openCreateAvailability">
          <LockOpenIcon class="h-4 w-4" aria-hidden="true" />
          Додати
        </button>
      </div>
      <div v-if="pending" class="text-xs text-slate-500 xl:text-sm">Завантаження відкритих інтервалів...</div>
      <div v-else-if="!availabilityWindows.length" class="text-xs text-slate-500 xl:text-sm">У цьому діапазоні немає відкритих інтервалів.</div>
      <div v-else class="grid gap-2 xl:divide-y xl:divide-slate-100">
        <article v-for="window in availabilityWindows" :key="window.id" class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 shadow-sm xl:rounded-none xl:border-0 xl:bg-transparent xl:px-0 xl:py-4 xl:shadow-none">
          <div class="min-w-0">
            <p class="text-sm font-medium leading-snug text-slate-900 xl:text-base">{{ formatDateTime(window.start_at) }} - {{ formatDateTime(window.end_at) }}</p>
            <p class="mt-0.5 truncate text-xs text-emerald-700 xl:text-sm">Готовий приймати клієнтів</p>
          </div>
          <button
            class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-300 text-rose-700 transition hover:bg-rose-50 disabled:opacity-60 xl:h-10 xl:w-10"
            :disabled="deletingAvailabilityId === window.id"
            :aria-label="deletingAvailabilityId === window.id ? 'Закриття доступності' : 'Закрити доступність'"
            :title="deletingAvailabilityId === window.id ? 'Закриття...' : 'Закрити'"
            @click="deleteAvailability(window.id)"
          >
            <TrashIcon class="h-4 w-4 xl:h-5 xl:w-5" aria-hidden="true" />
            <span class="sr-only">{{ deletingAvailabilityId === window.id ? 'Закриття...' : 'Закрити' }}</span>
          </button>
        </article>
      </div>
    </section>

    <section class="space-y-3 rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm xl:space-y-5 xl:rounded-[1.75rem] xl:p-6">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-base font-semibold text-slate-900 xl:text-xl">Блокування часу</h2>
        <button type="button" class="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-800 hover:bg-slate-800 hover:text-white xl:px-4 xl:py-2 xl:text-sm" @click="openCreateBlock">
          <PlusIcon class="h-4 w-4" aria-hidden="true" />
          Додати
        </button>
      </div>
      <div v-if="pending" class="text-xs text-slate-500 xl:text-sm">Завантаження блокувань часу...</div>
      <div v-else-if="!blocks.length" class="text-xs text-slate-500 xl:text-sm">У цьому діапазоні дат немає блокувань часу.</div>
      <div v-else class="grid gap-2 xl:divide-y xl:divide-slate-100">
        <article v-for="block in blocks" :key="block.id" class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 shadow-sm xl:rounded-none xl:border-0 xl:px-0 xl:py-4 xl:shadow-none">
          <div class="min-w-0">
            <p class="text-sm font-medium leading-snug text-slate-900 xl:text-base">{{ formatDateTime(block.start_at) }} - {{ formatDateTime(block.end_at) }}</p>
            <p class="mt-0.5 truncate text-xs text-slate-500 xl:text-sm">{{ block.reason || 'Без причини' }}</p>
          </div>
          <button
            class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-300 text-rose-700 transition hover:bg-rose-50 disabled:opacity-60 xl:h-10 xl:w-10"
            :disabled="deletingId === block.id"
            :aria-label="deletingId === block.id ? 'Видалення блокування часу' : 'Видалити блокування часу'"
            :title="deletingId === block.id ? 'Видалення...' : 'Видалити'"
            @click="deleteBlock(block.id)"
          >
            <TrashIcon class="h-4 w-4 xl:h-5 xl:w-5" aria-hidden="true" />
            <span class="sr-only">{{ deletingId === block.id ? 'Видалення...' : 'Видалити' }}</span>
          </button>
        </article>
      </div>
    </section>

    <AvailabilityWindowFormModal
      :model-value="availabilityModalOpen"
      @saved="handleBlockSaved"
      @update:model-value="handleAvailabilityModalUpdate"
    />
    <MyTimeBlockFormModal
      :model-value="timeBlockModalOpen"
      @saved="handleBlockSaved"
      @update:model-value="handleBlockModalUpdate"
    />
  </div>
</template>
