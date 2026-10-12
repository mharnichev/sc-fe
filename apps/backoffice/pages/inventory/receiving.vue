<script setup lang="ts">
import { ArrowDownTrayIcon, PlusIcon, CheckIcon, DocumentPlusIcon, InformationCircleIcon } from '@heroicons/vue/24/outline'
import type { InventoryProduct, InventoryReceipt as Receipt } from '~/types/inventory'
import { createInventoryIdempotencyKey, createReceiptItemRequest, inventoryApiErrorMessage, isDefiniteInventoryRejection, receiptItemStorageKey, restoreReceiptItemRequest } from '~/utils/inventory'

interface Requirement { orderItemId: number, quantity: number }

const auth = useAuthStore()
const canPostInventory = computed(() => Boolean(auth.user?.is_superuser || auth.user?.can_post_inventory))

const api = useBackofficeApi()
const route = useRoute()
const router = useRouter()
const toast = useBaseToastNotification()
const receipt = ref<Receipt | null>(null)
const loadingReceipt = ref(false)
const creating = ref(false)
const adding = ref(false)
const pendingAdd = shallowRef<ReturnType<typeof createReceiptItemRequest> | null>(null)
const addOutcomeUncertain = ref(false)
const pendingStorageError = ref(false)
const addLocked = computed(() => adding.value || Boolean(pendingAdd.value) || pendingStorageError.value)
const posting = ref(false)
const errorMessage = ref('')
const postConfirmationOpen = ref(false)
const reason = ref('Поставка товару')
const comment = ref('')
const barcode = ref(typeof route.query.barcode === 'string' ? route.query.barcode : '')
const search = ref('')
const searchPending = ref(false)
const searchResults = ref<InventoryProduct[]>([])
const selectedProduct = ref<InventoryProduct | null>(null)
const quantity = ref<number | null>(1)
const unitCost = ref<number | null>(null)
const batchNumber = ref('')
const expirationDate = ref('')
const allocationQuantities = ref<Record<number, number | null>>({})
const createOutcomeUncertain = ref(false)
const createKey = ref('')
const pendingCreate = ref<{ key: string, payload: { reason: string, comment: string | null } } | null>(null)
const createStorageKey = `backoffice:inventory:receipt-create:${auth.user?.id}`
const postKey = ref('')
const postedBalances = ref<Record<number, InventoryProduct>>({})
let receiptLoadRequest = 0
let balanceLoadRequest = 0
let productLookupRequest = 0
let productSearchRequest = 0

const readId = (value: unknown) => typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : null
const receiptIdFromRoute = computed(() => readId(route.query.id))
const routeProductId = computed(() => readId(route.query.product_id))
const isPosted = computed(() => receipt.value?.status === 'posted')
const requirements = computed<Requirement[]>(() => typeof route.query.requirements === 'string'
  ? route.query.requirements.split(',').map(part => {
      const [id, amount] = part.split(':')
      return { orderItemId: Number(id), quantity: Number(amount) }
    }).filter(item => Number.isInteger(item.orderItemId) && item.orderItemId > 0 && Number.isInteger(item.quantity) && item.quantity > 0)
  : [])
const allocationTotal = computed(() => Object.values(allocationQuantities.value).reduce<number>((sum, value) => sum + (Number(value ?? 0) || 0), 0))

