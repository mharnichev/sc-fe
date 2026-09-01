<script setup lang="ts">
import { EyeIcon, FunnelIcon, PencilIcon, PlusIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import type { Product } from '~/composables/useBackofficeApi'

const api = useBackofficeApi()
const route = useRoute()
const toast = useBaseToastNotification()
const assetUrl = useAssetUrl()
const { apiErrorMessage } = useBookingFormatting()
const page = ref(1)
const pageSize = 20
const normalizeBrandQuery = (value: string | (string | null)[] | null | undefined) => {
  const candidate = Array.isArray(value) ? value[0] : value
  return typeof candidate === 'string' && /^\d+$/.test(candidate) ? candidate : ''
}
const filters = reactive({
  search: '',
  category_id: '',
  brand_id: normalizeBrandQuery(route.query.brand_id),
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

const categoryOptions = computed(() => [
  { value: '', label: 'Усі категорії' },
  ...(categories.value?.items || []).map(category => ({ value: String(category.id), label: category.name })),
])
const brandOptions = computed(() => [
  { value: '', label: 'Усі бренди' },
  ...(brands.value?.items || []).map(brand => ({ value: String(brand.id), label: brand.name })),
])
const visibilityOptions = [
  { value: '', label: 'Будь-який статус' },
  { value: 'true', label: 'Показані' },
  { value: 'false', label: 'Приховані' },
]

const pendingDeleteId = ref<number | null>(null)
const pendingVisibilityIds = ref<Set<number>>(new Set())

const isVisibilityPending = (productId: number) => pendingVisibilityIds.value.has(productId)
const setVisibilityPending = (productId: number, pending: boolean) => {
  const next = new Set(pendingVisibilityIds.value)
  if (pending) next.add(productId)
  else next.delete(productId)
  pendingVisibilityIds.value = next
}

const productVisibilityLabel = (product: Product) => {
  if (product.is_effectively_visible) return 'Показаний'
  if (product.hidden_reason === 'category') return 'Прихований категорією'
  if (product.hidden_reason === 'parent_category') return 'Прихований батьківською категорією'
  return 'Прихований вручну'
}

const productVisibilityTone = (product: Product) => product.is_effectively_visible ? 'success' : 'neutral'

const productMainImage = (product: Product) => {
  if (Array.isArray(product.images) && product.images.length) {
    const image = [...product.images]
      .filter(item => item.is_active && item.image_url)
      .sort((first, second) => first.sort_order - second.sort_order || first.id - second.id)[0]
    return image?.image_url ? assetUrl(image.image_url) : ''
  }
  if (product.image_url?.trim()) return assetUrl(product.image_url)
  const legacy = product.attributes_json?.image_urls
  if (!Array.isArray(legacy)) return ''
  const legacyMainImage = legacy.find(value => typeof value === 'string' && value.trim())
  return typeof legacyMainImage === 'string' ? assetUrl(legacyMainImage.trim()) : ''
}

const productMainImages = computed(() => new Map(
  (data.value?.items || []).map(product => [product.id, productMainImage(product)]),
))

const toggleProductVisibility = async (product: Product) => {
  if (isVisibilityPending(product.id)) return
  setVisibilityPending(product.id, true)
  try {
    await api.updateProduct(product.id, { is_active: !product.is_active })
    toast.success(product.is_active ? 'Товар приховано.' : 'Товар показано.')
    await refresh()
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося оновити видимість товару.'))
  }
  finally {
    setVisibilityPending(product.id, false)
  }
}

const handleProductVisibilityChange = (product: Product, event: Event) => {
  // BaseToggle emits after the native input has toggled. Restore the
  // server-confirmed value immediately; the refreshed API row is authoritative.
  (event.target as HTMLInputElement).checked = product.is_active
  void toggleProductVisibility(product)
}

watch(() => route.query.brand_id, async value => {
  const brandId = normalizeBrandQuery(value)
  if (brandId === filters.brand_id) return
  const shouldRefreshImmediately = page.value === 1
  filters.brand_id = brandId
  page.value = 1
  if (shouldRefreshImmediately) await refresh()
})

const applyFilters = async () => {
  const shouldRefreshImmediately = page.value === 1
  page.value = 1
  if (shouldRefreshImmediately) await refresh()
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

    <form @submit.prevent="applyFilters">
      <BaseCard class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div class="grid min-w-0 gap-4 md:grid-cols-2">
          <BaseInput v-model="filters.search" type="search" placeholder="Пошук за назвою" />
          <BaseSelect v-model="filters.category_id" :options="categoryOptions" aria-label="Категорія" />
          <BaseSelect v-model="filters.brand_id" :options="brandOptions" aria-label="Бренд" />
          <BaseSelect v-model="filters.is_active" :options="visibilityOptions" aria-label="Ручна видимість товару" />
        </div>
        <div class="grid gap-3 sm:grid-cols-2 xl:flex xl:flex-wrap xl:justify-end">
          <BaseButton type="submit" variant="primary" class="w-full xl:w-auto">
            <FunnelIcon class="h-4 w-4" aria-hidden="true" />
            <span>Застосувати</span>
          </BaseButton>
          <BaseButton type="button" variant="neutral" class="w-full xl:w-auto" @click="clearFilters">
            <XMarkIcon class="h-4 w-4" aria-hidden="true" />
            <span>Очистити</span>
          </BaseButton>
        </div>
      </BaseCard>
    </form>

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
          <th>Фото</th>
          <th>Назва</th>
          <th>Категорія</th>
          <th>Бренд</th>
          <th>Ціна</th>
          <th>Рекомендована роздрібна ціна</th>
          <th>Склад</th>
          <th>Статус</th>
          <th>Видимість</th>
          <th>Дії</th>
        </tr>
      </template>
          <tr v-for="item in data?.items || []" :key="item.id">
            <td data-label="Фото" class="px-4 py-3">
              <img v-if="productMainImages.get(item.id)" :src="productMainImages.get(item.id)" :alt="item.name" class="h-12 w-12 rounded-xl object-cover">
              <span v-else class="text-xs text-ui-muted">—</span>
            </td>
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
            <td data-label="Видимість" class="px-4 py-3">
              <div class="flex flex-wrap items-center gap-2">
                <BaseBadge :tone="productVisibilityTone(item)">
                  {{ productVisibilityLabel(item) }}
                </BaseBadge>
                <BaseToggle
                  :checked="item.is_active"
                  :loading="isVisibilityPending(item.id)"
                  :aria-label="`${item.is_active ? 'Приховати' : 'Показати'} товар ${item.name}`"
                  @change="handleProductVisibilityChange(item, $event)"
                />
              </div>
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
                  variant="danger-icon"
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
