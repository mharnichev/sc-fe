<script setup lang="ts">
import type { InventoryProduct, InventoryReceiptItem, ReceiptAllocation } from '~/types/inventory'

const props = defineProps<{
  modelValue: boolean
  item: InventoryReceiptItem | null
  product?: InventoryProduct | null
  posted: boolean
  pending: boolean
  locked: boolean
  error?: string
}>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  save: [payload: { quantity: number, purchase_unit_cost: string, reason: string, allocations?: ReceiptAllocation[] }]
  remove: []
  retry: []
}>()

const quantity = ref<number | string | null>(null)
const cost = ref<string | number | null>('')
const reason = ref<string | number | null>('')
const validationError = ref('')
const confirmingRemove = ref(false)
const allocations = ref<ReceiptAllocation[]>([])
const disabled = computed(() => props.pending || props.locked)
const normalizedCost = computed(() => String(cost.value ?? '').trim().replace(',', '.'))
const validCost = computed(() => /^\d+(?:\.\d{1,2})?$/.test(normalizedCost.value)
  && Number.isFinite(Number(normalizedCost.value)) && Number(normalizedCost.value) <= 99999999.99)
const validQuantity = computed(() => Number.isSafeInteger(Number(quantity.value)) && String(quantity.value ?? '').trim() !== '' && Number(quantity.value) >= (props.posted ? 0 : 1) && Number(quantity.value) <= 1000000)
const lineTotal = computed(() => validQuantity.value && validCost.value
  ? (Number(quantity.value) * Number(normalizedCost.value)).toFixed(2)
  : null)

watch([() => props.modelValue, () => props.item?.id], ([open]) => {
  if (!open) return
  quantity.value = props.item?.effective_quantity ?? props.item?.quantity ?? null
  cost.value = props.item?.effective_purchase_unit_cost ?? props.item?.purchase_unit_cost ?? ''
  reason.value = ''
  validationError.value = ''
  allocations.value = props.item?.allocations.map(a => ({ ...a })) ?? []
  confirmingRemove.value = false
}, { immediate: true })

const close = () => {
  if (!props.pending) emit('update:modelValue', false)
}
const save = () => {
  if (disabled.value || !props.item) return
  if (!validQuantity.value) { validationError.value = 'Вкажіть цілу кількість від 1 до 1 000 000 (для сторнування проведеної позиції — 0).'; return }
  if (!validCost.value) { validationError.value = 'Вкажіть невід’ємну собівартість з не більше ніж двома знаками після коми.'; return }
  const trimmedReason = String(reason.value ?? '').trim()
  if (props.posted && !trimmedReason) { validationError.value = 'Вкажіть причину зміни проведеного приймання.'; return }
  if (!props.posted && (allocations.value.some(a => !Number.isInteger(Number(a.quantity)) || Number(a.quantity) < 0) || allocations.value.reduce((sum, a) => sum + Number(a.quantity), 0) > Number(quantity.value))) { validationError.value = 'Розподіли мають бути цілими невід’ємними та не перевищувати кількість.'; return }
  validationError.value = ''
  emit('save', { quantity: Number(quantity.value), purchase_unit_cost: Number(normalizedCost.value).toFixed(2), reason: trimmedReason, ...(!props.posted ? { allocations: allocations.value.filter(a => Number(a.quantity) > 0).map(a => ({ order_item_id: a.order_item_id, quantity: Number(a.quantity) })) } : {}) })
}
</script>