const loadPostedBalances = async (next: Receipt) => {
  const request = receiptLoadRequest
  const balanceRequest = ++balanceLoadRequest
  const products = await Promise.all([...new Set(next.items.map(item => item.product_id))].map(async (productId) => {
    try { return await api.getInventoryProduct(productId) }
    catch { return null }
  }))
  if (balanceRequest !== balanceLoadRequest || request !== receiptLoadRequest || receiptIdFromRoute.value !== next.id || receipt.value?.id !== next.id) return
  postedBalances.value = Object.fromEntries(products.filter((product): product is InventoryProduct => Boolean(product)).map(product => [product.id, product]))
}
const setReceipt = (next: Receipt) => {
  receipt.value = next
  postedBalances.value = {}
  void loadPostedBalances(next)
}
const loadReceipt = async (id = receiptIdFromRoute.value) => {
  if (!id || adding.value || posting.value) return
  const request = ++receiptLoadRequest
  loadingReceipt.value = true
  errorMessage.value = ''
  try {
    const next = await api.getInventoryReceipt(id) as Receipt
    if (request === receiptLoadRequest && receiptIdFromRoute.value === id) setReceipt(next)
  }
  catch (cause) {
    if (request === receiptLoadRequest) errorMessage.value = inventoryApiErrorMessage(cause, 'Не вдалося завантажити приймання.')
  }
  finally { if (request === receiptLoadRequest) loadingReceipt.value = false }
}
const selectProduct = (product: InventoryProduct, repeatedScan = false) => {
  if (addLocked.value) return
  ++productLookupRequest
  ++productSearchRequest
  searchPending.value = false
  if (repeatedScan) quantity.value = Math.max(1, Number(quantity.value || 0) + 1)
  else if (selectedProduct.value?.id !== product.id) quantity.value = 1
  selectedProduct.value = product
  searchResults.value = []
  search.value = product.name
}
const clearSelectedProduct = () => {
  if (addLocked.value) return
  ++productLookupRequest
  ++productSearchRequest
  searchPending.value = false
  selectedProduct.value = null
  barcode.value = ''
  search.value = ''
  searchResults.value = []
}
const createReceipt = async () => {
  if (loadingReceipt.value || receiptIdFromRoute.value || !reason.value.trim() || creating.value) { errorMessage.value = 'Вкажіть причину приймання.'; return }
  errorMessage.value = ''
  creating.value = true
  if (!pendingCreate.value) {
    pendingCreate.value = { key: createInventoryIdempotencyKey(), payload: { reason: reason.value.trim(), comment: comment.value.trim() || null } }
    try { sessionStorage.setItem(createStorageKey, JSON.stringify(pendingCreate.value)) }
    catch { pendingCreate.value = null; creating.value = false; errorMessage.value = 'Не вдалося зберегти безпечний повтор. Чернетку не надіслано.'; return }
  }
  const previouslyUncertain = createOutcomeUncertain.value
  createOutcomeUncertain.value = true
  createKey.value = pendingCreate.value.key
  const request = receiptLoadRequest
  try {
    const next = await api.createInventoryReceipt(pendingCreate.value.payload, createKey.value) as Receipt
    if (request !== receiptLoadRequest || receiptIdFromRoute.value) return
    setReceipt(next)
    await router.replace({ query: { ...route.query, id: String(next.id) } })
    sessionStorage.removeItem(createStorageKey)
    pendingCreate.value = null
    toast.success('Чернетку приймання створено.')
  }
  catch (cause) {
    if (!previouslyUncertain && isDefiniteInventoryRejection(cause)) {
      try { sessionStorage.removeItem(createStorageKey); pendingCreate.value = null; createOutcomeUncertain.value = false } catch { /* Preserve the retry intent if storage cannot be cleared. */ }
    }
    if (request === receiptLoadRequest && !receiptIdFromRoute.value) errorMessage.value = inventoryApiErrorMessage(cause, 'Не вдалося створити чернетку приймання. Повторіть запит із тими самими даними.')
  }
  finally { creating.value = false }
}
const addItem = async () => {
  if (adding.value || posting.value || loadingReceipt.value || pendingStorageError.value) return
  const activeReceipt = receipt.value
  const product = selectedProduct.value
  const itemQuantity = quantity.value
  const cost = unitCost.value
  if (!activeReceipt || (!pendingAdd.value && (!product || !itemQuantity || !Number.isInteger(itemQuantity) || itemQuantity < 1 || cost === null || !Number.isFinite(cost) || cost < 0 || isPosted.value))) {
    errorMessage.value = 'Оберіть товар і вкажіть додатну кількість та собівартість.'
    return
  }
  if (!pendingAdd.value) {
    if (!product || !itemQuantity || cost === null) return
    if (allocationTotal.value > itemQuantity) { errorMessage.value = 'Сума розподілів не може перевищувати кількість.'; return }
    const allocations = requirements.value.map(item => ({ order_item_id: item.orderItemId, quantity: Number(allocationQuantities.value[item.orderItemId] || 0) })).filter(item => item.quantity > 0)
    pendingAdd.value = createReceiptItemRequest(activeReceipt.id, {
      product_id: product.id,
      quantity: itemQuantity,
      purchase_unit_cost: cost.toFixed(2),
      batch_number: batchNumber.value.trim() || null,
      expiration_date: expirationDate.value || null,
      allocations,
    })
    try {
      // Persist before sending: even a reload during the first attempt must replay this tuple.
      sessionStorage.setItem(receiptItemStorageKey(activeReceipt.id), JSON.stringify(pendingAdd.value))
    }
    catch {
      pendingAdd.value = null
      errorMessage.value = 'Не вдалося зберегти запит у браузері. Позицію не надіслано. Перевірте доступ до сховища та повторіть спробу.'
      return
    }
  }
  const operation = pendingAdd.value
  if (operation.receiptId !== activeReceipt.id) return
  errorMessage.value = ''
  adding.value = true
  const request = receiptLoadRequest
  try {
    const next = await api.addInventoryReceiptItem(operation.receiptId, operation.payload, operation.key) as Receipt
    if (request !== receiptLoadRequest || receiptIdFromRoute.value !== activeReceipt.id || receipt.value?.id !== activeReceipt.id) return
    setReceipt(next)
    sessionStorage.removeItem(receiptItemStorageKey(operation.receiptId))
    pendingAdd.value = null
    addOutcomeUncertain.value = false
    postKey.value = ''
    toast.success('Позицію додано. Повторне додавання такого самого товару збільшить рядок.')
    quantity.value = 1
    allocationQuantities.value = {}
  }
  catch (cause) {
    // A rejected retry cannot prove that an earlier timed-out attempt did not commit.
    if (isDefiniteInventoryRejection(cause) && !addOutcomeUncertain.value) {
      try {
        sessionStorage.removeItem(receiptItemStorageKey(operation.receiptId))
        pendingAdd.value = null
      }
      catch { addOutcomeUncertain.value = true }
    }
    else addOutcomeUncertain.value = true
    if (request === receiptLoadRequest && receiptIdFromRoute.value === activeReceipt.id) errorMessage.value = inventoryApiErrorMessage(cause, 'Не вдалося додати позицію. Перевірте розподіли та статус замовлення.')
  }
  finally { adding.value = false }
}
const postReceipt = async () => {
  const activeReceipt = receipt.value
  if (!canPostInventory.value || !activeReceipt || isPosted.value || posting.value || adding.value || pendingAdd.value || pendingStorageError.value) return
  posting.value = true
  errorMessage.value = ''
  try {
    const keyName = `backoffice:inventory:receipt-post:${activeReceipt.id}`
    postKey.value = sessionStorage.getItem(keyName) || createInventoryIdempotencyKey()
    sessionStorage.setItem(keyName, postKey.value)
  }
  catch { posting.value = false; errorMessage.value = 'Не вдалося зберегти безпечний повтор проведення.'; return }
  const request = receiptLoadRequest
  try {
    const next = await api.postInventoryReceipt(activeReceipt.id, postKey.value) as Receipt
    if (request !== receiptLoadRequest || receiptIdFromRoute.value !== activeReceipt.id || receipt.value?.id !== activeReceipt.id) return
    if (next.status !== 'posted') throw new Error('Server did not confirm posting')
    setReceipt(next)
    sessionStorage.removeItem(`backoffice:inventory:receipt-post:${activeReceipt.id}`)
    postConfirmationOpen.value = false
    toast.success('Приймання проведено. Редагування заблоковано.')
  }
  catch (cause) {
    if (request === receiptLoadRequest && receiptIdFromRoute.value === activeReceipt.id) errorMessage.value = inventoryApiErrorMessage(cause, 'Не вдалося провести приймання.')
  }
  finally { posting.value = false }
}

