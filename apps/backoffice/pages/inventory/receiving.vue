<script setup lang="ts">
import { ArrowDownTrayIcon, PlusIcon, CheckIcon, DocumentPlusIcon, InformationCircleIcon, CubeIcon, CurrencyDollarIcon, CalendarDaysIcon, TagIcon, ChatBubbleLeftEllipsisIcon, DocumentTextIcon, ChevronRightIcon } from '@heroicons/vue/24/outline'
import type { InventoryProduct, InventoryReceipt as Receipt, InventoryReceiptItem, InventoryReceiptChange } from '~/types/inventory'
import { createInventoryIdempotencyKey, createReceiptItemRequest, inventoryApiErrorMessage, isDefiniteInventoryRejection, receiptItemStorageKey, restoreReceiptItemRequest } from '~/utils/inventory'

import { receiptEditStorageKey, restoreReceiptEdit, type PendingReceiptEdit } from '~/utils/inventoryReceiptEdits'

interface Requirement { orderItemId: number, quantity: number }

provide('compactFieldHints', true)

const auth = useAuthStore()
const canPostInventory = computed(() => Boolean(auth.user?.is_superuser || (auth.user?.can_post_inventory && auth.user?.master_id == null && auth.user?.role !== 'master')))

const api = useBackofficeApi()
const route = useRoute()
const router = useRouter()
const toast = useBaseToastNotification()
const receipt = ref<Receipt | null>(null)
const loadingReceipt = ref(false)
const creating = ref(false)
const adding = ref(false)
const editOpen = ref(false)
const editItem = ref<InventoryReceiptItem | null>(null)
const editBaseRevision = ref<number | null>(null)
const editing = ref(false)
const editError = ref('')
const pendingEdit = shallowRef<PendingReceiptEdit | null>(null)
const editStorageError = ref(false)
const editLocked = computed(() => editing.value || Boolean(pendingEdit.value) || editStorageError.value)
const receiptChanges = ref<InventoryReceiptChange[]>([])
const historyPage = ref(1)
const historyTotal = ref(0)
const historyBusy = ref(false)
const historyError = ref('')
const pendingAdd = shallowRef<ReturnType<typeof createReceiptItemRequest> | null>(null)
const addOutcomeUncertain = ref(false)
const pendingStorageError = ref(false)
const addLocked = computed(() => adding.value || Boolean(pendingAdd.value) || pendingStorageError.value || editOpen.value || editLocked.value)
const posting = ref(false)
const errorMessage = ref('')
const postConfirmationOpen = ref(false)
const itemReviewOpen = ref(false)
const reason = ref('Поставка товару')
const comment = ref('')
const barcode = ref(typeof route.query.barcode === 'string' ? route.query.barcode : '')
const search = ref('')
const searchPending = ref(false)
const searchResults = ref<InventoryProduct[]>([])
const selectedProduct = ref<InventoryProduct | null>(null)
const quantity = ref<number | null>(1)
const unitCost = ref<number | null>(null)
const quantityFields = ref<HTMLElement | null>(null)
const batchNumber = ref('')
const expirationDate = ref('')
const allocationQuantities = ref<Record<number, number | null>>({})
const createOutcomeUncertain = ref(false)
const createKey = ref('')
const pendingCreate = ref<{ key: string, payload: { reason: string, comment: string | null } } | null>(null)
const createStorageKey = `backoffice:inventory:receipt-create:${auth.user?.id}`
const postKey = ref('')
const postedBalances = ref<Record<number, InventoryProduct>>({})
const pickerDirty = ref(false)
const pickerBusy = ref(false)
const pickerSavedRevision = ref(0)
let receiptLoadRequest = 0
let balanceLoadRequest = 0
let productLookupRequest = 0
let productSearchRequest = 0
let editRestoreGeneration = 0

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
const itemFormSnapshot = () => JSON.stringify([
  selectedProduct.value?.id || null, barcode.value, search.value, quantity.value,
  unitCost.value, batchNumber.value, expirationDate.value, allocationQuantities.value,
])
const savedItemForm = ref(JSON.stringify([null, '', '', 1, null, '', '', {}]))
const hasUnsavedChanges = computed(() => editOpen.value || editLocked.value || (!isPosted.value && (
  Boolean(pendingAdd.value || pendingStorageError.value || pickerDirty.value)
  || itemFormSnapshot() !== savedItemForm.value
  || (!receipt.value && (reason.value !== 'Поставка товару' || Boolean(comment.value)))
)))

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
  if (!id || adding.value || posting.value || editing.value) return
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
  else if (selectedProduct.value?.id !== product.id) {
    quantity.value = 1
    const cost = product.purchase_unit_cost
    const parsed = cost === null || cost === undefined || String(cost).trim() === '' ? NaN : Number(cost)
    unitCost.value = Number.isFinite(parsed) && parsed >= 0 ? parsed : null
  }
  selectedProduct.value = product
  searchResults.value = []
  search.value = product.name
  if (typeof window !== 'undefined' && quantityFields.value) void nextTick(() => {
    quantityFields.value?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  })
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
  if (adding.value || posting.value || loadingReceipt.value || pendingStorageError.value || editOpen.value || editLocked.value) return
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
    itemReviewOpen.value = false
    toast.success('Позицію додано. Повторне додавання такого самого товару збільшить рядок.')
    quantity.value = 1
    allocationQuantities.value = {}
    savedItemForm.value = itemFormSnapshot()
    pickerSavedRevision.value++
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
  if (!canPostInventory.value || !activeReceipt || isPosted.value || posting.value || adding.value || pendingAdd.value || pendingStorageError.value || editOpen.value || editLocked.value) return
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
    toast.success(next.revision ? 'Приймання проведено. Залишки та собівартість товарів оновлено.' : 'Приймання проведено.')
  }
  catch (cause) {
    if (request === receiptLoadRequest && receiptIdFromRoute.value === activeReceipt.id) errorMessage.value = inventoryApiErrorMessage(cause, 'Не вдалося провести приймання.')
  }
  finally { posting.value = false }
}

