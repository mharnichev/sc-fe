<script setup lang="ts">
import { canManageCatalog } from '~/utils/catalogAccess'
import { categoryPathLabels } from '~/utils/categoryPaths'
import { ArrowPathIcon, CodeBracketIcon, CubeIcon, PhotoIcon, PlusIcon, TagIcon } from '@heroicons/vue/24/outline'
import { slugify } from '@shared-utils'
import type { Brand, Category, ProductPayload } from '~/composables/useBackofficeApi'

provide('compactFieldHints', true)
const formId = `product-form-${useId()}`
const compactControlClass = 'base-control min-h-10 w-full px-3 py-2 text-sm'

interface FilterRow {
  id: string
  group_slug: string
  group_name: string
  value_slug: string
  value_name: string
}

const catalogAuth = useAuthStore()
const catalogEditable = computed(() => canManageCatalog(catalogAuth.user))

const props = defineProps<{
  categories: Category[]
  brands: Brand[]
  initialValue?: ProductPayload
  submitLabel?: string
  loading?: boolean
}>()

const categoryLabels = computed(() => categoryPathLabels(props.categories))

const emit = defineEmits<{
  submit: [value: ProductPayload]
}>()

const form = reactive<ProductPayload>({
  name: props.initialValue?.name ?? '',
  slug: props.initialValue?.slug ?? '',
  description: props.initialValue?.description ?? null,
  ingredients: props.initialValue?.ingredients ?? null,
  short_description: props.initialValue?.short_description ?? null,
  price: props.initialValue?.price ?? 0,
  recommended_retail_price: props.initialValue?.recommended_retail_price ?? null,
  shop_price: props.initialValue?.shop_price ?? null,
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
  if (!catalogEditable.value) return
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
    ingredients: normalizeText(form.ingredients ?? ''),
    short_description: normalizeText(form.short_description ?? ''),
    sku: normalizeText(form.sku ?? ''),
    image_url: normalizeText(form.image_url ?? ''),
    external_url: normalizeText(form.external_url ?? ''),
    availability_status: normalizeText(form.availability_status ?? ''),
    price: Number(form.price),
    shop_price: form.shop_price == null || String(form.shop_price).trim() === '' ? null : Number(form.shop_price),
    recommended_retail_price: form.recommended_retail_price === null ? null : Number(form.recommended_retail_price),
    stock_quantity: Number(form.stock_quantity),
    attributes_json: attributesJson,
    brand_id: form.brand_id || null,
    category_id: form.category_id || null,
  })
}
</script>

