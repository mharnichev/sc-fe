<script setup lang="ts">
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  NoSymbolIcon,
  PencilIcon,
  PlusIcon,
  TicketIcon,
} from '@heroicons/vue/24/outline'
import type { ShopPromotion, ShopPromotionProduct } from '~/composables/useBackofficeApi'

definePageMeta({
  middleware: () => {
    const auth = useAuthStore()
    if (!auth.user?.is_superuser && auth.user?.role !== 'admin') return navigateTo('/')
  },
})

const api = useBackofficeApi()
const toast = useBaseToastNotification()
const { apiErrorMessage, formatDateTime, formatMoney, normalizeItems, normalizeTotal } = useBookingFormatting()

const page = ref(1)
const pageSize = 100
const normalizeProductQuery = (value: string | (string | null)[] | null | undefined) => {
  const candidate = Array.isArray(value) ? value[0] : value
  return typeof candidate === 'string' && /^\d+$/.test(candidate) ? candidate : ''
}
const route = useRoute()
const router = useRouter()
const filters = reactive({ search: '', is_active: '', trigger: '', status: '', product_id: normalizeProductQuery(route.query.product_id) })
const editing = ref<ShopPromotion | null>(null)
const modalOpen = ref(false)
const productsModalOpen = ref(false)
const productsPromotion = ref<ShopPromotion | null>(null)
const affectedProducts = ref<ShopPromotionProduct[]>([])
const affectedProductsCount = ref(0)
const productsPending = ref(false)
const productsError = ref('')
let productsRequestId = 0
const pendingToggleId = ref<number | null>(null)

const { data, pending, error, refresh } = await useAsyncData(
  'admin-shop-promotions',
  () => api.adminGetShopPromotions(page.value, pageSize, {
    search: filters.search || undefined,
    is_active: filters.is_active === '' ? null : filters.is_active === 'true',
    trigger: filters.trigger || undefined,
    status: filters.status || undefined,
    product_id: filters.product_id ? Number(filters.product_id) : undefined,
  }),
  { watch: [page] },
)

const promotions = computed(() => normalizeItems(data.value))
const total = computed(() => normalizeTotal(data.value))
const activeCount = computed(() => promotions.value.filter(promotion => promotion.status === 'active').length)
const inactiveCount = computed(() => promotions.value.filter(promotion => promotion.status === 'disabled').length)
const activeFilterCount = computed(() => [filters.search.trim(), filters.is_active, filters.trigger, filters.status, filters.product_id].filter(Boolean).length)

const activeOptions = [
  { value: '', label: 'Будь-який стан' },
  { value: 'true', label: 'Увімкнені' },
  { value: 'false', label: 'Вимкнені' },
]
const triggerOptions = [
  { value: '', label: 'Будь-який спосіб' },
  { value: 'automatic', label: 'Автоматичні' },
  { value: 'promocode', label: 'За промокодом' },
]
const statusOptions = [
  { value: '', label: 'Будь-який статус' },
  { value: 'active', label: 'Активні' },
  { value: 'scheduled', label: 'Заплановані' },
  { value: 'expired', label: 'Завершені' },
  { value: 'disabled', label: 'Вимкнені' },
]

const openCreate = () => {
  editing.value = null
  modalOpen.value = true
}
const openEdit = (promotion: ShopPromotion) => {
  editing.value = promotion
  modalOpen.value = true
}
const openAffectedProducts = async (promotion: ShopPromotion) => {
  const requestId = ++productsRequestId
  productsPromotion.value = promotion
  productsModalOpen.value = true
  affectedProducts.value = []
  affectedProductsCount.value = 0
  productsError.value = ''
  productsPending.value = true
  try {
    const result = await api.adminGetShopPromotionProducts(promotion.id)
    if (requestId !== productsRequestId) return
    affectedProducts.value = result.products
    affectedProductsCount.value = result.affected_products_count
  }
  catch (cause) {
    if (requestId !== productsRequestId) return
    productsError.value = apiErrorMessage(cause, 'Не вдалося завантажити товари, на які поширюється акція.')
  }
  finally {
    if (requestId === productsRequestId) productsPending.value = false
  }
}
const closeAffectedProducts = () => {
  productsRequestId += 1
  productsModalOpen.value = false
  productsPromotion.value = null
  affectedProducts.value = []
  affectedProductsCount.value = 0
  productsPending.value = false
  productsError.value = ''
}
const handleSaved = async (message: string) => {
  toast.success(message)
  editing.value = null
  await refresh()
}

