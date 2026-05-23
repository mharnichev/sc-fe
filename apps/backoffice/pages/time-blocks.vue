<script setup lang="ts">
const api = useBackofficeApi()
const auth = useAuthStore()
const {
  todayInput,
  addDaysInput,
  toKyivIso,
  formatDateTime,
  masterName,
  normalizeItems,
  apiErrorMessage,
} = useBookingFormatting()

const isAdmin = computed(() => Boolean(auth.user?.is_superuser || auth.user?.role === 'admin'))
const filters = reactive({
  date_from: todayInput(),
  date_to: addDaysInput(todayInput(), 30),
  master_id: '',
})
const form = reactive({
  master_id: '',
  date: todayInput(),
  block_type: 'full_day',
  start_time: '08:00',
  end_time: '20:00',
  reason: '',
})

const [{ data, pending, error, refresh }, { data: masters }] = await Promise.all([
  useAsyncData(
    'admin-time-blocks',
    () => api.adminGetTimeBlocks(1, 200, {
      date_from: filters.date_from,
      date_to: filters.date_to,
      master_id: filters.master_id ? Number(filters.master_id) : null,
    }),
  ),
  useAsyncData('time-block-master-options', () => api.adminGetMasters(1, 200)),
])

const blocks = computed(() =>
  normalizeItems(data.value).filter(block => {
    const date = block.start_at.slice(0, 10)
    return (!filters.date_from || date >= filters.date_from) && (!filters.date_to || date <= filters.date_to)
  }),
)
const masterOptions = computed(() => normalizeItems(masters.value))
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
  if (!form.master_id) return 'Майстер обов’язковий.'
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
    await api.adminCreateTimeBlock({
      master_id: Number(form.master_id),
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
    await api.adminDeleteTimeBlock(blockId)
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
      <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Адмін</p>
      <h1 class="mt-2 text-3xl font-semibold text-slate-900">Усі блокування часу</h1>
    </div>

    <p v-if="!isAdmin" class="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
      Для керування всіма блокуваннями майстрів потрібен доступ адміністратора.
    </p>

    <section class="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <form class="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm" @submit.prevent="createBlock">
        <h2 class="text-xl font-semibold text-slate-900">Створити блокування майстра</h2>
        <label class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">Майстер</span>
          <select v-model="form.master_id" required class="w-full rounded-2xl border border-slate-300 px-4 py-3">
            <option value="">Виберіть майстра</option>
            <option v-for="master in masterOptions" :key="master.id" :value="String(master.id)">{{ masterName(master) }}</option>
          </select>
        </label>
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
        <button type="submit" :disabled="saving || !isAdmin" class="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60">
          {{ saving ? 'Створення...' : 'Створити блокування' }}
        </button>
        <p v-if="formError" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{{ formError }}</p>
        <p v-if="successMessage" class="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ successMessage }}</p>
      </form>

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
          {{ apiErrorMessage(error, 'Не вдалося завантажити блокування часу з /backoffice/time-blocks.') }}
        </p>

        <div v-if="pending" class="text-sm text-slate-500">Завантаження блокувань часу...</div>
        <div v-else-if="!blocks.length" class="text-sm text-slate-500">У цьому діапазоні дат немає блокувань часу.</div>
        <div v-else class="divide-y divide-slate-100">
          <article v-for="block in blocks" :key="block.id" class="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p class="font-medium text-slate-900">{{ masterName(block.master) }}</p>
              <p class="text-sm text-slate-500">{{ formatDateTime(block.start_at) }} - {{ formatDateTime(block.end_at) }}</p>
              <p class="text-xs text-slate-500">{{ block.reason || 'Без причини' }}</p>
            </div>
            <button
              class="rounded-full border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 disabled:opacity-60"
              :disabled="deletingId === block.id || !isAdmin"
              @click="deleteBlock(block.id)"
            >
              {{ deletingId === block.id ? 'Видалення...' : 'Видалити' }}
            </button>
          </article>
        </div>
      </section>
    </section>
  </div>
</template>
