<script setup lang="ts">
import { PlusIcon, TrashIcon } from '@heroicons/vue/24/outline'

const api = useBackofficeApi()
const {
  todayInput,
  addDaysInput,
  formatDateTime,
  normalizeItems,
  apiErrorMessage,
} = useBookingFormatting()

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
  () => api.getMyTimeBlocks(),
)

const blocks = computed(() =>
  normalizeItems(data.value).filter(block => {
    const date = block.start_at.slice(0, 10)
    return (!filters.date_from || date >= filters.date_from) && (!filters.date_to || date <= filters.date_to)
  }),
)
const formError = ref('')
const successMessage = ref('')
const deletingId = ref<number | null>(null)
const timeBlockModalOpen = ref(false)

const openCreateBlock = () => {
  formError.value = ''
  successMessage.value = ''
  timeBlockModalOpen.value = true
}

const applyFilters = async () => {
  await refresh()
}

const handleBlockSaved = async (message: string) => {
  successMessage.value = message
  formError.value = ''
  await refresh()
}

const handleBlockModalUpdate = (value: boolean) => {
  timeBlockModalOpen.value = value
}

const deleteBlock = async (blockId: number) => {
  if (!confirm(`Видалити time block #${blockId}?`)) return
  deletingId.value = blockId
  formError.value = ''
  successMessage.value = ''
  try {
    await api.deleteMyTimeBlock(blockId)
    successMessage.value = 'Блокування часу видалено.'
    await refresh()
  }
  catch (cause) {
    formError.value = apiErrorMessage(cause, 'Не вдалося видалити блокування часу.')
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
        <p class="text-xs uppercase tracking-[0.22em] text-cyan-700 xl:text-sm xl:tracking-[0.3em]">Доступність</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900 xl:mt-2 xl:text-3xl">Мої блокування часу</h1>
        <p class="mt-1 text-xs text-slate-500 xl:mt-2 xl:text-sm">Блокуйте недоступні інтервали в межах 09:00-20:00.</p>
      </div>
      <button type="button" class="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-full bg-slate-950 px-3 py-2 text-xs font-medium text-white sm:w-auto xl:min-h-11 xl:gap-2 xl:px-5 xl:py-3 xl:text-sm" @click="openCreateBlock">
        <PlusIcon class="h-4 w-4" aria-hidden="true" />
        Створити блокування
      </button>
    </div>

    <div class="space-y-2 xl:space-y-3">
      <p v-if="formError" class="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600 xl:rounded-2xl xl:px-4 xl:py-3 xl:text-sm">{{ formError }}</p>
      <p v-if="successMessage" class="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700 xl:rounded-2xl xl:px-4 xl:py-3 xl:text-sm">{{ successMessage }}</p>
    </div>

    <section class="space-y-3 rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm xl:space-y-5 xl:rounded-[1.75rem] xl:p-6">
      <div class="flex flex-wrap items-end justify-between gap-3 xl:gap-4">
        <h2 class="text-base font-semibold text-slate-900 xl:text-xl">Наявні блокування</h2>
        <div class="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-[auto_auto_auto] xl:gap-3">
          <label class="space-y-1 text-xs text-slate-600">
            <span>Від</span>
            <input v-model="filters.date_from" type="date" class="min-h-9 w-full rounded-xl border border-slate-300 px-2 py-1.5 text-xs xl:rounded-2xl xl:px-3 xl:py-2 xl:text-sm">
          </label>
          <label class="space-y-1 text-xs text-slate-600">
            <span>До</span>
            <input v-model="filters.date_to" type="date" class="min-h-9 w-full rounded-xl border border-slate-300 px-2 py-1.5 text-xs xl:rounded-2xl xl:px-3 xl:py-2 xl:text-sm">
          </label>
          <button class="col-span-2 min-h-9 rounded-full border border-slate-300 px-3 py-1.5 text-xs sm:col-span-1 xl:px-4 xl:py-2 xl:text-sm" @click="applyFilters">Застосувати</button>
        </div>
      </div>

      <p v-if="error" class="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600 xl:rounded-2xl xl:px-4 xl:py-3 xl:text-sm">
        {{ apiErrorMessage(error, 'Не вдалося завантажити блокування часу з /backoffice/masters/me/time-blocks.') }}
      </p>

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
    <MyTimeBlockFormModal
      :model-value="timeBlockModalOpen"
      @saved="handleBlockSaved"
      @update:model-value="handleBlockModalUpdate"
    />
  </div>
</template>
