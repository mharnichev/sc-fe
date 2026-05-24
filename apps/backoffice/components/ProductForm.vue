<script setup lang="ts">
import { slugify } from '@shared-utils'
import type { Brand, Category, ProductPayload } from '~/composables/useBackofficeApi'

const props = defineProps<{
  categories: Category[]
  brands: Brand[]
  initialValue?: ProductPayload
  submitLabel?: string
  loading?: boolean
  error?: string
}>()

const emit = defineEmits<{
  submit: [value: ProductPayload]
}>()

const form = reactive<ProductPayload>({
  name: props.initialValue?.name ?? '',
  slug: props.initialValue?.slug ?? '',
  description: props.initialValue?.description ?? null,
  short_description: props.initialValue?.short_description ?? null,
  price: props.initialValue?.price ?? 0,
  recommended_retail_price: props.initialValue?.recommended_retail_price ?? null,
  sku: props.initialValue?.sku ?? null,
  stock_quantity: props.initialValue?.stock_quantity ?? 0,
  is_active: props.initialValue?.is_active ?? true,
  image_url: props.initialValue?.image_url ?? null,
  external_url: props.initialValue?.external_url ?? null,
  availability_status: props.initialValue?.availability_status ?? null,
  attributes_json: props.initialValue?.attributes_json ?? null,
  brand_id: props.initialValue?.brand_id ?? null,
  category_id: props.initialValue?.category_id ?? null,
})

const attributesText = ref(
  form.attributes_json ? JSON.stringify(form.attributes_json, null, 2) : '',
)
const parseError = ref('')

watch(
  () => props.initialValue,
  value => {
    if (!value) return
    Object.assign(form, value)
    attributesText.value = value.attributes_json ? JSON.stringify(value.attributes_json, null, 2) : ''
  },
  { deep: true },
)

const normalizeText = (value: string) => {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

const submit = () => {
  parseError.value = ''
  let attributesJson: Record<string, unknown> | null = null

  try {
    if (attributesText.value.trim()) {
      attributesJson = JSON.parse(attributesText.value) as Record<string, unknown>
    }
  }
  catch {
    parseError.value = 'Атрибути JSON мають бути валідним JSON.'
    return
  }

  emit('submit', {
    ...form,
    slug: form.slug.trim(),
    name: form.name.trim(),
    description: normalizeText(form.description ?? ''),
    short_description: normalizeText(form.short_description ?? ''),
    sku: normalizeText(form.sku ?? ''),
    image_url: normalizeText(form.image_url ?? ''),
    external_url: normalizeText(form.external_url ?? ''),
    availability_status: normalizeText(form.availability_status ?? ''),
    price: Number(form.price),
    recommended_retail_price: form.recommended_retail_price === null ? null : Number(form.recommended_retail_price),
    stock_quantity: Number(form.stock_quantity),
    attributes_json: attributesJson,
    brand_id: form.brand_id || null,
    category_id: form.category_id || null,
  })
}
</script>

<template>
  <form class="space-y-6" @submit.prevent="submit">
    <div class="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section class="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 class="text-xl font-semibold text-slate-900">Основна інформація</h2>
          <button
            type="button"
            class="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 sm:self-auto"
            @click="form.slug = slugify(form.name)"
          >
            Згенерувати slug
          </button>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">Назва</span>
            <input v-model="form.name" required class="w-full rounded-2xl border border-slate-300 px-4 py-3">
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">Slug</span>
            <input v-model="form.slug" required class="w-full rounded-2xl border border-slate-300 px-4 py-3">
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">SKU</span>
            <input v-model="form.sku" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">Статус доступності</span>
            <input v-model="form.availability_status" placeholder="in_stock" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">Ціна</span>
            <input v-model.number="form.price" type="number" min="0.01" step="0.01" required class="w-full rounded-2xl border border-slate-300 px-4 py-3">
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">Рекомендована роздрібна ціна</span>
            <input v-model.number="form.recommended_retail_price" type="number" min="0" step="0.01" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">Кількість на складі</span>
            <input v-model.number="form.stock_quantity" type="number" min="0" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
          </label>
          <label class="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
            <input v-model="form.is_active" type="checkbox" class="h-4 w-4 rounded border-slate-300">
            Товар активний
          </label>
        </div>
        <label class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">Короткий опис</span>
          <textarea v-model="form.short_description" rows="3" class="w-full rounded-2xl border border-slate-300 px-4 py-3" />
        </label>
        <label class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">Опис</span>
          <textarea v-model="form.description" rows="7" class="w-full rounded-2xl border border-slate-300 px-4 py-3" />
        </label>
      </section>

      <section class="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">Зв’язки та медіа</h2>
        <label class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">Категорія</span>
          <select v-model="form.category_id" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
            <option :value="null">Без категорії</option>
            <option v-for="category in categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
        </label>
        <label class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">Бренд</span>
          <select v-model="form.brand_id" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
            <option :value="null">Без бренду</option>
            <option v-for="brand in brands" :key="brand.id" :value="brand.id">
              {{ brand.name }}
            </option>
          </select>
        </label>
        <label class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">URL зображення</span>
          <input v-model="form.image_url" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
        </label>
        <label class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">Зовнішній URL</span>
          <input v-model="form.external_url" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
        </label>
        <label class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">Атрибути JSON</span>
          <textarea v-model="attributesText" rows="10" class="w-full rounded-2xl border border-slate-300 px-4 py-3 font-mono text-xs" />
        </label>
      </section>
    </div>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      <button type="submit" :disabled="loading" class="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60">
        {{ submitLabel || 'Зберегти товар' }}
      </button>
      <p v-if="parseError" class="text-sm text-rose-600">{{ parseError }}</p>
      <p v-if="error" class="text-sm text-rose-600">{{ error }}</p>
    </div>
  </form>
</template>
