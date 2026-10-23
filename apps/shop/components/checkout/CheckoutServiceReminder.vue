<script setup lang="ts">
import { cartFingerprint, readReminder, readReminderOrderKey, reminderStorageKey, reminderOrderStorageKey, type ReminderIdentity } from '~/utils/checkoutReminder'
import { checkedInput } from '~/utils/inputSafety'

const props = defineProps<{ email: string, checkpointRevision: number, active: boolean }>()
const cart = useCartStore()
const auth = useCustomerAuthStore()
const { locale } = useShopLocale()
const api = useApi()
const enabled = ref(false)
const dryRun = ref(false)
let identityOwner = ''
const scope = computed(() => auth.isAuthenticated ? `customer:${auth.customer?.id}` : 'guest')
const previewText = computed(() => locale.value === 'uk'
  ? 'Тестовий режим нагадування: лист не буде надіслано.'
  : 'Reminder test mode: no email will be sent.')
let timer: ReturnType<typeof setTimeout> | undefined
let generation = 0
let pendingDraft: (() => void) | undefined
const signature = () => JSON.stringify([props.email.trim().toLowerCase(), locale.value, cartFingerprint(cart.items)])
const resetTimer = () => { generation++; if (timer) clearTimeout(timer); timer = undefined; pendingDraft = undefined }
const persist = (owner: string, value: ReminderIdentity) => {
  sessionStorage.setItem(reminderStorageKey(owner), JSON.stringify(value))
  sessionStorage.setItem(reminderOrderStorageKey(owner), value.key)
  if (scope.value === owner) identityOwner = owner
}
const nextIdentity = (owner: string): ReminderIdentity => {
  const previous = readReminder(sessionStorage, owner)
  return { key: previous?.key || readReminderOrderKey(sessionStorage, owner) || crypto.randomUUID(),
    revision: (previous?.revision || 0) + 1, fingerprint: '' }
}
const cancelIdentity = async (owner: string, value: ReminderIdentity) => {
  try {
    await api('/public/checkout-reminders/cancel', { method: 'POST', body: {}, retry: 0,
      headers: { 'X-Checkout-Key': value.key, 'X-Checkout-Revision': String(value.revision) } })
    const current = readReminder(sessionStorage, owner)
    if (current?.key === value.key && current.revision === value.revision) persist(owner, { ...current, pendingCancel: false })
  } catch { /* Keep the revision for replay after reconnect/reload. */ }
}
const invalidate = () => {
  resetTimer()
  const owner = scope.value
  if (identityOwner !== owner || !readReminder(sessionStorage, owner)?.fingerprint) return
  try {
    const next = { ...nextIdentity(owner), pendingCancel: true }
    persist(owner, next)
    // One invalidation per persisted checkpoint, never a request per keystroke.
    void cancelIdentity(owner, next)
  } catch { /* Storage/network failure cannot create a new reminder. */ }
}
const scheduleCheckpoint = () => {
  resetTimer()
  if (!auth.isAuthenticated || !props.active || cart.syncing || cart.ownerScope !== scope.value || !cart.items.length || cart.hasUnavailableItems) return
  let email: string
  try { email = checkedInput(props.email, 'email', true) } catch { return }
  const owner = scope.value
  const currentGeneration = generation
  const intentSignature = signature()
  const isCurrentSession = auth.captureSession()
  const payload = { email, locale: locale.value,
    items: cart.items.map(item => ({ product_id: item.product.id, quantity: item.quantity })) }
  const save = async () => {
    if (!auth.isAuthenticated || cart.syncing || !props.active || !enabled.value || generation !== currentGeneration || !isCurrentSession() || scope.value !== owner || signature() !== intentSignature) return
    try {
      const bytes = new TextEncoder().encode(intentSignature)
      const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('')
      if (generation !== currentGeneration || !isCurrentSession() || scope.value !== owner || signature() !== intentSignature) return
      const previous = readReminder(sessionStorage, owner)
      // A repeated blur on unchanged content is a read, not another event.
      if (previous?.fingerprint === fingerprint && previous.confirmed) return
      const next = previous?.fingerprint === fingerprint ? previous : { ...nextIdentity(owner), fingerprint, confirmed: false, cartSignature: cartFingerprint(cart.items) }
      persist(owner, next)
      await api('/public/checkout-reminders/checkpoint', { method: 'POST', body: payload, retry: 0,
        headers: { 'X-Checkout-Key': next.key, 'X-Checkout-Revision': String(next.revision) } })
      const current = readReminder(sessionStorage, owner)
      if (current?.key === next.key && current.revision === next.revision) persist(owner, { ...current, confirmed: true })
    } catch { /* Checkout remains usable; stable identity fences uncertain outcomes. */ }
  }
  pendingDraft = () => {
    if (!props.active || !enabled.value || !isCurrentSession() || generation !== currentGeneration || signature() !== intentSignature) return
    // Reserve before debounce/hash, but only for an enabled, unfinished checkout.
    try {
      if (!readReminderOrderKey(sessionStorage, owner)) sessionStorage.setItem(reminderOrderStorageKey(owner), crypto.randomUUID())
    } catch { return }
    timer = setTimeout(() => { timer = undefined; void save() }, 800)
  }
  if (enabled.value) pendingDraft()
}
watch(() => props.active, active => { if (!active) resetTimer() }, { flush: 'sync' })
watch(() => props.checkpointRevision, () => { if (props.checkpointRevision > 0) scheduleCheckpoint() })
watch(() => [props.email, locale.value, cartFingerprint(cart.items)], invalidate)
watch(() => [auth.sessionRevision, auth.accessToken, auth.customer?.id, auth.tokenType], () => {
  resetTimer()
  enabled.value = false
  dryRun.value = false
  identityOwner = scope.value
  void nextTick().then(refreshCapabilities)
}, { flush: 'sync' })
let capabilityRequest = 0
const refreshCapabilities = async () => {
  const request = ++capabilityRequest
  const isCurrentSession = auth.captureSession()
  enabled.value = false
  dryRun.value = false
  if (!auth.isAuthenticated) return
  identityOwner = scope.value
  try {
    const result = await api<{ enabled: boolean, dry_run?: boolean }>('/public/checkout-reminders/capabilities', { retry: 0, cache: 'no-store' })
    if (request !== capabilityRequest || !isCurrentSession()) return
    enabled.value = result.enabled === true
    dryRun.value = result.dry_run === true
    if (enabled.value && pendingDraft) pendingDraft()
  } catch { if (request === capabilityRequest && isCurrentSession()) enabled.value = false }
}
onNuxtReady(refreshCapabilities)
onUnmounted(() => { capabilityRequest++; resetTimer() })
</script>

<template>
  <p v-if="enabled && dryRun" class="checkout-service-reminder" role="status">{{ previewText }}</p>
</template>
