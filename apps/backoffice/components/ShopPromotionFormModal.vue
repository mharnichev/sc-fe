<script setup lang="ts">
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  TicketIcon,
} from '@heroicons/vue/24/outline'
import type {
  Brand,
  Category,
  Product,
  ShopPromotion,
  ShopPromotionDiscountType,
  ShopPromotionPayload,
  ShopPromotionPreviewResponse,
  ShopPromotionPreviewProduct,
  ShopPromotionTrigger,
} from '~/composables/useBackofficeApi'

const props = withDefaults(defineProps<{
  modelValue: boolean
  promotion?: ShopPromotion | null
  initialProductIds?: number[]
}>(), {
  promotion: null,
  initialProductIds: () => [],
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [message: string]
}>()

const api = useBackofficeApi()
const toast = useBaseToastNotification()
const { apiErrorMessage, formatMoney, normalizeItems } = useBookingFormatting()

type ShopPromotionForm = Omit<ShopPromotionPayload, 'starts_at' | 'ends_at' | 'discount_value'> & {
  starts_at: string
  ends_at: string
  discount_value: number | null
}

const emptyForm = (): ShopPromotionForm => ({
  name: '',
  description: null,
  trigger: 'automatic',
  code: null,
  discount_type: 'percent',
  discount_value: null,
  priority: 100,
  starts_at: '',
  ends_at: '',
  is_active: true,
  applies_to_all_products: false,
  include_subcategories: true,
  product_ids: [...props.initialProductIds],
  category_ids: [],
  brand_ids: [],
  usage_limit: null,
  usage_limit_per_customer: null,
})

const form = reactive<ShopPromotionForm>(emptyForm())
const formError = ref('')
const saving = ref(false)
const previewing = ref(false)
const optionsLoading = ref(false)
const preview = ref<ShopPromotionPreviewResponse | null>(null)
const previewMessage = ref('')
const products = ref<Product[]>([])
const categories = ref<Category[]>([])
const brands = ref<Brand[]>([])

const editing = computed(() => props.promotion || null)
const triggerOptions: { value: ShopPromotionTrigger, label: string }[] = [
  { value: 'automatic', label: 'Автоматично' },
  { value: 'promocode', label: 'За промокодом' },
]
const discountTypeOptions: { value: ShopPromotionDiscountType, label: string }[] = [
  { value: 'percent', label: 'Відсоток' },
  { value: 'fixed_amount', label: 'Фіксована сума' },
  { value: 'fixed_price', label: 'Фіксована ціна' },
]

const normalizeNumberIds = (values?: Array<number | string> | null) =>
  Array.from(new Set((values || []).map(Number).filter(Number.isFinite)))

const productOptions = computed(() => products.value.map(product => ({
  value: product.id,
  label: product.name,
  description: product.sku ? `SKU: ${product.sku}` : null,
  searchText: `${product.name} ${product.sku || ''}`,
})))
const categoryOptions = computed(() => categories.value.map(category => ({
  value: category.id,
  label: category.name,
  description: category.slug,
  searchText: `${category.name} ${category.slug}`,
})))
const brandOptions = computed(() => brands.value.map(brand => ({
  value: brand.id,
  label: brand.name,
  description: brand.slug,
  searchText: `${brand.name} ${brand.slug}`,
})))

const toDateTimeLocal = (value?: string | null) => {
  if (!value) return ''
  // The API normalizes responses to Europe/Kyiv. Preserve that wall-clock
  // value for datetime-local instead of interpreting it in the browser zone.
  return value.replace(/(?:Z|[+-]\d{2}:?\d{2})$/, '').slice(0, 16)
}

const toIsoOrNull = (value: string) => value ? `${value}:00` : null
const normalizeCode = (value?: string | null) => value?.trim().toUpperCase() || null
const optionalPositiveInteger = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

const fillForm = (promotion?: ShopPromotion | null) => {
  const defaults = emptyForm()
  Object.assign(form, {
    ...defaults,
    name: promotion?.name || '',
    description: promotion?.description || null,
    trigger: promotion?.trigger || defaults.trigger,
    code: promotion?.code || null,
    discount_type: promotion?.discount_type || defaults.discount_type,
    discount_value: promotion?.discount_value == null ? null : Number(promotion.discount_value),
    priority: promotion?.priority ?? defaults.priority,
    starts_at: toDateTimeLocal(promotion?.starts_at),
    ends_at: toDateTimeLocal(promotion?.ends_at),
    is_active: promotion?.is_active ?? defaults.is_active,
    applies_to_all_products: promotion?.applies_to_all_products ?? defaults.applies_to_all_products,
    include_subcategories: promotion?.include_subcategories ?? defaults.include_subcategories,
    product_ids: normalizeNumberIds(promotion?.product_ids || props.initialProductIds),
    category_ids: normalizeNumberIds(promotion?.category_ids),
    brand_ids: normalizeNumberIds(promotion?.brand_ids),
    usage_limit: promotion?.usage_limit ?? defaults.usage_limit,
    usage_limit_per_customer: promotion?.usage_limit_per_customer ?? defaults.usage_limit_per_customer,
  })
  formError.value = ''
  preview.value = null
  previewMessage.value = ''
}

const loadOptions = async () => {
  if (products.value.length && categories.value.length && brands.value.length) return
  optionsLoading.value = true
  try {
    const [productResponse, categoryResponse, brandResponse] = await Promise.all([
      api.getProducts(1, 100, { is_active: true }),
      api.getCategories(1, 100, { is_active: true }),
      api.getBrands(1, 100),
    ])
    products.value = normalizeItems(productResponse)
    categories.value = normalizeItems(categoryResponse)
    brands.value = normalizeItems(brandResponse)
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося завантажити товари, категорії або бренди.'))
  }
  finally {
    optionsLoading.value = false
  }
}

const validate = () => {
  const name = form.name.trim()
  const code = normalizeCode(form.code)
  const usageLimit = form.usage_limit as unknown
  const usageLimitPerCustomer = form.usage_limit_per_customer as unknown
  if (name.length < 2) return 'Назва акції має містити щонайменше 2 символи.'
  if (form.trigger === 'promocode' && (!code || code.length < 3)) return 'Для промокодової акції вкажіть код щонайменше з 3 символів.'
  if (code && !/^[A-Z0-9_-]+$/.test(code)) return 'Код може містити лише A-Z, 0-9, "_" і "-".'
  if (typeof form.discount_value !== 'number' || !Number.isFinite(form.discount_value) || form.discount_value <= 0) return 'Вкажіть знижку більше нуля.'
  if (form.discount_type === 'percent' && form.discount_value > 100) return 'Відсоткова знижка не може перевищувати 100%.'
  if ((form.priority as unknown) === '' || !Number.isInteger(Number(form.priority)) || Number(form.priority) < 0) return 'Пріоритет має бути цілим числом від 0.'
  if (form.trigger === 'automatic' && (optionalPositiveInteger(form.usage_limit) !== null || optionalPositiveInteger(form.usage_limit_per_customer) !== null)) return 'Ліміти використання доступні лише для промокодових акцій.'
  if (form.trigger === 'promocode' && usageLimit != null && usageLimit !== '' && optionalPositiveInteger(usageLimit) === null) return 'Загальний ліміт має бути додатним цілим числом.'
  if (form.trigger === 'promocode' && usageLimitPerCustomer != null && usageLimitPerCustomer !== '' && optionalPositiveInteger(usageLimitPerCustomer) === null) return 'Ліміт на клієнта має бути додатним цілим числом.'
  if (!form.applies_to_all_products && !form.product_ids.length && !form.category_ids.length && !form.brand_ids.length) return 'Виберіть товари, категорії або бренди для акції.'
  if (form.starts_at && form.ends_at && form.ends_at <= form.starts_at) return 'Дата завершення має бути пізніше дати старту.'
  return ''
}

const promotionPayload = (): ShopPromotionPayload => ({
  name: form.name.trim(),
  description: form.description?.trim() || null,
  trigger: form.trigger,
  code: form.trigger === 'promocode' ? normalizeCode(form.code) : null,
  discount_type: form.discount_type,
  discount_value: Number(form.discount_value),
  priority: Number(form.priority),
  starts_at: toIsoOrNull(form.starts_at),
  ends_at: toIsoOrNull(form.ends_at),
  is_active: form.is_active,
  applies_to_all_products: form.applies_to_all_products,
  include_subcategories: form.include_subcategories,
  product_ids: form.applies_to_all_products ? [] : normalizeNumberIds(form.product_ids),
  category_ids: form.applies_to_all_products ? [] : normalizeNumberIds(form.category_ids),
  brand_ids: form.applies_to_all_products ? [] : normalizeNumberIds(form.brand_ids),
  usage_limit: form.trigger === 'promocode' ? optionalPositiveInteger(form.usage_limit) : null,
  usage_limit_per_customer: form.trigger === 'promocode' ? optionalPositiveInteger(form.usage_limit_per_customer) : null,
})

const runPreview = async () => {
  formError.value = validate()
  if (formError.value) return
  if (editing.value) {
    preview.value = null
    previewMessage.value = 'Для редагування backend preview приймає лише нове правило, тому конфлікти перевірить backend під час збереження.'
    return
  }
  previewMessage.value = ''
  previewing.value = true
  try {
    preview.value = await api.adminPreviewShopPromotion(promotionPayload())
  }
  catch (cause) {
    formError.value = apiErrorMessage(cause, 'Не вдалося перевірити вплив акції.')
  }
  finally {
    previewing.value = false
  }
}
const conflictSummary = (item: ShopPromotionPreviewProduct) => item.conflicts
  .map(conflict => `${conflict.name} · ${formatMoney(conflict.price)} · пріоритет ${conflict.priority}`)
  .join('; ')

const close = () => emit('update:modelValue', false)
const submit = async () => {
  formError.value = validate()
  if (formError.value) {
    toast.warning(formError.value)
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      await api.adminUpdateShopPromotion(editing.value.id, promotionPayload())
      emit('saved', 'Акцію товарів оновлено.')
    }
    else {
      await api.adminCreateShopPromotion(promotionPayload())
      emit('saved', 'Акцію товарів створено.')
    }
    close()
  }
  catch (cause) {
    formError.value = apiErrorMessage(cause, 'Не вдалося зберегти акцію товарів.')
    toast.error(formError.value)
  }
  finally {
    saving.value = false
  }
}

