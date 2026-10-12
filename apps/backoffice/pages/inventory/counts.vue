<script setup lang="ts">
import { ArrowPathIcon, ChatBubbleBottomCenterTextIcon, CheckIcon, ClipboardDocumentCheckIcon, CubeIcon, MagnifyingGlassIcon, PlusIcon } from '@heroicons/vue/24/outline'
import type { InventoryCount, InventoryProduct } from '~/types/inventory'
import { createInventoryIdempotencyKey, inventoryApiErrorMessage } from '~/utils/inventory'

definePageMeta({ middleware: () => {
  const auth = useAuthStore()
  if (!auth.user?.is_superuser && !auth.user?.can_post_inventory) return navigateTo('/')
} })

const api = useBackofficeApi()
const route = useRoute()
const router = useRouter()
const toast = useBaseToastNotification()
const count = ref<InventoryCount | null>(null)
const reason = ref('Інвентаризація')
const barcode = ref('')
const search = ref('')
const searchResults = ref<InventoryProduct[]>([])
const selectedProduct = ref<InventoryProduct | null>(null)
const countedQuantity = ref<number | null>(null)
const loading = ref(false)
const creating = ref(false)
const savingItem = ref(false)
const posting = ref(false)
const searching = ref(false)
const errorMessage = ref('')
const postConfirmationOpen = ref(false)
const createKey = ref('')
const postKey = ref('')
let countLoadRequest = 0
let productLookupRequest = 0
let productSearchRequest = 0

