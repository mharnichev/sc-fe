<script setup lang="ts">
import type { CustomerOrder, CustomerShipment, TrackingRefreshResponse } from '~/types/order'
import { deliveryStatus, retrySeconds, shipmentStatusLabel, shipmentStatusIcon, shipmentStatusTone } from '~/utils/shipmentStatus'
import { orderReceiptDates } from '~/utils/orderReceiptDates'
import { orderTrackingText } from '~/utils/orderTrackingText'
const { runtimeMessage, orderItemName } = useShopRuntimeDisplay()
const props = defineProps<{ shipments?: CustomerShipment[], orderId?: number, items?: CustomerOrder['items'] }>()
const emit = defineEmits<{ updated: [], unavailable: [] }>()
const { locale, dateLocale } = useShopLocale()
const text = computed(() => orderTrackingText[locale.value] || orderTrackingText.uk)
const copyResult = ref<'copied' | 'copyFailed' | ''>('')
const copying = ref(false)
let copyGeneration = 0
const copyTracking = async (number: string) => {
  if (copying.value) return
  const capturedSession = session()
  const current = copyGeneration
  const isCurrent = () => current === copyGeneration && capturedSession === session()
  copying.value = true
  copyResult.value = ''
  try {
    await navigator.clipboard.writeText(number)
    if (isCurrent()) copyResult.value = 'copied'
  } catch { if (isCurrent()) copyResult.value = 'copyFailed' }
  finally { if (isCurrent()) copying.value = false }
}
const api = useApi()
const auth = useCustomerAuthStore()
const refreshing = ref(false)
const deadline = ref(0)
const now = ref(Date.now())
const feedback = ref<CooldownKind | 'disabled' | 'no_real_shipments' | ''>('')
const notice = computed(() => ['queued', 'cooldown', 'disabled', 'no_real_shipments'].includes(feedback.value) ? text.value[feedback.value as keyof typeof text.value] : '')
const error = computed(() => ['rate_limited', 'error'].includes(feedback.value) ? text.value[feedback.value as keyof typeof text.value] : '')
const unavailable = ref(false)
const remaining = computed(() => Math.max(0, Math.ceil((deadline.value - now.value) / 1000)))
const realShipments = computed(() => props.shipments?.some(s => !s.simulation && s.carrier === 'nova_poshta'))
const session = () => `${props.orderId}:${auth.customer?.id}:${auth.sessionRevision}:${auth.accessToken}`
const storageKey = () => `shop-tracking-cooldown:${auth.customer?.id}:${props.orderId}`
let generation = 0
let clock: ReturnType<typeof setInterval> | undefined
let reloadTimer: ReturnType<typeof setTimeout> | undefined
const clearReload = () => { if (reloadTimer) clearTimeout(reloadTimer); reloadTimer = undefined }
const scheduleRead = (seconds: number) => {
  clearReload()
  const current = generation
  const capturedSession = session()
  reloadTimer = setTimeout(() => {
    if (current === generation && capturedSession === session() && auth.isAuthenticated) emit('updated')
  }, Math.min(seconds * 1000, 2147483647))
}
type CooldownKind = 'queued' | 'cooldown' | 'rate_limited' | 'error'
const showCooldown = (kind: CooldownKind) => { feedback.value = kind }
const rememberCooldown = (seconds: number, kind: CooldownKind) => {
  now.value = Date.now()
  deadline.value = now.value + seconds * 1000
  try { sessionStorage.setItem(storageKey(), JSON.stringify({ until: deadline.value, kind })) } catch { /* Storage is optional. */ }
}
const reset = () => {
  copyGeneration++
  generation++
  clearReload()
  refreshing.value = false
  unavailable.value = false
  feedback.value = ''; copyResult.value = ''; copying.value = false; deadline.value = 0
  now.value = Date.now()
  if (import.meta.client && props.orderId && auth.isAuthenticated) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey()) || 'null')
      const until = typeof saved === 'number' ? saved : saved?.until
      if (typeof until === 'number' && Number.isFinite(until) && until > now.value) {
        deadline.value = until
        const kind = ['queued', 'cooldown', 'rate_limited', 'error'].includes(saved?.kind) ? saved.kind as CooldownKind : 'cooldown'
        showCooldown(kind)
        scheduleRead(Math.ceil((until - now.value) / 1000))
      }
    } catch { /* Server cooldown still applies without browser storage. */ }
  }
}
watch(session, reset, { immediate: true })
onMounted(() => {
  clock = setInterval(() => { now.value = Date.now() }, 1000)
})
onBeforeUnmount(() => { copyGeneration++; generation++; clearReload(); if (clock) clearInterval(clock) })
const refresh = async () => {
  if (!props.orderId || !auth.isAuthenticated || !realShipments.value || refreshing.value || remaining.value || unavailable.value) return
  const current = ++generation
  const capturedSession = session()
  const isCurrent = () => current === generation && capturedSession === session() && auth.isAuthenticated
  refreshing.value = true; feedback.value = ''
  try {
    const result = await api<TrackingRefreshResponse>(`/public/orders/me/${props.orderId}/shipments/refresh`, { method: 'POST', retry: 0 })
    if (!isCurrent()) return
    if (result.status === 'disabled' || result.status === 'no_real_shipments') {
      unavailable.value = true
      feedback.value = result.status
      return
    }
    if (result.status !== 'queued' && result.status !== 'cooldown') throw new Error('Invalid refresh result')
    const wait = Math.max(1, retrySeconds(result.retry_after_seconds))
    rememberCooldown(wait, result.status)
    showCooldown(result.status)
    scheduleRead(wait)
  }
  catch (cause: unknown) {
    if (!isCurrent()) return
    const failure = cause as { statusCode?: number, response?: { status?: number, headers?: Headers } }
    const code = failure.response?.status || failure.statusCode
    if (code === 401 || code === 403 || code === 404) { emit('unavailable'); return }
    const kind = code === 429 ? 'rate_limited' : 'error'
    rememberCooldown(code === 429 ? Math.max(1, retrySeconds(failure.response?.headers?.get('Retry-After'))) : 60, kind)
    showCooldown(kind)
  }
  finally { if (isCurrent()) refreshing.value = false }
}
const formatTime = (value?: string | null) => {
  if (!value) return text.value.neverChecked
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? text.value.invalidDate : date.toLocaleString(dateLocale.value, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Kyiv' })
}
const receiptDates = computed(() => new Map((props.shipments || []).flatMap(shipment => orderReceiptDates([shipment])).map(receipt => [receipt.id, receipt.date])))
const itemName = (id: number) => {
  const item = props.items?.find(item => item.id === id)
  return item ? orderItemName(item) : `${text.value.item} #${id}`
}
</script>
<template>
  <section v-if="shipments?.length" :aria-label="text.shipments" class="shipments">
    <header class="shipments__head">
      <h2>{{ text.shipments }}</h2>
      <BaseButton v-if="orderId && realShipments" type="button" variant="outline-dark" size="sm" :disabled="refreshing || remaining > 0 || unavailable" :aria-busy="refreshing" @click="refresh">
        {{ refreshing ? text.refreshing : remaining > 0 ? `${text.refreshAfter} ${remaining} ${text.seconds}` : text.refresh }}
      </BaseButton>
    </header>
    <p v-if="shipments.every(shipment => shipment.simulation)" class="shipments__note">{{ locale === 'en' ? 'Test data' : 'Тестові дані' }}</p>
    <p v-if="copyResult" role="status">{{ text[copyResult] }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="error" role="alert">{{ runtimeMessage(error) }}</p>
    <article v-for="shipment in shipments" :key="shipment.id" class="shipments__card soft-surface" :aria-label="`${text.shipments} #${shipment.id}`">
      <p v-if="shipment.simulation && shipments.some(parcel => !parcel.simulation)" class="shipments__note">{{ locale === 'en' ? 'Test shipment' : 'Тестове відправлення' }}</p>
      <p v-if="shipment.return_of_shipment_id">{{ text.returnOf }} #{{ shipment.return_of_shipment_id }}</p>
      <div class="shipments__tracking">
        <h3>{{ text.tracking }}:</h3>
        <template v-if="shipment.tracking_number">
          <BaseButton type="button" variant="text" size="sm" class="shipments__number" :disabled="copying" @click="copyTracking(shipment.tracking_number)">{{ shipment.tracking_number }}</BaseButton>
          <BaseButton type="button" variant="borderless" size="sm" class="shipments__copy" :aria-label="text.copy" :title="text.copy" :disabled="copying" @click="copyTracking(shipment.tracking_number)">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>
          </BaseButton>
        </template>
        <p v-else>{{ text.noNumber }}</p>
      </div>
      <p><OrderStatusBadge :label="shipmentStatusLabel(deliveryStatus(shipment), locale, !shipment.simulation)" :icon="'nova-post'" :tone="shipmentStatusTone(deliveryStatus(shipment))" /></p>
      <p v-if="!shipment.simulation && deliveryStatus(shipment) === 'delivered' && !shipment.return_of_shipment_id" class="shipments__received">{{ locale === 'en' ? 'Received' : 'Отримано' }}: <time v-if="receiptDates.get(shipment.id)" :datetime="receiptDates.get(shipment.id) || undefined">{{ formatTime(receiptDates.get(shipment.id)) }}</time><span v-else>{{ locale === 'en' ? 'Date not recorded' : 'Дату не зафіксовано' }}</span></p>
      <p v-if="!shipment.simulation && shipment.stale !== false" class="shipments__warning">{{ text.stale }}</p>
      <p v-if="shipment.last_attempt_status === 'error'" class="shipments__warning">{{ text.attemptFailed }}</p>
      <BaseDisclosure :key="shipment.id" :label="text.history">
        <div v-if="shipment.events?.length" class="shipments__history">
          <ol><li v-for="(event, index) in shipment.events" :key="index" class="shipments__event">
            <BaseIcon class="shipments__event-icon" :name="shipmentStatusIcon(event.normalized_status)" size="xxs" />
            <div class="shipments__event-copy">
              <p class="shipments__event-label">{{ shipmentStatusLabel(event.normalized_status, locale, !shipment.simulation) }}</p>
              <time v-if="event.event_at" :datetime="event.event_at">{{ formatTime(event.event_at) }}</time>
              <span v-else class="shipments__event-missing">{{ text.noEventTime }}</span>
              <small v-if="!event.event_at">{{ text.observed }}: {{ formatTime(event.observed_at) }}</small>
            </div>
          </li></ol>
        </div>
        <div v-if="!shipment.simulation" class="shipments__contents">
          <h4>{{ text.contents }}</h4>
          <ul v-if="shipment.items?.length"><li v-for="item in shipment.items" :key="item.order_item_id">{{ itemName(item.order_item_id) }} · {{ item.quantity }} {{ text.units }}</li></ul>
          <p v-else>{{ text.noContents }}</p>
        </div>
        <p class="shipments__checked">{{ text.checked }}: {{ formatTime(shipment.last_successful_check_at ?? shipment.last_checked_at) }}</p>
      </BaseDisclosure>
    </article>
  </section>
</template>
<style scoped>
.shipments { display: grid; min-width: 0; gap: 1rem; background: transparent; padding: 1rem; }
.shipments__status { display: inline-flex; align-items: center; gap: .35rem; }
.shipments h2, .shipments h3, .shipments h4 { font-weight: 800; }
.shipments__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; }
.shipments__card { display: grid; min-width: 0; gap: .65rem; border: 0; padding: .85rem; overflow-wrap: anywhere; }
.shipments__tracking { display: flex; align-items: center; gap: .35rem; min-width: 0; }
.shipments__number { min-width: 0; padding: .5rem .15rem; text-align: left; overflow-wrap: anywhere; }
.shipments__number :deep(.sc-button__text) { white-space: normal; overflow-wrap: anywhere; }
.shipments__copy { flex-shrink: 0; min-width: 44px; min-height: 44px; padding: .5rem; }
.shipments__history ol { display: grid; gap: 0; margin: .2rem 0; padding: 0; list-style: none; }
.shipments__event { display: grid; grid-template-columns: 1.25rem minmax(0, 1fr); gap: .6rem; position: relative; padding-bottom: 1rem; }
.shipments__event:last-child { padding-bottom: 0; }
.shipments__event:not(:last-child)::after { content: ''; position: absolute; left: .6rem; top: 1.3rem; bottom: .2rem; width: 1px; background: #e5e7eb; }
.shipments__event-icon { margin-top: .15rem; color: #737373; }
.shipments__event-copy { display: flex; flex-wrap: wrap; align-items: baseline; gap: .2rem 1rem; min-width: 0; }
.shipments__event-label { font-size: .85rem; font-weight: 500; color: #262626; }
.shipments__event-copy time, .shipments__event-missing { margin-left: auto; color: #737373; font-size: .75rem; font-weight: 400; }
.shipments__event-copy small { flex-basis: 100%; color: #737373; font-size: .7rem; }
.shipments__contents { font-size: .75rem; color: #737373; line-height: 1.5; margin-top: .5rem; }
.shipments__contents h4 { font-size: .75rem; font-weight: 500; margin-bottom: .2rem; }
.shipments__contents li { color: #525252; }
.shipments__checked, .shipments__note { color: #737373; font-size: .7rem; line-height: 1.5; }
.shipments__checked { margin-top: .25rem; }
@media (max-width: 480px) { .shipments__event-copy { display: grid; gap: .15rem; } .shipments__event-copy time, .shipments__event-missing { margin-left: 0; } }
.shipments__warning { color: #854d0e; }
</style>
