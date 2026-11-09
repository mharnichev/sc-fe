<script setup lang="ts">
import { LinkIcon } from '@heroicons/vue/24/outline'
import type { PosInvoiceRecovery } from '~/types/posSale'
import { closedPosAttachmentKey, salesErrorDetail } from '~/utils/orderSales'

const props = defineProps<{ orderId: number; revision: number; recovery: PosInvoiceRecovery; reading?: boolean; readSale: () => Promise<boolean> }>()
const api = useApi({ refreshOnUnauthorized: false })
const auth = useAuthStore()
const { formatDateTime } = useBookingFormatting()
const draft = ref('')
const rejectedRevision = ref<number | null>(null)
const failure = ref('')
const needsFreshRead = ref(false)
const invoicePattern = /^[A-Za-z0-9_-]{1,100}$/
const identityRejections = ['master_mono_recovery_mismatch', 'master_mono_identity_conflict', 'master_mono_recovery_invoice_not_found']
const unavailable = ['master_mono_request_required', 'master_mono_disabled', 'master_mono_profile_conflict', 'master_mono_fiscal_policy_required']
const rejections = [...identityRejections, ...unavailable, 'idempotency_conflict']
type AttachRequest = { invoice_id: string; expected_revision: number }
const command = useOrderSalesCommand<AttachRequest>('pos-attach-invoice', () => String(props.orderId), rejections)
const pending = computed(() => command.intent.value?.body)
const invoice = computed(() => pending.value?.invoice_id ?? draft.value.trim())
const pendingRevision = computed(() => pending.value?.expected_revision)
const requiresRead = computed(() => needsFreshRead.value || rejectedRevision.value === props.revision)
const isAllowed = computed(() => {
  const user = auth.user
  return props.recovery.can_attach === true && !!user?.is_active && !!auth.accessToken
    && (user.is_superuser || (user.can_manage_fiscal_settings === true && !user.master_id && !['barber', 'master'].includes(user.role || '')))
    && Number.isSafeInteger(props.revision) && props.revision > 0
})
const canAttach = computed(() => isAllowed.value && !requiresRead.value && !props.reading && !command.busy.value && typeof invoice.value === 'string' && invoicePattern.test(invoice.value)
  && (!pending.value || pendingRevision.value === props.revision))

watch([() => props.revision, pendingRevision, command.busy], ([revision, expected, busy]) => {
  if (!busy && expected !== undefined && Number.isSafeInteger(revision) && revision > expected) {
    command.clear()
    failure.value = 'Стан продажу змінився. Перевірте дані рахунку перед повторною прив’язкою.'
  }
})

const read = async () => {
  if (await props.readSale()) needsFreshRead.value = false
}

