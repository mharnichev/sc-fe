<script setup lang="ts">
import { ArchiveBoxArrowDownIcon } from '@heroicons/vue/24/outline'
import type { PosSaleDetail } from '~/types/posSale'
import { parseSalesIntent, salesErrorDetail, salesIntentStorageKey } from '~/utils/orderSales'
import type { SalesIntent } from '~/utils/orderSales'

const props = defineProps<{ sale: PosSaleDetail; reading: boolean; readDetail: (id: number) => Promise<PosSaleDetail | null> }>()
type CloseRequest = { expected_revision: number }
type CloseResult = { order_id: number; revision: number; status: 'cancelled' }
const api = useApi({ refreshOnUnauthorized: false })
const auth = useAuthStore()
const actor = computed(() => auth.user?.is_active && auth.user.is_superuser && auth.accessToken ? auth.user.id : null)
const keyFor = (userId: number, orderId: number) => salesIntentStorageKey(userId, 'pos-close-expired-unpaid', String(orderId))
const scope = computed(() => actor.value ? keyFor(actor.value, props.sale.order_id) : '')
const pending = shallowRef<SalesIntent<CloseRequest> | null>(null)
const storageError = ref(false)
const busy = ref(false)
const feedback = ref('')
let active = true
onScopeDispose(() => { active = false })

const uuidV4 = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const readPending = (key: string) => {
  const raw = localStorage.getItem(key)
  if (raw === null) return null
  const saved = parseSalesIntent<CloseRequest>(raw)
  if (!saved || !uuidV4.test(saved.key) || Object.keys(saved.body).length !== 1
      || !Number.isSafeInteger(saved.body.expected_revision) || saved.body.expected_revision < 1) {
    throw new Error('Invalid saved close request')
  }
  return saved
}

const syncPending = () => {
  if (!scope.value) return
  try {
    pending.value = readPending(scope.value)
    storageError.value = false
  } catch {
    storageError.value = true
  }
}
const storageChanged = (event: StorageEvent) => {
  if (event.key === scope.value || event.key === null) syncPending()
}
onMounted(() => {
  syncPending()
  window.addEventListener('storage', storageChanged)
})
onBeforeUnmount(() => window.removeEventListener('storage', storageChanged))

const maySubmit = computed(() => props.sale.can_check_expired_close === true
  && (!pending.value || pending.value.body.expected_revision === props.sale.revision))
const quarantined = (sale: PosSaleDetail) => sale.order_status === 'cancelled'
  && sale.blocking_reasons.includes('master_mono_closed_conflict')
const provedClosed = (sale: PosSaleDetail) => quarantined(sale) || (
  sale.order_status === 'cancelled' && sale.payment.invoice_id === null && sale.payment.status === 'expired'
)

const outcome = computed(() => quarantined(props.sale)
  ? 'Продаж закрито. Нові дані про оплату потребують звірки.'
  : provedClosed(props.sale) ? 'Продаж закрито. Резерв товару знято.' : '')

