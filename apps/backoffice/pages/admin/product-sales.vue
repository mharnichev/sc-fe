<script setup lang="ts">
import { ArrowLeftIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import type { PosPage, PosSaleDetail, PosSaleSummary } from '~/types/posSale'
import { posBlockingReasons, posMoney } from '~/composables/usePosSale'
definePageMeta({ middleware: () => { const auth = useAuthStore(); if (!auth.user?.is_active || !auth.user.is_superuser) return navigateTo('/orders/pos') } })
const api = useApi(), auth = useAuthStore()
const route = useRoute()
const initialQuery = typeof route.query.q === 'string' ? route.query.q.trim().slice(0, 120) : ''
const query = ref(initialQuery), status = ref(''), employee = ref(''), from = ref(''), to = ref('')
const applied = ref<Record<string, string | number>>(initialQuery ? { q: initialQuery } : {}), page = ref(1)
const rows = shallowRef<PosPage<PosSaleSummary>>({items:[],total:0,page:1,page_size:20}), detail = shallowRef<PosSaleDetail | null>(null)
const reviewReasons = computed(() => posBlockingReasons(detail.value?.blocking_reasons))
const loading = ref(false), detailBusy = ref(false), error = ref(''), detailError = ref('')
let generation = 0, detailGeneration = 0
const date = (value: string | null) => value ? new Intl.DateTimeFormat('uk-UA',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Kyiv'}).format(new Date(value)) : '—'
const orderLabels: Record<string,string> = {pending:'Очікує',confirmed:'Підтверджено',paid:'Оплачено',completed:'Завершено',cancelled:'Скасовано'}
const paymentLabels: Record<string,string> = {not_started:'Не почато',pending:'Очікує',processing:'Перевіряється',paid:'Оплачено',failed:'Помилка',expired:'Строк минув',reversed:'Скасовано банком',unknown:'Потребує перевірки'}
const receiptLabels: Record<string,string> = {not_requested:'Ще немає',pending:'Обробляється',accepted:'Готовий',failed:'Помилка',requires_review:'Потребує перевірки'}
const handoverLabels: Record<string,string> = {not_ready:'Ще не видано',ready:'Можна видати',handed_over:'Видано'}
const workflowLabels: Record<string,string> = {prepared:'Підготовлено',creating_invoice:'Створюється QR',awaiting_payment:'Очікує оплати',payment_processing:'Оплата перевіряється',paid_receipt_pending:'Оплачено, очікує чека',ready_to_handover:'Готово до видачі',completed:'Завершено',requires_review:'Потрібна перевірка'}
const load = async (keepDetail = false) => {
 const v=++generation; loading.value=true;error.value=''
 if (!keepDetail) { detail.value=null;detailBusy.value=false;detailGeneration++ }
 if (!auth.user?.is_active || !auth.user.is_superuser) { rows.value={items:[],total:0,page:1,page_size:20};loading.value=false;return }
 try { const result=await api<PosPage<PosSaleSummary>>('/backoffice/pos/sales',{query:{...applied.value,page:page.value,page_size:20},retry:0,cache:'no-store'});if(v===generation)rows.value=result }
 catch { if(v===generation){rows.value={items:[],total:0,page:1,page_size:20};error.value='Історія продажів недоступна. Перевірте доступ або повторіть запит.'} }
 finally {if(v===generation)loading.value=false}
}
const apply = () => {
 if ((from.value && to.value && from.value>to.value) || (employee.value && (!/^\d+$/.test(employee.value)||Number(employee.value)<1))) return
 const next:Record<string,string|number>={}
 if(query.value.trim()) next.q=query.value.trim().slice(0,120)
 if(status.value) next.order_status=status.value
 if(employee.value) next.employee_user_id=Number(employee.value)
 if(from.value) next.date_from=from.value
 if(to.value) next.date_to=to.value
 applied.value=next;page.value=1;void load()
}
const open = async (id: number, reread = false) => {
 if (!auth.user?.is_active || !auth.user.is_superuser || !Number.isSafeInteger(id) || id <= 0 || detailBusy.value) return false
 const v = ++detailGeneration
 detailBusy.value = true
 error.value = ''; detailError.value = ''
 if (!reread) detail.value = null
 try {
  const result = await api<PosSaleDetail>(`/backoffice/pos/sales/${id}`, { retry: 0, cache: 'no-store' })
  if (result.order_id !== id || (reread && detail.value && result.revision < detail.value.revision)) throw new Error('Invalid sale detail')
  if (v !== detailGeneration) return false
  const statusChanged = reread && detail.value?.order_status !== result.order_status
  detail.value = result
  if (statusChanged) void load(true)
  return true
 } catch {
  if (v === detailGeneration) {
   if (reread) detailError.value = 'Не вдалося перечитати деталі продажу.'
   else error.value = 'Деталі продажу недоступні.'
  }
  return false
 } finally { if (v === detailGeneration) detailBusy.value = false }
}
const readDetail = async (id: number) => await open(id, true) ? detail.value : null
watch(()=>[auth.user?.id,auth.accessToken,auth.user?.is_active,auth.user?.is_superuser],()=>{generation++;detailGeneration++;rows.value={items:[],total:0,page:1,page_size:20};detail.value=null;detailBusy.value=false;void load()},{immediate:true,flush:'sync'})
onScopeDispose(()=>{generation++;detailGeneration++})
</script>
<template>
 <div class="mx-auto max-w-7xl space-y-4">
  <header class="flex flex-wrap items-center justify-between gap-2"><h1 class="text-2xl font-semibold">Продажі товарів</h1><NuxtLink to="/orders/pos" class="inline-flex min-h-11 items-center gap-2 text-sm underline"><ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />Продати товар</NuxtLink></header>
  <BaseCard><form class="space-y-3" @submit.prevent="apply"><div class="grid gap-3 md:grid-cols-3"><BaseInput v-model="query" type="search" label="Пошук продажу" placeholder="№, товар, SKU або працівник" maxlength="120" /><BaseSelect v-model="status" label="Статус замовлення" :options="[{value:'',label:'Усі'},...Object.entries(orderLabels).map(([value,label])=>({value,label}))]" /><BaseInput v-model="employee" label="ID працівника" inputmode="numeric" /></div><BaseDateRange v-model:date-from="from" v-model:date-to="to" from-label="Продажі з" to-label="Продажі до" /><BaseButton type="submit" variant="primary" size="lg" :loading="loading"><MagnifyingGlassIcon class="h-5 w-5" aria-hidden="true" />Застосувати фільтри</BaseButton><p class="text-xs text-ui-secondary">Дати створення продажу за Києвом. Статус замовлення відокремлено від оплати, чека й видачі.</p></form></BaseCard>
  <p v-if="error" role="alert" class="ui-status-warning rounded-xl p-3 text-sm">{{ error }}</p>
  <BaseTable caption="Історія реальних POS-продажів" min-width="68rem" :loading="loading" :empty="!rows.items.length" empty-title="Продажів не знайдено"><template #head><tr><th>Продаж / дата</th><th>Працівник</th><th>Товари</th><th>Сума</th><th>Замовлення</th><th>Оплата</th><th>Чек</th><th>Видача</th><th>Деталі</th></tr></template><tr v-for="sale in rows.items" :key="sale.order_id"><td>#{{ sale.order_id }}<span class="mt-1 block text-xs text-ui-secondary">{{ date(sale.created_at) }}</span></td><td>{{ sale.employee.display_name }}<span class="block text-xs text-ui-secondary">ID {{ sale.employee.user_id }}</span></td><td><p v-for="(item, index) in sale.items" :key="index" class="max-w-xs break-words text-sm">{{ item.name }} × {{ item.quantity }}</p></td><td>{{ posMoney(sale.amount_minor) }}</td><td>{{ orderLabels[sale.order_status] || sale.order_status }}</td><td>{{ paymentLabels[sale.payment_status] || sale.payment_status }}</td><td>{{ receiptLabels[sale.receipt_status] || sale.receipt_status }}</td><td>{{ handoverLabels[sale.handover_status] || sale.handover_status }}</td><td><BaseButton variant="neutral" size="lg" :disabled="detailBusy" :aria-label="`Деталі продажу #${sale.order_id}`" @click="open(sale.order_id)">Деталі</BaseButton></td></tr></BaseTable>
  <div class="flex items-center justify-between gap-2"><BaseButton variant="neutral" size="lg" :disabled="loading||page<=1" @click="page--;load()">Назад</BaseButton><span class="text-sm text-ui-secondary">{{ page }} / {{ Math.max(1,Math.ceil(rows.total/20)) }}</span><BaseButton variant="neutral" size="lg" :disabled="loading||page*20>=rows.total" @click="page++;load()">Далі</BaseButton></div>
  <BaseLoader v-if="detailBusy" label="Завантажуємо деталі продажу" />
  <BaseModal :model-value="!!detail" aria-label="Деталі продажу" @close="detailGeneration++;detailBusy=false;detail=null"><template #head="{close}"><div class="flex items-center justify-between gap-3"><h2 class="text-lg font-semibold">Продаж #{{ detail?.order_id }}</h2><ModalCloseButton @click="close" /></div></template><template #body><div v-if="detail" class="space-y-4"><p class="text-sm text-ui-secondary">{{ detail.source === 'quick_pos' ? 'Швидкий POS-продаж' : 'Існуючий реальний mono-продаж' }} · {{ detail.can_check_expired_close ? 'Доступна перевірка прострочення' : detail.invoice_recovery?.can_attach ? 'Доступна звірка рахунку' : 'Лише перегляд' }}</p><p>{{ detail.employee.display_name }} · {{ date(detail.created_at) }}</p><ul class="space-y-2"><li v-for="(item, index) in detail.items" :key="index" class="flex justify-between gap-3 border-b border-ui py-2"><span class="min-w-0 break-words">{{ item.name }} · {{ item.quantity }} шт.</span><strong class="shrink-0">{{ posMoney(item.total_minor) }}</strong></li></ul><p class="text-xl font-semibold">{{ posMoney(detail.amount_minor) }}</p><dl class="grid grid-cols-2 gap-3 text-sm"><div><dt class="text-ui-secondary">Стан продажу</dt><dd>{{ workflowLabels[detail.status] || detail.status }}</dd></div><div><dt class="text-ui-secondary">Статус замовлення</dt><dd>{{ orderLabels[detail.order_status] || detail.order_status }}</dd></div><div><dt class="text-ui-secondary">Оплата</dt><dd>{{ paymentLabels[detail.payment.status] }} · {{ date(detail.payment.confirmed_at) }}</dd></div><div><dt class="text-ui-secondary">Чек</dt><dd>{{ receiptLabels[detail.receipt.status] }} · {{ date(detail.receipt.recorded_at) }}</dd></div><div><dt class="text-ui-secondary">Видача</dt><dd>{{ handoverLabels[detail.handover.status] }} · {{ date(detail.handover.handed_over_at) }}</dd></div><div><dt class="text-ui-secondary">Хто видав</dt><dd>{{ detail.handover.actor_user_id ?? '—' }}</dd></div></dl>
  <div v-if="detail.status === 'requires_review'" class="space-y-1">
    <p v-for="reason in reviewReasons" :key="reason" class="text-sm text-ui-secondary">{{ reason }}</p>
    <BaseButton variant="ghost" size="lg" :loading="detailBusy" @click="open(detail.order_id, true)">Перечитати стан</BaseButton>
  </div>
  <p v-if="detailError" role="alert" class="text-sm text-ui-danger">{{ detailError }}</p>
  <PosExpiredSaleClose :key="`close-${detail.order_id}`" :sale="detail" :reading="detailBusy" :read-detail="readDetail" />
  <PosInvoiceRecovery v-if="detail.invoice_recovery && !detail.payment.invoice_id" :key="detail.order_id" :order-id="detail.order_id" :revision="detail.revision" :recovery="detail.invoice_recovery" :reading="detailBusy" :read-sale="() => open(detail?.order_id ?? 0, true)" />
  </div></template></BaseModal>
 </div>
</template>