const attach = async () => {
  if (!canAttach.value) return
  const orderId = props.orderId, revision = props.revision, submittedInvoice = invoice.value
  const actor = auth.user?.id, token = auth.accessToken
  if (!actor) return
  const sameSession = () => actor === auth.user?.id && token === auth.accessToken && orderId === props.orderId
  let reread: 'fresh' | 'newer' | undefined, rejectCandidate = false
  failure.value = ''
  if (!navigator.locks) {
    failure.value = 'Відкрийте POS в актуальному браузері для безпечної прив’язки.'
    return
  }
  await navigator.locks.request(`sc-pos:v1:${actor}`, { ifAvailable: true }, async lock => {
    if (!lock) {
      failure.value = 'Інша дія з продажем ще триває. Дочекайтеся її завершення.'
      return
    }
    if (!sameSession() || !isAllowed.value || revision !== props.revision) return
    try {
      if (localStorage.getItem(closedPosAttachmentKey(actor, orderId)) !== null) {
        failure.value = 'Продаж закрито. Перечитуємо його стан.'
        reread = 'newer'
        return
      }
    } catch {
      failure.value = 'Сховище недоступне. Прив’язку заблоковано.'
      return
    }
    await command.execute({ invoice_id: submittedInvoice, expected_revision: revision }, async (body, key) => {
      if (body.invoice_id !== submittedInvoice) {
        failure.value = 'В іншій вкладці збережено інший рахунок. Перевірте його перед явним повтором.'
        throw new Error('Different saved attachment')
      }
      if (!sameSession() || !isAllowed.value || body.expected_revision !== props.revision) throw new Error('Stale attachment')
      try {
        const result = await api<{ order_id: number; invoice_id: string | null; revision: number }>(`/backoffice/master-mono/orders/${orderId}/recover-invoice`, {
          method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0, cache: 'no-store',
        })
        if (result.order_id !== orderId || result.invoice_id !== body.invoice_id || !Number.isSafeInteger(result.revision) || result.revision <= body.expected_revision) throw new Error('Invalid attachment response')
        return { id: result.order_id }
      } catch (cause) {
        if (!sameSession()) throw cause
        const { code } = salesErrorDetail(cause)
        const status = (cause as { response?: { status?: number } })?.response?.status
        if (code === 'revision_conflict' || code === 'idempotency_conflict') {
          failure.value = 'Стан продажу змінився. Перечитуємо збережені дані.'
          reread = 'newer'
        } else if (status === 409 && code === 'master_mono_recovery_url_required') {
          failure.value = 'Mono підтвердив рахунок. Оригінальне посилання для оплати недоступне. Перечитайте стан продажу.'
          reread = 'fresh'
        } else if (code && identityRejections.includes(code)) {
          failure.value = 'Не вдалося підтвердити цей рахунок для продажу. Перевірте ID та дані в mono.'
          rejectCandidate = code === 'master_mono_recovery_invoice_not_found' && status === 404
          reread = 'fresh'
        } else if ((code && unavailable.includes(code)) || status === 401 || status === 403 || status === 404) {
          failure.value = 'Прив’язка зараз недоступна. Перечитуємо стан продажу.'
          reread = 'newer'
        }
        throw cause
      }
    }, () => {
      if (!sameSession()) return
      if (command.intent.value?.body.invoice_id !== submittedInvoice) {
        failure.value = 'В іншій вкладці збережено інший рахунок. Перечитайте стан продажу.'
        reread = 'newer'
        return
      }
      command.clear()
      reread = 'newer'
    })
  })
  if (!reread || !sameSession()) return
  if (rejectCandidate && command.intent.value?.body.invoice_id === submittedInvoice) command.clear()
  if (reread === 'newer') rejectedRevision.value = revision
  else needsFreshRead.value = true
  await read()
}
</script>

<template>
  <BaseCard as="section" variant="subtle" padding="sm" class="space-y-2" aria-label="Звірка рахунку mono">
    <h3 class="flex items-center gap-2 text-sm font-semibold"><LinkIcon class="h-4 w-4 shrink-0" aria-hidden="true" />Звірка рахунку mono</h3>
    <dl class="grid gap-1 text-xs sm:grid-cols-2">
      <div><dt class="text-ui-secondary">Reference у mono</dt><dd class="break-all font-medium">{{ recovery.reference }}</dd></div>
      <div><dt class="text-ui-secondary">Час запиту</dt><dd class="font-medium">{{ formatDateTime(recovery.requested_at) }}</dd></div>
    </dl>
    <p v-if="!isAllowed" class="text-sm text-ui-secondary">Прив’язка зараз недоступна.</p>
    <template v-else>
      <p class="text-sm text-ui-secondary">Знайдіть цей запит у mono за reference і часом. Введіть ID вже створеного рахунку.</p>
      <form class="flex flex-wrap items-end gap-2" @submit.prevent="attach">
        <BaseInput class="min-w-0 flex-1" :model-value="pending?.invoice_id ?? draft" label="ID рахунку mono" :maxlength="100" :disabled="!!pending || command.busy.value || requiresRead || reading" autocomplete="off" @update:model-value="draft = String($event ?? '')" />
        <BaseButton variant="neutral" size="lg" type="submit" :disabled="!canAttach" :loading="command.busy.value">
          {{ pending ? 'Повторити прив’язку' : 'Прив’язати наявний рахунок' }}
        </BaseButton>
      </form>
      <p v-if="failure || command.error.value" role="alert" class="text-sm text-ui-danger">{{ failure || 'Результат прив’язки не підтверджено. Перечитайте стан або повторіть той самий запит.' }}</p>
      <BaseButton v-if="requiresRead || pending" variant="ghost" size="lg" :disabled="command.busy.value || reading" @click="read">Перечитати збережений стан</BaseButton>
    </template>
  </BaseCard>
</template>