const run = async () => {
  const userId = actor.value
  if (!userId || props.reading || busy.value || storageError.value) return
  const shown = props.sale
  const startedScope = scope.value
  const session = auth.sessionRevision, token = auth.accessToken
  const shownKey = pending.value?.key
  const allowSubmit = maySubmit.value
  const current = () => active && startedScope === scope.value && auth.sessionRevision === session && auth.accessToken === token
  feedback.value = ''
  if (!navigator.locks) {
    feedback.value = 'Відкрийте продаж в актуальному браузері для безпечної перевірки.'
    return
  }

  busy.value = true
  try {
    await navigator.locks.request(`sc-pos:v1:${userId}`, { ifAvailable: true }, async lock => {
      if (!current()) return
      if (!lock) {
        feedback.value = 'В іншій вкладці вже триває дія з продажем. Дочекайтеся завершення.'
        return
      }
      let saved = readPending(startedScope)
      pending.value = saved
      const acceptClose = (sale: PosSaleDetail) => {
        if (!provedClosed(sale)) return false
        if (saved && sale.revision > saved.body.expected_revision && readPending(startedScope)?.key === saved.key) {
          localStorage.removeItem(startedScope)
          pending.value = null
        }
        return true
      }

      const fresh = await props.readDetail(shown.order_id)
      if (!current() || !fresh || fresh.order_id !== shown.order_id) return
      if (acceptClose(fresh)) return
      if (!allowSubmit || saved?.key !== shownKey || fresh.can_check_expired_close !== true
          || !Number.isSafeInteger(fresh.revision) || fresh.revision < 1
          || fresh.revision !== shown.revision || (saved && saved.body.expected_revision !== fresh.revision)) {
        feedback.value = 'Стан продажу змінився або запит уже збережено в іншій вкладці. Перевірте деталі.'
        return
      }
      if (!saved) {
        saved = { key: crypto.randomUUID(), body: { expected_revision: fresh.revision } }
        localStorage.setItem(startedScope, JSON.stringify(saved))
        pending.value = saved
      }

      let rejectedProof = false
      try {
        const result = await api<CloseResult>(`/backoffice/master-mono/orders/${shown.order_id}/close-expired-unpaid`, {
          method: 'POST', body: saved.body, headers: { 'Idempotency-Key': saved.key }, retry: 0,
        })
        if (result.order_id !== shown.order_id || result.status !== 'cancelled'
            || !Number.isSafeInteger(result.revision) || result.revision <= saved.body.expected_revision) {
          throw new Error('Invalid close response')
        }
      } catch (cause) {
        const { code } = salesErrorDetail(cause)
        rejectedProof = code === 'master_mono_close_unpaid_unproven' || code === 'master_mono_close_fiscal_unproven'
      }
      if (!current()) return
      const after = await props.readDetail(shown.order_id)
      if (!current()) return
      if (after?.order_id === shown.order_id && acceptClose(after)) return
      feedback.value = rejectedProof
        ? 'Перевірка mono та чека не підтвердила умови закриття.'
        : 'Закриття не підтверджено. Запит збережено. Перед повтором перевіримо поточний стан.'
    })
  } catch {
    if (!current()) return
    syncPending()
    feedback.value = 'Не вдалося виконати перевірку. Перечитайте стан продажу перед наступною дією.'
  } finally {
    if (active) busy.value = false
  }
}
</script>

<template>
  <BaseCard v-if="actor && (sale.can_check_expired_close === true || pending || outcome)" as="section" variant="subtle" padding="sm" class="space-y-2" aria-label="Закриття простроченого продажу">
    <h3 class="flex items-center gap-2 text-sm font-semibold">
      <ArchiveBoxArrowDownIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
      Закриття простроченого продажу
    </h3>
    <p v-if="outcome" role="status" class="text-sm">{{ outcome }}</p>
    <template v-if="!outcome || pending">
      <p v-if="!outcome" class="text-sm text-ui-secondary">Сервер спочатку звірить стан рахунку в mono та наявність чека. Резерв звільниться, лише якщо підтверджено, що рахунок прострочено, оплати й чека немає.</p>
      <p v-if="pending" class="text-sm text-ui-secondary">Є збережений запит для цього продажу.</p>
      <BaseButton type="button" variant="danger-outline" size="lg" :loading="busy" :disabled="reading || storageError" @click="run">
        {{ !maySubmit ? 'Перечитати стан закриття' : pending ? 'Перевірити стан і повторити запит' : 'Перевірити й закрити продаж' }}
      </BaseButton>
    </template>
    <p v-if="storageError || feedback" role="alert" class="text-sm text-ui-danger">{{ storageError ? 'Збережений запит недоступний. Закриття заблоковано.' : feedback }}</p>
  </BaseCard>
</template>
