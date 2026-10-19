<script setup lang="ts">
import OrderReturnFactsMock from '~/components/orders/OrderReturnFactsMock.vue'
import type { FiscalMockDocument, FiscalMockReadiness, MockReturn, MockReturnCreate, OrderResponse } from '~/composables/useBackofficeApi'
import { fiscalMoney, fiscalDefinitiveRejections } from '~/utils/fiscalMock'
const props = defineProps<{ order: OrderResponse, refreshToken?: number }>()
const emit = defineEmits<{ changed: [] }>()
const api = useBackofficeApi(), auth = useAuthStore()
const command = useOrderSalesCommand<MockReturnCreate>('mock-return-create', () => String(props.order.id), fiscalDefinitiveRejections)
const returns = ref<MockReturn[]>([]), sales = ref<FiscalMockDocument[]>([]), readiness = shallowRef<FiscalMockReadiness | null>(null)
const parentId = ref(''), reason = ref(''), quantities = ref<Record<number, number | string | null>>({}), confirmed = ref(false), error = ref(''), loading = ref(false)
const parent = computed(() => sales.value.find(item => String(item.id) === parentId.value))
const enabled = computed(() => readiness.value?.available === true && readiness.value.mode === 'mock_only')
const canCreate = computed(() => enabled.value && sales.value.length > 0 && (auth.user?.is_superuser || auth.user?.can_record_sales === true))
const remaining = (item: { order_item_id: number, quantity: number }) => Math.max(0, item.quantity - returns.value.flatMap(record => record.items).filter(line => line.order_item_id === item.order_item_id).reduce((sum, line) => sum + line.quantity, 0))
const selected = computed(() => (parent.value?.snapshot.items || []).map(item => ({ order_item_id: item.order_item_id, quantity: Number(quantities.value[item.order_item_id] || 0) })).filter(item => item.quantity > 0))
const valid = computed(() => !!parent.value && !!reason.value.trim() && selected.value.length > 0 && selected.value.every(item => Number.isSafeInteger(item.quantity) && item.quantity <= remaining(parent.value!.snapshot.items.find(line => line.order_item_id === item.order_item_id)!)))
watch(() => JSON.stringify([auth.user?.id, props.order.id, parentId.value, quantities.value, reason.value]), () => { confirmed.value = false }, { flush: 'sync' })
watch(parentId, () => { quantities.value = {}; confirmed.value = false }, { flush: 'sync' })
let generation = 0, read = 0
const load = async () => {
  const version = generation, request = ++read, order = props.order.id
  loading.value = true; error.value = ''
  const result = await Promise.allSettled([api.getMockReturns(order), (auth.user?.is_superuser || auth.user?.can_record_sales) ? api.getFiscalMockDocuments(order) : Promise.resolve([]), api.getFiscalMockReadiness()])
  if (version !== generation || request !== read) return
  if (result[0].status === 'fulfilled' && Array.isArray(result[0].value)) returns.value = result[0].value
  else { returns.value = []; error.value = 'Не вдалося прочитати MOCK повернення. Нові записи заблоковано.' }
  if (result[1].status === 'fulfilled' && Array.isArray(result[1].value)) sales.value = result[1].value.filter(item => item.kind === 'sale' && item.order_id === order && item.document_kind === 'mock_fiscal_receipt' && item.status === 'issued' && item.simulation && !(item.snapshot && 'transport' in item.snapshot && item.snapshot.transport === 'provider_sandbox'))
  else { sales.value = []; error.value = 'Не вдалося прочитати вихідні MOCK чеки.' }
  readiness.value = result[2].status === 'fulfilled' ? result[2].value : null
  loading.value = false
}
watch([() => props.order.id, () => auth.user?.id], () => { generation++; read++; returns.value = []; sales.value = []; readiness.value = null; parentId.value = ''; quantities.value = {}; confirmed.value = false; reason.value = ''; if (import.meta.client && auth.user?.id) void load() }, { immediate: true, flush: 'sync' })
watch(() => props.refreshToken, () => { confirmed.value = false; if (import.meta.client && auth.user?.id) void load() })
const changed = async () => { await load(); emit('changed') }
const create = async () => {
  if (command.busy.value || !canCreate.value || loading.value || error.value || (!command.intent.value && (!valid.value || !confirmed.value))) return
  const version = generation, order = props.order.id
  const body = command.intent.value?.body || { parent_sale_id: parent.value!.id, items: selected.value, reason: reason.value.trim() }
  confirmed.value = false
  await command.execute(body, (payload, key) => api.createMockReturn(order, payload, key), async () => { if (version !== generation) return; command.clear(); quantities.value = {}; reason.value = ''; await changed() })
  if (version === generation && !command.intent.value && command.error.value) await load()
}
</script>
<template>
  <section aria-label="Повернення товарів MOCK" class="space-y-4 rounded-[1.75rem] border border-amber-200 bg-white p-6">
    <h2 class="text-xl font-semibold">Часткове повернення MOCK</h2>
    <p>Незмінний запис резервує кількість із виданого MOCK чека. Гроші, фіскальне повернення та фізичне приймання — три окремі факти. Оригінальний продаж не редагується.</p>
    <BaseButton :disabled="loading || command.busy.value" variant="neutral" @click="load">Оновити MOCK повернення</BaseButton>
    <template v-if="canCreate">
      <label>Вихідний виданий MOCK чек<BaseSelect v-model="parentId" native :disabled="command.busy.value || !!command.intent.value"><option value="">Оберіть чек</option><option v-for="sale in sales" :key="sale.id" :value="String(sale.id)">MOCK продаж #{{ sale.id }}</option></BaseSelect></label>
      <div v-for="item in parent?.snapshot.items || []" :key="item.order_item_id"><p>{{ item.name }} · доступно {{ remaining(item) }} з {{ item.quantity }}</p><BaseInput v-model="quantities[item.order_item_id]" type="number" :min="0" :max="remaining(item)" :step="1" :label="`Кількість повернення ${item.name || item.order_item_id}`" :disabled="command.busy.value || !!command.intent.value" /></div>
      <BaseInput v-model="reason" label="Причина MOCK повернення" :maxlength="500" :disabled="command.busy.value || !!command.intent.value" />
      <ul v-if="selected.length"><li v-for="item in selected" :key="item.order_item_id">Обрана позиція #{{ item.order_item_id }} · {{ item.quantity }}</li></ul>
      <BaseCheckbox v-if="!command.intent.value" v-model="confirmed" :disabled="!valid || loading || !!error" label="Фіксую незмінний MOCK запит повернення обраних кількостей. Продовжу окремо гроші, фіскальне повернення та приймання. Скасування фіскального погодження не звільняє кількість" />
      <BaseButton :disabled="command.busy.value || loading || !!error || (!command.intent.value && (!valid || !confirmed))" @click="create">{{ command.intent.value ? 'Повторити те саме створення MOCK повернення' : 'Створити незмінне MOCK повернення' }}</BaseButton>
    </template>
    <p v-if="!enabled">Нові операції заблоковано: MOCK режим недоступний.</p>
    <p v-if="error" role="alert">{{ error }}</p><p v-if="command.error.value" role="alert">{{ command.error.value }}</p>
    <OrderReturnFactsMock v-for="record in returns" :key="`${auth.user?.id}:${record.id}`" :record="record" :order="order" :refresh-token="refreshToken" :enabled="enabled" @changed="changed" />
    <p v-if="!loading && !returns.length">Записів MOCK повернення ще немає.</p>
  </section>
</template>