<template>
  <BaseModal :model-value="modelValue" style="--modal-bg: var(--bo-surface)" aria-label="Редагування позиції приймання" :close-on-backdrop="!pending" :close-on-escape="!pending" max-width-class="max-w-lg" @update:model-value="!$event && close()">
    <template #head><h2 class="text-lg font-semibold">Редагування позиції</h2></template>
    <template #body>
      <div v-if="item" class="space-y-4">
        <InventoryProductCard v-if="product" :product="product" :framed="false" :show-stock="false" />
        <p v-else class="font-semibold">Товар #{{ item.product_id }} · {{ item.barcode || 'Без штрихкоду' }}</p>
        <p class="rounded-xl bg-ui-subtle p-3 text-sm text-ui-secondary">Зараз: {{ item.effective_quantity ?? item.quantity }} од. × {{ item.effective_purchase_unit_cost ?? item.purchase_unit_cost }} грн</p>
        <p v-if="posted" class="text-sm text-ui-secondary">Коригування зберігає оригінал та історію. Зменшення кількості можливе лише за наявності вільного залишку та без подальших витрат чи резервів. 0 — сторнувати позицію.</p>
        <p v-if="posted && item.allocations.length" class="text-sm text-ui-secondary">У замовлення вже розподілено {{ item.allocations.reduce((sum, a) => sum + a.quantity, 0) }} од. Кількість не може бути меншою; розподіли проведеного документа не змінюються.</p>
        <p v-if="error" role="alert" class="text-sm text-ui-danger">{{ error }}</p>
        <template v-if="locked">
          <p class="text-sm text-ui-secondary">Результат попереднього запиту невідомий. Повторіть його з тими самими даними.</p>
          <BaseButton variant="primary" type="button" class="min-h-11 w-full" :loading="pending" @click="emit('retry')">Повторити запит</BaseButton>
          <BaseButton variant="neutral" class="min-h-11 w-full" :disabled="pending" @click="close">Повернутися</BaseButton>
        </template>
        <template v-else-if="confirmingRemove">
          <p class="font-medium">Видалити цю позицію з чернетки?</p>
          <BaseButton variant="danger" type="button" class="min-h-11 w-full" :loading="pending" @click="emit('remove')">Так, видалити</BaseButton>
          <BaseButton variant="neutral" type="button" class="min-h-11 w-full" :disabled="pending" @click="confirmingRemove = false">Скасувати</BaseButton>
        </template>
        <form v-else class="space-y-4" @submit.prevent="save">
          <BaseInput v-model="quantity" type="number" :min="posted ? 0 : 1" max="1000000" step="1" inputmode="numeric" label="Кількість, од." required :disabled="disabled" />
          <BaseInput v-model="cost" inputmode="decimal" label="Собівартість за одиницю, грн" required :disabled="disabled" />
          <fieldset v-if="!posted && allocations.length" :disabled="disabled" class="space-y-2 rounded-xl bg-ui-subtle p-3"><legend class="text-sm font-medium">Розподіл на замовлення</legend><div v-for="allocation in allocations" :key="allocation.order_item_id"><BaseInput v-model.number="allocation.quantity" type="number" min="0" step="1" :label="`Позиція замовлення #${allocation.order_item_id}`" inputmode="numeric" /></div><p class="text-xs text-ui-secondary">0 — прибрати розподіл. Сума не може перевищувати кількість товару.</p></fieldset>
          <BaseInput v-if="posted" v-model="reason" label="Причина зміни" maxlength="255" required :disabled="disabled" />
          <p class="font-semibold">Нова сума рядка: {{ lineTotal === null ? '—' : `${lineTotal} грн` }}</p>
          <p v-if="validationError" role="alert" class="text-sm text-ui-danger">{{ validationError }}</p>
          <BaseButton variant="primary" type="submit" class="min-h-11 w-full" :loading="pending">Зберегти зміни</BaseButton>
          <BaseButton v-if="!posted" variant="danger-outline" type="button" class="min-h-11 w-full" :disabled="disabled" @click="confirmingRemove = true">Видалити позицію</BaseButton>
          <BaseButton variant="neutral" type="button" class="min-h-11 w-full" :disabled="disabled" @click="close">Повернутися</BaseButton>
        </form>
      </div>
    </template>
  </BaseModal>
</template>
