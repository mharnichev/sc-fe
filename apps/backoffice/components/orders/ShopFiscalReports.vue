<script setup lang="ts">
import { shopFiscalPrefix, shopFiscalMoney, shopFiscalReason, shopFiscalRejected, useShopFiscalRead } from '~/utils/shopFiscal'
import type { ShopFiscalRegister, ShopFiscalReport } from '~/utils/shopFiscal'
const props = defineProps<{ refreshToken?: number }>()
const emit = defineEmits<{ changed: [] }>()
const auth = useAuthStore(), api = useApi()
type Operation = 'open' | 'close' | 'x' | 'z'
type Body = { expected_shift_revision: number, confirm: true }
const open = useOrderSalesCommand<Body>('shop-fiscal-open', 'SHOP-MOCK-KASA-1', shopFiscalRejected)
const close = useOrderSalesCommand<Body>('shop-fiscal-close', 'SHOP-MOCK-KASA-1', shopFiscalRejected)
const x = useOrderSalesCommand<Body>('shop-fiscal-x', 'SHOP-MOCK-KASA-1', shopFiscalRejected)
const z = useOrderSalesCommand<Body>('shop-fiscal-z', 'SHOP-MOCK-KASA-1', shopFiscalRejected)
const commands = { open, close, x, z }
const list = [open, close, x, z]
const context = () => JSON.stringify([auth.user, props.refreshToken])
const read = useShopFiscalRead<ShopFiscalRegister>(context, () => auth.user?.id ? api(`${shopFiscalPrefix}/register`, { retry: 0 }) : Promise.reject(new Error('No actor')), value => value.id === 'SHOP-MOCK-KASA-1' && Number.isSafeInteger(value.shift_revision) && !!value.actions && Array.isArray(value.reports))
const { state, loading, error } = read
const busy = computed(() => list.some(command => command.busy.value)), unresolved = computed(() => list.some(command => command.intent.value))
const kind = ref<'x' | 'z'>('x'), shiftConfirmed = ref(false), reportConfirmed = ref(false)
watch([context, kind, () => state.value?.shift_revision, () => state.value?.shift_status], () => { shiftConfirmed.value = false; reportConfirmed.value = false }, { flush: 'sync' })
const canRun = (operation: Operation) => !!state.value && !loading.value && !busy.value && !(unresolved.value && !commands[operation].intent.value) && state.value.actions[commands[operation].intent.value ? `replay_${operation}` : operation] === true
const send = async (operation: Operation) => {
  const command = commands[operation]
  if (!canRun(operation) || !state.value || (!command.intent.value && !(operation === 'open' || operation === 'close' ? shiftConfirmed.value : reportConfirmed.value))) return
  const version = read.version(), target = operation === 'open' || operation === 'close' ? `/shift/${operation}` : `/reports/${operation}`
  await command.execute({ expected_shift_revision: state.value.shift_revision, confirm: true }, async (body, key) => {
    const result = await api<ShopFiscalRegister | ShopFiscalReport>(shopFiscalPrefix + target, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
    return { id: typeof result.id === 'number' ? result.id : 1 }
  }, async () => {
    if (!read.current(version)) return
    if (!await read.load()) throw new Error('Canonical read unavailable')
    if (!read.current(version)) return
    command.clear(); shiftConfirmed.value = false; reportConfirmed.value = false; emit('changed')
  })
  if (read.current(version) && !command.intent.value && command.error.value) await read.load()
}
</script>
<template>
  <section aria-label="Зміна та X/Z магазину" class="space-y-4 rounded-[1.75rem] border border-violet-200 bg-white p-6">
    <h2 class="text-xl font-semibold">Зміна та X/Z магазину</h2>
    <p class="rounded-xl bg-amber-100 p-3 font-semibold text-amber-950" role="status">ТЕСТОВА КАСА · документи та звіти не надсилаються до ДПС.</p>
    <BaseButton variant="neutral" :disabled="loading || busy" @click="read.load">Оновити зміну та звіти</BaseButton>
    <template v-if="state">
      <p>{{ state.id }} · зміна {{ state.shift_status === 'open' ? 'відкрита' : 'закрита' }} · revision {{ state.shift_revision }}</p>
      <p v-for="reason in state.blocking_reasons" :key="reason">{{ shopFiscalReason(reason) }}</p>
      <BaseCheckbox v-model="shiftConfirmed" :disabled="busy || loading || unresolved" :label="`Підтверджую ${state.shift_status === 'open' ? 'закриття' : 'відкриття'} тестової зміни revision ${state.shift_revision}`" />
      <div class="flex flex-wrap gap-3">
        <BaseButton v-for="operation in (['open','close'] as const)" v-show="state.actions[operation] || commands[operation].intent.value" :key="operation" :disabled="!canRun(operation) || (!commands[operation].intent.value && !shiftConfirmed)" @click="send(operation)">{{ commands[operation].intent.value ? 'Повторити те саме ' : '' }}{{ operation === 'open' ? 'Відкрити тестову зміну' : 'Закрити тестову зміну' }}</BaseButton>
      </div>
      <BaseSelect id="shop-fiscal-report-kind" v-model="kind" label="Тип тестового звіту" aria-labelledby="shop-fiscal-report-kind-label" native :disabled="busy || unresolved"><option value="x">X — поточний підсумок</option><option value="z">Z — підсумок і закриття зміни</option></BaseSelect>
      <BaseCheckbox v-model="reportConfirmed" :disabled="busy || loading || unresolved" :label="`Підтверджую ${kind.toUpperCase()} тестовий звіт revision ${state.shift_revision}${kind === 'z' ? ' та закриття зміни' : ''}`" />
      <BaseButton :disabled="!canRun(kind) || (!commands[kind].intent.value && !reportConfirmed)" @click="send(kind)">Створити {{ kind.toUpperCase() }} тестовий звіт</BaseButton>
      <BaseButton v-for="operation in (['x','z'] as const)" v-show="commands[operation].intent.value" :key="operation" :disabled="!canRun(operation)" @click="send(operation)">Повторити той самий {{ operation.toUpperCase() }} звіт</BaseButton>
      <article v-if="state.reconciliation" class="space-y-2 rounded-xl bg-slate-50 p-4" aria-label="Звірка зміни магазину"><h3 class="font-semibold">Незавершені факти зміни</h3><p>Документи: {{ state.reconciliation.pending_document_ids.join(', ') || 'немає' }}</p><p>Оплати без виданого чека: {{ state.reconciliation.unreceipted_payment_ids.join(', ') || 'немає' }}</p><p>Незавершені повернення: {{ state.reconciliation.unresolved_return_ids.join(', ') || 'немає' }}</p><p>Незавершені повернення НП: {{ (state.reconciliation.carrier_return_case_ids || []).join(', ') || 'немає' }}</p><p>Невідомі результати: {{ state.reconciliation.unknown_document_ids.join(', ') || 'немає' }}</p></article>
      <article v-for="report in state.reports" :key="report.id" :aria-label="`Тестовий звіт ${report.kind.toUpperCase()} #${report.id}`" class="border-t pt-3"><h3 class="font-semibold">{{ report.kind.toUpperCase() }} тестовий #{{ report.id }} · revision {{ report.shift_revision }}</h3><p>Продажі {{ report.totals.sale_count }} / {{ shopFiscalMoney(report.totals.sales_minor) }} · повернення {{ report.totals.return_count }} / {{ shopFiscalMoney(report.totals.returns_minor) }} · підсумок {{ shopFiscalMoney(report.totals.net_minor) }}</p><p>{{ report.notice }}</p></article>
    </template>
    <p v-for="message in [error, ...list.map(command => command.error.value)].filter(Boolean)" :key="message" role="alert">{{ message }}</p>
  </section>
</template>
