<script setup lang="ts">
import { productDisplayImages } from '~/utils/productImages'
import { canManageCatalog } from '~/utils/catalogAccess'
import { PencilIcon, ArrowLeftIcon, TagIcon, CurrencyDollarIcon, CubeIcon, DocumentTextIcon, PhotoIcon, PlusIcon, CodeBracketIcon, InformationCircleIcon } from '@heroicons/vue/24/outline'
import { formatPrice } from '@shared-utils'
import type { PaginatedResponse, ProductImage, ProductPayload, ShopPromotion } from '~/composables/useBackofficeApi'

provide('compactFieldHints', true)

const catalogAuth = useAuthStore()
const catalogEditable = computed(() => canManageCatalog(catalogAuth.user))

const route = useRoute()
const router = useRouter()
const api = useBackofficeApi()
const toast = useBaseToastNotification()
const { apiErrorMessage, formatDateTime } = useBookingFormatting()

const productId = computed(() => route.params.id as string)
const isNewProduct = computed(() => productId.value === 'new')

const editMode = ref(false)

const [{ data: productResult, refresh: refreshProduct }, { data: categories }, { data: brands }] = await Promise.all([
  useAsyncData(
    () => `product-details-${productId.value}`,
    async () => ({
      product: isNewProduct.value ? null : await api.getProduct(productId.value),
    }),
    { watch: [productId] },
  ),
  useAsyncData('editor-categories', () => api.getCategories(1, 200)),
  useAsyncData('editor-brands', () => api.getBrands(1, 200)),
])

const product = computed(() => productResult.value?.product ?? null)
const shopPromotionModalOpen = ref(false)
const selectedShopPromotion = ref<ShopPromotion | null>(null)

const { data: shopPromotionResult, pending: shopPromotionsPending, error: shopPromotionsError, refresh: refreshShopPromotions } = await useAsyncData(
  () => `product-shop-promotions-${productId.value}`,
  async (): Promise<PaginatedResponse<ShopPromotion>> => isNewProduct.value
    ? { total: 0, page: 1, page_size: 100, items: [] }
    : await api.adminGetShopPromotions(1, 100, { product_id: Number(productId.value) }),
  { watch: [productId] },
)

const shopPromotions = computed(() => shopPromotionResult.value?.items || [])
const activeShopPromotions = computed(() => shopPromotions.value.filter(promotion => promotion.status === 'active'))
const scheduledShopPromotions = computed(() => shopPromotions.value.filter(promotion => promotion.status === 'scheduled'))
const expiredShopPromotions = computed(() => shopPromotions.value.filter(promotion => promotion.status === 'expired'))
const shopPromotionPeriod = (promotion: ShopPromotion) => {
  if (!promotion.starts_at && !promotion.ends_at) return 'Без обмеження'
  if (promotion.starts_at && promotion.ends_at) return `${formatDateTime(promotion.starts_at)} — ${formatDateTime(promotion.ends_at)}`
  if (promotion.starts_at) return `З ${formatDateTime(promotion.starts_at)}`
  return `До ${formatDateTime(promotion.ends_at)}`
}
const shopPromotionDiscount = (promotion: ShopPromotion) => promotion.discount_type === 'percent'
  ? `${promotion.discount_value}%`
  : `${promotion.discount_type}: ${promotion.discount_value}`
const groupTone = (tone: string): 'success' | 'info' | 'neutral' => tone as 'success' | 'info' | 'neutral'
const openShopPromotionForm = () => {
  if (!catalogEditable.value) return
  selectedShopPromotion.value = null
  shopPromotionModalOpen.value = true
}
const editShopPromotion = (promotion: ShopPromotion) => {
  if (!catalogEditable.value) return
  selectedShopPromotion.value = promotion
  shopPromotionModalOpen.value = true
}
const handleShopPromotionSaved = async (message: string) => {
  toast.success(message)
  selectedShopPromotion.value = null
  await refreshShopPromotions()
}
const assetUrl = useAssetUrl()
const managedImages = ref<ProductImage[]>([])

watch(() => product.value?.images, value => {
  managedImages.value = Array.isArray(value) ? [...value] : []
}, { immediate: true, deep: true })

