<script setup lang="ts">
import { productDisplayImage } from '~/utils/productImages'
import { ArrowLeftIcon, ArrowPathIcon, ShoppingBagIcon, UserIcon, TruckIcon, CreditCardIcon, DocumentTextIcon, Cog6ToothIcon, ArrowUturnLeftIcon, ChartBarIcon, ClipboardDocumentListIcon, PlusIcon, PhotoIcon } from '@heroicons/vue/24/outline'
import OrderQrMock from '~/components/orders/OrderQrMock.vue'
import OrderShopCarrierReturns from '~/components/orders/OrderShopCarrierReturns.vue'
import OrderShopNPReturns from '~/components/orders/OrderShopNPReturns.vue'
import OrderShipments from '~/components/orders/OrderShipments.vue'
import FiscalReportsMock from '~/components/orders/FiscalReportsMock.vue'
import OrderReturnsMock from '~/components/orders/OrderReturnsMock.vue'
import OrderEttnMock from '~/components/orders/OrderEttnMock.vue'
import OrderFiscalMock from '~/components/orders/OrderFiscalMock.vue'
import OrderProjections from '~/components/orders/OrderProjections.vue'
import OrderShopOperations from '~/components/orders/OrderShopOperations.vue'
import OrderShopPayments from '~/components/orders/OrderShopPayments.vue'
import OrderShopPaymentResolution from '~/components/orders/OrderShopPaymentResolution.vue'
import OrderShopCheckboxFiscal from '~/components/orders/OrderShopCheckboxFiscal.vue'
import OrderShopCheckboxReturns from '~/components/orders/OrderShopCheckboxReturns.vue'
import ShopCheckboxReports from '~/components/orders/ShopCheckboxReports.vue'
import OrderShopFiscal from '~/components/orders/OrderShopFiscal.vue'
import OrderShopReturns from '~/components/orders/OrderShopReturns.vue'
import ShopFiscalReports from '~/components/orders/ShopFiscalReports.vue'
import { isShopCarrierReturnShipment, shopFiscalUsesCanonicalPanel } from '~/utils/shopFiscal'
import { orderUsesNovaPoshta } from '~/utils/shipmentStatus'
import { orderAmountMinor, orderStatusOptions } from '~/utils/orderSales'
import type { OrderPaymentCommand, OrderHandoverCommand, PreliminaryOrderDocument } from '~/composables/useBackofficeApi'
import { procurementStatusLabel } from '~/utils/inventory'

const route = useRoute()
const api = useBackofficeApi()
const assetUrl = useAssetUrl()
const productImages = ref<Record<number, string>>({})
const failedProductImages = ref<number[]>([])
const auth = useAuthStore()
const { isAdmin, isBarber } = useBackofficeAccess()
const toast = useBaseToastNotification()
const { apiErrorMessage, formatDateTime, formatMoney } = useBookingFormatting()

const legacyShipmentOrder = computed(() => order.value ? { ...order.value, shipments: (order.value.shipments || []).filter(shipment => !isShopCarrierReturnShipment(shipment)) } : null)
const usesShopFiscal = computed(() => !!order.value && shopFiscalUsesCanonicalPanel(order.value))
const shopFiscalProfile = ref<'checkbox' | 'local_mock' | 'unavailable' | null>(null)
const fiscalProfileError = ref(''), fiscalProfileLoading = ref(false)
const usesCheckbox = computed(() => usesShopFiscal.value && shopFiscalProfile.value === 'checkbox')
const fiscalProfileReady = computed(() => !usesShopFiscal.value || (shopFiscalProfile.value !== null && !fiscalProfileLoading.value && !fiscalProfileError.value))
const isPosSale = computed(() => order.value?.channel === 'backoffice_pos')
const qrOwnsSale = ref(false)
const ettnOwner = ref<'sc_manual' | 'checkbox_ettn' | null>(null)
watch(() => route.params.id, () => { ettnOwner.value = null; qrOwnsSale.value = false })
const orderId = computed(() => route.params.id as string)
let orderContext = 0
watch([orderId, () => auth.user?.id], () => { orderContext++ }, { flush: 'sync' })
onBeforeUnmount(() => { orderContext++ })

const {
  data: order,
  pending,
  error,
} = await useAsyncData(
  () => `backoffice-order-${orderId.value}`,
  () => api.getOrder(orderId.value),
  { watch: [orderId] },
)

const {
  data: fulfillment,
  error: fulfillmentError,
} = await useAsyncData(
  () => `backoffice-order-fulfillment-${orderId.value}`,
  () => api.getOrderFulfillment(orderId.value),
  { watch: [orderId] },
)

const statusDraft = ref('')
const statusPending = ref(false)
const statusError = ref('')

const statusLocked = computed(() => !!order.value?.channel && ['cancelled', 'completed'].includes(order.value.status))
const statusOptions = computed(() => orderStatusOptions(!!order.value && !order.value.channel))