const effectiveQuantity = (item: InventoryReceiptItem) => item.effective_quantity ?? item.quantity
const effectiveCost = (item: InventoryReceiptItem) => item.effective_purchase_unit_cost ?? item.purchase_unit_cost
const effectiveValue = (item: InventoryReceiptItem) => item.effective_purchase_value ?? (effectiveQuantity(item) * Number(effectiveCost(item))).toFixed(2)
const canEditReceipt = computed(() => canPostInventory.value && Number.isInteger(receipt.value?.revision) && !loadingReceipt.value)
const loadHistory = async (page = 1) => {
  const current = receipt.value
  if (!current?.revision || historyBusy.value) return
  historyBusy.value = true
  historyError.value = ''
  try {
    const result = await api.getInventoryReceiptChanges(current.id, page)
    if (receiptIdFromRoute.value !== current.id) return
    receiptChanges.value = result.items
    historyTotal.value = result.total
    historyPage.value = page
  }
  catch (cause) { historyError.value = inventoryApiErrorMessage(cause, 'Не вдалося завантажити історію.') }
  finally { historyBusy.value = false }
}
const openEdit = (item: InventoryReceiptItem) => {
  if (!canEditReceipt.value || adding.value || posting.value || editLocked.value || pendingAdd.value || pendingStorageError.value) return
  editError.value = ''
  editItem.value = JSON.parse(JSON.stringify(item))
  editBaseRevision.value = receipt.value?.revision ?? null
  editOpen.value = true
}
const restoreEdit = (id: number) => {
  if (typeof window === 'undefined' || !auth.user?.id) return
  try {
    pendingEdit.value = restoreReceiptEdit(sessionStorage.getItem(receiptEditStorageKey(auth.user.id, id)), auth.user.id, id)
    if (pendingEdit.value) { editItem.value = pendingEdit.value.item; editOpen.value = true }
  }
  catch { editStorageError.value = true; errorMessage.value = 'Не вдалося відновити коригування. Зміни заблоковано: перевірте збережений запит перед продовженням.' }
}
const sendEdit = async () => {
  const operation = pendingEdit.value
  if (!operation || editing.value || operation.userId !== auth.user?.id || receiptIdFromRoute.value !== operation.receiptId) return
  editing.value = true
  editError.value = ''
  try {
    // A restored or failed request always replays the exact command and key.
    const next = await api.changeInventoryReceiptItem(operation.receiptId, operation.itemId, operation.kind, operation.payload, operation.key)
    sessionStorage.removeItem(receiptEditStorageKey(operation.userId, operation.receiptId))
    pendingEdit.value = null
    if (receiptIdFromRoute.value !== operation.receiptId) return
    setReceipt(next)
    editOpen.value = false
    editItem.value = null
    toast.success(operation.kind === 'remove' ? 'Позицію видалено.' : 'Зміни збережено.')
    void loadHistory()
  }
  catch (cause) {
    editError.value = inventoryApiErrorMessage(cause, 'Не вдалося зберегти зміни. Повторіть той самий запит.')
    // The change API replays committed keys before revision/status checks.
    // A 409 for this exact durable command therefore permits reload/re-edit.
    const status = (cause as { statusCode?: number, status?: number, response?: { status?: number } })
    const code = status?.response?.status ?? status?.statusCode ?? status?.status
    if (code === 409 || (firstEditAttempt && isDefiniteInventoryRejection(cause))) {
      try {
        sessionStorage.removeItem(receiptEditStorageKey(operation.userId, operation.receiptId))
        pendingEdit.value = null
        if (code === 409) {
          const next = await api.getInventoryReceipt(operation.receiptId)
          if (receiptIdFromRoute.value === operation.receiptId) setReceipt(next)
          if (next.revision !== operation.payload.expected_revision) {
            editOpen.value = false
            errorMessage.value = 'Документ змінено. Перевірте актуальні дані та повторно відкрийте редагування. ' + editError.value
          }
        }
      }
      catch { /* Keep the command locked if browser storage could not clear it. */ }
    }
  }
  finally { editing.value = false; firstEditAttempt = false }
}
let firstEditAttempt = false
const saveEdit = async (values?: { quantity: number, purchase_unit_cost: string, reason: string, allocations?: InventoryReceiptItem['allocations'] }, remove = false) => {
  const current = receipt.value
  const item = editItem.value
  if (!current?.revision || !item || !canEditReceipt.value || editLocked.value || adding.value || posting.value || pendingAdd.value || !auth.user?.id) return
  if (!remove && !values) return
  const kind = remove ? 'remove' : isPosted.value ? 'correct' : 'update'
  if (remove && isPosted.value) return
  const payload: PendingReceiptEdit['payload'] = { expected_revision: editBaseRevision.value ?? current.revision, reason: values?.reason.trim() || (remove ? 'Видалення помилкової позиції' : 'Виправлення даних приймання') }
  if (values) {
    payload.quantity = values.quantity
    payload.purchase_unit_cost = values.purchase_unit_cost
    if (kind === 'update') payload.allocations = (values.allocations ?? item.allocations).map(a => ({ ...a }))
  }
  const operation: PendingReceiptEdit = { userId: auth.user.id, receiptId: current.id, itemId: item.id, kind, key: createInventoryIdempotencyKey(), payload, item: JSON.parse(JSON.stringify(item)) }
  try { sessionStorage.setItem(receiptEditStorageKey(operation.userId, operation.receiptId), JSON.stringify(operation)) }
  catch { editError.value = 'Не вдалося зберегти безпечний повтор. Запит не надіслано.'; return }
  pendingEdit.value = operation
  firstEditAttempt = true
  await sendEdit()
}