watch([reason, comment], () => {
  if (!receipt.value && !receiptIdFromRoute.value) createKey.value = ''
})

onBeforeRouteLeave(() => !adding.value && !creating.value && !posting.value)
onBeforeRouteUpdate(() => !adding.value && !posting.value)
const warnPendingAdd = (event: BeforeUnloadEvent) => {
  if (!addLocked.value) return
  event.preventDefault()
  event.returnValue = ''
}
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnPendingAdd))

watch(receiptIdFromRoute, async (id) => {
  if (id && receipt.value?.id === id) return
  ++receiptLoadRequest
  pendingAdd.value = null
  pendingStorageError.value = false
  addOutcomeUncertain.value = false
  if (id && typeof window !== 'undefined') {
    try {
      pendingAdd.value = restoreReceiptItemRequest(sessionStorage, id)
      addOutcomeUncertain.value = Boolean(pendingAdd.value)
      if (pendingAdd.value) {
        const payload = pendingAdd.value.payload
        quantity.value = payload.quantity
        unitCost.value = Number(payload.purchase_unit_cost)
        batchNumber.value = payload.batch_number || ''
        expirationDate.value = payload.expiration_date || ''
        allocationQuantities.value = Object.fromEntries(payload.allocations.map(item => [item.order_item_id, item.quantity]))
      }
    }
    catch {
      pendingStorageError.value = true
      errorMessage.value = 'Не вдалося відновити попередній запит. Нове додавання заблоковано, щоб не подвоїти кількість.'
    }
  }
  createKey.value = ''
  postKey.value = ''
  postConfirmationOpen.value = false
  postedBalances.value = {}
  // Keep the warehouse selection when creating its draft.
  if (!receipt.value || receipt.value.id !== id) selectedProduct.value = null
  ++productLookupRequest
  ++productSearchRequest
  barcode.value = ''
  search.value = ''
  searchResults.value = []
  searchPending.value = false
  if (!id) {
    receipt.value = null
    loadingReceipt.value = false
    return
  }
  receipt.value = null
  await loadReceipt(id)
  if (pendingStorageError.value) errorMessage.value = 'Не вдалося відновити попередній запит. Нове додавання заблоковано, щоб не подвоїти кількість.'
}, { immediate: true })