const applyFilters = async () => {
  const immediate = page.value === 1
  page.value = 1
  if (immediate) await refresh()
}
const clearFilters = async () => {
  const immediate = page.value === 1
  filters.search = ''
  filters.is_active = ''
  filters.trigger = ''
  filters.status = ''
  filters.product_id = ''
  page.value = 1
  if (route.query.product_id !== undefined) {
    const query = { ...route.query }
    delete query.product_id
    await router.replace({ query })
  }
  if (immediate) await refresh()
}

watch(() => route.query.product_id, async value => {
  const productId = normalizeProductQuery(value)
  if (productId === filters.product_id) return
  const immediate = page.value === 1
  filters.product_id = productId
  page.value = 1
  if (immediate) await refresh()
})

const promotionPeriod = (promotion: ShopPromotion) => {
  if (!promotion.starts_at && !promotion.ends_at) return 'Без обмеження'
  if (promotion.starts_at && promotion.ends_at) return `${formatDateTime(promotion.starts_at)} — ${formatDateTime(promotion.ends_at)}`
  if (promotion.starts_at) return `З ${formatDateTime(promotion.starts_at)}`
  return `До ${formatDateTime(promotion.ends_at)}`
}
const scopeLabel = (promotion: ShopPromotion) => promotion.applies_to_all_products
  ? 'Усі товари'
  : `${promotion.product_ids.length} товарів · ${promotion.category_ids.length} категорій · ${promotion.brand_ids.length} брендів`
const discountLabel = (promotion: ShopPromotion) => {
  if (promotion.discount_type === 'percent') return `${promotion.discount_value}%`
  if (promotion.discount_type === 'fixed_price') return `Ціна ${promotion.discount_value}`
  return `−${promotion.discount_value}`
}
const statusLabel = (promotion: ShopPromotion) => ({
  disabled: 'Вимкнена',
  scheduled: 'Запланована',
  active: 'Активна',
  expired: 'Завершена',
}[promotion.status] || promotion.status)
const statusTone = (promotion: ShopPromotion) => ({
  disabled: 'neutral',
  scheduled: 'info',
  active: 'success',
  expired: 'warning',
}[promotion.status] || 'neutral') as 'neutral' | 'info' | 'success' | 'warning'

const togglePromotion = async (promotion: ShopPromotion) => {
  pendingToggleId.value = promotion.id
  try {
    await api.adminUpdateShopPromotion(promotion.id, { is_active: !promotion.is_active })
    toast.success(promotion.is_active ? 'Акцію товарів вимкнено.' : 'Акцію товарів увімкнено.')
    await refresh()
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося змінити статус акції.'))
  }
  finally {
    pendingToggleId.value = null
  }
}

