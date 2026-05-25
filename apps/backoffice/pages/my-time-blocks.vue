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
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Доступність</p>
        <h1 class="mt-2 text-3xl font-semibold text-slate-900">Мої блокування часу</h1>
        <p class="mt-2 text-sm text-slate-500">Блокуйте недоступні інтервали в межах 09:00-20:00 Europe/Kyiv.</p>
      </div>
      <button type="button" class="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white" @click="openCreateBlock">
        <PlusIcon class="h-4 w-4" aria-hidden="true" />
        Створити блокування
      </button>
    </div>

    <div class="space-y-3">
      <p v-if="formError" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{{ formError }}</p>
      <p v-if="successMessage" class="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ successMessage }}</p>
    </div>

    <section class="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <h2 class="text-xl font-semibold text-slate-900">Наявні блокування</h2>
        <div class="flex flex-wrap items-end gap-3">
          <label class="space-y-1 text-xs text-slate-600">
            <span>Від</span>
            <input v-model="filters.date_from" type="date" class="rounded-2xl border border-slate-300 px-3 py-2">
          </label>
          <label class="space-y-1 text-xs text-slate-600">
            <span>До</span>
            <input v-model="filters.date_to" type="date" class="rounded-2xl border border-slate-300 px-3 py-2">
          </label>
          <button class="rounded-full border border-slate-300 px-4 py-2 text-sm" @click="applyFilters">Застосувати</button>
        </div>
      </div>

      <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ apiErrorMessage(error, 'Не вдалося завантажити блокування часу з /backoffice/masters/me/time-blocks.') }}
      </p>

      <div v-if="pending" class="text-sm text-slate-500">Завантаження блокувань часу...</div>
      <div v-else-if="!blocks.length" class="text-sm text-slate-500">У цьому діапазоні дат немає блокувань часу.</div>
      <div v-else class="divide-y divide-slate-100">
        <article v-for="block in blocks" :key="block.id" class="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p class="font-medium text-slate-900">{{ formatDateTime(block.start_at) }} - {{ formatDateTime(block.end_at) }}</p>
            <p class="text-sm text-slate-500">{{ block.reason || 'Без причини' }}</p>
          </div>
          <button
            class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-300 text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
            :disabled="deletingId === block.id"
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
    <MyTimeBlockFormModal
      :model-value="timeBlockModalOpen"
      @saved="handleBlockSaved"
      @update:model-value="handleBlockModalUpdate"
    />
  </div>
</template>
