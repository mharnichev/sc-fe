<script setup lang="ts">
import { ShoppingBagIcon } from '@heroicons/vue/24/outline'
import type { Brand } from '~/composables/useBackofficeApi'
import { getBrandVisibility, summarizeBrandProducts } from '~/utils/brandVisibility'

const api = useBackofficeApi()
const toast = useBaseToastNotification()
const { apiErrorMessage } = useBookingFormatting()
const brandPageSize = 200
const loadAllBrands = async () => {
  const firstPage = await api.getBrands(1, brandPageSize)
  const pageCount = Math.ceil(firstPage.total / firstPage.page_size)
  if (pageCount <= 1) return firstPage

  const remainingPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) => api.getBrands(index + 2, firstPage.page_size)),
  )
  return {
    ...firstPage,
    page_size: firstPage.total,
    items: [firstPage, ...remainingPages].flatMap(page => page.items),
  }
}
const loadBrandProducts = async () => {
  const firstPage = await api.getProducts(1, brandPageSize)
  const products = [...firstPage.items]
  const pageCount = Math.ceil(firstPage.total / firstPage.page_size)
  for (let page = 2; page <= pageCount; page++) {
    const result = await api.getProducts(page, firstPage.page_size)
    products.push(...result.items)
  }
  return summarizeBrandProducts(products)
}
const [brandsState, productsState] = await Promise.all([
  useAsyncData('backoffice-brands', loadAllBrands),
  useAsyncData('backoffice-brand-products', loadBrandProducts, { lazy: true }),
])
const { data, pending, refresh, error } = brandsState
const { data: productSummaries, pending: productsPending, error: productsError, refresh: refreshProducts } = productsState
const brandVisibility = (brand: Brand) => getBrandVisibility(brand, productsError.value ? null : productSummaries.value)
const pendingBrandIds = ref<Set<number>>(new Set())
const search = ref('')
const appliedSearch = ref('')
const visibleBrands = computed(() => {
  const query = appliedSearch.value.toLocaleLowerCase('uk-UA')
  if (!query) return data.value?.items || []
  return (data.value?.items || []).filter(brand => brand.name.toLocaleLowerCase('uk-UA').includes(query))
})

const applySearch = () => {
  appliedSearch.value = search.value.trim()
}

const clearSearch = () => {
  search.value = ''
  appliedSearch.value = ''
}

const isBrandActive = (brand: Brand) => brand.is_active !== false
const isBrandPending = (brandId: number) => pendingBrandIds.value.has(brandId)
const setBrandPending = (brandId: number, pending: boolean) => {
  const next = new Set(pendingBrandIds.value)
  if (pending) next.add(brandId)
  else next.delete(brandId)
  pendingBrandIds.value = next
}

const toggleBrandVisibility = async (brand: Brand) => {
  if (isBrandPending(brand.id)) return
  const nextActive = !isBrandActive(brand)
  setBrandPending(brand.id, true)
  try {
    const updated = await api.updateBrand(brand.id, { is_active: nextActive })
    if (updated.is_active !== nextActive) {
      toast.error('API брендів не повернув оновлений статус видимості.')
      return
    }
    if (data.value) {
      data.value.items = data.value.items.map(item => item.id === brand.id ? updated : item)
    }
    toast.success(nextActive ? 'Бренд увімкнено. Видимість залежить від товарів і категорій.' : 'Бренд приховано.')
    await refresh()
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося оновити видимість бренду.'))
  }
  finally {
    setBrandPending(brand.id, false)
  }
}

const handleBrandVisibilityChange = (brand: Brand, event: Event) => {
  (event.target as HTMLInputElement).checked = isBrandActive(brand)
  void toggleBrandVisibility(brand)
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Каталог</p>
      <h1 class="mt-2 text-3xl font-semibold text-slate-900">Бренди</h1>
    </div>

    <BaseFilterPanel
      :loading="pending"
      :active-count="appliedSearch ? 1 : 0"
      mobile-title="Пошук брендів"
      fields-class="md:grid-cols-1"
      @apply="applySearch"
      @clear="clearSearch"
    >
      <BaseInput
        v-model="search"
        placeholder="Пошук за назвою бренду"
        aria-label="Пошук брендів за назвою"
      />
    </BaseFilterPanel>

    <div v-if="productsError" role="alert" class="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-slate-700">
      <p>Не вдалося перевірити видимість брендів за товарами та категоріями.</p>
      <BaseButton class="mt-2" variant="neutral" size="sm" :loading="productsPending" @click="refreshProducts()">Спробувати ще раз</BaseButton>
    </div>
    <div v-if="error" role="alert" class="text-sm text-red-600">
      Не вдалося завантажити бренди.
      <BaseButton variant="neutral" size="sm" :loading="pending" @click="refresh()">Спробувати ще раз</BaseButton>
    </div>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article v-for="item in visibleBrands" :key="item.id" class="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm" :class="{ 'opacity-65': brandVisibility(item).visible === false }">
        <h2 class="text-lg font-semibold text-slate-900">{{ item.name }}</h2>
        <p class="mt-1 text-xs text-slate-500">{{ item.slug }}</p>
        <p class="mt-4 text-sm leading-7 text-slate-600">{{ item.description || 'Без опису' }}</p>
        <div class="mt-4 space-y-3">
          <BaseToggle
            :checked="isBrandActive(item)"
            label="Показувати бренд"
            :loading="isBrandPending(item.id)"
            :loading-label="isBrandActive(item) ? 'Приховуємо бренд…' : 'Показуємо бренд…'"
            :aria-label="`${isBrandActive(item) ? 'Приховати' : 'Показати'} бренд ${item.name}`"
            :aria-describedby="`brand-visibility-${item.id}`"
            @change="handleBrandVisibilityChange(item, $event)"
          />
          <div :id="`brand-visibility-${item.id}`" aria-live="polite">
            <BaseBadge :tone="brandVisibility(item).visible === true ? 'success' : 'neutral'">
              {{ brandVisibility(item).visible === true ? 'Показаний у магазині' : brandVisibility(item).visible === false ? 'Прихований у магазині' : productsPending ? 'Перевіряємо видимість…' : 'Видимість невідома' }}
            </BaseBadge>
            <p v-if="brandVisibility(item).reason" class="mt-2 text-sm text-slate-600">Причина: {{ brandVisibility(item).reason }}</p>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <NuxtLink
            :to="{ path: '/products', query: { brand_id: String(item.id) } }"
            class="base-button base-button--neutral min-h-9 gap-2 px-3 py-1.5 text-xs"
            :aria-label="`Переглянути товари бренду ${item.name}`"
          >
            <ShoppingBagIcon class="h-4 w-4" aria-hidden="true" />
            Переглянути товари
          </NuxtLink>
        </div>
      </article>
    </div>
    <BaseEmptyState
      v-if="!pending && !error && !visibleBrands.length"
      title="Брендів не знайдено"
      description="Спробуйте змінити пошуковий запит."
    />
  </div>
</template>