const statusLabels = { pending: 'Очікує', confirmed: 'Підтверджено', paid: 'Оплачено', completed: 'Завершено', cancelled: 'Скасовано' } as Record<string, string>

const statusBadgeClass = (status?: string | null) => {
  if (status === 'completed') return 'bg-emerald-50 text-emerald-700'
  if (status === 'paid') return 'bg-cyan-50 text-cyan-700'
  if (status === 'confirmed') return 'bg-blue-50 text-blue-700'
  if (status === 'cancelled') return 'bg-rose-50 text-rose-700'
  return 'bg-amber-50 text-amber-700'
}

const displayValue = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

const snapshotMoney = (value?: string | number | null) =>
  value === null || value === undefined ? 'Недоступно' : formatMoney(value)

const snapshotValue = (value?: string | number | null) =>
  value === null || value === undefined || value === '' ? 'Недоступно' : String(value)

const fullCustomerName = computed(() => {
  if (!order.value) return '—'
  const fromParts = [order.value.first_name, order.value.last_name].filter(Boolean).join(' ')
  return fromParts || order.value.customer_name || '—'
})

const shippingRows = computed(() => {
  const item = order.value
  if (!item) return []
  return [
    { label: 'Компанія', value: item.shipping_company },
    { label: 'Метод', value: item.shipping_method },
    { label: 'Область', value: item.shipping_area },
    { label: 'Місто', value: item.shipping_city },
    { label: 'Відділення', value: item.shipping_warehouse_number },
    { label: 'Вулиця', value: item.shipping_street },
    { label: 'Будинок', value: item.building_number },
    { label: 'Квартира', value: item.shipping_apartment },
    { label: 'Адреса доставки', value: item.delivery_address },
    { label: 'ТТН', value: item.tracking_number },
    { label: 'Settlement ref', value: item.shipping_settlement_ref },
    { label: 'City ref', value: item.shipping_city_ref },
    { label: 'Warehouse ref', value: item.shipping_warehouse_ref },
    { label: 'Street ref', value: item.shipping_street_ref },
  ]
})

const visibleShippingRows = computed(() => shippingRows.value.slice(0, 10).filter(row => row.value !== null && row.value !== undefined && row.value !== ''))
const technicalShippingRows = computed(() => shippingRows.value.slice(10).filter(row => row.value))

const syncRows = computed(() => {
  const item = order.value
  if (!item) return []
  return [
    { label: 'Метод оплати', value: item.payment_method },
    { label: 'External ID', value: item.external_id },
    { label: 'Sync status', value: item.external_sync_status },
    { label: 'Sync error', value: item.external_sync_error },
  ]
})

const shippingPayloadEntries = computed(() => {
  const payload = order.value?.shipping_payload_json
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return []
  return Object.entries(payload)
})

const orderItems = computed(() => fulfillment.value?.items || order.value?.items || [])

// Optional catalog photos must not delay the order or its actions.
watch([orderId, () => auth.user?.id, () => !isBarber.value || isPosSale.value, () => orderItems.value.map(item => item.product_id).join(',')], async (_value, _previous, onCleanup) => {
  let current = true
  onCleanup(() => { current = false })
  productImages.value = {}; failedProductImages.value = []
  if (!import.meta.client || (isBarber.value && !isPosSale.value)) return
  const ids = [...new Set(orderItems.value.map(item => item.product_id))]
  for (let index = 0; index < ids.length && current; index += 4) {
    await Promise.all(ids.slice(index, index + 4).map(async id => {
      try {
        const product = await api.getProduct(id)
        if (current && productDisplayImage(product)) productImages.value[id] = productDisplayImage(product)
      }
      catch { /* Catalog failures use the photo placeholder. */ }
    }))
  }
}, { immediate: true })

const hasOutstandingProcurement = computed(() => orderItems.value.some(item =>
  item.quantity_to_order > item.quantity_received_for_order,
) || false)

watch(
  () => order.value?.status,
  value => {
    statusDraft.value = value || ''
  },
  { immediate: true },
)

