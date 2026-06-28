<script setup lang="ts">
import { FunnelIcon } from '@heroicons/vue/24/outline'

const api = useBackofficeApi()
const filters = reactive({
  search: '',
  is_active: '',
})

const [{ data }, { data: tree, refresh: refreshTree }] = await Promise.all([
  useAsyncData('backoffice-categories', () =>
    api.getCategories(1, 200, {
      search: filters.search || undefined,
      is_active: filters.is_active === '' ? null : filters.is_active === 'true',
    })),
  useAsyncData('backoffice-category-tree', () => api.getCategoryTree()),
])

const applyFilters = async () => {
  await refreshNuxtData('backoffice-categories')
  await refreshTree()
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Каталог</p>
      <h1 class="mt-2 text-3xl font-semibold text-slate-900">Категорії</h1>
    </div>
    <section class="grid gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_220px_160px]">
      <BaseInput v-model="filters.search" placeholder="Пошук категорій" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
      <BaseSelect native v-model="filters.is_active" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
        <option value="">Будь-який статус</option>
        <option value="true">Активні</option>
        <option value="false">Неактивні</option>
      </BaseSelect>
      <BaseButton class="backoffice-modal-action-button backoffice-modal-action-primary" @click="applyFilters">
        <FunnelIcon class="h-4 w-4" aria-hidden="true" />
        <span>Застосувати</span>
      </BaseButton>
    </section>

    <div class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section class="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-200 px-5 py-4">
          <h2 class="text-lg font-semibold text-slate-900">Плоский список</h2>
        </div>
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-4 py-3 text-left font-medium text-slate-500">Назва</th>
              <th class="px-4 py-3 text-left font-medium text-slate-500">Slug</th>
              <th class="px-4 py-3 text-left font-medium text-slate-500">Батьківська категорія</th>
              <th class="px-4 py-3 text-left font-medium text-slate-500">Статус</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="item in data?.items || []" :key="item.id">
              <td data-label="Назва" class="px-4 py-3">
                <p class="font-medium text-slate-900">{{ item.name }}</p>
                <p class="text-xs text-slate-500">{{ item.description || 'Без опису' }}</p>
              </td>
              <td data-label="Slug" class="px-4 py-3 text-slate-700">{{ item.slug }}</td>
              <td data-label="Батьківська категорія" class="px-4 py-3 text-slate-700">{{ item.parent_id || '—' }}</td>
              <td data-label="Статус" class="px-4 py-3">
                <span class="rounded-full px-3 py-1 text-xs font-medium" :class="item.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">
                  {{ item.is_active ? 'активний' : 'неактивний' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="text-lg font-semibold text-slate-900">Дерево</h2>
        <div class="mt-4 space-y-3">
          <CategoryTreeItem v-for="node in tree || []" :key="node.id" :node="node" />
        </div>
      </section>
    </div>
  </div>
</template>
