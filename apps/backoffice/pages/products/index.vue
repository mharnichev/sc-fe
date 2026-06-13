<script setup lang="ts">
import { EyeIcon, PencilIcon, PlusIcon, TrashIcon } from '@heroicons/vue/24/outline'

const api = useBackofficeApi()
const toast = useBaseToastNotification()
const page = ref(1)
const pageSize = 20
const filters = reactive({
  search: '',
  category_id: '',
  brand_id: '',
  is_active: '',
})

const { data, refresh } = await useAsyncData(
  'backoffice-products',
  () =>
    api.getProducts(page.value, pageSize, {
      search: filters.search || undefined,
      category_id: filters.category_id ? Number(filters.category_id) : null,
      brand_id: filters.brand_id ? Number(filters.brand_id) : null,
      is_active:
        filters.is_active === ''
          ? null
          : filters.is_active === 'true',
    }),
  { watch: [page] },
)

const [{ data: categories }, { data: brands }] = await Promise.all([
  useAsyncData('product-categories-options', () => api.getCategories(1, 200)),
  useAsyncData('product-brands-options', () => api.getBrands(1, 200)),
])

const pendingDeleteId = ref<number | null>(null)

const applyFilters = async () => {
  page.value = 1
  if (page.value !== 1) return
  await refresh()
}

const clearFilters = async () => {
  const shouldRefreshImmediately = page.value === 1
  filters.search = ''
  filters.category_id = ''
  filters.brand_id = ''
  filters.is_active = ''
  page.value = 1
  if (shouldRefreshImmediately) {
    await refresh()
  }
}

const removeProduct = async (productId: number) => {
  if (!confirm(`Видалити product #${productId}?`)) return
  pendingDeleteId.value = productId
  try {
    await api.deleteProduct(productId)
    toast.success('Товар видалено.')
    await refresh()
  }
  catch (error: unknown) {
    toast.error(
      typeof error === 'object' && error && 'data' in error && typeof error.data === 'object' && error.data && 'detail' in error.data
        ? String(error.data.detail)
        : 'Не вдалося видалити товар.',
    )
  }
  finally {
    pendingDeleteId.value = null
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
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Каталог</p>
        <h1 class="mt-2 text-3xl font-semibold text-slate-900">Товари</h1>
      </div>
      <NuxtLink to="/products/new" class="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white">
        <PlusIcon class="h-4 w-4" aria-hidden="true" />
        Додати товар
      </NuxtLink>
    </div>

    <section class="grid gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-5">
      <input v-model="filters.search" placeholder="Пошук за назвою" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
      <select v-model="filters.category_id" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
        <option value="">Усі категорії</option>
        <option v-for="category in categories?.items || []" :key="category.id" :value="String(category.id)">
          {{ category.name }}
        </option>
      </select>
      <select v-model="filters.brand_id" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
        <option value="">Усі бренди</option>
        <option v-for="brand in brands?.items || []" :key="brand.id" :value="String(brand.id)">
          {{ brand.name }}
        </option>
      </select>
      <select v-model="filters.is_active" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
        <option value="">Будь-який статус</option>
        <option value="true">Активні</option>
        <option value="false">Неактивні</option>
      </select>
      <div class="flex gap-3">
        <button class="flex-1 rounded-full bg-slate-950 px-4 py-3 text-sm font-medium text-white" @click="applyFilters">Застосувати</button>
        <button class="flex-1 rounded-full border border-slate-300 px-4 py-3 text-sm" @click="clearFilters">Очистити</button>
      </div>
    </section>

    <div class="rounded-[1.25rem] bg-slate-50 px-4 py-3 text-sm text-slate-600">
      Total: {{ data?.total || 0 }}
    </div>

    <div class="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Назва</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Категорія</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Бренд</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Ціна</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Рекомендована роздрібна ціна</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Склад</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Статус</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Дії</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="item in data?.items || []" :key="item.id">
            <td data-label="Назва" class="px-4 py-3">
              <p class="font-medium text-slate-900">{{ item.name }}</p>
              <p class="text-xs text-slate-500">{{ item.slug }}</p>
              <p v-if="item.sku" class="text-xs text-slate-400">SKU: {{ item.sku }}</p>
            </td>
            <td data-label="Категорія" class="px-4 py-3 text-slate-700">{{ item.category?.name || '—' }}</td>
            <td data-label="Бренд" class="px-4 py-3 text-slate-700">{{ item.brand?.name || '—' }}</td>
            <td data-label="Ціна" class="px-4 py-3 text-slate-700">{{ item.price }}</td>
            <td data-label="Рекомендована ціна" class="px-4 py-3 text-slate-700">{{ item.recommended_retail_price }}</td>
            <td data-label="Склад" class="px-4 py-3 text-slate-700">{{ item.stock_quantity }}</td>
            <td data-label="Статус" class="px-4 py-3">
              <span class="rounded-full px-3 py-1 text-xs font-medium" :class="item.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">
                {{ item.is_active ? 'активний' : 'неактивний' }}
              </span>
            </td>
            <td data-label="Дії" class="px-4 py-3">
              <div class="flex flex-wrap gap-2">
                <NuxtLink
                  :to="`/products/${item.id}`"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50"
                  aria-label="Переглянути товар"
                  title="Переглянути"
                >
                  <EyeIcon class="h-4 w-4" aria-hidden="true" />
                  <span class="sr-only">Переглянути</span>
                </NuxtLink>
                <NuxtLink
                  :to="`/products/${item.id}`"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50"
                  aria-label="Редагувати товар"
                  title="Редагувати"
                >
                  <PencilIcon class="h-4 w-4" aria-hidden="true" />
                  <span class="sr-only">Редагувати</span>
                </NuxtLink>
                <button
                  class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-300 text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                  :disabled="pendingDeleteId === item.id"
                  :aria-label="pendingDeleteId === item.id ? 'Видалення товару' : 'Видалити товар'"
                  :title="pendingDeleteId === item.id ? 'Видалення...' : 'Видалити'"
                  @click="removeProduct(item.id)"
                >
                  <TrashIcon class="h-4 w-4" aria-hidden="true" />
                  <span class="sr-only">{{ pendingDeleteId === item.id ? 'Видалення...' : 'Видалити' }}</span>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="flex flex-wrap gap-3">
      <button :disabled="page === 1" class="rounded-full border border-slate-300 px-4 py-2 text-sm disabled:opacity-50" @click="prev">Попередня</button>
      <button :disabled="!data || page * pageSize >= data.total" class="rounded-full border border-slate-300 px-4 py-2 text-sm disabled:opacity-50" @click="next">Наступна</button>
    </div>
  </div>
</template>