const readId = (value: unknown) => typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : null
const countIdFromRoute = computed(() => readId(route.query.id))
const isPosted = computed(() => count.value?.status === 'posted')
const selectProduct = (product: InventoryProduct) => { ++productLookupRequest; ++productSearchRequest; searching.value = false; selectedProduct.value = product; search.value = product.name; searchResults.value = [] }
const clearSelectedProduct = () => { ++productLookupRequest; ++productSearchRequest; searching.value = false; selectedProduct.value = null; barcode.value = ''; search.value = ''; searchResults.value = [] }
const loadCount = async (id = countIdFromRoute.value) => {
  if (!id) return
  const request = ++countLoadRequest
  loading.value = true; errorMessage.value = ''
  try {
    const next = await api.getInventoryCount(id) as InventoryCount
    if (request === countLoadRequest && countIdFromRoute.value === id) count.value = next
  }
  catch (cause) {
    if (request === countLoadRequest) errorMessage.value = inventoryApiErrorMessage(cause, 'Не вдалося завантажити інвентаризацію.')
  }
  finally { if (request === countLoadRequest) loading.value = false }
}
const scanBarcode = async (value: string | { barcode?: string }) => {
  const scanned = typeof value === 'string' ? value.trim() : value?.barcode?.trim() || ''
  if (!scanned || isPosted.value) return
  const request = ++productLookupRequest
  const documentRequest = countLoadRequest
  ++productSearchRequest
  searching.value = false
  barcode.value = scanned; errorMessage.value = ''
  try {
    const product = await api.lookupInventoryProductByBarcode(scanned) as InventoryProduct
    if (request === productLookupRequest && documentRequest === countLoadRequest) selectProduct(product)
  }
  catch (cause) {
    if (request === productLookupRequest && documentRequest === countLoadRequest) {
      selectedProduct.value = null
      errorMessage.value = inventoryApiErrorMessage(cause, 'Товар за цим штрихкодом не знайдено.')
    }
  }
}
const searchProducts = async () => {
  if (!search.value.trim() || isPosted.value) return
  const request = ++productSearchRequest
  const documentRequest = countLoadRequest
  ++productLookupRequest
  searching.value = true; errorMessage.value = ''
  try {
    const result = await api.getProducts(1, 10, { search: search.value.trim() })
    const resolved = await Promise.all(result.items.map(async (product) => {
      try { return await api.getInventoryProduct(product.id) }
      catch { return null }
    }))
    if (request === productSearchRequest && documentRequest === countLoadRequest) searchResults.value = resolved.filter((product): product is InventoryProduct => Boolean(product))
  }
  catch (cause) {
    if (request === productSearchRequest && documentRequest === countLoadRequest) errorMessage.value = inventoryApiErrorMessage(cause, 'Не вдалося знайти товар.')
  }
  finally { if (request === productSearchRequest) searching.value = false }
}
const createCount = async () => {
  if (loading.value || countIdFromRoute.value || !reason.value.trim() || creating.value) { errorMessage.value = 'Вкажіть причину інвентаризації.'; return }
  creating.value = true; errorMessage.value = ''
  if (!createKey.value) createKey.value = createInventoryIdempotencyKey()
  const request = countLoadRequest
  try {
    const next = await api.createInventoryCount({ reason: reason.value.trim() }, createKey.value) as InventoryCount
    if (request !== countLoadRequest || countIdFromRoute.value) return
    count.value = next
    await router.replace({ query: { ...route.query, id: String(next.id) } })
    toast.success('Чернетку інвентаризації створено.')
  }
  catch (cause) {
    if (request === countLoadRequest && !countIdFromRoute.value) errorMessage.value = inventoryApiErrorMessage(cause, 'Не вдалося створити чернетку інвентаризації.')
  }
  finally { creating.value = false }
}
const setItem = async () => {
  const activeCount = count.value
  const product = selectedProduct.value
  const itemQuantity = countedQuantity.value
  if (!activeCount || !product || itemQuantity === null || itemQuantity < 0 || savingItem.value || posting.value || isPosted.value) {
    errorMessage.value = 'Оберіть товар і вкажіть кількість 0 або більше.'
    return
  }
  savingItem.value = true; errorMessage.value = ''
  const request = countLoadRequest
  try {
    const next = await api.setInventoryCountItem(activeCount.id, { product_id: product.id, counted_quantity: itemQuantity }) as InventoryCount
    if (request !== countLoadRequest || countIdFromRoute.value !== activeCount.id || count.value?.id !== activeCount.id) return
    count.value = next
    postKey.value = ''
    toast.success('Фактичну кількість збережено. Повторне сканування оновлює це значення, а не додає його.')
    countedQuantity.value = null
  }
  catch (cause) {
    if (request === countLoadRequest && countIdFromRoute.value === activeCount.id) errorMessage.value = inventoryApiErrorMessage(cause, 'Не вдалося зберегти кількість.')
  }
  finally { savingItem.value = false }
}
const postCount = async () => {
  const activeCount = count.value
  if (!activeCount || isPosted.value || posting.value || savingItem.value) return
  posting.value = true; errorMessage.value = ''
  if (!postKey.value) postKey.value = createInventoryIdempotencyKey()
  const request = countLoadRequest
  try {
    const next = await api.postInventoryCount(activeCount.id, postKey.value) as InventoryCount
    if (request !== countLoadRequest || countIdFromRoute.value !== activeCount.id || count.value?.id !== activeCount.id) return
    count.value = next
    postConfirmationOpen.value = false
    toast.success('Інвентаризацію проведено. Редагування заблоковано.')
  }
  catch (cause) {
    if (request === countLoadRequest && countIdFromRoute.value === activeCount.id) errorMessage.value = inventoryApiErrorMessage(cause, 'Не вдалося провести інвентаризацію.')
  }
  finally { posting.value = false }
}
watch(reason, () => {
  if (!count.value && !countIdFromRoute.value) createKey.value = ''
})

watch(countIdFromRoute, async (id) => {
  ++countLoadRequest
  createKey.value = ''
  postKey.value = ''
  postConfirmationOpen.value = false
  selectedProduct.value = null
  ++productLookupRequest
  ++productSearchRequest
  barcode.value = ''
  search.value = ''
  searchResults.value = []
  searching.value = false
  if (!id) {
    count.value = null
    loading.value = false
    return
  }
  if (count.value?.id === id) return
  count.value = null
  await loadCount(id)
}, { immediate: true })
</script>

