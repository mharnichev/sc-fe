<script setup lang="ts">
import { PencilIcon } from '@heroicons/vue/24/outline'
import { formatPrice } from '@shared-utils'
import type { ProductPayload } from '~/composables/useBackofficeApi'

const route = useRoute()
const router = useRouter()
const api = useBackofficeApi()
const toast = useBaseToastNotification()

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

const galleryImages = computed(() => {
  const images = new Set<string>()

  if (product.value?.image_url) images.add(product.value.image_url)

  const fromAttributes = product.value?.attributes_json?.image_urls
  if (Array.isArray(fromAttributes)) {
    for (const image of fromAttributes) {
      if (typeof image === 'string' && image.trim()) images.add(image)
    }
  }

  return Array.from(images)
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
    short_description: product.value.short_description,
    price: Number(product.value.price),
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
</script>

<template>
  <div class="space-y-6">
    <template v-if="isNewProduct">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="ui-eyebrow text-sm uppercase tracking-[0.3em]">Каталог</p>
          <h1 class="mt-2 text-3xl font-semibold text-ui-primary">Новий товар</h1>
          <p class="mt-2 text-sm text-ui-muted">Заповніть дані товару для додавання до каталогу.</p>
        </div>
        <NuxtLink to="/products" class="base-button base-button--neutral min-h-10 px-4 py-2 text-sm">
          Назад до списку
        </NuxtLink>
      </div>

      <p v-if="errorMessage" class="text-sm text-ui-danger" role="alert">
        {{ errorMessage }}
      </p>
      <ProductForm
        :categories="categories?.items || []"
        :brands="brands?.items || []"
        :loading="pending"
        submit-label="Створити товар"
        @submit="submit"
      />
    </template>

    <template v-else-if="product">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Каталог</p>
          <h1 class="mt-2 text-3xl font-semibold text-slate-900">{{ product.name }}</h1>
          <p class="mt-2 text-sm text-slate-500">Товар #{{ product.id }} · {{ product.slug }}</p>
        </div>
        <div class="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <NuxtLink to="/products" class="rounded-full border border-slate-300 px-5 py-3 text-sm">
            Назад до списку
          </NuxtLink>
          <BaseButton
            class="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white"
            :aria-label="editMode ? 'Закрити редагування' : 'Редагувати товар'"
            :title="editMode ? 'Закрити редагування' : 'Редагувати'"
            @click="editMode = !editMode"
          >
            <template v-if="editMode">
              Закрити редагування
            </template>
            <template v-else>
              <PencilIcon class="h-4 w-4" aria-hidden="true" />
              <span class="sr-only">Редагувати товар</span>
            </template>
          </BaseButton>
        </div>
      </div>

      <ProductForm
        v-if="editMode"
        :categories="categories?.items || []"
        :brands="brands?.items || []"
        :initial-value="initialValue"
        :loading="pending"
        submit-label="Зберегти зміни"
        @submit="submit"
      />

      <div v-else class="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <section class="space-y-6 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div class="space-y-3">
          <h2 class="text-xl font-semibold text-slate-900">Зображення</h2>
          <div v-if="galleryImages.length" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <a
                v-for="image in galleryImages"
                :key="image"
                :href="image"
                target="_blank"
                rel="noreferrer"
                class="group overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50"
            >
              <img :src="image" :alt="product.name" class="h-64 w-full object-cover transition group-hover:scale-[1.02]">
            </a>
          </div>
          <p v-else class="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            Для цього товару немає доступних зображень.
          </p>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-xl font-semibold text-slate-900">Огляд</h2>
          <span class="rounded-full px-3 py-1 text-xs font-medium" :class="product.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">
            {{ product.is_active ? 'активний' : 'неактивний' }}
          </span>
        </div>

        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div class="rounded-2xl bg-slate-50 p-4">
            <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Ціна</p>
            <p class="mt-2 text-2xl font-semibold text-slate-900">{{ formatPrice(product.price) }}</p>
          </div>
          <div class="rounded-2xl bg-slate-50 p-4">
            <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Рекомендована роздрібна ціна</p>
            <p class="mt-2 text-2xl font-semibold text-slate-900">
              {{ product.recommended_retail_price ? formatPrice(product.recommended_retail_price) : '—' }}
            </p>
          </div>
          <div class="rounded-2xl bg-slate-50 p-4">
            <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Склад</p>
            <p class="mt-2 text-2xl font-semibold text-slate-900">{{ product.stock_quantity }}</p>
          </div>
        </div>

        <div class="grid gap-6 md:grid-cols-2">
          <div class="space-y-2">
            <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Короткий опис</p>
            <p class="rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
              {{ product.short_description || 'Без короткого опису' }}
            </p>
          </div>
          <div class="space-y-2">
            <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Опис</p>
            <p class="rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700 whitespace-pre-line">
              {{ product.description || 'Без опису' }}
            </p>
          </div>
        </div>
      </section>

      <section class="space-y-6">
        <div class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 class="text-xl font-semibold text-slate-900">Мета</h2>
          <dl class="mt-4 space-y-4 text-sm">
            <div class="grid grid-cols-[140px_1fr] gap-3">
              <dt class="text-slate-500">SKU</dt>
              <dd class="font-medium text-slate-900">{{ product.sku || '—' }}</dd>
            </div>
            <div class="grid grid-cols-[140px_1fr] gap-3">
              <dt class="text-slate-500">Доступність</dt>
              <dd class="font-medium text-slate-900">{{ product.availability_status || '—' }}</dd>
            </div>
            <div class="grid grid-cols-[140px_1fr] gap-3">
              <dt class="text-slate-500">Бренд</dt>
              <dd class="font-medium text-slate-900">{{ product.brand?.name || '—' }}</dd>
            </div>
            <div class="grid grid-cols-[140px_1fr] gap-3">
              <dt class="text-slate-500">Категорія</dt>
              <dd class="font-medium text-slate-900">{{ product.category?.name || '—' }}</dd>
            </div>
            <div class="grid grid-cols-[140px_1fr] gap-3">
              <dt class="text-slate-500">Зовнішній URL</dt>
              <dd class="font-medium break-all text-slate-900">
                <a v-if="product.external_url" :href="product.external_url" target="_blank" rel="noreferrer" class="text-cyan-700 hover:underline">
                  {{ product.external_url }}
                </a>
                <span v-else>—</span>
              </dd>
            </div>
            <div class="grid grid-cols-[140px_1fr] gap-3">
              <dt class="text-slate-500">URL зображення</dt>
              <dd class="font-medium break-all text-slate-900">{{ product.image_url || '—' }}</dd>
            </div>
            <div class="grid grid-cols-[140px_1fr] gap-3">
              <dt class="text-slate-500">Створено</dt>
              <dd class="font-medium text-slate-900">{{ product.created_at }}</dd>
            </div>
            <div class="grid grid-cols-[140px_1fr] gap-3">
              <dt class="text-slate-500">Оновлено</dt>
              <dd class="font-medium text-slate-900">{{ product.updated_at }}</dd>
            </div>
          </dl>
        </div>

        <div class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 class="text-xl font-semibold text-slate-900">Атрибути JSON</h2>
          <div v-if="attributeEntries.length" class="mt-4 space-y-3">
            <article v-for="[key, value] in attributeEntries" :key="key" class="rounded-2xl bg-slate-50 p-4">
              <p class="text-xs uppercase tracking-[0.2em] text-slate-500">{{ key }}</p>
              <pre class="mt-2 overflow-x-auto whitespace-pre-wrap text-sm leading-7 text-slate-700">{{ typeof value === 'string' ? value : JSON.stringify(value, null, 2) }}</pre>
            </article>
          </div>
          <p v-else class="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            Для цього товару немає додаткових атрибутів.
          </p>
        </div>
      </section>
      </div>
    </template>

    <BaseEmptyState
      v-else
      title="Товар не знайдено"
      description="Поверніться до каталогу та виберіть інший товар."
    >
      <template #actions>
        <NuxtLink to="/products" class="base-button base-button--neutral min-h-10 px-4 py-2 text-sm">
          До каталогу
        </NuxtLink>
      </template>
    </BaseEmptyState>
  </div>
</template>
