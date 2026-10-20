<script setup lang="ts">
import { qrMockCode as qrCode } from '~/utils/qrMock'
import { masterMonoPaymentUrl, masterMonoBlockingReason, validMasterMonoState } from '~/utils/masterMono'
import { useBackofficeApi } from '~/composables/useBackofficeApi'
import type { MasterMonoCommand, MasterMonoState, OrderResponse } from '~/composables/useBackofficeApi'
const props = defineProps<{ order: OrderResponse, refreshToken?: number, blocked?: boolean }>()
const emit = defineEmits<{ changed: [], selected: [value: boolean], ready: [value: boolean], busy: [value: boolean], handoverAllowed: [value: boolean] }>()
const api = useBackofficeApi(), auth = useAuthStore()
const { isBarber } = useBackofficeAccess()
const permission = computed(() => isBarber.value && props.order.channel === 'backoffice_pos' && !props.order.simulation && !!auth.user?.is_active && !!auth.accessToken && (auth.user.is_superuser || (auth.user.can_record_sales === true && auth.user.can_accept_qr_payments === true)))
const resource = computed(() => String(props.order.id))
const session = computed(() => JSON.stringify([resource.value, auth.user?.id, auth.accessToken, permission.value]))
const rejections = ['master_mono_disabled', 'master_mono_not_ready', 'master_mono_profile_conflict', 'master_mono_checkout_owned', 'master_mono_binding_required', 'master_mono_payment_conflict', 'master_mono_issuer_conflict', 'master_mono_identity_conflict', 'unsupported_zero_total', 'payment_required', 'master_mono_terminal_truth', 'terminal_order']
const start = useOrderSalesCommand<MasterMonoCommand>('master-mono-start', resource, rejections)
const refresh = useOrderSalesCommand<MasterMonoCommand>('master-mono-refresh', resource, rejections)
const state = shallowRef<MasterMonoState | null>(null)
const loading = ref(false), readError = ref(''), printError = ref(''), ready = ref(false)
const busy = computed(() => start.busy.value || refresh.busy.value)
const unresolved = computed(() => !!start.intent.value || !!refresh.intent.value)
const selected = computed(() => permission.value)
const canStart = computed(() => permission.value && state.value?.enabled && state.value.status === 'not_started' && !state.value.invoice_id && !state.value.payment_url && !state.value.paid && !state.value.receipt_accepted && props.order.status !== 'cancelled' && props.order.status !== 'completed' && !state.value.blocking_reasons.length)
const paymentUrl = computed(() => permission.value && ready.value && !readError.value && state.value?.enabled && !['declined', 'expired', 'cancelled', 'reversed', 'failed', 'creation_unknown'].includes(state.value.status) && !['cancelled', 'completed'].includes(props.order.status) && !state.value.paid && !state.value?.receipt_accepted ? masterMonoPaymentUrl(state.value) : null)
const paymentQr = computed(() => paymentUrl.value ? qrCode(paymentUrl.value) : null)
const creationUnknown = computed(() => !!state.value && !state.value.invoice_id && !state.value.payment_url && (state.value.status !== 'not_started' || unresolved.value))
const handoverAllowed = computed(() => permission.value && ready.value && !loading.value && !readError.value && !unresolved.value && !busy.value && !!state.value?.enabled && !!state.value.paid && !!state.value.receipt_accepted && state.value.can_handover && state.value.revision === props.order.revision)
const canPrint = computed(() => permission.value && ready.value && !readError.value && !!state.value?.paid && !!state.value.receipt_accepted && state.value.receipt_pdf_path === `/api/v1/backoffice/master-mono/orders/${props.order.id}/receipt/pdf`)
const amount = computed(() => ((state.value?.amount_minor ?? 0) / 100).toLocaleString('uk-UA', { style: 'currency', currency: 'UAH' }))
let generation = 0, active = true
let timer: ReturnType<typeof setTimeout> | undefined
let reading: Promise<boolean> | null = null
const popups = new Set<Window>(), blobUrls = new Set<string>()
const stopTimer = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined }
const clearPrint = () => { popups.forEach(popup => popup.close()); popups.clear(); blobUrls.forEach(url => URL.revokeObjectURL(url)); blobUrls.clear() }
const valid = (version: number) => active && generation === version && permission.value
const accept = (value: MasterMonoState) => {
  if (!validMasterMonoState(value, props.order.id)) throw new Error('Invalid master mono state')
  if (state.value && state.value.revision > value.revision) return
  state.value = value
}
const schedule = () => {
  stopTimer()
  if (active && permission.value && selected.value && !busy.value) timer = setTimeout(() => { timer = undefined; void load() }, 3000)
}
const load = (): Promise<boolean> => {
  if (!active || !permission.value) return Promise.resolve(false)
  if (reading) return reading
  stopTimer()
  const version = generation, id = props.order.id
  loading.value = true
  const request = (async () => {
    try {
      const result = await api.getMasterMonoState(id)
      if (!valid(version)) return false
      const previous = state.value
      accept(result); readError.value = ''; ready.value = true
      // A server-observed invoice resolves a lost creation reply without another POST.
      if (start.intent.value && state.value?.invoice_id && state.value.revision > start.intent.value.body.expected_revision) { start.clear(); start.error.value = '' }
      if (refresh.intent.value && state.value && state.value.revision > refresh.intent.value.body.expected_revision) { refresh.clear(); refresh.error.value = '' }
      if ((state.value && state.value.revision > (props.order.revision ?? 0)) || (!previous && (state.value?.paid || state.value?.receipt_accepted || state.value?.can_handover)) || (previous && (previous.paid !== state.value?.paid || previous.receipt_accepted !== state.value?.receipt_accepted || previous.can_handover !== state.value?.can_handover))) emit('changed')
      return true
    } catch {
      if (valid(version)) readError.value = 'Стан mono → Checkbox не підтверджено. Оновіть стан перед наступною дією.'
      return false
    } finally {
      if (valid(version)) { reading = null; loading.value = false; schedule() }
    }
  })()
  reading = request
  return request
}
watch(session, () => {
  generation++; stopTimer(); clearPrint(); reading = null
  state.value = null; ready.value = false; loading.value = false; readError.value = ''; printError.value = ''
  if (!permission.value) ready.value = true
  else if (import.meta.client) void load()
}, { immediate: true, flush: 'sync' })
watch(() => props.refreshToken, () => { if (import.meta.client && !busy.value) void load() })
watch(selected, value => emit('selected', value), { immediate: true, flush: 'sync' })
watch(handoverAllowed, value => emit('handoverAllowed', value), { immediate: true, flush: 'sync' })
watch(ready, value => emit('ready', value), { immediate: true, flush: 'sync' })
watch(busy, value => { emit('busy', value); if (value) stopTimer() }, { immediate: true, flush: 'sync' })
onBeforeUnmount(() => { active = false; generation++; stopTimer(); clearPrint() })
const run = async (operation: 'start' | 'refresh') => {
  if (!permission.value || props.blocked || busy.value || loading.value || readError.value || !state.value) return
  const command = operation === 'start' ? start : refresh
  const other = operation === 'start' ? refresh : start
  if (other.intent.value || (operation === 'start' ? !canStart.value : !state.value.invoice_id)) return
  const version = generation, id = props.order.id
  stopTimer()
  await command.execute({ expected_revision: state.value.revision }, async (body, key) => {
    const result = await (operation === 'start' ? api.startMasterMono(id, body, key) : api.refreshMasterMono(id, body, key))
    // Validate before recording durable completion. An unexpected body remains recoverable.
    if (valid(version)) accept(result)
    return { id: result.order_id }
  }, async () => {
    if (!valid(version)) return
    if (!await load() || !valid(version)) throw new Error('Стан операції потребує повторного читання.')
    command.clear(); emit('changed')
  })
  if (valid(version)) { if (!command.intent.value && command.error.value) await load(); schedule() }
}
const print = async () => {
  if (!permission.value || !canPrint.value) return
  const version = generation, id = props.order.id
  const popup = window.open('about:blank', '_blank')
  if (!popup) { printError.value = 'Дозвольте вікно PDF-чека.'; return }
  popup.opener = null; popups.add(popup); printError.value = ''
  try {
    const blob = await api.getMasterMonoReceiptPdf(id)
    if (!valid(version)) { popup.close(); return }
    if (!(blob instanceof Blob) || blob.type.split(';')[0] !== 'application/pdf') throw new Error('Invalid PDF')
    const url = URL.createObjectURL(blob); blobUrls.add(url); popup.location.replace(url)
  } catch { popup.close(); popups.delete(popup); if (valid(version)) printError.value = 'PDF-чек недоступний. Повторіть запит.' }
}
</script>
<template>
  <section v-if="selected" aria-label="mono → Checkbox" class="space-y-4 rounded-[1.75rem] border border-cyan-200 bg-ui-surface p-4 sm:p-6">
    <header><h2 class="text-xl font-semibold">2. Оплата через mono</h2><p class="mt-2 text-sm text-ui-secondary">Покажіть клієнту QR. Дочекайтеся підтвердження оплати та фіскального чека.</p></header>
    <p v-if="state" class="text-lg font-semibold">До сплати: {{ amount }}</p>
    <figure v-if="paymentQr" class="mx-auto w-fit max-w-full text-center"><svg role="img" aria-label="QR для оплати mono" :viewBox="`0 0 ${paymentQr.size} ${paymentQr.size}`" class="h-60 w-60 max-w-full rounded-2xl border border-ui bg-white p-3" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white" /><path :d="paymentQr.path" fill="black" /></svg><figcaption class="mt-2 text-sm">Відскануйте QR у банківському застосунку</figcaption></figure>
    <a v-if="paymentUrl" :href="paymentUrl" target="_blank" rel="noopener noreferrer" class="inline-flex min-h-11 items-center text-sm underline">Відкрити платіжне посилання</a>
    <p v-if="creationUnknown" role="status" class="font-semibold text-amber-800">Перевіряємо створення рахунку. Не створюйте повторну оплату; зверніться до адміністратора.</p>
    <p v-else-if="state?.invoice_id && !state.paid" role="status">Очікуємо підтвердження оплати.</p>
    <div v-if="state" class="grid gap-3 sm:grid-cols-2"><p role="status">Оплата: <strong>{{ state.paid ? 'Підтверджена' : 'Очікує підтвердження' }}</strong></p><p role="status">Чек: <strong>{{ state.receipt_accepted ? 'Прийнятий' : 'Ще не прийнятий' }}</strong></p></div>
    <p v-if="state?.paid && !state.receipt_accepted" role="status" class="font-semibold text-amber-800">Оплату підтверджено. Очікуємо чек; нову оплату не створюйте. Видача ще недоступна.</p>
    <p v-if="handoverAllowed" role="status" class="font-semibold text-emerald-700">Оплату та чек підтверджено. Передайте товар і окремо підтвердьте видачу нижче.</p>
    <p v-if="state && !state.enabled" role="status" class="text-amber-800">Оплату через mono тимчасово вимкнено. Зверніться до адміністратора.</p>
    <p v-if="loading" role="status" class="text-sm text-ui-secondary">Перевіряємо стан…</p>
    <div class="flex flex-wrap gap-3">
      <BaseButton v-if="canStart" variant="primary" size="lg" :disabled="blocked || busy || loading || !!readError || !!refresh.intent.value" @click="run('start')">{{ start.intent.value ? 'Відновити той самий запит' : 'Створити QR для оплати' }}</BaseButton>
      <BaseButton v-if="state?.invoice_id || refresh.intent.value" :disabled="blocked || busy || loading || !!readError || !!start.intent.value" @click="run('refresh')">{{ refresh.intent.value ? 'Повторити перевірку' : 'Перевірити статус' }}</BaseButton>
      <BaseButton v-if="canPrint" :disabled="busy" @click="print">Відкрити PDF-чек</BaseButton>
      <BaseButton v-if="readError || creationUnknown" :disabled="loading || busy" @click="load">Оновити стан</BaseButton>
    </div>
    <p v-if="readError || start.error.value || refresh.error.value || printError" role="alert" class="text-rose-600">{{ readError || (start.error.value || refresh.error.value ? 'Результат запиту ще не підтверджено. Оновіть стан; нову оплату не створюйте.' : printError) }}</p>
    <details v-if="state?.blocking_reasons.length" class="text-sm text-ui-secondary"><summary class="cursor-pointer">Чому дія недоступна</summary><p v-for="reason in state.blocking_reasons" :key="reason" class="mt-2 break-words">{{ masterMonoBlockingReason(reason) }}</p></details>
  </section>
</template>