<template>
  <div class="space-y-4">
    <div><h1 class="flex items-center gap-2 text-2xl font-semibold text-ui-primary sm:text-3xl"><ClipboardDocumentCheckIcon class="h-6 w-6 shrink-0" aria-hidden="true" />Інвентаризація</h1><p class="mt-1 text-sm text-ui-secondary">Внесіть фактичну кількість для кожного товару. Повторне сканування оновлює кількість, а не підсумовує її.</p></div>
    <InventorySectionNav />
    <p v-if="loading" role="status" class="text-sm text-ui-muted">Завантаження інвентаризації…</p>
    <div v-if="errorMessage" role="alert" class="ui-status-danger rounded-2xl p-4 text-sm">{{ errorMessage }} <BaseButton class="min-h-11" v-if="countIdFromRoute" variant="neutral" size="sm" @click="loadCount()"><ArrowPathIcon class="h-4 w-4" aria-hidden="true" />Повторити</BaseButton></div>
    <BaseCard v-if="isPosted" variant="subtle" padding="sm" class="text-sm text-ui-secondary"><BaseBadge tone="success">Проведено</BaseBadge><span class="ml-2">Інвентаризацію #{{ count?.id }} проведено {{ count?.posted_at || '' }}. Редагування недоступне.</span></BaseCard>
    <BaseCard v-if="!count && !countIdFromRoute && !loading" variant="surface" padding="sm" class="grid gap-4"><h2 class="text-lg font-semibold text-ui-primary">Нова інвентаризація</h2><BaseInput v-model="reason" label="Причина" hint="Коротко вкажіть, навіщо перераховуєте товари." maxlength="255" required placeholder="Наприклад, плановий перерахунок" ><template #icon><ChatBubbleBottomCenterTextIcon class="h-4 w-4" aria-hidden="true" /></template></BaseInput><BaseButton class="min-h-11 w-full sm:w-auto" variant="primary" :loading="creating" @click="createCount"><PlusIcon class="h-4 w-4" aria-hidden="true" />Створити чернетку</BaseButton></BaseCard>
    <template v-if="count">
      <BaseCard variant="surface" padding="sm" class="space-y-4" :class="isPosted ? 'opacity-70' : ''"><div class="flex items-center justify-between gap-4"><div><h2 class="text-lg font-semibold text-ui-primary">Внести фактичну кількість</h2><p class="text-sm text-ui-secondary">Інвентаризація #{{ count.id }} · {{ count.reason }}</p></div><BaseBadge tone="neutral">{{ isPosted ? 'Проведено' : 'Чернетка' }}</BaseBadge></div>
        <p v-if="!isPosted" class="rounded-xl bg-ui-subtle p-3 text-xs text-ui-secondary">Чернетка: залишки зміняться лише після проведення інвентаризації.</p>
        <InventoryBarcodeInput v-model="barcode" :match="selectedProduct" :disabled="isPosted || savingItem" :auto-focus="!isPosted" @submit="scanBarcode" @clear="clearSelectedProduct" />
        <div class="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4"><BaseInput v-model="search" type="search" label="Пошук товару" aria-description="Введіть назву або артикул SKU." placeholder="Назва або SKU" :disabled="isPosted" @keyup.enter="searchProducts" ><template #icon><MagnifyingGlassIcon class="h-4 w-4" aria-hidden="true" /></template></BaseInput><BaseButton variant="neutral" class="min-h-11" :loading="searching" :disabled="isPosted" @click="searchProducts"><MagnifyingGlassIcon class="h-4 w-4 shrink-0" aria-hidden="true" />Знайти</BaseButton><p class="col-span-2 text-xs text-ui-muted">Введіть назву товару або артикул SKU.</p></div>
        <div v-if="searchResults.length" class="grid gap-2"><BaseButton v-for="product in searchResults" :key="product.id" type="button" variant="neutral" class="justify-start text-left" @click="selectProduct(product)"><span class="font-medium text-ui-primary">{{ product.name }}</span><span class="ml-2 text-xs text-ui-muted">{{ product.sku || 'без SKU' }}</span></BaseButton></div>
        <div v-if="selectedProduct" class="rounded-xl bg-ui-subtle p-4 text-sm"><p class="font-medium text-ui-primary">{{ selectedProduct.name }}</p><p class="text-ui-secondary">SKU: {{ selectedProduct.sku || '—' }} · Поточний залишок: {{ selectedProduct.on_hand }}</p></div>
        <div class="grid gap-4 md:grid-cols-2"><BaseInput v-model.number="countedQuantity" type="number" min="0" step="1" label="Фактична кількість" hint="Усі одиниці, які ви порахували. Вкажіть 0, якщо товару немає." inputmode="numeric" :disabled="isPosted" required ><template #icon><CubeIcon class="h-4 w-4" aria-hidden="true" /></template></BaseInput><p class="text-xs text-ui-muted md:self-center">Очікувана кількість та різниця з'являться після збереження рядка.</p></div>
        <BaseButton class="min-h-11 w-full sm:w-auto" variant="primary" :loading="savingItem" :disabled="isPosted || posting || !selectedProduct" @click="setItem"><CheckIcon class="h-4 w-4" aria-hidden="true" />Зберегти кількість</BaseButton>
      </BaseCard>
      <div v-if="count.items.length" class="space-y-2 md:hidden">
        <BaseCard v-for="item in count.items" :key="item.id" padding="sm" as="article">
          <p class="text-sm font-medium text-ui-primary">Товар #{{ item.product_id }}</p>
          <p class="break-all text-xs text-ui-muted">{{ item.barcode || 'Без штрихкоду' }}</p>
          <dl class="mt-2 grid grid-cols-3 gap-2 text-xs"><div><dt class="text-ui-muted">Очікувано</dt><dd class="mt-1 font-medium">{{ item.expected_quantity ?? '—' }}</dd></div><div><dt class="text-ui-muted">Фактично</dt><dd class="mt-1 font-medium">{{ item.counted_quantity }}</dd></div><div><dt class="text-ui-muted">Різниця</dt><dd class="mt-1 font-medium">{{ item.difference === null ? '—' : item.difference > 0 ? `+${item.difference}` : item.difference }}</dd></div></dl>
        </BaseCard>
      </div>
      <BaseTable :wrapper-class="count.items.length ? 'hidden md:block' : ''" caption="Рядки інвентаризації" min-width="48rem" :empty="!count.items.length" empty-title="Позицій ще немає"><template #head><tr><th>Товар</th><th>Очікувано</th><th>Фактично</th><th>Різниця</th></tr></template><tr v-for="item in count.items" :key="item.id"><td>Товар #{{ item.product_id }}<p class="text-xs text-ui-muted">{{ item.barcode || '—' }}</p></td><td>{{ item.expected_quantity ?? '—' }}</td><td class="font-medium text-ui-primary">{{ item.counted_quantity }}</td><td :class="item.difference && item.difference < 0 ? 'text-[var(--bo-danger-text)]' : item.difference && item.difference > 0 ? 'text-[var(--bo-success-text)]' : 'text-ui-secondary'">{{ item.difference === null ? '—' : item.difference > 0 ? `+${item.difference}` : item.difference }}</td></tr></BaseTable>
      <BaseCard variant="subtle" padding="sm" class="flex flex-wrap items-center justify-between gap-4"><span class="text-sm text-ui-secondary">Проведення застосує різницю до залишків і не може бути скасоване цією формою.</span><BaseButton class="min-h-11 w-full sm:w-auto" variant="primary" :disabled="isPosted || savingItem || !count.items.length" @click="postConfirmationOpen = true">Провести інвентаризацію</BaseButton></BaseCard>
    </template>
    <ConfirmActionModal v-model="postConfirmationOpen" title="Провести інвентаризацію?" message="Різниця між очікуваною та фактичною кількістю змінить залишки. Після проведення документ лише для перегляду." confirm-label="Провести" :pending="posting" @confirm="postCount" />
  </div>
</template>
