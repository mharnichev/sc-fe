<script setup lang="ts">
import { PlusIcon, TrashIcon } from '@heroicons/vue/24/outline'

const api = useBackofficeApi()
const {
  todayInput,
  addDaysInput,
  toKyivIso,
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

const form = reactive({
  date: todayInput(),
  block_type: 'full_day',
  start_time: '08:00',
  end_time: '20:00',
  reason: '',
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
const saving = ref(false)
const deletingId = ref<number | null>(null)

watch(
  () => form.block_type,
  value => {
    if (value === 'full_day') {
      form.start_time = '08:00'
      form.end_time = '20:00'
    }
  },
)

const validate = () => {
  if (!form.date) return 'Дата обов’язкова.'
  if (!form.block_type) return 'Тип блокування обов’язковий.'
  if (form.block_type === 'custom') {
    if (!form.start_time || !form.end_time) return 'Час початку й завершення обов’язкові.'
    if (form.start_time >= form.end_time) return 'Час початку має бути раніше часу завершення.'
    if (form.start_time < '08:00' || form.end_time > '20:00') return 'Власний інтервал має бути в межах 08:00-20:00.'
  }
  return ''
}

const applyFilters = async () => {
  await refresh()
}

const createBlock = async () => {
  formError.value = validate()
  successMessage.value = ''
  if (formError.value) return

  saving.value = true
  try {
    await api.createMyTimeBlock({
      start_at: toKyivIso(form.date, form.block_type === 'full_day' ? '08:00' : form.start_time),
      end_at: toKyivIso(form.date, form.block_type === 'full_day' ? '20:00' : form.end_time),
      reason: form.reason.trim() || null,
    })
    successMessage.value = 'Блокування часу створено.'
    form.reason = ''
    await refresh()
  }
  catch (cause) {
    formError.value = apiErrorMessage(cause, 'Не вдалося створити блокування часу.')
  }
  finally {
    saving.value = false
  }
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
    <div>
      <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Доступність</p>
      <h1 class="mt-2 text-3xl font-semibold text-slate-900">Мої блокування часу</h1>
      <p class="mt-2 text-sm text-slate-500">Блокуйте недоступні інтервали в межах 08:00-20:00 Europe/Kyiv.</p>
    </div>

    <section class="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <form class="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm" @submit.prevent="createBlock">
        <h2 class="text-xl font-semibold text-slate-900">Створити блокування</h2>
        <label class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">Дата</span>
          <input v-model="form.date" required type="date" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
        </label>
        <label class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">Тип блокування</span>
          <select v-model="form.block_type" required class="w-full rounded-2xl border border-slate-300 px-4 py-3">
            <option value="full_day">Повний день</option>
            <option value="custom">Власний інтервал</option>
          </select>
        </label>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">Час початку</span>
            <input v-model="form.start_time" :disabled="form.block_type === 'full_day'" type="time" min="08:00" max="20:00" class="w-full rounded-2xl border border-slate-300 px-4 py-3 disabled:bg-slate-100">
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">Час завершення</span>
            <input v-model="form.end_time" :disabled="form.block_type === 'full_day'" type="time" min="08:00" max="20:00" class="w-full rounded-2xl border border-slate-300 px-4 py-3 disabled:bg-slate-100">
          </label>
        </div>
        <label class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">Причина</span>
          <textarea v-model="form.reason" rows="4" class="w-full rounded-2xl border border-slate-300 px-4 py-3" />
        </label>
        <button type="submit" :disabled="saving" class="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60">
          <PlusIcon v-if="!saving" class="h-4 w-4" aria-hidden="true" />
          {{ saving ? 'Створення...' : 'Створити блокування' }}
        </button>
        <p v-if="formError" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{{ formError }}</p>
        <p v-if="successMessage" class="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ successMessage }}</p>
      </form>

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
    </section>
  </div>
</template>