const documentPrintPending = ref(false)
const preliminaryCommand = useOrderSalesCommand<{ expected_revision: number }>('preliminary-document', orderId)
const documentPending = computed(() => documentPrintPending.value || preliminaryCommand.busy.value)
const documentError = ref('')
const pendingDocumentWindows = new Set<Window>()
const closePendingDocuments = () => {
  pendingDocumentWindows.forEach(preview => preview.close())
  pendingDocumentWindows.clear()
}
watch([orderId, () => auth.user?.id], () => {
  closePendingDocuments(); documentPrintPending.value = false; documentError.value = ''
  statusPending.value = false; statusError.value = ''
}, { flush: 'sync' })
onBeforeUnmount(closePendingDocuments)
const createDocument = async () => {
  if (!order.value || documentPending.value || !order.value.revision) return
  const generation = orderContext, id = order.value.id
  documentError.value = ''
  await preliminaryCommand.execute({ expected_revision: order.value.revision },
    (body, key) => api.createOrderPreliminaryDocument(id, body.expected_revision, key),
    async () => { if (generation !== orderContext) return; preliminaryCommand.clear(); await reloadSales() })
  if (generation !== orderContext) return
  documentError.value = preliminaryCommand.error.value
  if (!preliminaryCommand.intent.value && preliminaryCommand.error.value) await reloadSales()
}
const openDocument = async (document: PreliminaryOrderDocument) => {
  if (!order.value || documentPending.value) return
  const generation = orderContext, id = order.value.id
  const preview = window.open('about:blank', '_blank')
  if (!preview) { documentError.value = 'Дозвольте відкриття вікна документа.'; return }
  preview.opener = null
  pendingDocumentWindows.add(preview)
  documentPrintPending.value = true
  documentError.value = ''
  try {
    const html = await api.getOrderPreliminaryDocumentHtml(id, document.id)
    if (generation !== orderContext) { preview.close(); return }
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
    preview.location.replace(url)
    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  }
  catch (err: unknown) { preview.close(); if (generation === orderContext) documentError.value = apiErrorMessage(err, 'Не вдалося відкрити документ.') }
  finally { pendingDocumentWindows.delete(preview); if (generation === orderContext) documentPrintPending.value = false }
}

const paymentMethod = ref<'cash' | 'card'>('cash')
const paymentEvidence = ref('')
const handoverEvidence = ref('')
const paymentCommand = useOrderSalesCommand<OrderPaymentCommand>('payment', orderId)
const handoverCommand = useOrderSalesCommand<OrderHandoverCommand>('handover', orderId)
const commandBusy = computed(() => paymentCommand.busy.value || handoverCommand.busy.value)
const fiscalRefresh = ref(0)
const profileApi = useApi()
let fiscalProfileSequence = 0, fiscalProfileActive = true, fiscalProfileScope = ''
const loadFiscalProfile = async () => {
  const sequence = ++fiscalProfileSequence, id = orderId.value, scope = JSON.stringify([id, auth.user])
  if (scope !== fiscalProfileScope) { shopFiscalProfile.value = null; fiscalProfileScope = scope }
  fiscalProfileError.value = ''; fiscalProfileLoading.value = false
  if (!import.meta.client || !auth.user?.id || !usesShopFiscal.value) return
  fiscalProfileLoading.value = true
  try {
    const value = await profileApi<{ order_id: number, fiscal_profile?: string }>(`/backoffice/shop-checkbox/orders/${id}/profile`, { retry: 0 })
    if (!fiscalProfileActive || sequence !== fiscalProfileSequence || orderId.value !== id) return
    if (value.order_id !== Number(id) || !['checkbox', 'local_mock', 'unavailable'].includes(value.fiscal_profile || '')) throw new Error('Invalid fiscal profile')
    shopFiscalProfile.value = value.fiscal_profile as 'checkbox' | 'local_mock' | 'unavailable'
  } catch { if (fiscalProfileActive && sequence === fiscalProfileSequence) fiscalProfileError.value = 'Не вдалося перевірити серверний фіскальний профіль. Нові фіскальні дії заблоковано; оновіть профіль.' }
  finally { if (fiscalProfileActive && sequence === fiscalProfileSequence) fiscalProfileLoading.value = false }
}
watch([orderId, () => JSON.stringify(auth.user), () => order.value?.revision, fiscalRefresh], loadFiscalProfile, { immediate: true, flush: 'sync' })
onBeforeUnmount(() => { fiscalProfileActive = false; fiscalProfileSequence++ })
watch([orderId, () => auth.user?.id], () => {
  paymentEvidence.value = ''; handoverEvidence.value = ''
}, { flush: 'sync' })
let salesRead = 0
const reloadSales = async () => {
  const generation = orderContext, id = orderId.value, request = ++salesRead
  try {
    const [nextOrder, nextFulfillment] = await Promise.all([api.getOrder(id), api.getOrderFulfillment(id)])
    if (generation !== orderContext || request !== salesRead || id !== orderId.value || String(nextOrder.id) !== id) return
    order.value = nextOrder; fulfillment.value = nextFulfillment; fiscalRefresh.value++
  }
  catch (err: unknown) {
    if (generation === orderContext && request === salesRead) toast.error(apiErrorMessage(err, 'Не вдалося оновити замовлення. Повторіть читання.'))
  }
}
const recordPayment = async () => {
  if (qrOwnsSale.value || !order.value?.simulation || (!order.value.sales_actions?.can_record_payment && !paymentCommand.intent.value) || commandBusy.value) return
  const amount = orderAmountMinor(order.value.total_amount)
  if (!amount || (!paymentEvidence.value.trim() && !paymentCommand.intent.value)) return
  const id = order.value.id, generation = orderContext
  await paymentCommand.execute({ expected_revision: order.value.revision!, amount_minor: amount, method: paymentMethod.value, source: 'operator_confirmation', evidence: paymentEvidence.value.trim() },
    (body, key) => api.recordOrderPayment(id, body, key), async () => { if (generation !== orderContext) return; paymentCommand.clear(); paymentEvidence.value = ''; await reloadSales() })
  if (generation === orderContext && !paymentCommand.intent.value && paymentCommand.error.value) await reloadSales()
}
const handover = async () => {
  if (!order.value?.simulation || (!order.value.sales_actions?.can_handover && !handoverCommand.intent.value) || commandBusy.value) return
  if (!handoverEvidence.value.trim() && !handoverCommand.intent.value) return
  const id = order.value.id, generation = orderContext
  await handoverCommand.execute({ expected_revision: order.value.revision!, evidence: handoverEvidence.value.trim() },
    (body, key) => api.handoverOrder(id, body, key), async () => { if (generation !== orderContext) return; handoverCommand.clear(); handoverEvidence.value = ''; await reloadSales() })
  if (generation === orderContext && !handoverCommand.intent.value && handoverCommand.error.value) await reloadSales()
}

