<script setup lang="ts">
import type { MockCaseType, MockFiscalReport, MockReconciliation, FiscalMockReadiness } from '~/composables/useBackofficeApi'
import { fiscalMoney, fiscalDefinitiveRejections } from '~/utils/fiscalMock'
const props = defineProps<{ refreshToken?: number }>()
const emit = defineEmits<{ changed: [] }>()
const api = useBackofficeApi(), auth = useAuthStore()
const report = useOrderSalesCommand<{ kind: 'x' | 'z', expected_shift_revision: number, confirm: true }>('mock-fiscal-report', 'MOCK-KASA-1', fiscalDefinitiveRejections)
const ack = useOrderSalesCommand<{ case_type: MockCaseType, resource_id: string, evidence: string }>('mock-reconciliation-ack', 'global', fiscalDefinitiveRejections)
const reconciliation = shallowRef<MockReconciliation | null>(null), readiness = shallowRef<FiscalMockReadiness | null>(null), reports = ref<MockFiscalReport[]>([])
const error = ref(''), loading = ref(false), kind = ref<'x' | 'z'>('x'), confirmed = ref(false), evidence = ref(''), selected = ref('')
const busy = computed(() => report.busy.value || ack.busy.value), unresolved = computed(() => !!report.intent.value || !!ack.intent.value)
const permitted = computed(() => auth.user?.is_superuser || auth.user?.can_manage_fiscal_settings === true)
const register = computed(() => readiness.value?.cash_registers.find(item => item.id === 'MOCK-KASA-1'))
const enabled = computed(() => readiness.value?.available === true && readiness.value.mode === 'mock_only')
const cases = computed(() => Object.entries(reconciliation.value?.buckets || {}).flatMap(([type, items]) => items.map(item => ({ ...item, type: type as MockCaseType, key: `${type}:${item.resource_id}` }))))
const activeCase = computed(() => cases.value.find(item => item.key === selected.value))
const labels: Record<MockCaseType, string> = { automation_receipt_missing: 'ЕТТН без канонічного MOCK чека', payments_without_receipts: 'Оплати без MOCK чека', receipts_without_basis: 'MOCK чеки без підстави', unknown: 'Невідомий результат', refund_pending: 'Очікує грошей', fiscal_return_pending: 'Очікує фіскального повернення', receipt_pending: 'Очікує фізичного приймання', open_shifts: 'Відкриті MOCK зміни' }
let generation = 0, read = 0
const load = async () => {
  const version = generation, request = ++read
  loading.value = true; error.value = ''
  const result = await Promise.allSettled([api.getMockReconciliation(), api.getFiscalMockReadiness(), permitted.value ? api.getMockFiscalReports('MOCK-KASA-1') : Promise.resolve([])])
  if (version !== generation || request !== read) return
  reconciliation.value = result[0].status === 'fulfilled' && result[0].value.buckets && result[0].value.totals ? result[0].value : null
  readiness.value = result[1].status === 'fulfilled' ? result[1].value : null
  reports.value = result[2].status === 'fulfilled' && Array.isArray(result[2].value) ? result[2].value : []
  if (result.some(item => item.status === 'rejected')) error.value = 'Не вдалося прочитати поточну MOCK звірку або звіти. Оновіть дані.'
  loading.value = false
}
watch(() => auth.user?.id, () => { generation++; read++; reconciliation.value = null; readiness.value = null; reports.value = []; selected.value = ''; evidence.value = ''; confirmed.value = false; if (import.meta.client && auth.user?.id) void load() }, { immediate: true, flush: 'sync' })
watch([kind, () => register.value?.shift_revision, () => register.value?.shift_status], () => { confirmed.value = false }, { flush: 'sync' })
watch(() => props.refreshToken, () => { confirmed.value = false; if (import.meta.client && auth.user?.id) void load() })
const runReport = async () => {
  if (!permitted.value || !enabled.value || busy.value || (!report.intent.value && (unresolved.value || !confirmed.value || register.value?.shift_status !== 'open'))) return
  const version = generation
  const body = report.intent.value?.body || { kind: kind.value, expected_shift_revision: register.value!.shift_revision, confirm: true as const }
  confirmed.value = false
  await report.execute(body, (payload, key) => api.createMockFiscalReport('MOCK-KASA-1', payload, key), async () => { if (version !== generation) return; report.clear(); await load(); if (version === generation) emit('changed') })
  if (version === generation && !report.intent.value && report.error.value) await load()
}
const acknowledge = async () => {
  if (!enabled.value || busy.value || (!ack.intent.value && (unresolved.value || !activeCase.value || !evidence.value.trim()))) return
  const version = generation
  const body = ack.intent.value?.body || { case_type: activeCase.value!.type, resource_id: activeCase.value!.resource_id, evidence: evidence.value.trim() }
  await ack.execute(body, (payload, key) => api.acknowledgeMockReconciliation(payload, key), async () => { if (version !== generation) return; ack.clear(); evidence.value = ''; await load(); if (version === generation) emit('changed') })
}
</script>
<template>
  <section aria-label="Звірка та X Z звіти MOCK" class="space-y-4 rounded-[1.75rem] border border-violet-200 bg-white p-6">
    <h2 class="text-xl font-semibold">Поточна звірка та X/Z MOCK</h2>
    <p>Звіти не надсилаються до ДПС. Підтвердження розбіжності додає незмінний аудит і не усуває саму розбіжність.</p>
    <BaseButton :disabled="loading || busy" variant="neutral" @click="load">Оновити MOCK звірку та звіти</BaseButton>
    <p v-if="reconciliation">{{ reconciliation.notice }} · продажі {{ fiscalMoney(reconciliation.totals.sales_minor) }} · зарезервовані повернення {{ fiscalMoney(reconciliation.totals.reserved_returns_minor) }} · гроші {{ fiscalMoney(reconciliation.totals.refunds_minor) }} · фіскальні повернення {{ fiscalMoney(reconciliation.totals.fiscal_returns_minor) }}</p>
    <article v-for="item in cases" :key="item.key"><h3>{{ labels[item.type] }} · #{{ item.resource_id }} · {{ fiscalMoney(item.amount_minor) }}</h3><p v-for="entry in item.acknowledgements" :key="entry.id">Аудит #{{ entry.id }} · оператор {{ entry.actor_id }} · {{ entry.evidence }}</p></article>
    <template v-if="enabled">
      <label>Поточна розбіжність MOCK<BaseSelect v-model="selected" native :disabled="busy || unresolved"><option value="">Оберіть розбіжність</option><option v-for="item in cases" :key="item.key" :value="item.key">{{ labels[item.type] }} #{{ item.resource_id }}</option></BaseSelect></label>
      <BaseInput v-model="evidence" label="Доказ перевірки розбіжності MOCK" :maxlength="500" :disabled="busy || unresolved" />
      <BaseButton :disabled="busy || (!ack.intent.value && (unresolved || !activeCase || !evidence.trim()))" @click="acknowledge">{{ ack.intent.value ? 'Повторити той самий аудит MOCK' : 'Зафіксувати перевірку розбіжності MOCK' }}</BaseButton>
      <template v-if="permitted"><label>Тип звіту MOCK<BaseSelect v-model="kind" native :disabled="busy || unresolved"><option value="x">X — поточний підсумок</option><option value="z">Z — закрити MOCK зміну</option></BaseSelect></label>
      <BaseCheckbox v-model="confirmed" :disabled="busy || unresolved || register?.shift_status !== 'open'" :label="`Підтверджую ${kind.toUpperCase()} звіт MOCK каси MOCK-KASA-1, revision ${register?.shift_revision}${kind === 'z' ? ' та закриття MOCK зміни' : ''}`" />
      <BaseButton :disabled="busy || (!report.intent.value && (unresolved || !confirmed || register?.shift_status !== 'open'))" @click="runReport">{{ report.intent.value ? 'Повторити той самий X/Z звіт MOCK' : 'Створити X/Z звіт MOCK' }}</BaseButton></template>
    </template>
    <article v-for="item in reports" :key="item.id"><h3>{{ item.kind.toUpperCase() }} MOCK #{{ item.id }} · revision {{ item.shift_revision }}</h3><p>Продажі {{ item.totals.sale_count }} / {{ fiscalMoney(item.totals.sales_minor) }} · повернення {{ item.totals.return_count }} / {{ fiscalMoney(item.totals.returns_minor) }} · підсумок {{ fiscalMoney(item.totals.net_minor) }}</p><p>{{ item.notice }}</p></article>
    <p v-for="entry in reconciliation?.acknowledgements || []" :key="`audit-${entry.id}`">Незмінний аудит #{{ entry.id }} · {{ labels[entry.case_type] }} #{{ entry.resource_id }} · {{ entry.evidence }}</p>
    <p v-for="message in [error, report.error.value, ack.error.value].filter(Boolean)" :key="message" role="alert">{{ message }}</p>
  </section>
</template>
