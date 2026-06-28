<script setup lang="ts">
import { EyeIcon, FunnelIcon, XMarkIcon } from '@heroicons/vue/24/outline'

const api = useBackofficeApi()
const { formatDateTime, formatMoney } = useBookingFormatting()
const page = ref(1)
const pageSize = 20
const filters = reactive({
  search: '',
  is_active: '',
  is_verified: '',
  telegram_connected: '',
  sort_by: 'created_at',
  sort_order: 'desc',
})

const activeStatusOptions = [
  { value: '', label: 'Будь-який статус' },
  { value: 'true', label: 'Активні' },
  { value: 'false', label: 'Неактивні' },
]

const verificationOptions = [
  { value: '', label: 'Будь-яка верифікація' },
  { value: 'true', label: 'Верифіковані' },
  { value: 'false', label: 'Не верифіковані' },
]

const telegramOptions = [
  { value: '', label: 'Будь-який TG' },
  { value: 'true', label: 'TG підключено' },
  { value: 'false', label: 'TG не підключено' },
]

const sortOptions = [
  { value: 'created_at', label: 'Створено' },
  { value: 'last_login_at', label: 'Останній вхід' },
  { value: 'name', label: 'Ім’я' },
  { value: 'surname', label: 'Прізвище' },
  { value: 'phone', label: 'Телефон' },
  { value: 'id', label: 'ID' },
]

const { data, refresh } = await useAsyncData(
  'backoffice-customers',
  () =>
    api.getCustomers(page.value, pageSize, {
      search: filters.search || undefined,
      is_active: filters.is_active || null,
      is_verified: filters.is_verified || null,
      telegram_connected: filters.telegram_connected || null,
      sort_by: filters.sort_by,
      sort_order: filters.sort_order,
    }),
  { watch: [page] },
)

const applyFilters = async () => {
  page.value = 1
  if (page.value !== 1) return
  await refresh()
}

const clearFilters = async () => {
  const shouldRefreshImmediately = page.value === 1
  filters.search = ''
  filters.is_active = ''
  filters.is_verified = ''
  filters.telegram_connected = ''
  filters.sort_by = 'created_at'
  filters.sort_order = 'desc'
  page.value = 1
  if (shouldRefreshImmediately) {
    await refresh()
  }
}

const next = async () => {
  if (!data.value || page.value * pageSize >= data.value.total) return
  page.value += 1
}

const prev = async () => {
  page.value = Math.max(1, page.value - 1)
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">CRM</p>
      <h1 class="mt-2 text-3xl font-semibold text-slate-900">Клієнти</h1>
    </div>

    <section class="grid gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-5">
      <BaseInput v-model="filters.search" placeholder="Пошук за телефоном, email або ім’ям" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
      <BaseSelect v-model="filters.is_active" :options="activeStatusOptions" aria-label="Статус клієнта" menu-class="z-[220]" />
      <BaseSelect v-model="filters.is_verified" :options="verificationOptions" aria-label="Верифікація клієнта" menu-class="z-[220]" />
      <BaseSelect v-model="filters.telegram_connected" :options="telegramOptions" aria-label="Telegram клієнта" menu-class="z-[220]" />
      <BaseSelect v-model="filters.sort_by" :options="sortOptions" aria-label="Сортування клієнтів" menu-class="z-[220]" />
      <div class="flex gap-3 md:col-span-2 xl:col-span-5 xl:justify-end">
        <BaseButton class="backoffice-modal-action-button backoffice-modal-action-primary flex-1 xl:flex-none" @click="applyFilters">
          <FunnelIcon class="h-4 w-4" aria-hidden="true" />
          <span>Застосувати</span>
        </BaseButton>
        <BaseButton class="backoffice-modal-action-button backoffice-modal-action-neutral flex-1 xl:flex-none" @click="clearFilters">
          <XMarkIcon class="h-4 w-4" aria-hidden="true" />
          <span>Очистити</span>
        </BaseButton>
      </div>
    </section>

    <div class="rounded-[1.25rem] bg-slate-50 px-4 py-3 text-sm text-slate-600">
      Усього клієнтів: {{ data?.total || 0 }}
    </div>

    <div class="customers-table-scroll overflow-x-auto rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
      <table class="customers-table min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-4 py-3 text-left font-medium text-slate-500">ID</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Клієнт</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Контакти</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Прізвище</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Імпорт</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Нотатки</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Telegram</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Верифікація</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Дії</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="item in data?.items || []" :key="item.id">
            <td data-label="ID" class="px-4 py-3 text-slate-700">{{ item.id }}</td>
            <td data-label="Клієнт" class="px-4 py-3">
              <p class="font-medium text-slate-900">{{ item.name || 'Клієнт без імені' }}</p>
              <p class="mt-1 text-xs text-slate-500">Customer #{{ item.id }}</p>
            </td>
            <td data-label="Контакти" class="px-4 py-3">
              <p class="font-medium text-slate-900">{{ item.phone }}</p>
              <p class="mt-1 text-xs text-slate-500">{{ item.email || 'Без email' }}</p>
            </td>
            <td data-label="Прізвище" class="px-4 py-3 text-slate-700">{{ item.surname || '—' }}</td>
            <td data-label="Імпорт" class="px-4 py-3 text-slate-700">
              <p class="font-medium text-slate-900">{{ formatMoney(item.imported_total_spent) }}</p>
              <p class="mt-1 text-xs text-slate-500">{{ formatDateTime(item.imported_last_visit_at) }}</p>
              <span v-if="item.imported_is_new_client" class="mt-2 inline-flex rounded-full bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-700">новий</span>
            </td>
            <td data-label="Нотатки" class="max-w-xs px-4 py-3 text-slate-700">
              <p class="line-clamp-2">{{ item.notes || '—' }}</p>
            </td>
            <td data-label="Telegram" class="px-4 py-3">
              <span class="rounded-full px-3 py-1 text-xs font-medium" :class="item.telegram_connected ? 'bg-cyan-50 text-cyan-700' : 'bg-slate-100 text-slate-500'">
                {{ item.telegram_connected ? 'TG підключено' : 'немає TG' }}
              </span>
            </td>
            <td data-label="Верифікація" class="px-4 py-3">
              <span class="rounded-full px-3 py-1 text-xs font-medium" :class="item.is_verified ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">
                {{ item.is_verified ? 'верифіковано' : 'не верифіковано' }}
              </span>
            </td>
            <td data-label="Дії" class="px-4 py-3">
              <NuxtLink
                :to="`/customers/${item.id}`"
                class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50"
                aria-label="Переглянути клієнта"
                title="Переглянути"
              >
                <EyeIcon class="h-4 w-4" aria-hidden="true" />
                <span class="sr-only">Переглянути</span>
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!data?.items.length" class="px-5 py-8 text-center text-sm text-slate-500">
        Клієнтів за цими фільтрами не знайдено.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <BaseButton :disabled="page === 1" class="rounded-full border border-slate-300 px-4 py-2 text-sm disabled:opacity-50" @click="prev">Попередня</BaseButton>
      <span class="text-sm text-slate-500">Сторінка {{ page }}</span>
      <BaseButton :disabled="!data || page * pageSize >= data.total" class="rounded-full border border-slate-300 px-4 py-2 text-sm disabled:opacity-50" @click="next">Наступна</BaseButton>
    </div>
  </div>
</template>