const updateStatus = async () => {
  if (statusPending.value || statusLocked.value || !order.value || !statusDraft.value || statusDraft.value === order.value.status || !statusOptions.value.some(option => option.value === statusDraft.value)) return

  const generation = orderContext, id = order.value.id, status = statusDraft.value
  statusPending.value = true
  statusError.value = ''

  try {
    const result = await api.updateOrderStatus(id, status)
    if (generation !== orderContext || result.id !== id) return
    order.value = result
    toast.success('Статус замовлення оновлено.')
    await reloadSales()
  }
  catch (err: unknown) {
    if (generation !== orderContext) return
    statusError.value = apiErrorMessage(err, 'Не вдалося оновити статус замовлення.')
    toast.error(statusError.value)
  }
  finally {
    if (generation === orderContext) statusPending.value = false
  }
}
</script>

<template>
  <div class="order-detail mx-auto max-w-7xl space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div><NuxtLink to="/orders" class="inline-flex min-h-11 items-center gap-2 text-sm text-ui-secondary"><ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />До замовлень</NuxtLink><h1 class="text-2xl font-semibold">Замовлення #{{ orderId }}</h1><p v-if="order?.created_at" class="mt-1 text-xs text-ui-secondary">{{ formatDateTime(order.created_at) }}</p></div>
      <NuxtLink v-if="isPosSale" to="/orders/pos" class="base-button base-button--neutral min-h-11 gap-2 px-4 text-sm"><PlusIcon class="h-5 w-5" aria-hidden="true" />Продати ще товар</NuxtLink>
    </header>
    <p v-if="error" role="alert" class="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{{ apiErrorMessage(error, 'Не вдалося завантажити замовлення.') }}</p>
    <div v-if="pending && (!order || String(order.id) !== orderId)" class="space-y-3"><div v-for="index in 3" :key="index" class="h-24 animate-pulse rounded-2xl bg-ui-subtle" /></div>
    <div v-else-if="order && String(order.id) === orderId" :key="orderId" class="space-y-4">
      <section v-if="!isBarber || isPosSale" aria-label="Стан замовлення" class="rounded-2xl border border-ui bg-ui-surface p-3 sm:p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2"><span class="rounded-full px-3 py-1 text-sm font-semibold" :class="statusBadgeClass(order.status)">{{ statusLabels[order.status] || order.status }}</span><span v-if="order.simulation" class="text-sm font-medium text-amber-700">Тестовий продаж · без реальних платежів</span></div>
          <div class="text-right"><p class="text-xs text-ui-secondary">Сума замовлення</p><p class="text-2xl font-semibold">{{ formatMoney(order.total_amount) }}</p></div>
        </div>
        <div v-if="!isBarber" class="mt-3 border-t border-ui pt-3"><OrderProjections :order="order" compact /></div>
      </section>
      <p v-if="statusError" role="alert" class="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{{ statusError }}</p>
      <p v-if="fulfillmentError" class="rounded-xl bg-amber-50 p-3 text-sm text-amber-800" role="status">Не вдалося оновити окремий статус виконання: {{ apiErrorMessage(fulfillmentError, 'показано дані замовлення.') }}</p>
      <div v-if="!isBarber || isPosSale" class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section class="min-w-0 rounded-2xl border border-ui bg-ui-surface p-4 sm:p-5">
          <h2 class="flex items-center gap-2 text-lg font-semibold"><ShoppingBagIcon class="h-5 w-5 text-ui-secondary" aria-hidden="true" />Позиції <span class="text-sm text-ui-secondary" aria-hidden="true">{{ orderItems.length }}</span></h2>
          <p v-if="hasOutstandingProcurement" role="status" class="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Частина товарів очікує надходження.</p>
          <div class="mt-3 divide-y divide-ui">
            <article v-for="item in orderItems" :key="item.id" class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
              <div class="flex min-w-0 items-center gap-2.5">
                <img v-if="productImages[item.product_id] && !failedProductImages.includes(item.product_id)" :src="assetUrl(productImages[item.product_id])" alt="" class="h-12 w-12 shrink-0 rounded-lg bg-white object-contain" loading="lazy" @error="failedProductImages.push(item.product_id)">
                <span v-else class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-ui-subtle text-ui-secondary" aria-hidden="true"><PhotoIcon class="h-6 w-6" /></span>
                <div class="min-w-0"><h3 class="break-words text-sm font-medium">{{ item.product_name || `Товар #${item.product_id}` }}</h3><p class="mt-1 text-xs text-ui-secondary">{{ item.quantity }} шт. × {{ snapshotMoney(item.price) }}</p></div></div>
              <p class="text-sm font-semibold">{{ snapshotMoney(item.total_price) }}</p>
            </article>
          </div>
          <p v-if="!orderItems.length" class="py-3 text-sm text-ui-secondary">Товари відсутні.</p>
          <div v-if="Number(order.discount_amount) > 0 || order.promo_code" class="mt-2 flex flex-wrap justify-between gap-2 border-t border-ui pt-3 text-sm text-ui-secondary"><span>Знижка: {{ snapshotMoney(order.discount_amount) }}</span><span v-if="order.promo_code">Промокод: {{ order.promo_code }}</span></div>
          <details v-if="!isBarber" class="mt-3 border-t border-ui pt-2"><summary class="cursor-pointer py-2 text-sm font-medium"><ClipboardDocumentListIcon class="mr-1 inline h-4 w-4" aria-hidden="true" />Склад, ціни та знижки</summary>
          <BaseTable
            caption="Позиції замовлення"
            wrapper-class="mt-4 rounded-2xl"
            min-width="1240px"
          >
            <template #head>
                <tr>
                  <th>Товар</th>
                  <th>SKU</th>
                  <th>Замовлено</th>
                  <th>Зі складу</th>
                  <th>Під закупівлю</th>
                  <th>Отримано</th>
                  <th>Статус закупівлі</th>
                  <th>Базова ціна</th>
                  <th>Фінальна ціна</th>
                  <th>Знижка snapshot</th>
                  <th>Promotion snapshot</th>
                  <th>Сума snapshot</th>
                </tr>
            </template>
                <tr v-for="item in orderItems" :key="item.id">
                  <td>
                    <p class="font-medium text-ui-primary">{{ item.product_name || `Товар #${item.product_id}` }}</p>
                    <p class="mt-1 text-xs text-ui-muted">Product ID: {{ item.product_id }}</p>
                  </td>
                  <td class="text-ui-secondary">{{ item.product_sku || '—' }}</td>
                  <td class="text-ui-secondary">{{ item.quantity }}</td>
                  <td class="text-ui-secondary">{{ item.quantity_from_stock }}</td>
                  <td class="text-ui-secondary">{{ item.quantity_to_order }}</td>
                  <td class="text-ui-secondary">{{ item.quantity_received_for_order }}</td>
                  <td class="text-ui-secondary">{{ procurementStatusLabel(item.procurement_status) }}</td>
                  <td class="text-ui-secondary">{{ snapshotMoney(item.base_price) }}</td>
                  <td class="text-ui-secondary">{{ snapshotMoney(item.price) }}</td>
                  <td class="text-ui-secondary">{{ snapshotMoney(item.discount_amount) }}</td>
                  <td class="text-ui-secondary">
                    <p>ID: {{ snapshotValue(item.shop_promotion_id) }}</p>
                    <p class="mt-1">Назва: {{ snapshotValue(item.promotion_name) }}</p>
                    <p class="mt-1">Код: {{ snapshotValue(item.promotion_code) }}</p>
                  </td>
                  <td class="font-medium text-ui-primary">{{ snapshotMoney(item.total_price) }}</td>
                </tr>
          </BaseTable>
          </details>
        </section>
        <aside v-if="!isBarber" class="min-w-0 space-y-4">
          <section class="rounded-2xl border border-ui bg-ui-surface p-4"><h2 class="flex items-center gap-2 font-semibold"><UserIcon class="h-5 w-5 text-ui-secondary" aria-hidden="true" />Клієнт</h2><p class="mt-3 break-words font-medium">{{ fullCustomerName === '—' ? 'Без контакту' : fullCustomerName }}</p><p v-if="order.customer_phone" class="mt-1 text-sm">{{ order.customer_phone }}</p><p v-if="order.comment" class="mt-3 whitespace-pre-line break-words rounded-xl bg-ui-subtle p-3 text-sm">{{ order.comment }}</p><details v-if="order.customer_email" class="mt-2"><summary class="cursor-pointer py-2 text-sm text-ui-secondary">Email клієнта</summary><p v-if="order.customer_email" class="mt-2 break-all text-sm">{{ order.customer_email }}</p></details></section>
          <section class="rounded-2xl border border-ui bg-ui-surface p-4"><h2 class="flex items-center gap-2 font-semibold"><TruckIcon class="h-5 w-5 text-ui-secondary" aria-hidden="true" />Доставка</h2><p v-if="order.fulfillment_method === 'pickup'" class="mt-3 text-sm">Отримання у салоні</p><dl v-if="visibleShippingRows.length" class="mt-3 space-y-2 text-sm"><div v-for="row in visibleShippingRows" :key="row.label" class="grid grid-cols-[6rem_minmax(0,1fr)] gap-2"><dt class="text-ui-secondary">{{ row.label }}</dt><dd class="break-words">{{ row.value }}</dd></div></dl><p v-else-if="order.fulfillment_method !== 'pickup'" class="mt-3 text-sm text-ui-secondary">Дані доставки не вказані.</p></section>
        </aside>
      </div>
      <details v-if="!isBarber" class="order-disclosure"><summary><Cog6ToothIcon class="order-summary-icon" aria-hidden="true" />Змінити статус замовлення</summary><div class="mt-3">
      <section class="grid gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1fr_auto] lg:items-center">
        <div class="flex flex-wrap items-center gap-3">
          <span
            class="rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.15em]"
            :class="statusBadgeClass(order.status)"
          >
            {{ statusLabels[order.status] || order.status }}
          </span>
          <span class="text-sm text-slate-500">
            Разом: <strong class="font-semibold text-slate-900">{{ formatMoney(order.total_amount) }}</strong>
          </span>
          <span class="text-sm text-slate-500">
            Підсумок: <strong class="font-semibold text-slate-900">{{ snapshotMoney(order.subtotal_amount) }}</strong>
          </span>
          <span class="text-sm text-slate-500">
            Знижка: <strong class="font-semibold text-slate-900">{{ snapshotMoney(order.discount_amount) }}</strong>
          </span>
          <span v-if="order.promo_code" class="text-sm text-slate-500">
            Промокод: <strong class="font-semibold text-slate-900">{{ order.promo_code }}</strong>
          </span>
        </div>
        <form v-if="!statusLocked" class="grid gap-3 sm:grid-cols-[minmax(12rem,16rem)_auto]" @submit.prevent="updateStatus">
          <BaseSelect
            native
            aria-label="Новий статус замовлення"
            v-model="statusDraft"
            class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
            :disabled="statusPending || statusLocked"
          >
            <option v-for="option in statusOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </BaseSelect>
          <BaseButton
            type="submit"
            :loading="statusPending"
            :disabled="statusLocked || statusDraft === order.status || !statusOptions.some(option => option.value === statusDraft)"
            class="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            <ArrowPathIcon class="h-4 w-4" aria-hidden="true" />
            Оновити статус
          </BaseButton>
        </form>
        <p v-else class="text-sm text-slate-500">Замовлення закрите. Подальші операції потребують окремого дозволеного сценарію.</p>
      </section>


      </div></details>
      <div class="space-y-4">
      <section v-if="usesShopFiscal && !fiscalProfileReady" class="rounded-xl border border-amber-300 p-4" aria-label="Перевірка фіскального профілю"><p role="status">{{ fiscalProfileError || 'Перевіряємо серверний фіскальний профіль. Нові фіскальні дії тимчасово заблоковано; збережений запит не змінено.' }}</p><BaseButton :disabled="fiscalProfileLoading" @click="loadFiscalProfile">Оновити фіскальний профіль</BaseButton></section>
      <OrderShopPayments v-if="order.channel === 'shop' && !isBarber" :order="order" :refresh-token="fiscalRefresh" @changed="reloadSales" />
      <OrderShopPaymentResolution v-if="order.channel === 'shop' && !isBarber" :order="order" :refresh-token="fiscalRefresh" @changed="reloadSales" />
      <OrderShopOperations v-if="order.channel === 'shop' && !isBarber" :order="order" :refresh-token="fiscalRefresh" @changed="reloadSales" />
      <OrderQrMock v-if="order.channel === 'backoffice_pos' && order.simulation" :order="order" :refresh-token="fiscalRefresh" @owner="qrOwnsSale = $event" @changed="reloadSales" />
      <section v-if="order.channel !== 'shop' && !orderUsesNovaPoshta(order)" class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 class="flex items-center gap-2 text-lg font-semibold"><CreditCardIcon class="h-5 w-5" aria-hidden="true" />{{ isPosSale ? '3. Передайте товар' : 'Оплата та видача' }}</h2>
        <p v-if="isPosSale && order.handovers?.length" role="status" class="font-semibold text-emerald-700">Видачу підтверджено. Продаж завершено.</p>
        <p v-else-if="isPosSale && order.sales_actions?.can_handover" class="text-ui-secondary">Оплата підтверджена. Передайте товар клієнту та окремо зафіксуйте видачу нижче.</p>
        <p v-else-if="isPosSale" class="text-ui-secondary">Спочатку дочекайтеся підтвердження оплати та чека. Після цього тут з’явиться підтвердження видачі.</p>
        <p v-if="order.simulation" class="text-amber-700" role="status">Ізольована тестова симуляція. Записи не підтверджують реальний розрахунок або реальну видачу.</p>
        <p v-else>Лише підготовка замовлення. Реальні оплата та видача заблоковані до дозволеного фіскального сценарію.</p>
        <details v-if="!isBarber && order.sales_actions?.blocking_reasons?.length" class="text-sm text-ui-secondary"><summary class="cursor-pointer">Чому дія недоступна: технічні причини</summary><p v-for="reason in order.sales_actions.blocking_reasons" :key="reason" class="mt-2 break-words">{{ reason }}</p></details>
        <details v-if="!isBarber && !qrOwnsSale && order.simulation && (order.sales_actions?.can_record_payment || paymentCommand.intent.value)" :open="!isPosSale || !!paymentCommand.intent.value"><summary class="cursor-pointer font-medium">Інший тестовий спосіб оплати</summary><div class="mt-3 grid gap-3 sm:grid-cols-2">
          <label>Спосіб тестової оплати<BaseSelect v-model="paymentMethod" native :disabled="commandBusy || !!paymentCommand.intent.value"><option value="cash">Готівка</option><option value="card">Картка (без списання)</option></BaseSelect></label>
          <BaseInput v-model="paymentEvidence" label="Підстава тестової оплати" :disabled="commandBusy || !!paymentCommand.intent.value" />
          <BaseButton :loading="paymentCommand.busy.value" :disabled="commandBusy || (!paymentEvidence.trim() && !paymentCommand.intent.value)" @click="recordPayment">{{ paymentCommand.intent.value ? 'Повторити тестову оплату' : 'Записати тестову оплату' }}</BaseButton>
        </div></details>
        <p v-if="paymentCommand.error.value" role="alert" class="text-rose-600">{{ paymentCommand.error.value }}</p>
        <div v-if="order.simulation && (order.sales_actions?.can_handover || handoverCommand.intent.value)" class="space-y-3">
          <BaseInput v-model="handoverEvidence" label="Підстава тестової видачі" :disabled="commandBusy || !!handoverCommand.intent.value" />
          <BaseButton variant="primary" size="lg" :loading="handoverCommand.busy.value" :disabled="commandBusy || (!handoverEvidence.trim() && !handoverCommand.intent.value)" @click="handover">{{ handoverCommand.intent.value ? 'Повторити тестову видачу' : 'Підтвердити тестову видачу' }}</BaseButton>
        </div>
        <p v-if="handoverCommand.error.value" role="alert" class="text-rose-600">{{ handoverCommand.error.value }}</p>
        <details v-if="!isBarber && (order.payments?.length || order.handovers?.length)"><summary class="cursor-pointer py-2 text-sm font-medium">Історія оплати та видачі</summary><div class="mt-2 space-y-2 text-sm">        <ul v-if="!isBarber" class="space-y-2"><li v-for="payment in order.payments || []" :key="payment.id">{{ payment.simulation ? 'Тестова оплата' : 'Оплата' }} · {{ formatMoney((payment.amount_minor / 100).toFixed(2)) }} · {{ payment.method }} · {{ payment.source }} · {{ payment.evidence }} · {{ formatDateTime(payment.created_at) }}</li></ul>
        <ul v-if="!isBarber" class="space-y-2"><li v-for="fact in order.handovers || []" :key="fact.id">{{ fact.simulation ? 'Тестова видача' : 'Видача' }} · {{ fact.evidence }} · {{ formatDateTime(fact.created_at) }}</li></ul>
