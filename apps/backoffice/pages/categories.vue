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
        <BaseTable
          caption="Плоский список категорій"
          wrapper-class="rounded-none border-0"
          min-width="48rem"
          :empty="!data?.items.length"
          empty-title="Категорій не знайдено"
        >
          <template #head>
            <tr>
              <th>Назва</th>
              <th>Slug</th>
              <th>Батьківська категорія</th>
              <th>Статус</th>
            </tr>
          </template>
            <tr v-for="item in data?.items || []" :key="item.id">
              <td>
                <p class="font-medium text-ui-primary">{{ item.name }}</p>
                <p class="text-xs text-ui-muted">{{ item.description || 'Без опису' }}</p>
              </td>
              <td class="text-ui-secondary">{{ item.slug }}</td>
              <td class="text-ui-secondary">{{ item.parent_id || '—' }}</td>
              <td>
                <BaseBadge :tone="item.is_active ? 'success' : 'neutral'">
                  {{ item.is_active ? 'активний' : 'неактивний' }}
                </BaseBadge>
              </td>
            </tr>
        </BaseTable>
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