onMounted(async () => {
  window.addEventListener('beforeunload', warnPendingAdd)
  if (!receiptIdFromRoute.value) {
    try {
      const raw = sessionStorage.getItem(createStorageKey)
      if (raw) {
        const value = JSON.parse(raw)
        if (typeof value.key !== 'string' || !value.key || typeof value.payload?.reason !== 'string') throw new Error('Invalid stored draft')
        pendingCreate.value = value
        createOutcomeUncertain.value = true
        reason.value = value.payload.reason
        comment.value = value.payload.comment || ''
      }
    }
    catch { errorMessage.value = 'Не вдалося відновити запит створення чернетки. Перевірте попередню приймання перед новим запитом.'; creating.value = true }
  }
  if (!receiptIdFromRoute.value && routeProductId.value) {
    const request = receiptLoadRequest
    try {
      const inventoryProduct = await api.getInventoryProduct(routeProductId.value)
      if (request === receiptLoadRequest && !receiptIdFromRoute.value) selectProduct(inventoryProduct)
    }
    catch { /* Scanner or product search remains available if the prefilled product is unavailable. */ }
  }
})
</script>

<template>
  <div class="space-y-4 sm:space-y-6">
    <header><h1 class="flex items-center gap-2 text-2xl font-semibold text-ui-primary sm:text-3xl"><ArrowDownTrayIcon class="h-6 w-6 shrink-0" aria-hidden="true" />Приймання товару</h1><p class="mt-1 text-sm text-ui-secondary">Знайдіть товар, вкажіть кількість і закупівельну вартість.</p></header>
    <InventorySectionNav />
    <p v-if="loadingReceipt" role="status" class="text-sm text-ui-muted">Завантаження приймання…</p>
    <div v-if="errorMessage" role="alert" class="ui-status-danger rounded-2xl p-4 text-sm">{{ errorMessage }} <BaseButton v-if="receiptIdFromRoute && !adding" variant="neutral" size="sm" :disabled="loadingReceipt || posting" @click="loadReceipt()">Повторити</BaseButton></div>
    <div v-if="pendingAdd && !adding" role="alert" class="ui-status-warning p-4 text-sm">Результат додавання невідомий або потребує звірки. Товар {{ pendingAdd.payload.product_id || pendingAdd.payload.barcode }} · {{ pendingAdd.payload.quantity }} од. Повторіть цю саму позицію перед редагуванням або новим скануванням.<BaseButton variant="neutral" size="sm" :disabled="loadingReceipt || !receipt" @click="addItem">Повторити додавання</BaseButton></div>
    <BaseCard v-if="isPosted" variant="subtle" padding="sm" class="text-sm text-ui-secondary"><BaseBadge tone="success">Проведено</BaseBadge><span class="ml-2">Приймання #{{ receipt?.id }} проведено {{ receipt?.posted_at || '' }}. Редагування недоступне.</span></BaseCard>
    <BaseCard v-if="!receipt && !receiptIdFromRoute && !loadingReceipt" variant="surface" padding="sm" class="space-y-3"><h2 class="text-xl font-semibold text-ui-primary">Нове приймання</h2><BaseInput v-model="reason" :disabled="creating || !!pendingCreate" label="Причина" hint="Назва поставки, щоб знайти цю чернетку пізніше." required maxlength="255" placeholder="Наприклад, поставка від постачальника" /><BaseTextarea v-model="comment" :disabled="creating || !!pendingCreate" label="Коментар" :rows="2" hint="Необов’язково: постачальник, номер накладної або примітка." maxlength="2000" /><BaseButton variant="primary" class="min-h-11 w-full sm:w-auto" :loading="creating" @click="createReceipt"><DocumentPlusIcon class="h-5 w-5 shrink-0" aria-hidden="true" />{{ pendingCreate ? 'Повторити створення без дублювання' : 'Створити чернетку' }}</BaseButton></BaseCard>
    <template v-if="receipt">
      <p v-if="!isPosted" class="ui-status-warning rounded-xl p-3 text-sm" role="status">Чернетка #{{ receipt.id }}: товари ще не оприбутковано. <span v-if="!canPostInventory">Передайте адміністратору посилання на цю чернетку — він має її провести.</span></p>
      <BaseCard variant="surface" padding="sm" class="space-y-3" :class="isPosted ? 'opacity-70' : ''"><div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-xl font-semibold text-ui-primary">Додати позицію</h2><p class="text-sm text-ui-secondary">Приймання #{{ receipt.id }} · {{ receipt.reason }}</p></div><BaseBadge :tone="isPosted ? 'success' : 'warning'">{{ isPosted ? 'Проведено' : 'Чернетка' }}</BaseBadge></div>
        <fieldset :disabled="isPosted || addLocked" class="space-y-4">
        <InventoryProductPicker :show-selected="false" :initial-barcode="typeof route.query.barcode === 'string' ? route.query.barcode : ''" :disabled="isPosted || addLocked || posting" @select="selectProduct" @clear="clearSelectedProduct" />
        <InventoryProductCard v-if="selectedProduct" :product="selectedProduct" />
        <div class="grid grid-cols-2 gap-3"><BaseInput v-model.number="quantity" type="number" min="1" step="1" label="Кількість" inputmode="numeric" hint="Скільки одиниць надійшло." :disabled="isPosted" required /><BaseInput v-model.number="unitCost" type="number" min="0" step="0.01" label="Закупівля, грн/од." aria-label="Закупівля, грн/од. (Закупівельна вартість за одиницю, грн)" inputmode="decimal" hint="Вартість однієї одиниці, не ціна продажу." :disabled="isPosted" required /></div><details class="rounded-xl border border-ui p-3"><summary class="min-h-10 cursor-pointer text-sm font-medium">Партія та термін придатності (необов’язково)</summary><div class="mt-3 grid gap-4 md:grid-cols-2"><BaseInput v-model="batchNumber" label="Партія" hint="Номер з упаковки або накладної." :disabled="isPosted" /><BaseInput v-model="expirationDate" type="date" label="Термін придатності" hint="Заповніть, якщо вказано на упаковці." :disabled="isPosted" /></div></details>
        <fieldset v-if="requirements.length" :disabled="isPosted" class="space-y-2 rounded-xl border border-ui p-4"><legend class="px-1 text-sm font-medium text-ui-primary">Розподіл на замовлені позиції (необов'язково)</legend><div v-for="requirement in requirements" :key="requirement.orderItemId" class="grid gap-2 sm:grid-cols-[1fr_10rem] sm:items-center"><span class="text-sm text-ui-secondary">Позиція замовлення #{{ requirement.orderItemId }} · залишок {{ requirement.quantity }}</span><BaseInput v-model.number="allocationQuantities[requirement.orderItemId]" type="number" min="0" :max="requirement.quantity" step="1" aria-label="Кількість розподілу" /></div><p class="text-xs text-ui-muted">Розподілено: {{ allocationTotal }} з {{ quantity || 0 }}</p></fieldset>
        </fieldset>
        <BaseButton variant="primary" class="min-h-11 w-full sm:w-auto" :loading="adding" :disabled="isPosted || posting || addLocked || !selectedProduct" @click="addItem"><PlusIcon class="h-5 w-5 shrink-0" aria-hidden="true" />Додати до приймання</BaseButton>
      </BaseCard>
      <BaseCard v-if="isPosted" variant="subtle" padding="sm"><p class="font-medium text-ui-primary">Підсумок проведення</p><p class="mt-1 text-sm text-ui-secondary">Оприбутковано {{ receipt.items.reduce((sum, item) => sum + item.quantity, 0) }} од. Виконано розподілів на замовлення: {{ receipt.items.reduce((sum, item) => sum + item.allocations.length, 0) }}.</p></BaseCard>
      <div class="space-y-2"><h2 class="text-lg font-semibold text-ui-primary">Позиції · {{ receipt.items.length }}</h2><p v-if="!isPosted" class="flex items-start gap-2 text-xs text-ui-muted"><InformationCircleIcon class="h-4 w-4 shrink-0" aria-hidden="true" />Перевірте дані перед додаванням: рядки можна лише доповнювати, без зменшення або видалення.</p></div>
      <div class="grid gap-2 md:hidden" aria-label="Позиції приймання">
        <BaseCard v-for="item in receipt.items" :key="item.id" padding="sm">
          <InventoryProductCard v-if="postedBalances[item.product_id]" :product="postedBalances[item.product_id]" :framed="false" />
          <p v-else>Товар #{{ item.product_id }} · {{ item.barcode || 'Без штрихкоду' }}</p>
          <p class="mt-2 text-sm font-semibold">{{ item.quantity }} од. × {{ item.purchase_unit_cost }} грн закупівельної вартості</p>
          <p class="text-sm text-ui-secondary">{{ item.batch_number || '' }} {{ item.expiration_date || '' }}</p>
        </BaseCard>
      </div>
      <BaseTable wrapper-class="hidden md:block" caption="Позиції приймання" min-width="64rem" :empty="!receipt.items.length" empty-title="Позицій ще немає"><template #head><tr><th>Товар</th><th>Кількість</th><th>Собівартість</th><th>Партія</th><th>Розподіли</th><th>Залишок після</th></tr></template><tr v-for="item in receipt.items" :key="item.id"><td>Товар #{{ item.product_id }}<p class="text-xs text-ui-muted">{{ item.barcode || '—' }}</p></td><td>{{ item.quantity }}</td><td>{{ item.purchase_unit_cost }}</td><td>{{ item.batch_number || '—' }}<p class="text-xs text-ui-muted">{{ item.expiration_date || '' }}</p></td><td>{{ item.allocations.length ? item.allocations.map(allocation => `#${allocation.order_item_id}: ${allocation.quantity}`).join(', ') : '—' }}</td><td>{{ isPosted ? (postedBalances[item.product_id]?.on_hand ?? 'оновлюється') : 'після проведення' }}</td></tr></BaseTable>
      <BaseCard variant="subtle" padding="sm" class="flex flex-wrap items-center justify-between gap-4"><span class="text-sm text-ui-secondary">Проведення оновить залишки та не може бути скасоване цією формою.</span><BaseButton variant="primary" class="min-h-11 w-full sm:w-auto" v-if="canPostInventory" :disabled="isPosted || posting || creating || adding || addLocked || !receipt.items.length" @click="postConfirmationOpen = true"><CheckIcon class="h-5 w-5 shrink-0" aria-hidden="true" />Прийняти товари</BaseButton></BaseCard>
    </template>
    <ConfirmActionModal v-model="postConfirmationOpen" title="Провести приймання?" message="Залишки буде збільшено, а документ стане доступним лише для перегляду." confirm-label="Провести" :pending="posting" @confirm="postReceipt" />
  </div>
</template>