const legacyGalleryImages = computed(() => {
  const images = new Set<string>()
  if (product.value?.image_url) images.add(product.value.image_url)
  const fromAttributes = product.value?.attributes_json?.image_urls
  if (Array.isArray(fromAttributes)) {
    for (const image of fromAttributes) {
      if (typeof image === 'string' && image.trim()) images.add(image.trim())
    }
  }
  return Array.from(images)
})

const galleryImages = computed(() => {
  const projected = product.value?.display_image_urls
  if (Array.isArray(projected) || product.value?.display_image_url) {
    return productDisplayImages(product.value).map(url => ({ url: assetUrl(url), alt: product.value?.name || 'Фотографія товару' }))
  }
  if (managedImages.value.length) {
    return managedImages.value
      .filter(image => image.is_active && image.image_url)
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
      .map(image => ({ url: assetUrl(image.image_url!), alt: image.alt || product.value?.name || 'Фотографія товару' }))
  }
  return legacyGalleryImages.value.map(url => ({ url: assetUrl(url), alt: product.value?.name || 'Фотографія товару' }))
})

const attributeEntries = computed(() => {
  if (!product.value?.attributes_json) return []
  return Object.entries(product.value.attributes_json)
})

const initialValue = computed<ProductPayload | undefined>(() => {
  if (!product.value) return undefined
  return {
    name: product.value.name,
    slug: product.value.slug,
    description: product.value.description,
    ingredients: product.value.ingredients,
    short_description: product.value.short_description,
    price: Number(product.value.price),
    shop_price: product.value.shop_price == null ? null : Number(product.value.shop_price),
    recommended_retail_price: product.value.recommended_retail_price ? Number(product.value.recommended_retail_price) : null,
    sku: product.value.sku,
    stock_quantity: product.value.stock_quantity,
    is_active: product.value.is_active,
    image_url: product.value.image_url,
    external_url: product.value.external_url,
    availability_status: product.value.availability_status,
    attributes_json: product.value.attributes_json,
    brand_id: product.value.brand_id,
    category_id: product.value.category_id,
  }
})

const pending = ref(false)
const errorMessage = ref('')

const submit = async (payload: ProductPayload) => {
  if (!catalogEditable.value) return
  pending.value = true
  errorMessage.value = ''
  try {
    if (isNewProduct.value) {
      const createdProduct = await api.createProduct(payload)
      toast.success('Товар створено.')
      await router.replace(`/products/${createdProduct.id}`)
      return
    }

    await api.updateProduct(productId.value, payload)
    editMode.value = false
    toast.success('Товар збережено.')
    await refreshProduct()
  }
  catch (error: unknown) {
    errorMessage.value =
      typeof error === 'object' && error && 'data' in error && typeof error.data === 'object' && error.data && 'detail' in error.data
        ? String(error.data.detail)
        : 'Не вдалося зберегти товар.'
    toast.error(errorMessage.value)
  }
  finally {
    pending.value = false
  }
}
const productMetrics = computed(() => product.value ? [
  { label: 'Ціна', value: formatPrice(product.value.price), hint: 'Базова ціна товару в каталозі.', icon: CurrencyDollarIcon },
  { label: 'Ціна магазину', value: formatPrice(product.value.shop_price ?? product.value.price), hint: 'Ціна для сайту та замовлень до застосування акцій. Якщо не задана, використовується базова ціна.', icon: TagIcon },
  { label: 'Рекомендована', value: product.value.recommended_retail_price != null ? formatPrice(product.value.recommended_retail_price) : '—', hint: 'Рекомендована роздрібна ціна виробника.', icon: CurrencyDollarIcon },
  { label: 'На складі', value: product.value.stock_quantity, hint: 'Загальна кількість одиниць товару на складі.', icon: CubeIcon },
  { label: 'У резерві', value: product.value.reserved_quantity, hint: 'Одиниці, зарезервовані під замовлення.', icon: CubeIcon },
  { label: 'Доступно', value: product.value.available_quantity, hint: 'Кількість, доступна для нових замовлень з урахуванням резерву.', icon: CubeIcon },
] : [])
const productMetadata = computed(() => product.value ? [
  { label: 'SKU', value: product.value.sku || '—' },
  { label: 'Доступність', value: product.value.availability_status || '—' },
  { label: 'Бренд', value: product.value.brand?.name || '—' },
  { label: 'Категорія', value: product.value.category?.name || '—' },
] : [])
</script>