watch(
  () => [props.modelValue, props.promotion] as const,
  ([open, promotion]) => {
    if (open) {
      fillForm(promotion)
      void loadOptions()
    }
  },
  { immediate: true },
)

watch(() => form.trigger, value => {
  if (value === 'automatic') {
    form.code = null
    form.usage_limit = null
    form.usage_limit_per_customer = null
  }
})

watch(() => form.applies_to_all_products, value => {
  if (value) {
    form.product_ids = []
    form.category_ids = []
    form.brand_ids = []
  }
})

watch(form, () => {
  preview.value = null
  previewMessage.value = ''
}, { deep: true })
</script>

<template>
  <BaseModal :model-value="modelValue" max-width-class="max-w-5xl" @update:model-value="emit('update:modelValue', $event)" @close="formError = ''">
    <template #head="{ close: closeModal }">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-[0.25em] text-cyan-700">Онлайн-магазин</p>
          <h2 class="mt-2 text-2xl font-semibold text-slate-900">{{ editing ? 'Редагувати акцію товарів' : 'Створити акцію товарів' }}</h2>
          <p class="mt-1 text-sm text-slate-500">Ціни та конфлікти визначає backend.</p>
        </div>
        <ModalCloseButton @click="closeModal" />
      </div>
    </template>

    <template #body>
      <form class="space-y-5" @submit.prevent="submit">
        <div v-if="formError" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{{ formError }}</div>

        <div class="grid gap-4 md:grid-cols-2">
          <BaseInput v-model="form.name" label="Назва" required placeholder="Літній sale" />
          <BaseTextarea v-model="form.description" label="Опис" rows="2" placeholder="Короткий опис для команди" />
          <BaseSelect v-model="form.trigger" label="Спосіб застосування" :options="triggerOptions" />
          <BaseInput v-if="form.trigger === 'promocode'" v-model="form.code" label="Промокод" required placeholder="SUMMER20" class="uppercase" />
          <div v-else class="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Автоматична акція не має промокоду або лімітів використання.</div>
          <BaseSelect v-model="form.discount_type" label="Тип знижки" :options="discountTypeOptions" />
          <BaseInput v-model.number="form.discount_value" label="Значення знижки" type="number" min="0.01" step="0.01" required />
          <BaseInput v-model.number="form.priority" label="Пріоритет" type="number" min="0" step="1" required hint="Менше число має вищий пріоритет при однаковій ціні." />
          <BaseInput v-if="form.trigger === 'promocode'" v-model.number="form.usage_limit" label="Загальний ліміт" type="number" min="1" step="1" />
          <BaseInput v-if="form.trigger === 'promocode'" v-model.number="form.usage_limit_per_customer" label="Ліміт на клієнта" type="number" min="1" step="1" />
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <BaseInput v-model="form.starts_at" label="Початок" type="datetime-local" hint="Час передається backend без локального перерахунку; Europe/Kyiv нормалізує сервер." />
          <BaseInput v-model="form.ends_at" label="Завершення" type="datetime-local" />
        </div>

        <section class="space-y-4 rounded-2xl border border-slate-200 p-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="font-semibold text-slate-900">Застосування</h3>
              <p class="mt-1 text-sm text-slate-500">Вкажіть хоча б один товар, категорію або бренд, якщо акція не для всіх.</p>
            </div>
            <BaseCheckbox v-model="form.applies_to_all_products" label="Усі товари" />
          </div>
          <div v-if="!form.applies_to_all_products" class="grid gap-4 md:grid-cols-3">
            <BaseMultiSelect v-model="form.product_ids" :options="productOptions" label="Товари" placeholder="Виберіть товари" search-placeholder="Пошук товарів" :disabled="optionsLoading" />
            <BaseMultiSelect v-model="form.category_ids" :options="categoryOptions" label="Категорії" placeholder="Виберіть категорії" search-placeholder="Пошук категорій" :disabled="optionsLoading" />
            <BaseMultiSelect v-model="form.brand_ids" :options="brandOptions" label="Бренди" placeholder="Виберіть бренди" search-placeholder="Пошук брендів" :disabled="optionsLoading" />
          </div>
          <BaseToggle v-model="form.include_subcategories" label="Включати підкатегорії" :disabled="form.applies_to_all_products" />
        </section>

        <div class="flex flex-wrap items-center gap-4">
          <BaseToggle v-model="form.is_active" label="Акція активна" />
          <p v-if="form.discount_type === 'percent' && form.discount_value === 100" class="flex items-center gap-2 text-sm text-amber-700">
            <ExclamationTriangleIcon class="h-4 w-4" aria-hidden="true" /> Backend перевірить правила для 100% знижки.
          </p>
          <p v-if="form.discount_type === 'fixed_price'" class="flex items-center gap-2 text-sm text-amber-700">
            <ExclamationTriangleIcon class="h-4 w-4" aria-hidden="true" /> Мінімальну допустиму ціну перевіряє backend.
          </p>
        </div>

        <section v-if="preview" class="space-y-3 rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4" aria-live="polite">
          <div class="flex items-center gap-2">
            <CheckCircleIcon class="h-5 w-5 text-cyan-700" aria-hidden="true" />
            <h3 class="font-semibold text-slate-900">Перевірка впливу: {{ preview.affected_products_count }} товарів</h3>
          </div>
          <div v-for="item in preview.products.slice(0, 8)" :key="item.product_id" class="rounded-xl bg-white/70 p-3 text-sm">
            <p class="font-medium text-slate-900">{{ item.product_name }}</p>
            <p class="mt-1 text-slate-600">База: {{ formatMoney(item.base_price) }} · Нова ціна: {{ formatMoney(item.new_price) }} · Знижка: {{ formatMoney(item.discount_amount) }}</p>
            <p v-if="item.currently_applied_promotion" class="mt-1 text-slate-600">Поточна акція: {{ item.currently_applied_promotion.name }} ({{ formatMoney(item.currently_applied_promotion.price) }})</p>
            <p v-if="item.applied_promotion" class="mt-1 font-medium text-cyan-800">Переможна акція: {{ item.applied_promotion.name }} ({{ formatMoney(item.applied_promotion.price) }})</p>
            <p v-if="item.conflicts.length" class="mt-1 text-amber-700">Конфлікти backend: {{ conflictSummary(item) }}</p>
          </div>
        </section>
        <p v-if="previewMessage" class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" aria-live="polite">{{ previewMessage }}</p>

        <div class="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
          <BaseButton type="button" variant="neutral" :disabled="saving || previewing" @click="runPreview">
            <ArrowPathIcon class="h-4 w-4" aria-hidden="true" /> Перевірити вплив
          </BaseButton>
          <BaseButton type="button" variant="neutral" :disabled="saving" @click="close">Скасувати</BaseButton>
          <BaseButton type="submit" variant="primary" :loading="saving">{{ editing ? 'Зберегти' : 'Створити' }}</BaseButton>
        </div>
      </form>
    </template>
  </BaseModal>
</template>
