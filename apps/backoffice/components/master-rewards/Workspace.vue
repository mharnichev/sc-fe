<script setup lang="ts">
import { GiftIcon, PlusIcon, ArrowPathIcon, CheckCircleIcon } from '@heroicons/vue/24/outline'
import RewardPeriodFilter from './RewardPeriodFilter.vue'
import RewardEntries from './RewardEntries.vue'
import RewardSettlementHistory from './RewardSettlementHistory.vue'
import RewardTransferModal from './RewardTransferModal.vue'
import RewardReviewModal from './RewardReviewModal.vue'
import type { RewardCandidate, RewardEntry, RewardMaster, RewardPage, RewardPolicy, RewardPreview, RewardSelection, RewardSettlement, RewardSummary } from '~/types/masterRewards'
import type { RewardEntryView, RewardSettlementView } from '~/types/masterRewardsView'
import { rewardDate, rewardMoney, rewardPercent, rewardRange, parseRewardRate } from '~/utils/masterRewardsView'
import { rewardError } from '~/composables/useMasterRewardsCommand'
const props = defineProps<{ admin: boolean }>()
const auth = useAuthStore(), api = useApi(), command = useMasterRewardsCommand()
const root = '/backoffice/master-rewards'
const permitted = computed(() => !!auth.user?.is_active && (!props.admin || !!auth.user.is_superuser))
const range = ref(rewardRange('month')), masterId = ref(''), page = ref(1), historyPage = ref(1)
const paidFrom = ref(''), paidTo = ref('')
const entries = ref<RewardEntry[]>([]), summaries = ref<RewardSummary[]>([]), settlements = ref<RewardSettlement[]>([]), masters = ref<RewardMaster[]>([])
const total = ref(0), historyTotal = ref(0), policy = ref<RewardPolicy | null>(null)
const loading = ref(false), error = ref(''), notice = ref('')
const selected = ref<number[]>([]), rateDraft = ref(''), policyReason = ref(''), unsetRate = ref(false)
const orderInput = ref(''), candidates = ref<RewardCandidate[]>([]), candidateId = ref(''), beneficiaryId = ref(''), entryReason = ref('')
const candidateBusy = ref(false), candidateError = ref('')
const reviewEntry = ref<RewardEntryView | null>(null)
const preview = ref<RewardPreview | null>(null), previewBusy = ref(false), previewError = ref(''), previewSelection = ref<RewardSelection | null>(null)
const previewViews = ref<RewardEntryView[]>([]), previewMasterName = ref('')
const locked = computed(() => loading.value || previewBusy.value || command.busy.value || command.storageFault.value || !!command.saved.value)
let generation = 0, candidateGeneration = 0
onScopeDispose(() => { generation++; candidateGeneration++ })
const viewEntry = (e: RewardEntry): RewardEntryView => ({ id: e.id, orderId: e.order_id, product: e.product_name, soldAt: e.sold_at, quantity: e.quantity, basisMinor: e.base_minor, rateBps: e.rate_bps, rewardMinor: e.reward_minor, state: e.status, needsReview: e.needs_review, canSettle: e.status === 'pending' && !e.needs_review && e.settlement_id == null })
const entryViews = computed(() => entries.value.map(viewEntry))
const historyViews = computed<RewardSettlementView[]>(() => settlements.value.map(s => ({ id: s.id, master: s.master_name, amountMinor: s.total_minor, handedAt: s.paid_at, recordedAt: s.created_at, entryIds: s.entry_ids })))
const selectedEntries = computed(() => entries.value.filter(e => selected.value.includes(e.id)))
const selectedViews = computed(() => selectedEntries.value.map(viewEntry))
const selectionTotal = computed(() => selectedEntries.value.reduce((sum, e) => sum + e.reward_minor, 0))
const selectedMaster = computed(() => masters.value.find(m => m.id === Number(masterId.value)))
const currentCandidate = computed(() => candidates.value.find(c => c.order_item_id === Number(candidateId.value)))
const managementScope = () => props.admin ? { master_id: masterId.value ? Number(masterId.value) : undefined } : {}
const read = <T,>(path: string, query: Record<string, string | number | undefined> = {}) => api<T>(`${root}${path}`, { query, cache: 'no-store', retry: 0 })
const load = async () => {
  const request = ++generation
  selected.value = []; preview.value = null; previewSelection.value = null
  if (!permitted.value) { entries.value = []; summaries.value = []; settlements.value = []; masters.value = []; policy.value = null; return }
  loading.value = true; error.value = ''
  try {
    const prefix = props.admin ? '' : '/me'
    const query = { ...managementScope(), date_from: range.value.from, date_to: range.value.to }
    const [e, s, h, p, m] = await Promise.all([
      read<RewardPage<RewardEntry>>(`${prefix}/entries`, { ...query, page: page.value, page_size: 20 }),
      read<{ currency: 'UAH', items: RewardSummary[] }>(`${prefix}/summary`, query),
      read<RewardPage<RewardSettlement>>(`${prefix}/settlements`, { ...managementScope(), date_from: paidFrom.value || undefined, date_to: paidTo.value || undefined, page: historyPage.value, page_size: 20 }),
      props.admin ? read<RewardPolicy>('/policy') : Promise.resolve(null),
      props.admin ? read<{ items: RewardMaster[] }>('/masters') : Promise.resolve({ items: [] }),
    ])
    if (request !== generation) return
    entries.value = e.items; total.value = e.total; summaries.value = s.items; settlements.value = h.items; historyTotal.value = h.total; policy.value = p; masters.value = m.items
  }
  catch (cause) { if (request === generation) { entries.value = []; summaries.value = []; settlements.value = []; policy.value = null; error.value = rewardError(cause) } }
  finally { if (request === generation) loading.value = false }
}
watch([() => auth.user?.id, permitted], () => {
  entries.value = []; summaries.value = []; settlements.value = []; masters.value = []; policy.value = null; selected.value = []; preview.value = null; previewSelection.value = null
  candidates.value = []; candidateId.value = ''; beneficiaryId.value = ''; entryReason.value = ''; orderInput.value = ''; candidateError.value = ''; notice.value = ''; policyReason.value = ''; rateDraft.value = ''; masterId.value = ''; paidFrom.value = ''; paidTo.value = ''; reviewEntry.value = null
  candidateGeneration++; page.value = 1; historyPage.value = 1; void load()
}, { immediate: true, flush: 'sync' })
const applyRange = (value: { from: string, to: string }) => { range.value = value; page.value = 1; void load() }
const changeMaster = () => { page.value = 1; historyPage.value = 1; void load() }
const run = async (body: Parameters<typeof command.execute>[0]) => {
  notice.value = ''
  if (await command.execute(body)) { notice.value = 'Запис збережено.'; candidates.value = []; candidateId.value = ''; entryReason.value = ''; policyReason.value = ''; rateDraft.value = ''; reviewEntry.value = null; preview.value = null; await load() }
  else if (!command.saved.value) await load()
}
const savePolicy = () => {
  if (locked.value || !policy.value || !policyReason.value.trim()) return
  const rate = unsetRate.value ? null : parseRewardRate(rateDraft.value)
  if (!unsetRate.value && rate == null) return
  return run({ kind: 'policy', method: 'PUT', path: '/policy', body: { expected_revision: policy.value.revision, rate_bps: rate, reason: policyReason.value.trim() } })
}
watch(orderInput, () => { candidateGeneration++; candidates.value = []; candidateId.value = ''; candidateError.value = ''; candidateBusy.value = false })
const findCandidates = async () => {
  if (locked.value || candidateBusy.value || !/^\d+$/.test(orderInput.value) || Number(orderInput.value) < 1) return
  const request = ++candidateGeneration
  candidateBusy.value = true; candidateError.value = ''; candidates.value = []; candidateId.value = ''
  try {
    const result = await read<{ items: RewardCandidate[], currency: 'UAH' }>('/candidates', { order_id: Number(orderInput.value) })
    if (request === candidateGeneration) candidates.value = result.items
  }
  catch (cause) { if (request === candidateGeneration) candidateError.value = rewardError(cause) }
  finally { if (request === candidateGeneration) candidateBusy.value = false }
}
const accrue = () => {
  const c = currentCandidate.value
  if (locked.value || !c || policy.value?.rate_bps == null || !beneficiaryId.value || !entryReason.value.trim()) return
  return run({ kind: 'entry', method: 'POST', path: '/entries', body: { order_id: c.order_id, order_item_id: c.order_item_id, master_id: Number(beneficiaryId.value), expected_order_revision: c.order_revision, expected_policy_revision: policy.value.revision, reason: entryReason.value.trim() } })
}
const toggle = (id: number) => {
  if (locked.value || !masterId.value) return
  const e = entries.value.find(item => item.id === id)
  if (!e || !viewEntry(e).canSettle || e.master_id !== Number(masterId.value)) return
  selected.value = selected.value.includes(id) ? selected.value.filter(value => value !== id) : [...selected.value, id]
  preview.value = null
}
const prepareTransfer = async () => {
  if (locked.value || previewBusy.value || !masterId.value || !selectedEntries.value.length || selectionTotal.value <= 0) return
  const request = generation
  const selection: RewardSelection = { master_id: Number(masterId.value), entries: selectedEntries.value.map(e => ({ id: e.id, expected_revision: e.revision })), expected_total_minor: selectionTotal.value }
  const snapshot = selectedViews.value.map(entry => ({ ...entry }))
  const masterName = selectedMaster.value?.name || ''
  previewBusy.value = true; previewError.value = ''
  try {
    const result = await api<RewardPreview>(`${root}/settlements/preview`, { method: 'POST', body: selection, headers: { 'Idempotency-Key': crypto.randomUUID() }, retry: 0, cache: 'no-store' })
    if (request !== generation) return
    if (result.master_id !== selection.master_id || result.total_minor !== selection.expected_total_minor || [...result.entry_ids].sort((a,b) => a-b).join(',') !== selection.entries.map(e => e.id).sort((a,b) => a-b).join(',')) { previewError.value = 'Склад перевірки змінився. Оновіть дані.'; return }
    previewSelection.value = selection; previewViews.value = snapshot; previewMasterName.value = masterName; preview.value = result
  }
  catch (cause) { if (request === generation) previewError.value = rewardError(cause) }
  finally { previewBusy.value = false }
}
const transfer = (actualDate: string, reason: string) => {
  if (command.saved.value) return recover()
  if (!preview.value || !previewSelection.value || !reason.trim() || locked.value) return
  const date = new Date(actualDate)
  if (Number.isNaN(date.getTime()) || date.getTime() > Date.now()) { previewError.value = 'Вкажіть фактичну дату та час у минулому.'; return }
  return run({ kind: 'settlement', method: 'POST', path: '/settlements', body: { ...previewSelection.value, paid_at: date.toISOString(), reason: reason.trim(), manual_payment_confirmed: true } })
}
const review = (reason: string) => {
  if (command.saved.value) return recover()
  const e = entries.value.find(e => e.id === reviewEntry.value?.id)
  if (locked.value || !e || !reason.trim()) return
  return run({ kind: 'review', method: 'POST', path: `/entries/${e.id}/review`, body: { expected_revision: e.revision, needs_review: !e.needs_review, reason: reason.trim() } })
}
const recover = async () => { if (await command.execute(undefined, true)) { notice.value = 'Результат збереженої операції підтверджено.'; reviewEntry.value = null; preview.value = null; await load() } }
</script>
<template>
  <div class="rewards-workspace mx-auto max-w-6xl space-y-4" data-private="true" data-sentry-mask>
    <header class="flex flex-wrap items-center justify-between gap-3"><div><h1 class="flex items-center gap-2 text-2xl font-semibold"><GiftIcon class="h-6 w-6" aria-hidden="true" />{{ admin ? 'Винагороди майстрів' : 'Мої продажі та винагорода' }}</h1><p class="mt-2 text-sm text-ui-secondary">Внутрішній ручний облік продажів товарів. Гроші передаються поза системою.</p></div><BaseButton variant="neutral" size="lg" :disabled="loading || previewBusy || command.busy.value" @click="load"><ArrowPathIcon class="h-5 w-5" aria-hidden="true" />Оновити</BaseButton></header>
    <p v-if="!permitted" role="alert" class="rounded-xl bg-amber-50 p-4 text-amber-900">Немає доступу. Керування доступне лише активному адміністратору з правами superuser.</p>
    <template v-else>
      <div v-if="command.saved.value" role="status" class="space-y-3 rounded-xl bg-amber-50 p-4 text-amber-900"><p>Результат команди «{{ command.saved.value.kind }}» не підтверджено. Нові дії заблоковано. Відновлення перевірить збережений результат або повторить той самий запит без зміни складу та суми.</p><BaseButton variant="primary" size="lg" :loading="command.busy.value" @click="recover">Відновити збережену операцію</BaseButton></div>
      <p v-if="command.error.value" role="alert" class="break-words text-sm text-ui-danger">{{ command.error.value }}</p>
      <p v-if="error" role="alert" class="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{{ error }}</p>
      <p v-if="notice" role="status" class="text-sm text-ui-secondary">{{ notice }}</p>
      <RewardPeriodFilter :from="range.from" :to="range.to" :disabled="locked || previewBusy" @apply="applyRange" />
      <section v-if="admin" class="rounded-2xl border border-ui p-4">
        <h2 class="font-semibold">Ставка для нових ручних нарахувань</h2><p class="mt-2 text-sm">{{ policy?.rate_bps == null ? 'Ставка не задана' : `Поточна ставка: ${rewardPercent(policy.rate_bps)}` }}</p>
        <details class="mt-2"><summary class="min-h-11 cursor-pointer py-3 text-sm font-medium">Задати або змінити ставку</summary><form class="mt-2 space-y-3" @submit.prevent="savePolicy"><p class="text-sm text-ui-secondary">Застосовується лише до нових ручних нарахувань. Історія не перераховується; старі замовлення автоматично не нараховуються.</p><BaseCheckbox v-model="unsetRate" :disabled="locked">Прибрати ставку для майбутніх нарахувань</BaseCheckbox><BaseInput v-if="!unsetRate" v-model="rateDraft" label="Ставка, % (0–100)" inputmode="decimal" placeholder="Вкажіть явно" :disabled="locked" /><BaseInput v-model="policyReason" label="Підстава зміни ставки" required maxlength="1000" :disabled="locked" /><BaseButton type="submit" variant="primary" size="lg" :disabled="locked || !policy || !policyReason.trim() || (!unsetRate && parseRewardRate(rateDraft) == null)">Зберегти ставку</BaseButton></form></details>
      </section>
      <section v-if="admin" class="rounded-2xl border border-ui p-4"><h2 class="font-semibold">Нарахувати за конкретну позицію</h2><p class="mt-2 text-sm text-ui-secondary">Лише існуючий завершений, оплачений і виданий продаж. Мастер-продавець обирається явно.</p><details class="mt-2"><summary class="min-h-11 cursor-pointer py-3 text-sm font-medium"><PlusIcon class="mr-1 inline h-4 w-4" aria-hidden="true" />Ручне нарахування</summary>
        <div class="mt-2 space-y-3"><form class="flex items-end gap-2" @submit.prevent="findCandidates"><BaseInput v-model="orderInput" label="Номер існуючого замовлення" inputmode="numeric" class="min-w-0" :disabled="locked || candidateBusy" /><BaseButton type="submit" variant="neutral" size="lg" :loading="candidateBusy" :disabled="locked || !/^\d+$/.test(orderInput)">Знайти позиції</BaseButton></form>
        <p v-if="candidateError" role="alert" class="text-sm text-ui-danger">{{ candidateError }}</p>
        <p v-if="orderInput && !candidateBusy && !candidates.length && !candidateError" class="text-sm text-ui-secondary">Шукайте позиції замовлення. Якщо список порожній, доступних для нарахування позицій немає.</p>
        <form v-if="candidates.length" class="space-y-3" @submit.prevent="accrue"><label class="grid min-w-0 gap-1.5 text-sm"><span>Позиція продажу</span><select v-model="candidateId"  :disabled="locked" aria-label="Позиція продажу" class="base-control min-h-11 w-full min-w-0 px-3 py-2 text-sm"><option value="">Оберіть позицію</option><option v-for="c in candidates" :key="c.order_item_id" :value="String(c.order_item_id)">{{ c.product_name }} · {{ c.quantity }} шт. · {{ rewardMoney(c.base_minor) }}</option></select></label><p v-if="currentCandidate" class="text-sm text-ui-secondary">Продано {{ rewardDate(currentCandidate.sold_at) }}. База після знижок: {{ rewardMoney(currentCandidate.base_minor) }}.</p><label class="grid min-w-0 gap-1.5 text-sm"><span>Майстер-продавець</span><select v-model="beneficiaryId"  :disabled="locked" aria-label="Майстер-продавець" class="base-control min-h-11 w-full min-w-0 px-3 py-2 text-sm"><option value="">Оберіть майстра явно</option><option v-for="m in masters" :key="m.id" :value="String(m.id)">{{ m.name }}</option></select></label><BaseInput v-model="entryReason" label="Підстава ручного нарахування" required maxlength="1000" :disabled="locked" /><BaseButton type="submit" variant="primary" size="lg" :disabled="locked || !currentCandidate || !beneficiaryId || !entryReason.trim() || policy?.rate_bps == null">Нарахувати за вибрану позицію</BaseButton></form></div>
      </details></section>
      <section class="space-y-3 rounded-2xl border border-ui p-4"><h2 class="font-semibold">Підсумки за датами продажів</h2><label v-if="admin" class="grid min-w-0 gap-1.5 text-sm"><span>Майстер для перегляду та передачі</span><select v-model="masterId"  :disabled="locked || previewBusy" @change="changeMaster" aria-label="Майстер для перегляду та передачі" class="base-control min-h-11 w-full min-w-0 px-3 py-2 text-sm"><option value="">Усі майстри</option><option v-for="m in masters" :key="m.id" :value="String(m.id)">{{ m.name }}</option></select></label>
        <p v-if="loading" role="status" class="text-sm text-ui-secondary">Завантаження…</p>
        <p v-if="!loading && !summaries.length" class="text-sm text-ui-secondary">За вибраний період даних немає.</p>
        <BaseTable v-if="admin && summaries.length" caption="Винагороди майстрів за період" class="hidden md:block" min-width="640px"><template #head><tr><th>Майстер</th><th>Продажі</th><th>Нараховано</th><th>Передано</th><th>Залишок</th></tr></template><tr v-for="s in summaries" :key="s.master_id"><td><BaseButton variant="ghost" class="min-h-11 text-left" :disabled="locked" @click="masterId = String(s.master_id); changeMaster()">{{ s.master_name }}</BaseButton></td><td>{{ rewardMoney(s.sales_net_minor) }}<span class="block text-xs text-ui-secondary">{{ s.sales_count }} продажів · {{ s.units }} шт.</span></td><td>{{ rewardMoney(s.accrued_minor) }}</td><td>{{ rewardMoney(s.transferred_minor) }}</td><td>{{ rewardMoney(s.balance_minor) }}<span v-if="s.held_minor" class="block text-xs text-amber-700">На розгляді: {{ rewardMoney(s.held_minor) }}</span></td></tr></BaseTable>
        <article v-for="s in summaries" :key="s.master_id" :class="admin ? 'md:hidden' : ''" class="rounded-xl bg-ui-subtle p-3"><p v-if="admin" class="mb-2 font-semibold">{{ s.master_name }}</p><dl class="grid grid-cols-2 gap-3 lg:grid-cols-5"><div><dt class="text-xs text-ui-secondary">Продажі · {{ s.sales_count }}</dt><dd class="mt-1 text-sm font-medium">{{ rewardMoney(s.sales_net_minor) }}</dd></div><div><dt class="text-xs text-ui-secondary">Нараховано</dt><dd class="mt-1 text-sm font-medium">{{ rewardMoney(s.accrued_minor) }}</dd></div><div><dt class="text-xs text-ui-secondary">Передано</dt><dd class="mt-1 text-sm font-medium">{{ rewardMoney(s.transferred_minor) }}</dd></div><div><dt class="text-xs text-ui-secondary">Очікується</dt><dd class="mt-1 text-sm font-medium">{{ rewardMoney(s.pending_minor) }}</dd></div><div><dt class="text-xs text-ui-secondary">Залишок</dt><dd class="mt-1 text-sm font-medium">{{ rewardMoney(s.balance_minor) }}</dd></div></dl><p v-if="s.held_minor" class="mt-2 text-xs text-amber-700">Потребує рішення: {{ rewardMoney(s.held_minor) }}. Це частина залишку, не борг і не утримання.</p></article>
      </section>
      <section class="space-y-3"><h2 class="font-semibold">Нарахування за товари</h2><p v-if="admin && !masterId" class="text-sm text-ui-secondary">Для вибору нарахувань спочатку оберіть одного майстра.</p><RewardEntries :entries="entryViews" :selected="selected" :admin="admin" :disabled="locked" :selection-disabled="!masterId" @toggle="toggle" @review="reviewEntry = $event" />
        <div class="flex flex-wrap items-center justify-between gap-2"><BaseButton variant="neutral" size="lg" :disabled="locked || page <= 1" @click="page--; load()">Назад</BaseButton><span class="text-sm">{{ page }} / {{ Math.max(1, Math.ceil(total / 20)) }}</span><BaseButton variant="neutral" size="lg" :disabled="locked || page * 20 >= total" @click="page++; load()">Далі</BaseButton></div>
        <div v-if="admin" class="rounded-xl border border-ui p-3"><p class="text-sm">Обрано: {{ selected.length }} · {{ rewardMoney(selectionTotal) }}</p><BaseButton variant="primary" size="lg" block class="mt-3" :loading="previewBusy" :disabled="locked || !selected.length || selectionTotal <= 0" @click="prepareTransfer"><CheckCircleIcon class="h-5 w-5" aria-hidden="true" />Перевірити передачу</BaseButton><p v-if="previewError" role="alert" class="mt-2 text-sm text-ui-danger">{{ previewError }}</p></div>
      </section>
      <section class="space-y-3"><details class="rounded-2xl border border-ui p-4"><summary class="min-h-8 cursor-pointer text-sm font-medium">Окремий фільтр за датами передачі</summary><form class="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]" @submit.prevent="historyPage = 1; load()"><BaseInput v-model="paidFrom" type="date" label="Передачі з" :disabled="locked" /><BaseInput v-model="paidTo" type="date" label="Передачі до" :disabled="locked" /><BaseButton type="submit" variant="neutral" size="lg" :disabled="locked || (!!paidFrom && !!paidTo && paidFrom > paidTo)">Застосувати до історії</BaseButton></form></details><RewardSettlementHistory :settlements="historyViews" /><div v-if="historyTotal > 20" class="flex justify-between gap-2"><BaseButton variant="neutral" size="lg" :disabled="locked || historyPage <= 1" @click="historyPage--; load()">Попередні передачі</BaseButton><BaseButton variant="neutral" size="lg" :disabled="locked || historyPage * 20 >= historyTotal" @click="historyPage++; load()">Наступні передачі</BaseButton></div></section>
      <template v-if="admin">
      <RewardTransferModal v-if="preview" :model-value="!!preview" :entries="previewViews" :master-name="previewMasterName" :amount-minor="preview.total_minor" :pending="command.busy.value" :recoverable="!!command.saved.value" :error="previewError || command.error.value" @close="preview = null" @confirm="transfer" />
      <RewardReviewModal :entry="reviewEntry" :pending="command.busy.value" :recoverable="!!command.saved.value" :error="command.error.value" @close="reviewEntry = null" @confirm="review" /></template>
    </template>
  </div>
</template>
<style scoped>
.rewards-workspace :deep(input:not([type='checkbox'])) { font-size: 16px; }
</style>