<template>
  <div class="product-detail space-y-4">
    <template v-if="isNewProduct && catalogEditable">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold text-ui-primary">Новий товар</h1>
        <NuxtLink to="/products" class="base-button base-button--neutral min-h-9 gap-2 px-3 py-2 text-sm"><ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />До каталогу</NuxtLink>
      </header>
      <p v-if="errorMessage" class="text-sm text-ui-danger" role="alert">{{ errorMessage }}</p>
      <ProductForm :categories="categories?.items || []" :brands="brands?.items || []" :loading="pending" submit-label="Створити товар" @submit="submit" />
      <p class="flex items-center gap-2 text-xs text-ui-muted"><PhotoIcon class="h-4 w-4 shrink-0" aria-hidden="true" />Спочатку збережіть товар, потім додайте фотографії.</p>
    </template>

    <template v-else-if="product">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 flex-1 basis-64">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="min-w-0 break-words text-xl font-semibold text-ui-primary">{{ product.name }}</h1>
            <BaseBadge :tone="product.is_active ? 'success' : 'neutral'">{{ product.is_active ? 'Активний' : 'Неактивний' }}</BaseBadge>
          </div>
          <p class="mt-1 break-all text-xs text-ui-muted">#{{ product.id }} · {{ product.slug }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <NuxtLink to="/products" class="base-button base-button--neutral min-h-9 gap-1.5 px-3 py-2 text-xs"><ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />До каталогу</NuxtLink>
          <BaseButton v-if="catalogEditable" variant="primary" size="sm" :aria-label="editMode ? 'Закрити редагування' : 'Редагувати товар'" @click="editMode = !editMode">
            <PencilIcon class="h-4 w-4" aria-hidden="true" />{{ editMode ? 'Закрити редагування' : 'Редагувати' }}
          </BaseButton>
        </div>
      </header>
      <p v-if="errorMessage" class="text-sm text-ui-danger" role="alert">{{ errorMessage }}</p>
      <ProductForm v-if="editMode && catalogEditable" :categories="categories?.items || []" :brands="brands?.items || []" :initial-value="initialValue" :loading="pending" submit-label="Зберегти зміни" @submit="submit" />

      <div v-else class="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.45fr)]">
        <BaseCard as="section" padding="sm" class="min-w-0 space-y-4">
          <h2 class="flex items-center gap-2 text-base font-semibold text-ui-primary"><DocumentTextIcon class="h-4 w-4 text-ui-muted" aria-hidden="true" />Огляд товару</h2>
          <dl class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div v-for="metric in productMetrics" :key="metric.label" class="min-w-0 rounded-xl bg-ui-subtle p-2.5">
              <dt class="flex items-center gap-1 text-xs text-ui-muted">
                <component :is="metric.icon" class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span class="min-w-0 flex-1">{{ metric.label }}</span><BaseFieldHelp :label="metric.label" :text="metric.hint" />
              </dt>
              <dd class="mt-1 break-words text-lg font-semibold text-ui-primary">{{ metric.value }}</dd>
            </div>
          </dl>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1 sm:col-span-2">
              <h3 class="flex items-center gap-1.5 text-sm font-medium text-ui-primary">Короткий опис<BaseFieldHelp label="Короткий опис" text="Стислий опис товару для швидкого ознайомлення в каталозі." /></h3>
              <p class="break-words whitespace-pre-line text-sm leading-5 text-ui-secondary">{{ product.short_description || 'Без короткого опису' }}</p>
            </div>
            <div class="space-y-1">
              <h3 class="flex items-center gap-1.5 text-sm font-medium text-ui-primary">Опис<BaseFieldHelp label="Опис" text="Призначення товару, особливості та спосіб застосування." /></h3>
              <p tabindex="0" role="region" aria-label="Опис товару" class="max-h-64 overflow-y-auto break-words whitespace-pre-line text-sm leading-5 text-ui-secondary">{{ product.description || 'Без опису' }}</p>
            </div>
            <div class="space-y-1">
              <h3 class="flex items-center gap-1.5 text-sm font-medium text-ui-primary">Склад<BaseFieldHelp label="Склад" text="Інгредієнти товару, зазначені виробником." /></h3>
              <p tabindex="0" role="region" aria-label="Склад товару" class="max-h-64 overflow-y-auto break-words whitespace-pre-line text-sm leading-5 text-ui-secondary">{{ product.ingredients || 'Склад не вказано' }}</p>
            </div>
          </div>
        </BaseCard>
        <BaseCard as="section" padding="sm" class="min-w-0 space-y-3 self-start">
          <h2 class="flex items-center gap-2 text-base font-semibold text-ui-primary"><InformationCircleIcon class="h-4 w-4 text-ui-muted" aria-hidden="true" />Дані товару</h2>
          <dl class="divide-y divide-ui text-sm">
            <div v-for="entry in productMetadata" :key="entry.label" class="grid grid-cols-[100px_minmax(0,1fr)] gap-2 py-2">
              <dt class="text-ui-muted">{{ entry.label }}</dt><dd class="break-words font-medium text-ui-primary">{{ entry.value }}</dd>
            </div>
          </dl>
          <details class="border-t border-ui pt-2">
            <summary class="cursor-pointer text-xs font-medium text-ui-secondary">Посилання та дати</summary>
            <dl class="mt-2 space-y-2 text-xs">
              <div><dt class="text-ui-muted">Зовнішній URL</dt><dd class="break-all"><a v-if="product.external_url" :href="product.external_url" target="_blank" rel="noreferrer" class="text-ui-accent hover:underline">{{ product.external_url }}</a><span v-else>—</span></dd></div>
              <div><dt class="text-ui-muted">URL зображення</dt><dd class="break-all text-ui-secondary">{{ product.image_url || '—' }}</dd></div>
              <div><dt class="text-ui-muted">Створено</dt><dd class="break-words text-ui-secondary">{{ product.created_at }}</dd></div>
              <div><dt class="text-ui-muted">Оновлено</dt><dd class="break-words text-ui-secondary">{{ product.updated_at }}</dd></div>
            </dl>
          </details>
          <details class="border-t border-ui pt-2">
            <summary class="cursor-pointer text-xs font-medium text-ui-secondary"><CodeBracketIcon class="mr-1 inline h-4 w-4" aria-hidden="true" />Атрибути JSON</summary>
            <div v-if="attributeEntries.length" class="mt-2 max-h-64 space-y-2 overflow-y-auto">
              <div v-for="[key, value] in attributeEntries" :key="key" class="min-w-0 rounded-lg bg-ui-subtle p-2">
                <p class="break-all text-xs font-medium text-ui-primary">{{ key }}</p>
                <pre class="mt-1 overflow-x-auto whitespace-pre-wrap break-words text-xs text-ui-secondary">{{ typeof value === 'string' ? value : JSON.stringify(value, null, 2) }}</pre>
              </div>
            </div>
            <p v-else class="mt-2 text-xs text-ui-muted">Додаткових атрибутів немає.</p>
          </details>
        </BaseCard>
      </div>

      <div class="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.45fr)]">
        <ProductImagesManager v-if="catalogEditable" v-show="editMode" :product-id="product.id" :initial-images="managedImages" :display-image-urls="product.display_image_urls" :display-image-sources="product.images" :legacy-image-urls="legacyGalleryImages" @change="managedImages = $event; refreshProduct()" />
        <BaseCard v-if="!editMode || !catalogEditable" as="section" padding="sm" class="min-w-0 space-y-2">
          <h2 class="flex items-center gap-2 text-base font-semibold text-ui-primary"><PhotoIcon class="h-4 w-4" aria-hidden="true" />Зображення</h2>
          <div v-if="galleryImages.length" class="flex gap-2 overflow-x-auto">
            <a v-for="image in galleryImages" :key="image.url" :href="image.url" target="_blank" rel="noreferrer" class="shrink-0 rounded-xl border border-ui"><img :src="image.url" :alt="image.alt" class="h-28 w-28 object-contain" loading="lazy"></a>
          </div>
          <p v-else class="text-xs text-ui-muted">Для цього товару немає доступних зображень.</p>
        </BaseCard>
        <InventorySettingsPanel v-if="catalogEditable" :product-id="product.id" :barcode="product.barcode" :allow-backorder="product.allow_backorder" @saved="refreshProduct" />
      </div>

      <BaseCard as="section" padding="sm" class="min-w-0 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="flex items-center gap-2 text-base font-semibold text-ui-primary"><TagIcon class="h-4 w-4 text-ui-muted" aria-hidden="true" />Акції товару<BaseFieldHelp label="Акції товару" text="Знижки та промокоди, які поширюються на цей товар. Підсумкова ціна враховує період дії та пріоритет акцій." /></h2>
          <BaseButton v-if="catalogEditable" variant="secondary" size="sm" title="Створити акцію для цього товару" @click="openShopPromotionForm"><PlusIcon class="h-4 w-4" aria-hidden="true" />Створити акцію</BaseButton>
        </div>
        <p v-if="shopPromotionsError" class="text-sm text-ui-danger" role="alert">{{ apiErrorMessage(shopPromotionsError, 'Не вдалося завантажити акції товара.') }}</p>
        <BaseLoader v-else-if="shopPromotionsPending" label="Завантаження акцій…" />
        <p v-else-if="!shopPromotions.length" class="text-xs text-ui-muted">Для цього товару акцій не знайдено.</p>
        <div v-else class="grid gap-3 lg:grid-cols-3">
          <div v-for="group in [
            { title: 'Активні', items: activeShopPromotions, tone: 'success' },
            { title: 'Заплановані', items: scheduledShopPromotions, tone: 'info' },
            { title: 'Завершені', items: expiredShopPromotions, tone: 'neutral' },
          ]" :key="group.title" class="min-w-0 space-y-2 rounded-xl bg-ui-subtle p-3">
            <div class="flex items-center justify-between gap-2"><h3 class="text-sm font-medium text-ui-primary">{{ group.title }}</h3><BaseBadge :tone="groupTone(group.tone)">{{ group.items.length }}</BaseBadge></div>
            <article v-for="promotion in group.items" :key="promotion.id" class="space-y-2 rounded-lg border border-ui p-2.5 text-xs">
              <div class="flex items-start justify-between gap-2"><p class="break-words font-medium text-ui-primary">{{ promotion.name }}</p><BaseButton v-if="catalogEditable" variant="ghost" size="sm" aria-label="Редагувати акцію" @click="editShopPromotion(promotion)"><PencilIcon class="h-3.5 w-3.5" aria-hidden="true" /></BaseButton></div>
              <dl class="space-y-1 text-ui-secondary">
                <div class="flex justify-between gap-2"><dt>Знижка</dt><dd>{{ shopPromotionDiscount(promotion) }}</dd></div>
                <div class="flex justify-between gap-2"><dt>Період</dt><dd class="text-right">{{ shopPromotionPeriod(promotion) }}</dd></div>
                <div class="flex justify-between gap-2"><dt>Промокод</dt><dd class="break-all">{{ promotion.code || '—' }}</dd></div>
                <div class="flex justify-between gap-2"><dt>Пріоритет</dt><dd>{{ promotion.priority }}</dd></div>
                <div class="flex justify-between gap-2"><dt>Статус</dt><dd>{{ promotion.status }}</dd></div>
              </dl>
            </article>
            <p v-if="!group.items.length" class="text-xs text-ui-muted">Немає акцій.</p>
          </div>
        </div>
      </BaseCard>
      <ShopPromotionFormModal v-if="catalogEditable" v-model="shopPromotionModalOpen" :promotion="selectedShopPromotion" :initial-product-ids="[product.id]" @saved="handleShopPromotionSaved" />
    </template>
    <BaseEmptyState v-else title="Товар не знайдено" description="Поверніться до каталогу та виберіть інший товар.">
      <template #actions><NuxtLink to="/products" class="base-button base-button--neutral min-h-9 px-3 py-2 text-sm">До каталогу</NuxtLink></template>
    </BaseEmptyState>
  </div>
</template>