</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="ui-eyebrow text-sm uppercase tracking-[0.3em]">Онлайн-магазин</p>
        <h1 class="mt-2 text-3xl font-semibold text-ui-primary">Акції товарів</h1>
        <p class="mt-2 max-w-2xl text-sm text-ui-muted">Окремі знижки магазину. Вони не змішуються з акціями клієнтів Soul Cuts.</p>
      </div>
      <BaseButton variant="primary" class="min-h-11 gap-2 px-5 py-3 text-sm" @click="openCreate">
        <PlusIcon class="h-4 w-4" aria-hidden="true" /> Створити акцію
      </BaseButton>
    </div>

    <section class="grid gap-3 sm:grid-cols-3">
      <BaseCard variant="subtle" padding="sm"><p class="text-xs uppercase tracking-[0.18em] text-ui-muted">Усього</p><p class="mt-2 text-2xl font-semibold text-ui-primary">{{ total }}</p></BaseCard>
      <BaseCard variant="subtle" padding="sm"><p class="text-xs uppercase tracking-[0.18em] text-ui-muted">Активні</p><p class="mt-2 text-2xl font-semibold text-emerald-700">{{ activeCount }}</p></BaseCard>
      <BaseCard variant="subtle" padding="sm"><p class="text-xs uppercase tracking-[0.18em] text-ui-muted">Вимкнені</p><p class="mt-2 text-2xl font-semibold text-ui-secondary">{{ inactiveCount }}</p></BaseCard>
    </section>

    <BaseFilterPanel
      :loading="pending"
      :active-count="activeFilterCount"
      mobile-title="Фільтри акцій товарів"
      fields-class="md:grid-cols-2 xl:grid-cols-4"
      @apply="applyFilters"
      @clear="clearFilters"
    >
      <BaseInput v-model="filters.search" type="search" placeholder="Пошук за назвою або кодом" aria-label="Пошук акцій товарів" />
      <BaseInput v-model="filters.product_id" type="number" min="1" placeholder="ID товару" aria-label="Фільтр за ID товару" />
      <BaseSelect v-model="filters.is_active" :options="activeOptions" aria-label="Увімкнення акції" />
      <BaseSelect v-model="filters.trigger" :options="triggerOptions" aria-label="Спосіб застосування" />
      <BaseSelect v-model="filters.status" :options="statusOptions" aria-label="Статус акції" />
    </BaseFilterPanel>

    <section class="rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm xl:p-4">
      <p v-if="error" class="mb-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ apiErrorMessage(error, 'Не вдалося завантажити акції товарів.') }}</p>
      <BaseTable sticky-actions caption="Акції товарів" min-width="110rem" :loading="pending" :empty="!promotions.length" empty-title="Акцій товарів не знайдено">
        <template #head>
          <tr><th>Акція</th><th>Знижка</th><th>Область</th><th>Період</th><th>Статус</th><th>Пріоритет</th><th>Промокод</th><th>Ліміти</th><th>Дії</th></tr>
        </template>
        <tr v-for="promotion in promotions" :key="promotion.id">
          <td class="min-w-64"><div class="flex items-start gap-2"><TicketIcon class="mt-0.5 h-4 w-4 shrink-0 text-ui-accent" aria-hidden="true" /><div><p class="font-medium text-ui-primary">{{ promotion.name }}</p><p class="mt-1 text-xs text-ui-muted">{{ promotion.description || 'Без опису' }}</p></div></div></td>
          <td><BaseBadge tone="info">{{ discountLabel(promotion) }} · {{ promotion.discount_type }}</BaseBadge></td>
          <td class="text-ui-secondary">{{ scopeLabel(promotion) }}<p v-if="promotion.include_subcategories && promotion.category_ids.length" class="mt-1 text-xs text-ui-muted">з підкатегоріями</p></td>
          <td class="text-ui-secondary">{{ promotionPeriod(promotion) }}</td>
          <td><BaseBadge :tone="statusTone(promotion)">{{ statusLabel(promotion) }}</BaseBadge></td>
          <td class="text-ui-secondary">{{ promotion.priority }}</td>
          <td class="font-medium text-ui-primary">{{ promotion.code || '—' }}</td>
          <td class="text-ui-secondary">{{ promotion.trigger === 'automatic' ? '—' : `${promotion.usage_limit ?? '∞'} / ${promotion.usage_limit_per_customer ?? '∞'}` }}</td>
          <td>
            <div class="flex flex-wrap gap-2">
              <BaseButton
                variant="icon"
                class="h-8 w-8"
                :disabled="productsPending && productsPromotion?.id === promotion.id"
                :aria-label="`Переглянути товари акції ${promotion.name}`"
                title="Переглянути товари"
                @click="openAffectedProducts(promotion)"
              >
                <EyeIcon class="h-4 w-4" aria-hidden="true" />
              </BaseButton>
              <BaseButton
                variant="icon"
                class="h-8 w-8"
                :disabled="pendingToggleId === promotion.id"
                :aria-label="promotion.is_active ? 'Вимкнути акцію' : 'Увімкнути акцію'"
                :title="promotion.is_active ? 'Вимкнути акцію' : 'Увімкнути акцію'"
                @click="togglePromotion(promotion)"
              >
                <NoSymbolIcon v-if="promotion.is_active" class="h-4 w-4" aria-hidden="true" />
                <CheckCircleIcon v-else class="h-4 w-4" aria-hidden="true" />
              </BaseButton>
              <BaseButton variant="icon" class="h-8 w-8" aria-label="Редагувати акцію" title="Редагувати акцію" @click="openEdit(promotion)">
                <PencilIcon class="h-4 w-4" aria-hidden="true" />
              </BaseButton>
            </div>
          </td>
        </tr>
      </BaseTable>
    </section>

    <p class="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800"><ExclamationTriangleIcon class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> Backend визначає допустимість, конфлікти та переможну ціну; frontend не перераховує ціни товарів.</p>
    <ShopPromotionFormModal v-model="modalOpen" :promotion="editing" @saved="handleSaved" />

    <BaseModal :model-value="productsModalOpen" max-width-class="max-w-6xl" aria-label="Товари акції" @update:model-value="productsModalOpen = $event" @close="closeAffectedProducts">
      <template #head="{ close }">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-sm uppercase tracking-[0.25em] text-cyan-700">Область застосування</p>
            <h2 class="mt-2 text-2xl font-semibold text-slate-900">Товари акції</h2>
            <p class="mt-1 text-sm text-slate-500">{{ productsPromotion?.name || 'Акція' }}</p>
          </div>
          <ModalCloseButton @click="close" />
        </div>
      </template>
      <template #body>
        <BaseLoader v-if="productsPending" label="Завантаження товарів…" />
        <p v-else-if="productsError" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{{ productsError }}</p>
        <template v-else>
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
            <span>Backend визначив товарів: <strong>{{ affectedProductsCount }}</strong></span>
            <span class="text-cyan-800">Список показує товари за областю застосування. Видимість відповідає поточному стану каталогу.</span>
          </div>
          <BaseTable v-if="affectedProducts.length" caption="Товари акції" min-width="48rem" dense>
            <template #head>
              <tr><th>ID</th><th>Товар</th><th>SKU</th><th>Базова ціна</th><th>Видимість</th></tr>
            </template>
            <tr v-for="item in affectedProducts" :key="item.product_id">
              <td class="text-ui-muted">#{{ item.product_id }}</td>
              <td><NuxtLink class="font-medium text-ui-primary hover:text-ui-accent" :to="`/products/${item.product_id}`">{{ item.product_name }}</NuxtLink></td>
              <td class="text-ui-secondary">{{ item.sku || '—' }}</td>
              <td class="text-ui-secondary">{{ formatMoney(item.base_price) }}</td>
              <td><BaseBadge :tone="item.is_effectively_visible ? 'success' : 'neutral'">{{ item.is_effectively_visible ? 'Видимий' : `Прихований${item.hidden_reason ? ` · ${item.hidden_reason}` : ''}` }}</BaseBadge></td>
            </tr>
          </BaseTable>
          <BaseEmptyState v-else title="Товарів не знайдено" description="Backend не знайшов товарів, які відповідають області застосування цієї акції." />
        </template>
      </template>
    </BaseModal>
  </div>
</template>
