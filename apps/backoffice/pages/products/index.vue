<script setup lang="ts">
import { EyeIcon, FunnelIcon, PencilIcon, PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/vue/24/outline'

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
        <p class="ui-eyebrow text-sm uppercase tracking-[0.3em]">Каталог</p>
        <h1 class="mt-2 text-3xl font-semibold text-ui-primary">Товари</h1>
      </div>
      <NuxtLink to="/products/new" class="base-button base-button--primary min-h-11 gap-2 px-5 py-3 text-sm">
        <PlusIcon class="h-4 w-4" aria-hidden="true" />
        Додати товар
      </NuxtLink>
    </div>

    <BaseCard as="section" class="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <BaseInput v-model="filters.search" placeholder="Пошук за назвою" />
      <BaseSelect native v-model="filters.category_id" aria-label="Категорія">
        <option value="">Усі категорії</option>
        <option v-for="category in categories?.items || []" :key="category.id" :value="String(category.id)">
          {{ category.name }}
        </option>
      </BaseSelect>
      <BaseSelect native v-model="filters.brand_id" aria-label="Бренд">
        <option value="">Усі бренди</option>
        <option v-for="brand in brands?.items || []" :key="brand.id" :value="String(brand.id)">
          {{ brand.name }}
        </option>
      </BaseSelect>
      <BaseSelect native v-model="filters.is_active" aria-label="Статус товару">
        <option value="">Будь-який статус</option>
        <option value="true">Активні</option>
        <option value="false">Неактивні</option>
      </BaseSelect>
      <div class="flex gap-3">
        <BaseButton variant="primary" class="flex-1" @click="applyFilters">
          <FunnelIcon class="h-4 w-4" aria-hidden="true" />
          <span>Застосувати</span>
        </BaseButton>
        <BaseButton variant="neutral" class="flex-1" @click="clearFilters">
          <XMarkIcon class="h-4 w-4" aria-hidden="true" />
          <span>Очистити</span>
        </BaseButton>
      </div>
    </BaseCard>

    <BaseCard variant="subtle" padding="sm" class="text-sm text-ui-secondary">
      Total: {{ data?.total || 0 }}
    </BaseCard>

    <BaseTable
      caption="Каталог товарів"
      min-width="68rem"
      :empty="!data?.items.length"
      empty-title="Товарів не знайдено"
    >
      <template #head>
        <tr>
          <th>Назва</th>
          <th>Категорія</th>
          <th>Бренд</th>
          <th>Ціна</th>
          <th>Рекомендована роздрібна ціна</th>
          <th>Склад</th>
          <th>Статус</th>
          <th>Дії</th>
        </tr>
      </template>
          <tr v-for="item in data?.items || []" :key="item.id">
            <td data-label="Назва" class="px-4 py-3">
              <p class="font-medium text-ui-primary">{{ item.name }}</p>
              <p class="text-xs text-ui-muted">{{ item.slug }}</p>
              <p v-if="item.sku" class="text-xs text-ui-muted">SKU: {{ item.sku }}</p>
            </td>
            <td data-label="Категорія" class="text-ui-secondary">{{ item.category?.name || '—' }}</td>
            <td data-label="Бренд" class="text-ui-secondary">{{ item.brand?.name || '—' }}</td>
            <td data-label="Ціна" class="text-ui-secondary">{{ item.price }}</td>
            <td data-label="Рекомендована ціна" class="text-ui-secondary">{{ item.recommended_retail_price }}</td>
            <td data-label="Склад" class="text-ui-secondary">{{ item.stock_quantity }}</td>
            <td data-label="Статус" class="px-4 py-3">
              <BaseBadge :tone="item.is_active ? 'success' : 'neutral'">
                {{ item.is_active ? 'активний' : 'неактивний' }}
              </BaseBadge>
            </td>
            <td data-label="Дії" class="px-4 py-3">
              <div class="flex flex-wrap gap-2">
                <NuxtLink
                  :to="`/products/${item.id}`"
                  class="base-button base-button--icon h-8 w-8 p-0"
                  aria-label="Переглянути товар"
                  title="Переглянути"
                >
                  <EyeIcon class="h-4 w-4" aria-hidden="true" />
                  <span class="sr-only">Переглянути</span>
                </NuxtLink>
                <NuxtLink
                  :to="`/products/${item.id}`"
                  class="base-button base-button--icon h-8 w-8 p-0"
                  aria-label="Редагувати товар"
                  title="Редагувати"
                >
                  <PencilIcon class="h-4 w-4" aria-hidden="true" />
                  <span class="sr-only">Редагувати</span>
                </NuxtLink>
                <BaseButton
                  variant="danger-outline"
                  class="h-8 w-8 p-0"
                  :disabled="pendingDeleteId === item.id"
                  :aria-label="pendingDeleteId === item.id ? 'Видалення товару' : 'Видалити товар'"
                  :title="pendingDeleteId === item.id ? 'Видалення...' : 'Видалити'"
                  @click="removeProduct(item.id)"
                >
                  <TrashIcon class="h-4 w-4" aria-hidden="true" />
                  <span class="sr-only">{{ pendingDeleteId === item.id ? 'Видалення...' : 'Видалити' }}</span>
                </BaseButton>
              </div>
            </td>
          </tr>
    </BaseTable>
    <div class="flex flex-wrap gap-3">
      <BaseButton variant="neutral" :disabled="page === 1" @click="prev">Попередня</BaseButton>
      <BaseButton variant="neutral" :disabled="!data || page * pageSize >= data.total" @click="next">Наступна</BaseButton>
    </div>
  </div>
</template>