<template>
  <form v-if="catalogEditable" class="space-y-3 [&_.base-field__label]:min-h-8" @submit.prevent="submit">
    <div class="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <BaseCard as="section" padding="sm" class="space-y-3">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 class="flex items-center gap-2 text-base font-semibold text-ui-primary"><CubeIcon class="h-4 w-4 text-ui-muted" aria-hidden="true" />Основна інформація</h2>
          <BaseButton
            type="button"
            variant="secondary" size="sm" class="gap-1.5 sm:self-auto"
            @click="form.slug = slugify(form.name)"
          >
            <ArrowPathIcon class="h-3.5 w-3.5" aria-hidden="true" />
            Згенерувати slug
          </BaseButton>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <BaseInput label="Назва" :input-class="compactControlClass" v-model="form.name" required />
          <BaseInput label="Slug" :input-class="compactControlClass" hint="Унікальна частина адреси товару. Можна згенерувати з назви." v-model="form.slug" required />
          <BaseInput label="SKU" :input-class="compactControlClass" v-model="form.sku" />
          <BaseInput label="Статус доступності" :input-class="compactControlClass" hint="Значення доступності з каталогу, наприклад in_stock." v-model="form.availability_status" placeholder="in_stock" />
          <BaseInput label="Ціна" :input-class="compactControlClass" hint="Базова ціна товару. Ціну сайту можна задати окремо." v-model.number="form.price" type="number" min="0.01" step="0.01" required />
          <BaseInput label="Наша ціна в магазині" :input-class="compactControlClass" hint="Ціна для сайту та замовлень. Акції застосовуються до неї." v-model.number="form.shop_price" type="number" min="0.01" step="0.01" />
          <BaseInput label="Рекомендована роздрібна ціна" :input-class="compactControlClass" v-model.number="form.recommended_retail_price" type="number" min="0" step="0.01" />
          <BaseInput label="Кількість на складі" :input-class="compactControlClass" hint="Поточний залишок товару." v-model.number="form.stock_quantity" type="number" min="0" />
          <BaseField label="Публікація" hint="Неактивний товар прихований від покупців." as="div" root-class="space-y-1.5 text-sm">
            <BaseToggle v-model="form.is_active" label="Товар активний" />
          </BaseField>
        </div>
        <BaseTextarea label="Короткий опис" :textarea-class="compactControlClass" v-model="form.short_description" rows="2" />
        <BaseTextarea label="Опис" :textarea-class="compactControlClass" v-model="form.description" rows="4" />
        <BaseTextarea label="Склад" :textarea-class="compactControlClass" v-model="form.ingredients" rows="3" />
      </BaseCard>

      <BaseCard as="section" padding="sm" class="space-y-3">
        <h2 class="flex items-center gap-2 text-base font-semibold text-ui-primary"><TagIcon class="h-4 w-4 text-ui-muted" aria-hidden="true" />Зв’язки та медіа</h2>
        <BaseSelect :id="`${formId}-category`" :aria-labelledby="`${formId}-category-label`" label="Категорія" :class="compactControlClass" hint="Категорія визначає розділ товару в каталозі." native v-model="form.category_id">
            <option :value="null">Без категорії</option>
            <option v-for="category in categories" :key="category.id" :value="category.id">
              {{ categoryLabels.get(category.id) || category.name }}
            </option>
          </BaseSelect>
        <BaseSelect :id="`${formId}-brand`" :aria-labelledby="`${formId}-brand-label`" label="Бренд" hint="Виробник товару для пошуку та фільтрації каталогу." :class="compactControlClass" native v-model="form.brand_id">
            <option :value="null">Без бренду</option>
            <option v-for="brand in brands" :key="brand.id" :value="brand.id">
              {{ brand.name }}
            </option>
          </BaseSelect>
        <details class="rounded-xl border border-ui px-3 py-2.5">
          <summary class="cursor-pointer text-sm font-medium text-ui-primary"><PhotoIcon class="mr-1 inline h-4 w-4 text-ui-muted" aria-hidden="true" />Зовнішні URL / старі зображення</summary>
          <div class="mt-3 space-y-3">
            <BaseInput label="URL зображення" :input-class="compactControlClass" hint="Старе зовнішнє посилання. Завантажені фото керуються в галереї товару." v-model="form.image_url" />
            <div class="space-y-3">
              <div class="flex items-center justify-between gap-3">
                <h3 class="text-sm font-semibold text-ui-primary">Галерея</h3>
                <BaseButton
                  type="button"
                  class="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-xs font-medium text-ui-secondary transition hover:bg-slate-50"
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
                    :label="`Зображення ${index + 1}`"
                    type="url"
                    placeholder="https://cdn.example.com/product.webp"
                    :input-class="compactControlClass"
                 />
                  <BaseButton
                    type="button"
                    class="inline-flex h-10 w-10 sm:mt-6 items-center justify-center rounded-full border border-rose-300 text-rose-600 transition hover:bg-rose-50"
                    aria-label="Видалити зображення з галереї"
                    title="Видалити"
                    @click="removeGalleryUrl(index)"
                  >
                    <TrashIcon class="h-4 w-4" aria-hidden="true" />
                  </BaseButton>
                </div>
              </div>
              <p v-else class="rounded-lg bg-ui-subtle px-3 py-2 text-xs text-ui-muted">
                Додаткові зображення не задані.
              </p>
              <div v-if="galleryPreviewUrls.length" class="grid grid-cols-3 gap-2">
                <a
                  v-for="image in galleryPreviewUrls"
                  :key="image"
                  :href="image"
                  target="_blank"
                  rel="noreferrer"
                  class="group overflow-hidden rounded-2xl border border-ui bg-slate-50"
                >
                  <img :src="image" alt="" class="h-20 w-full object-cover transition group-hover:scale-[1.02]">
                </a>
              </div>
            </div>
          </div>
        </details>
        <BaseInput label="Зовнішній URL" :input-class="compactControlClass" hint="Посилання на товар у зовнішньому джерелі." v-model="form.external_url" />
        <div class="space-y-3">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-sm font-semibold text-ui-primary">Фільтри каталогу</h3>
            <BaseButton
              type="button"
              class="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-xs font-medium text-ui-secondary transition hover:bg-slate-50"
              @click="addFilterRow"
            >
              <PlusIcon class="h-4 w-4" aria-hidden="true" />
              Додати
            </BaseButton>
          </div>
          <div v-if="filterRows.length" class="space-y-3">
            <div v-for="row in filterRows" :key="row.id" class="space-y-2 rounded-xl border border-ui p-3">
              <div class="grid gap-2 sm:grid-cols-2">
                <BaseInput label="Group slug" :input-class="compactControlClass" hint="Технічний ключ групи, наприклад color." v-model="row.group_slug" placeholder="color" />
                <BaseInput label="Group name" :input-class="compactControlClass" hint="Назва групи. Порожній slug буде згенеровано автоматично." v-model="row.group_name" placeholder="Color" @blur="normalizeFilterRowSlugs(row)" />
                <BaseInput label="Value slug" :input-class="compactControlClass" hint="Технічний ключ значення, наприклад black." v-model="row.value_slug" placeholder="black" />
                <BaseInput label="Value name" :input-class="compactControlClass" hint="Назва значення. Порожній slug буде згенеровано автоматично." v-model="row.value_name" placeholder="Black" @blur="normalizeFilterRowSlugs(row)" />
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
          <p v-else class="rounded-lg bg-ui-subtle px-3 py-2 text-xs text-ui-muted">
            Фільтри каталогу не задані.
          </p>
        </div>
        <details :open="Boolean(parseError)" class="rounded-xl border border-ui px-3 py-2.5">
          <summary class="cursor-pointer text-sm font-medium text-ui-primary"><CodeBracketIcon class="mr-1 inline h-4 w-4 text-ui-muted" aria-hidden="true" />Додаткові атрибути JSON</summary>
          <BaseTextarea
            v-model="attributesText"
            label="Атрибути JSON"
            hint="Додаткові атрибути товару у форматі JSON. Галерея та фільтри синхронізуються з полями вище."
            :error="parseError"
            rows="6"
            field-class="mt-3 space-y-1.5 text-sm"
            textarea-class="base-control w-full px-3 py-2 font-mono text-xs"
           @blur="syncStructuredFromAttributesText"
            @change="syncStructuredFromAttributesText"
         />
        </details>
      </BaseCard>
    </div>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      <BaseButton type="submit" :disabled="loading" variant="primary" size="sm" :loading="loading">
        {{ submitLabel || 'Зберегти товар' }}
      </BaseButton>
    </div>
  </form>
</template>
