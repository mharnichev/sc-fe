<script setup lang="ts">
import { EyeIcon } from '@heroicons/vue/24/outline'

const api = useBackofficeApi()
const page = ref(1)
const pageSize = 20
const filters = reactive({
  search: '',
  is_active: '',
  is_verified: '',
  sort_by: 'created_at',
  sort_order: 'desc',
})

const { data, refresh } = await useAsyncData(
  'backoffice-customers',
  () =>
    api.getCustomers(page.value, pageSize, {
      search: filters.search || undefined,
      is_active: filters.is_active || null,
      is_verified: filters.is_verified || null,
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
      <input v-model="filters.search" placeholder="Пошук за телефоном, email або ім’ям" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
      <select v-model="filters.is_active" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
        <option value="">Будь-який статус</option>
        <option value="true">Активні</option>
        <option value="false">Неактивні</option>
      </select>
      <select v-model="filters.is_verified" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
        <option value="">Будь-яка верифікація</option>
        <option value="true">Верифіковані</option>
        <option value="false">Не верифіковані</option>
      </select>
      <select v-model="filters.sort_by" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
        <option value="created_at">Створено</option>
        <option value="last_login_at">Останній вхід</option>
        <option value="name">Ім’я</option>
        <option value="surname">Прізвище</option>
        <option value="phone">Телефон</option>
        <option value="id">ID</option>
      </select>
      <div class="flex gap-3">
        <button class="flex-1 rounded-full bg-slate-950 px-4 py-3 text-sm font-medium text-white" @click="applyFilters">Застосувати</button>
        <button class="flex-1 rounded-full border border-slate-300 px-4 py-3 text-sm" @click="clearFilters">Очистити</button>
      </div>
    </section>

    <div class="rounded-[1.25rem] bg-slate-50 px-4 py-3 text-sm text-slate-600">
      Усього клієнтів: {{ data?.total || 0 }}
    </div>

    <div class="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-4 py-3 text-left font-medium text-slate-500">ID</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Клієнт</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Контакти</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Прізвище</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Нотатки</th>
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
            <td data-label="Нотатки" class="max-w-xs px-4 py-3 text-slate-700">
              <p class="line-clamp-2">{{ item.notes || '—' }}</p>
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
      <button :disabled="page === 1" class="rounded-full border border-slate-300 px-4 py-2 text-sm disabled:opacity-50" @click="prev">Попередня</button>
      <span class="text-sm text-slate-500">Сторінка {{ page }}</span>
      <button :disabled="!data || page * pageSize >= data.total" class="rounded-full border border-slate-300 px-4 py-2 text-sm disabled:opacity-50" @click="next">Наступна</button>
    </div>
  </div>
</template>