watch([reason, comment], () => {
  if (!receipt.value && !receiptIdFromRoute.value) createKey.value = ''
})

onBeforeRouteUpdate(() => !adding.value && !posting.value && !editing.value)
const warnPendingAdd = (event: BeforeUnloadEvent) => {
  if (!addLocked.value) return
  event.preventDefault()
  event.returnValue = ''
}
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnPendingAdd))

watch(receiptIdFromRoute, async (id) => {
  const restoreRequest = ++editRestoreGeneration
  if (id && receipt.value?.id === id) return
  pickerDirty.value = false
  pickerBusy.value = false
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
  itemReviewOpen.value = false
  editOpen.value = false
  editItem.value = null
  pendingEdit.value = null
  editStorageError.value = false
  receiptChanges.value = []
  historyPage.value = 1
  historyTotal.value = 0
  postedBalances.value = {}
  // Keep the warehouse selection when creating its draft.
  if (!receipt.value || receipt.value.id !== id) selectedProduct.value = null
  ++productLookupRequest
  ++productSearchRequest
  barcode.value = ''
  search.value = ''
  searchResults.value = []
  searchPending.value = false
  if (!pendingAdd.value) {
    quantity.value = 1
    unitCost.value = null
    batchNumber.value = ''
    expirationDate.value = ''
    allocationQuantities.value = {}
    savedItemForm.value = itemFormSnapshot()
  }
  if (!id) {
    receipt.value = null
    reason.value = 'Поставка товару'
    comment.value = ''
    loadingReceipt.value = false
    return
  }
  receipt.value = null
  await loadReceipt(id)
  if (restoreRequest !== editRestoreGeneration || receiptIdFromRoute.value !== id) return
  restoreEdit(id)
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
  <div class="inventory-page space-y-3 sm:space-y-4">
    <header><div class="flex min-w-0 items-center gap-1"><h1 class="flex items-center gap-2 text-2xl font-semibold text-ui-primary sm:text-3xl"><ArrowDownTrayIcon class="h-6 w-6 shrink-0" aria-hidden="true" />Приймання товару</h1><BaseFieldHelp text="Знайдіть товар, вкажіть кількість і закупівельну вартість." label="Про сторінку" /></div></header>
    <InventorySectionNav />
    <InventoryUnsavedChangesGuard :dirty="hasUnsavedChanges" :busy="adding || creating || posting || pickerBusy || editing" :document-id="receipt?.id" guard-document-changes />
    <NuxtLink v-if="receiptIdFromRoute" to="/inventory/receiving" class="inline-flex min-h-11 items-center font-medium text-ui-accent hover:underline">← До списку приймань</NuxtLink>
    <InventoryReceiptList v-else />
    <p v-if="loadingReceipt" role="status" class="text-sm text-ui-muted">Завантаження приймання…</p>
    <div v-if="errorMessage" role="alert" class="ui-status-danger rounded-2xl p-4 text-sm">{{ errorMessage }} <BaseButton v-if="receiptIdFromRoute && !adding" variant="neutral" size="sm" :disabled="loadingReceipt || posting" @click="loadReceipt()">Повторити</BaseButton></div>
    <div v-if="pendingAdd && !adding" role="alert" class="ui-status-warning p-4 text-sm">Результат додавання невідомий або потребує звірки. Товар {{ pendingAdd.payload.product_id || pendingAdd.payload.barcode }} · {{ pendingAdd.payload.quantity }} од. Повторіть цю саму позицію перед редагуванням або новим скануванням.<BaseButton variant="neutral" size="sm" :disabled="loadingReceipt || !receipt" @click="addItem">Повторити додавання</BaseButton></div>
    <BaseCard v-if="isPosted" variant="subtle" padding="sm" class="text-sm text-ui-secondary"><BaseBadge tone="success">Проведено</BaseBadge><span class="ml-2">Приймання #{{ receipt?.id }} проведено {{ receipt?.posted_at || '' }}. Виправлення оформлюються окремим коригуванням зі збереженням історії.</span></BaseCard>
    <BaseCard v-if="!receipt && !receiptIdFromRoute && !loadingReceipt" variant="surface" padding="sm" class="space-y-3 sm:space-y-4"><h2 class="text-xl font-semibold text-ui-primary">Нове приймання</h2><BaseInput v-model="reason" :disabled="creating || !!pendingCreate" label="Причина" hint="Назва поставки, щоб знайти цю чернетку пізніше." required maxlength="255" placeholder="Наприклад, поставка від постачальника"><template #icon><DocumentTextIcon class="h-4 w-4 shrink-0" aria-hidden="true" /></template></BaseInput><BaseTextarea v-model="comment" :disabled="creating || !!pendingCreate" label="Коментар" :rows="2" hint="Необов’язково: постачальник, номер накладної або примітка." maxlength="2000"><template #icon><ChatBubbleLeftEllipsisIcon class="h-4 w-4 shrink-0" aria-hidden="true" /></template></BaseTextarea><BaseButton variant="primary" class="min-h-11 w-full sm:w-auto" :loading="creating" @click="createReceipt"><DocumentPlusIcon class="h-5 w-5 shrink-0" aria-hidden="true" />{{ pendingCreate ? 'Повторити створення без дублювання' : 'Створити чернетку' }}</BaseButton></BaseCard>
    <template v-if="receipt">
      <p v-if="!isPosted" class="ui-status-warning rounded-xl p-3 text-sm" role="status">Чернетка #{{ receipt.id }}: товари ще не оприбутковано. <span v-if="!canPostInventory">Передайте адміністратору посилання на цю чернетку — він має її провести.</span></p>
      <BaseCard variant="surface" padding="sm" class="space-y-3 sm:space-y-4" :class="isPosted ? 'opacity-70' : ''"><div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="flex items-center gap-2 text-xl font-semibold text-ui-primary"><PlusIcon class="h-5 w-5 shrink-0 text-ui-muted" aria-hidden="true" />Додати позицію</h2><p class="text-sm text-ui-secondary">Приймання #{{ receipt.id }} · {{ receipt.reason }}</p></div><BaseBadge :tone="isPosted ? 'success' : 'warning'">{{ isPosted ? 'Проведено' : 'Чернетка' }}</BaseBadge></div>
        <fieldset :disabled="isPosted || addLocked" class="space-y-3 sm:space-y-4">
        <InventoryProductPicker :key="receipt.id" :saved-revision="pickerSavedRevision" @dirty-change="pickerDirty = $event" @busy-change="pickerBusy = $event" :show-selected="false" :initial-barcode="typeof route.query.barcode === 'string' ? route.query.barcode : ''" :disabled="isPosted || addLocked || posting" @select="selectProduct" @clear="clearSelectedProduct" />
        <div v-if="selectedProduct" class="rounded-xl bg-ui-subtle p-3"><p class="mb-2 flex items-center gap-2 font-semibold text-ui-accent"><CheckIcon class="h-5 w-5" aria-hidden="true" />Вибраний товар</p><InventoryProductCard :product="selectedProduct" :framed="false" /></div>
        <div ref="quantityFields" class="scroll-mt-24 inventory-receipt-quantity-fields grid grid-cols-2 gap-3"><BaseInput v-model.number="quantity" type="number" min="1" step="1" label="Кількість" label-class="base-field__label min-h-10 font-medium sm:min-h-5" inputmode="numeric" hint="Скільки одиниць надійшло." :disabled="isPosted" required><template #icon><CubeIcon class="h-4 w-4 shrink-0" aria-hidden="true" /></template></BaseInput><BaseInput v-model.number="unitCost" type="number" min="0" step="0.01" label="Закупівля, грн/од." label-class="base-field__label min-h-10 font-medium sm:min-h-5" aria-label="Закупівля, грн/од. (Закупівельна вартість за одиницю, грн)" inputmode="decimal" hint="Собівартість із картки товару, якщо є. Можна змінити для цієї поставки." :disabled="isPosted" required><template #icon><CurrencyDollarIcon class="h-4 w-4 shrink-0" aria-hidden="true" /></template></BaseInput></div><details class="group rounded-xl border border-ui p-3"><summary class="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden"><ChevronRightIcon class="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" aria-hidden="true" /><CalendarDaysIcon class="h-4 w-4 shrink-0 text-ui-muted" aria-hidden="true" />Партія та термін придатності (необов’язково)</summary><div class="mt-3 grid gap-4 md:grid-cols-2"><BaseInput v-model="batchNumber" label="Партія" hint="Номер з упаковки або накладної." :disabled="isPosted"><template #icon><TagIcon class="h-4 w-4 shrink-0" aria-hidden="true" /></template></BaseInput><BaseInput v-model="expirationDate" type="date" label="Термін придатності" hint="Заповніть, якщо вказано на упаковці." :disabled="isPosted"><template #icon><CalendarDaysIcon class="h-4 w-4 shrink-0" aria-hidden="true" /></template></BaseInput></div></details>
        <fieldset v-if="requirements.length" :disabled="isPosted" class="space-y-2 rounded-xl border border-ui p-4"><legend class="px-1 text-sm font-medium text-ui-primary">Розподіл на замовлені позиції (необов'язково)</legend><div v-for="requirement in requirements" :key="requirement.orderItemId" class="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-2 sm:grid-cols-[1fr_10rem]"><span class="text-sm text-ui-secondary">Позиція замовлення #{{ requirement.orderItemId }} · залишок {{ requirement.quantity }}</span><BaseInput v-model.number="allocationQuantities[requirement.orderItemId]" type="number" min="0" :max="requirement.quantity" step="1" aria-label="Кількість розподілу"><template #icon><CubeIcon class="h-4 w-4 shrink-0" aria-hidden="true" /></template></BaseInput></div><p class="text-xs text-ui-muted">Розподілено: {{ allocationTotal }} з {{ quantity || 0 }}</p></fieldset>
        </fieldset>
        <BaseButton variant="primary" class="min-h-11 w-full sm:w-auto" :loading="adding" :disabled="isPosted || posting || addLocked || !selectedProduct" @click="itemReviewOpen = true"><PlusIcon class="h-5 w-5 shrink-0" aria-hidden="true" />Перевірити та додати</BaseButton>
      </BaseCard>
      <BaseCard v-if="isPosted" variant="subtle" padding="sm"><p class="font-medium text-ui-primary">Підсумок проведення</p><p class="mt-1 text-sm text-ui-secondary">Оприбутковано {{ receipt.items.reduce((sum, item) => sum + effectiveQuantity(item), 0) }} од. Виконано розподілів на замовлення: {{ receipt.items.reduce((sum, item) => sum + item.allocations.length, 0) }}.</p></BaseCard>
      <div class="space-y-2"><h2 class="text-lg font-semibold text-ui-primary">Позиції · {{ receipt.items.length }}</h2><p class="text-sm text-ui-secondary">Загальна закупівля: <strong class="text-ui-primary">{{ receipt.effective_purchase_value ?? receipt.items.reduce((sum, item) => sum + Number(effectiveValue(item)), 0).toFixed(2) }} грн</strong></p><p v-if="!isPosted" class="flex items-start gap-2 text-xs text-ui-muted"><InformationCircleIcon class="h-4 w-4 shrink-0" aria-hidden="true" />Перевірте дані перед додаванням: кількість і собівартість можна виправити кнопкою «Редагувати».</p></div>
      <div class="grid gap-2 md:hidden" aria-label="Позиції приймання">
        <BaseCard v-for="item in receipt.items" :key="item.id" padding="sm">
          <InventoryProductCard v-if="postedBalances[item.product_id]" :product="postedBalances[item.product_id]" :framed="false" :show-stock="false" />
          <p v-else>Товар #{{ item.product_id }} · {{ item.barcode || 'Без штрихкоду' }}</p>
          <div class="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-ui-subtle p-3"><div><p class="text-xs text-ui-muted">Кількість</p><p class="font-semibold">{{ effectiveQuantity(item) }} од.</p></div><div><p class="text-xs text-ui-muted">Закупівля за од.</p><p class="font-semibold">{{ effectiveCost(item) }} грн</p></div><div class="col-span-2 flex justify-between gap-2 border-t border-ui-border pt-2"><span class="text-sm text-ui-secondary">Сума рядка</span><strong>{{ effectiveValue(item) }} грн</strong></div></div>
          <p v-if="item.last_correction_id" class="mt-2 text-xs text-ui-accent">Скориговано · оригінал: {{ item.quantity }} од. × {{ item.purchase_unit_cost }} грн</p>
          <BaseButton v-if="canEditReceipt" variant="secondary" class="mt-3 min-h-11 w-full" :disabled="addLocked || posting" @click="openEdit(item)">{{ isPosted ? 'Коригувати' : 'Редагувати' }}</BaseButton>
          <p class="text-sm text-ui-secondary">{{ item.batch_number || '' }} {{ item.expiration_date || '' }}</p>
        </BaseCard>
      </div>
      <BaseTable wrapper-class="hidden md:block" caption="Позиції приймання" min-width="64rem" :empty="!receipt.items.length" empty-title="Позицій ще немає">
        <template #head><tr><th class="w-[36%]">Товар</th><th>Кількість</th><th>Закупівля / од.</th><th>Сума</th><th>Партія / термін</th><th>Розподіли</th><th>Залишок після</th><th>Дії</th></tr></template>
        <tr v-for="item in receipt.items" :key="item.id">
          <td class="min-w-[20rem] max-w-md whitespace-normal">
            <InventoryProductCard v-if="postedBalances[item.product_id]" :product="postedBalances[item.product_id]" :framed="false" :show-stock="false" />
            <div v-else class="flex items-center gap-3"><CubeIcon class="h-12 w-12 shrink-0 text-ui-muted" aria-hidden="true" /><div><p class="font-medium">Товар #{{ item.product_id }}</p><p class="text-xs text-ui-muted">{{ item.barcode || 'Без штрихкоду' }}</p><p class="text-xs text-ui-muted">Назва та фото недоступні</p></div></div>
          </td>
          <td class="font-semibold whitespace-nowrap">{{ effectiveQuantity(item) }} од.<p v-if="item.last_correction_id" class="text-xs font-normal text-ui-accent">Скориговано</p></td>
          <td class="whitespace-nowrap">{{ effectiveCost(item) }} грн</td>
          <td class="font-semibold whitespace-nowrap">{{ effectiveValue(item) }} грн</td>
          <td>{{ item.batch_number || '—' }}<p class="text-xs text-ui-muted">{{ item.expiration_date || '' }}</p></td>
          <td>{{ item.allocations.length ? item.allocations.map(allocation => `#${allocation.order_item_id}: ${allocation.quantity}`).join(', ') : '—' }}</td>
          <td>{{ isPosted ? (postedBalances[item.product_id]?.on_hand ?? 'оновлюється') : 'після проведення' }}</td>
          <td><BaseButton v-if="canEditReceipt" variant="secondary" class="min-h-11" :disabled="addLocked || posting" @click="openEdit(item)">{{ isPosted ? 'Коригувати' : 'Редагувати' }}</BaseButton></td>
        </tr>
      </BaseTable>
      <BaseCard variant="subtle" padding="sm" class="flex flex-wrap items-center justify-between gap-4"><span class="text-sm text-ui-secondary">Проведення оновить залишки та не може бути скасоване цією формою.</span><BaseButton variant="primary" class="min-h-11 w-full sm:w-auto" v-if="canPostInventory" :disabled="isPosted || posting || creating || adding || addLocked || !receipt.items.length" @click="postConfirmationOpen = true"><CheckIcon class="h-5 w-5 shrink-0" aria-hidden="true" />Прийняти товари</BaseButton></BaseCard>
    </template>
    <div v-if="pendingEdit && !editOpen" role="alert" class="ui-status-warning rounded-xl p-3 text-sm">Є незавершений запит зміни. Нові операції з цим прийманням заблоковано до звірки.<BaseButton variant="secondary" class="mt-2 min-h-11 w-full" @click="editOpen = true">Перевірити / повторити запит</BaseButton></div>
    <InventoryReceiptItemEditModal v-model="editOpen" :item="editItem" :product="editItem ? postedBalances[editItem.product_id] : null" :posted="isPosted" :pending="editing" :locked="Boolean(pendingEdit)" :error="editError" @save="saveEdit" @remove="saveEdit(undefined, true)" @retry="sendEdit" />
    <section v-if="receipt?.revision" class="space-y-3 rounded-xl bg-ui-subtle p-4" aria-label="Історія змін приймання">
      <div class="flex flex-wrap items-center justify-between gap-2"><h2 class="font-semibold">Історія змін · версія {{ receipt.revision }}</h2><BaseButton variant="secondary" class="min-h-11" :loading="historyBusy" @click="loadHistory()">Оновити історію</BaseButton></div>
      <p v-if="historyError" role="alert" class="text-sm text-ui-danger">{{ historyError }}</p>
      <p v-if="!receiptChanges.length" class="text-sm text-ui-secondary">Натисніть «Оновити історію», щоб переглянути зміни.</p>
      <article v-for="change in receiptChanges" :key="change.id" class="rounded-xl bg-ui-surface p-3 text-sm"><p class="font-semibold">{{ change.operation === 'posted_correction' ? 'Коригування' : change.operation === 'draft_delete' ? 'Видалення' : 'Редагування' }} · позиція #{{ change.target_item_id }}</p><p>{{ change.reason }}</p><p class="text-ui-secondary">{{ change.created_at }} · користувач #{{ change.actor_id }} · залишок {{ change.on_hand_delta > 0 ? '+' : '' }}{{ change.on_hand_delta }} од. · сума {{ change.purchase_value_delta }} грн</p></article>
      <div v-if="historyTotal > 20" class="flex items-center justify-between"><BaseButton variant="secondary" :disabled="historyBusy || historyPage <= 1" @click="loadHistory(historyPage - 1)">Назад</BaseButton><span>{{ historyPage }} / {{ Math.ceil(historyTotal / 20) }}</span><BaseButton variant="secondary" :disabled="historyBusy || historyPage * 20 >= historyTotal" @click="loadHistory(historyPage + 1)">Далі</BaseButton></div>
    </section>
    <BaseModal v-model="itemReviewOpen" style="--modal-bg: var(--bo-surface)" aria-label="Перевірка позиції" :close-on-backdrop="!adding" :close-on-escape="!adding" max-width-class="max-w-lg">
      <template #head><h2 class="text-lg font-semibold">Перевірте перед додаванням</h2></template>
      <template #body>
        <form class="space-y-4" @submit.prevent="addItem">
          <p class="break-words font-semibold">{{ selectedProduct?.name }}</p>
          <p class="text-sm text-ui-secondary">Можна виправити кількість і закупівлю зараз. Збережені рядки поки не редагуються.</p>
          <BaseInput v-model.number="quantity" type="number" min="1" step="1" inputmode="numeric" label="Кількість, од." required :disabled="adding || addLocked" />
          <BaseInput v-model.number="unitCost" type="number" min="0" step="0.01" inputmode="decimal" label="Закупівля за одиницю, грн" required :disabled="adding || addLocked" />
          <p class="text-lg font-semibold">Разом: {{ ((quantity || 0) * (unitCost || 0)).toFixed(2) }} грн</p>
          <p v-if="errorMessage" role="alert" class="text-sm text-ui-danger">{{ errorMessage }}</p>
          <BaseButton type="submit" variant="primary" class="min-h-11 w-full" :loading="adding" :disabled="addLocked || posting">Додати до приймання</BaseButton>
          <BaseButton type="button" variant="neutral" class="min-h-11 w-full" :disabled="adding" @click="itemReviewOpen = false">Повернутися</BaseButton>
        </form>
      </template>
    </BaseModal>
    <ConfirmActionModal v-model="postConfirmationOpen" title="Провести приймання?" message="Залишки буде збільшено, а документ стане доступним лише для перегляду." confirm-label="Провести" :pending="posting" @confirm="postReceipt" />
  </div>
</template>
