<script setup lang="ts">
import { PlusIcon } from '@heroicons/vue/24/outline'
import { slugify } from '@shared-utils'
import type { Brand, Category, ProductPayload } from '~/composables/useBackofficeApi'

interface FilterRow {
  id: string
  group_slug: string
  group_name: string
  value_slug: string
  value_name: string
}

const props = defineProps<{
  categories: Category[]
  brands: Brand[]
  initialValue?: ProductPayload
  submitLabel?: string
  loading?: boolean
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
const galleryUrls = ref<string[]>([])
const filterRows = ref<FilterRow[]>([])
const parseError = ref('')
const toast = useBaseToastNotification()

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const labelFromSlug = (value: string) =>
  value
    .split(/[-_]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const filterRowId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `filter-${Date.now()}-${Math.random().toString(16).slice(2)}`

const emptyFilterRow = (): FilterRow => ({
  id: filterRowId(),
  group_slug: '',
  group_name: '',
  value_slug: '',
  value_name: '',
})

const normalizedGalleryUrls = () =>
  galleryUrls.value.map(url => url.trim()).filter(Boolean)

const parseAttributeText = () => {
  const trimmed = attributesText.value.trim()
  if (!trimmed) return {}

  const parsed = JSON.parse(trimmed) as unknown
  if (!isRecord(parsed)) {
    throw new Error('Атрибути JSON мають бути обʼєктом.')
  }
  return parsed
}

const filterValueRows = (groupSlug: string, groupName: string, value: unknown): FilterRow[] => {
  if (Array.isArray(value)) {
    return value.flatMap(item => filterValueRows(groupSlug, groupName, item))
  }

  if (isRecord(value)) {
    const slug = typeof value.slug === 'string' ? value.slug : ''
    const name = typeof value.name === 'string' ? value.name : slug
    return [{
      id: filterRowId(),
      group_slug: groupSlug,
      group_name: groupName,
      value_slug: slug || slugify(name),
      value_name: name || slug,
    }]
  }

  if (['string', 'number', 'boolean'].includes(typeof value)) {
    const label = String(value)
    return [{
      id: filterRowId(),
      group_slug: groupSlug,
      group_name: groupName,
      value_slug: slugify(label),
      value_name: label,
    }]
  }

  return []
}

const rowsFromFilters = (filters: unknown): FilterRow[] => {
  if (!isRecord(filters)) return []

  return Object.entries(filters).flatMap(([groupSlug, value]) =>
    filterValueRows(groupSlug, labelFromSlug(groupSlug), value),
  )
}

const buildFilters = () => {
  const groups = new Map<string, { groupName: string, values: Array<{ slug: string, name: string }> }>()

  for (const row of filterRows.value) {
    const groupName = row.group_name.trim()
    const groupSlug = row.group_slug.trim() || (groupName ? slugify(groupName) : '')
    const valueName = row.value_name.trim()
    const valueSlug = row.value_slug.trim() || (valueName ? slugify(valueName) : '')

    if (!groupSlug || !valueSlug) continue

    const group = groups.get(groupSlug) || { groupName, values: [] }
    group.groupName = groupName || group.groupName
    group.values.push({ slug: valueSlug, name: valueName || valueSlug })
    groups.set(groupSlug, group)
  }

  return Object.fromEntries(
    [...groups.entries()].map(([groupSlug, group]) => {
      const values = group.values.map(value => ({ slug: value.slug, name: value.name }))
      return [groupSlug, values.length === 1 ? values[0] : values]
    }),
  )
}

const mergeStructuredAttributes = (attributes: Record<string, unknown>) => {
  const next = { ...attributes }
  const imageUrls = normalizedGalleryUrls()
  const filters = buildFilters()

  if (imageUrls.length) next.image_urls = imageUrls
  else delete next.image_urls

  if (Object.keys(filters).length) next.filters = filters
  else delete next.filters

  return next
}

const syncAttributesTextFromStructured = () => {
  try {
    const attributes = parseAttributeText()
    const merged = mergeStructuredAttributes(attributes)
    attributesText.value = Object.keys(merged).length ? JSON.stringify(merged, null, 2) : ''
    parseError.value = ''
  }
  catch (error: unknown) {
    parseError.value = error instanceof Error ? error.message : 'Атрибути JSON мають бути валідним JSON.'
  }
}

const syncStructuredFromAttributes = (attributes: Record<string, unknown> | null) => {
  const normalizedAttributes = attributes || {}
  galleryUrls.value = Array.isArray(normalizedAttributes.image_urls)
    ? normalizedAttributes.image_urls.filter((image): image is string => typeof image === 'string')
    : []
  filterRows.value = rowsFromFilters(normalizedAttributes.filters)
}

const syncStructuredFromAttributesText = () => {
  try {
    const attributes = parseAttributeText()
    syncStructuredFromAttributes(attributes)
    parseError.value = ''
  }
  catch (error: unknown) {
    parseError.value = error instanceof Error ? error.message : 'Атрибути JSON мають бути валідним JSON.'
  }
}

const addGalleryUrl = () => {
  galleryUrls.value.push('')
}

const removeGalleryUrl = (index: number) => {
  galleryUrls.value.splice(index, 1)
}

const addFilterRow = () => {
  filterRows.value.push(emptyFilterRow())
}

const removeFilterRow = (rowId: string) => {
  filterRows.value = filterRows.value.filter(row => row.id !== rowId)
}

const normalizeFilterRowSlugs = (row: FilterRow) => {
  if (!row.group_slug.trim() && row.group_name.trim()) row.group_slug = slugify(row.group_name)
  if (!row.value_slug.trim() && row.value_name.trim()) row.value_slug = slugify(row.value_name)
}

const galleryPreviewUrls = computed(() => {
  const images = new Set<string>()
  if (form.image_url?.trim()) images.add(form.image_url.trim())
  for (const image of normalizedGalleryUrls()) images.add(image)
  return [...images]
})

syncStructuredFromAttributes(form.attributes_json)

watch([galleryUrls, filterRows], syncAttributesTextFromStructured, { deep: true })

watch(
  () => props.initialValue,
  value => {
    if (!value) return
    Object.assign(form, value)
    attributesText.value = value.attributes_json ? JSON.stringify(value.attributes_json, null, 2) : ''
    syncStructuredFromAttributes(value.attributes_json)
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
    const mergedAttributes = mergeStructuredAttributes(parseAttributeText())
    attributesJson = Object.keys(mergedAttributes).length ? mergedAttributes : null
  }
  catch (error: unknown) {
    parseError.value = error instanceof Error ? error.message : 'Атрибути JSON мають бути валідним JSON.'
    toast.warning(parseError.value)
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
          <BaseButton
            type="button"
            class="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 sm:self-auto"
            @click="form.slug = slugify(form.name)"
          >
            Згенерувати slug
          </BaseButton>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">Назва</span>
            <BaseInput v-model="form.name" required class="w-full rounded-2xl border border-slate-300 px-4 py-3" />
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">Slug</span>
            <BaseInput v-model="form.slug" required class="w-full rounded-2xl border border-slate-300 px-4 py-3" />
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">SKU</span>
            <BaseInput v-model="form.sku" class="w-full rounded-2xl border border-slate-300 px-4 py-3" />
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">Статус доступності</span>
            <BaseInput v-model="form.availability_status" placeholder="in_stock" class="w-full rounded-2xl border border-slate-300 px-4 py-3" />
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">Ціна</span>
            <BaseInput v-model.number="form.price" type="number" min="0.01" step="0.01" required class="w-full rounded-2xl border border-slate-300 px-4 py-3" />
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">Рекомендована роздрібна ціна</span>
            <BaseInput v-model.number="form.recommended_retail_price" type="number" min="0" step="0.01" class="w-full rounded-2xl border border-slate-300 px-4 py-3" />
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">Кількість на складі</span>
            <BaseInput v-model.number="form.stock_quantity" type="number" min="0" class="w-full rounded-2xl border border-slate-300 px-4 py-3" />
          </label>
          <label class="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
            <BaseCheckbox v-model="form.is_active" class="h-4 w-4 rounded border-slate-300" />
            Товар активний
          </label>
        </div>
        <label class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">Короткий опис</span>
          <BaseTextarea v-model="form.short_description" rows="3" class="w-full rounded-2xl border border-slate-300 px-4 py-3" />
        </label>
        <label class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">Опис</span>
          <BaseTextarea v-model="form.description" rows="7" class="w-full rounded-2xl border border-slate-300 px-4 py-3" />
        </label>
      </section>

      <section class="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">Зв’язки та медіа</h2>
        <label class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">Категорія</span>
          <BaseSelect native v-model="form.category_id" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
            <option :value="null">Без категорії</option>
            <option v-for="category in categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </BaseSelect>
        </label>
        <label class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">Бренд</span>
          <BaseSelect native v-model="form.brand_id" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
            <option :value="null">Без бренду</option>
            <option v-for="brand in brands" :key="brand.id" :value="brand.id">
              {{ brand.name }}
            </option>
          </BaseSelect>
        </label>
        <label class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">URL зображення</span>
          <BaseInput v-model="form.image_url" class="w-full rounded-2xl border border-slate-300 px-4 py-3" />
        </label>
        <div class="space-y-3">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-sm font-semibold text-slate-900">Галерея</h3>
            <BaseButton
              type="button"
              class="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              @click="addGalleryUrl"
            >
              <PlusIcon class="h-4 w-4" aria-hidden="true" />
              Додати
            </BaseButton>
          </div>
          <div v-if="galleryUrls.length" class="space-y-3">
            <div v-for="(_, index) in galleryUrls" :key="index" class="grid gap-2 sm:grid-cols-[1fr_auto]">
              <BaseInput
                v-model="galleryUrls[index]"
                type="url"
                placeholder="https://cdn.example.com/product.webp"
                class="w-full rounded-2xl border border-slate-300 px-4 py-3"
              />
              <BaseButton
                type="button"
                class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-rose-300 text-rose-600 transition hover:bg-rose-50"
                aria-label="Видалити зображення з галереї"
                title="Видалити"
                @click="removeGalleryUrl(index)"
              >
                <TrashIcon class="h-4 w-4" aria-hidden="true" />
              </BaseButton>
            </div>
          </div>
          <p v-else class="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Додаткові зображення не задані.
          </p>
          <div v-if="galleryPreviewUrls.length" class="grid grid-cols-2 gap-3">
            <a
              v-for="image in galleryPreviewUrls"
              :key="image"
              :href="image"
              target="_blank"
              rel="noreferrer"
              class="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
            >
              <img :src="image" alt="" class="h-28 w-full object-cover transition group-hover:scale-[1.02]">
            </a>
          </div>
        </div>
        <label class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">Зовнішній URL</span>
          <BaseInput v-model="form.external_url" class="w-full rounded-2xl border border-slate-300 px-4 py-3" />
        </label>
        <div class="space-y-3">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-sm font-semibold text-slate-900">Фільтри каталогу</h3>
            <BaseButton
              type="button"
              class="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              @click="addFilterRow"
            >
              <PlusIcon class="h-4 w-4" aria-hidden="true" />
              Додати
            </BaseButton>
          </div>
          <div v-if="filterRows.length" class="space-y-4">
            <div v-for="row in filterRows" :key="row.id" class="space-y-3 border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
              <div class="grid gap-3 md:grid-cols-2">
                <label class="space-y-2 text-sm text-slate-700">
                  <span class="font-medium">Group slug</span>
                  <BaseInput v-model="row.group_slug" placeholder="color" class="w-full rounded-2xl border border-slate-300 px-4 py-3" />
                </label>
                <label class="space-y-2 text-sm text-slate-700">
                  <span class="font-medium">Group name</span>
                  <BaseInput v-model="row.group_name" placeholder="Color" class="w-full rounded-2xl border border-slate-300 px-4 py-3" @blur="normalizeFilterRowSlugs(row)" />
                </label>
                <label class="space-y-2 text-sm text-slate-700">
                  <span class="font-medium">Value slug</span>
                  <BaseInput v-model="row.value_slug" placeholder="black" class="w-full rounded-2xl border border-slate-300 px-4 py-3" />
                </label>
                <label class="space-y-2 text-sm text-slate-700">
                  <span class="font-medium">Value name</span>
                  <BaseInput v-model="row.value_name" placeholder="Black" class="w-full rounded-2xl border border-slate-300 px-4 py-3" @blur="normalizeFilterRowSlugs(row)" />
                </label>
              </div>
              <BaseButton
                type="button"
                class="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-rose-300 px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                @click="removeFilterRow(row.id)"
              >
                <TrashIcon class="h-4 w-4" aria-hidden="true" />
                Видалити фільтр
              </BaseButton>
            </div>
          </div>
          <p v-else class="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Фільтри каталогу не задані.
          </p>
        </div>
        <label class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">Атрибути JSON</span>
          <BaseTextarea
            v-model="attributesText"
            rows="10"
            class="w-full rounded-2xl border border-slate-300 px-4 py-3 font-mono text-xs"
            @blur="syncStructuredFromAttributesText"
            @change="syncStructuredFromAttributesText"
          />
          <span v-if="parseError" class="block text-xs font-medium text-rose-600">{{ parseError }}</span>
        </label>
      </section>
    </div>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      <BaseButton type="submit" :disabled="loading" class="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60">
        {{ submitLabel || 'Зберегти товар' }}
      </BaseButton>
    </div>
  </form>
</template>