</div></details>
      </section>

      </div>
      <template v-if="!isBarber">
        <details class="order-disclosure" :open="orderUsesNovaPoshta(order)"><summary><TruckIcon class="order-summary-icon" aria-hidden="true" />Відправлення та ТТН</summary><div class="mt-3 space-y-4"><OrderShopNPReturns v-if="usesCheckbox && order.fulfillment_method === 'nova_poshta'" :profile-ready="fiscalProfileReady" :inert="!fiscalProfileReady || undefined" :order="order" :refresh-token="fiscalRefresh" @changed="reloadSales" /><OrderShopCarrierReturns :inert="!fiscalProfileReady || undefined" v-if="usesShopFiscal && shopFiscalProfile !== null && !usesCheckbox && order.fulfillment_method === 'nova_poshta'" :order="order" :refresh-token="fiscalRefresh" @changed="reloadSales" /><OrderShipments v-if="legacyShipmentOrder" :order="legacyShipmentOrder" @changed="reloadSales" /></div></details>
        <details class="order-disclosure"><summary><DocumentTextIcon class="order-summary-icon" aria-hidden="true" />Документи та чеки</summary><div class="mt-3 space-y-4">
      <section v-if="!isBarber" class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">Попередні документи SC</h2>
        <p class="my-4">Попереднє замовлення. Не є фіскальним чеком</p>
        <div class="flex flex-wrap gap-3">
          <BaseButton :disabled="documentPending || !order.revision" @click="createDocument">{{ preliminaryCommand.intent.value ? 'Повторити запит документа' : 'Створити нову версію документа' }}</BaseButton>
          <BaseButton v-for="document in order.preliminary_documents || []" :key="document.id" variant="neutral" :disabled="documentPending" @click="openDocument(document)">{{ document.number }} · v{{ document.version }} · Перегляд / друк</BaseButton>
        </div>
        <p v-if="!order.preliminary_documents?.length" class="mt-3 text-sm text-slate-500">Документи відсутні.</p>
        <p v-if="documentError" class="mt-3 text-sm text-rose-600" role="alert">{{ documentError }}</p>
      </section>


          <OrderShopCheckboxFiscal v-if="usesCheckbox" :profile-ready="fiscalProfileReady" :inert="!fiscalProfileReady || undefined" :aria-busy="!fiscalProfileReady" :order="order" :refresh-token="fiscalRefresh" @changed="reloadSales" />
          <OrderShopFiscal :inert="!fiscalProfileReady || undefined" v-else-if="usesShopFiscal && shopFiscalProfile !== null" :order="order" :refresh-token="fiscalRefresh" @changed="reloadSales" />
          <OrderFiscalMock v-else-if="!usesShopFiscal" :order="order" :refresh-token="fiscalRefresh" :sale-automation-owned="ettnOwner === 'checkbox_ettn' || qrOwnsSale" @changed="reloadSales" />
        </div></details>
        <details class="order-disclosure"><summary><ArrowUturnLeftIcon class="order-summary-icon" aria-hidden="true" />Повернення</summary><div class="mt-3"><OrderShopCheckboxReturns v-if="usesCheckbox" :profile-ready="fiscalProfileReady" :inert="!fiscalProfileReady || undefined" :aria-busy="!fiscalProfileReady" :order="order" :refresh-token="fiscalRefresh" @changed="reloadSales" /><OrderShopReturns :inert="!fiscalProfileReady || undefined" v-else-if="usesShopFiscal && shopFiscalProfile !== null" :order="order" :refresh-token="fiscalRefresh" @changed="reloadSales" /><OrderReturnsMock v-else-if="!usesShopFiscal" :order="order" :refresh-token="fiscalRefresh" @changed="reloadSales" /></div></details>
        <details class="order-disclosure"><summary><Cog6ToothIcon class="order-summary-icon" aria-hidden="true" />Автоматизація ЕТТН</summary><div class="mt-3"><OrderEttnMock :order="order" :refresh-token="fiscalRefresh" @owner="ettnOwner = $event" @changed="reloadSales" /></div></details>
        <details class="order-disclosure"><summary><ChartBarIcon class="order-summary-icon" aria-hidden="true" />Звіти каси</summary><div class="mt-3"><ShopCheckboxReports v-if="usesCheckbox" :profile-ready="fiscalProfileReady" :inert="!fiscalProfileReady || undefined" :aria-busy="!fiscalProfileReady" :refresh-token="fiscalRefresh" @changed="reloadSales" /><ShopFiscalReports :inert="!fiscalProfileReady || undefined" v-else-if="usesShopFiscal && shopFiscalProfile !== null" :refresh-token="fiscalRefresh" @changed="reloadSales" /><FiscalReportsMock v-else-if="!usesShopFiscal" :refresh-token="fiscalRefresh" @changed="reloadSales" /></div></details>
        <details class="order-disclosure"><summary><Cog6ToothIcon class="order-summary-icon" aria-hidden="true" />Технічні дані та синхронізація</summary><div class="mt-3 space-y-4 text-sm">
          <dl class="grid gap-3 sm:grid-cols-2"><div v-for="row in [...syncRows, ...technicalShippingRows]" :key="row.label"><dt class="text-ui-secondary">{{ row.label }}</dt><dd class="mt-1 break-words">{{ displayValue(row.value) }}</dd></div></dl>
          <details v-if="shippingPayloadEntries.length"><summary class="cursor-pointer py-2">Shipping payload</summary><div class="mt-2 grid gap-3 md:grid-cols-2"><article v-for="[key, value] in shippingPayloadEntries" :key="key" class="min-w-0 rounded-xl bg-ui-subtle p-3"><p class="break-all text-xs text-ui-secondary">{{ key }}</p><pre class="mt-2 whitespace-pre-wrap break-all text-xs">{{ typeof value === 'string' ? value : JSON.stringify(value, null, 2) }}</pre></article></div></details>
        </div></details>
      </template>
    </div>
  </div>
</template>

<style scoped>
.order-disclosure { border: 1px solid var(--bo-border); border-radius: 1rem; padding: .25rem 1rem; }
.order-disclosure > summary { min-height: 3rem; cursor: pointer; padding: .75rem 0; font-size: .875rem; font-weight: 600; }
.order-summary-icon { display: inline; width: 1.25rem; height: 1.25rem; margin-right: .5rem; vertical-align: text-bottom; }
.order-disclosure[open] { padding-bottom: 1rem; }
</style>
