<script setup lang="ts">
import type { Product } from '~/composables/useBackofficeApi'
import type { InventoryManualOperationCreate } from '~/types/inventory'
import { createInventoryIdempotencyKey, inventoryApiErrorMessage } from '~/utils/inventory'

definePageMeta({
  middleware: () => {
    const auth = useAuthStore()
    if (!auth.user?.is_superuser && auth.user?.role !== 'admin') return navigateTo('/dashboard')
  },
})

type OperationType = 'opening-balance' | 'receipt' | 'customer-return' | 'write-off'
const api = useBackofficeApi()
const route = useRoute()
const router = useRouter()
const toast = useBaseToastNotification()
const { apiErrorMessage } = useBookingFormatting()
const operationOptions = [
  { value: 'opening-balance', label: 'Початковий залишок' }, { value: 'receipt', label: 'Надходження' },
  { value: 'customer-return', label: 'Повернення від клієнта' }, { value: 'write-off', label: 'Списання' },
]
const writeOffReasons = [
  { value: 'damaged', label: 'Пошкоджено' }, { value: 'expired', label: 'Прострочено' }, { value: 'tester', label: 'Тестер' },
  { value: 'salon use', label: 'Використано в салоні' }, { value: 'other', label: 'Інше' },
]
const selectedProduct = ref<Product | null>(null)
const productSearch = ref('')
const products = ref<Product[]>([])
const productsPending = ref(false)
const form = reactive({ type: 'receipt' as OperationType, quantity: 1, reason: '', writeOffOtherReason: '', barcode: '', order_id: '', order_item_id: '' })
const confirmOpen = ref(false)
const pending = ref(false)
const errorMessage = ref('')
const idempotencyKey = ref('')
const selectedProductId = computed(() => {
  const candidate = Number(route.query.product_id)
  return Number.isInteger(candidate) && candidate > 0 ? candidate : null
})

const resetIdempotencyKey = () => { idempotencyKey.value = createInventoryIdempotencyKey() }
resetIdempotencyKey()

const loadSelectedProduct = async () => {
  if (!selectedProductId.value || selectedProduct.value?.id === selectedProductId.value) return
  try { selectedProduct.value = await api.getProduct(selectedProductId.value) }
  catch (cause) { errorMessage.value = apiErrorMessage(cause, 'Не вдалося завантажити вибраний товар.') }
}
watch(selectedProductId, loadSelectedProduct, { immediate: true })
const searchProducts = async () => {
  productsPending.value = true
  errorMessage.value = ''
  try { products.value = (await api.getProducts(1, 20, { search: productSearch.value.trim() || undefined })).items }
  catch (cause) { errorMessage.value = apiErrorMessage(cause, 'Не вдалося знайти товари.') }
  finally { productsPending.value = false }
}
const chooseProduct = async (product: Product) => { selectedProduct.value = product; await router.replace({ query: { ...route.query, product_id: String(product.id) } }) }
const operationLabel = computed(() => operationOptions.find(option => option.value === form.type)?.label || form.type)
const requiresOtherReason = computed(() => form.type === 'write-off' && form.reason === 'other')
const reasonValue = computed(() => requiresOtherReason.value ? form.writeOffOtherReason.trim() : form.reason.trim())
const isValid = computed(() => Boolean((selectedProduct.value || form.barcode.trim()) && Number.isInteger(form.quantity) && form.quantity > 0 && reasonValue.value))
const openConfirmation = () => { if (pending.value || !isValid.value) return; errorMessage.value = ''; confirmOpen.value = true }
const performOperation = async () => {
  if (pending.value || !isValid.value) return
  pending.value = true
  errorMessage.value = ''
  try {
    const details = {
      quantity: form.quantity,
      reason: reasonValue.value,
      order_id: form.order_id ? Number(form.order_id) : undefined,
      order_item_id: form.order_item_id ? Number(form.order_item_id) : undefined,
    }
    const payload: InventoryManualOperationCreate = selectedProduct.value
      ? { product_id: selectedProduct.value.id, ...details }
      : { barcode: form.barcode.trim(), ...details }
    await api.createInventoryOperation(form.type, payload, idempotencyKey.value)
    toast.success(`${operationLabel.value} зафіксовано.`)
    confirmOpen.value = false
    form.quantity = 1; form.reason = ''; form.writeOffOtherReason = ''; form.barcode = ''; form.order_id = ''; form.order_item_id = ''
    resetIdempotencyKey()
  }
  catch (cause) { errorMessage.value = inventoryApiErrorMessage(cause, 'Не вдалося виконати операцію. Повторіть із тим самим ключем лише якщо результат невідомий.'); toast.error(errorMessage.value) }
  finally { pending.value = false }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4"><div><p class="ui-eyebrow text-sm uppercase tracking-[0.3em]">Склад</p><h1 class="mt-2 text-3xl font-semibold text-ui-primary">Ручна операція</h1><p class="mt-2 text-sm text-ui-secondary">Операція одразу змінює склад і потрапляє в журнал руху.</p></div><NuxtLink to="/inventory" class="base-button base-button--neutral min-h-10 px-4 py-2 text-sm">До складу</NuxtLink></div>
    <BaseCard as="section" padding="sm" class="space-y-4"><form class="flex flex-wrap gap-3" @submit.prevent="searchProducts"><BaseInput v-model="productSearch" type="search" class="min-w-[min(100%,22rem)] flex-1" placeholder="Знайти товар" aria-label="Пошук товару для операції" /><BaseButton type="submit" variant="neutral" :loading="productsPending">Знайти</BaseButton></form><div v-if="products.length" class="grid gap-2 md:grid-cols-2 xl:grid-cols-3"><BaseButton v-for="product in products" :key="product.id" variant="neutral" class="justify-start text-left" @click="chooseProduct(product)">{{ product.name }} <span class="ml-2 text-ui-muted">#{{ product.id }}</span></BaseButton></div><p v-if="selectedProduct" class="text-sm text-ui-secondary">Вибрано: <strong class="text-ui-primary">{{ selectedProduct.name }}</strong> · #{{ selectedProduct.id }}</p></BaseCard>
    <form class="grid gap-5 rounded-[1.75rem] border border-ui-border bg-ui-surface p-6" @submit.prevent="openConfirmation">
      <div class="grid gap-4 md:grid-cols-2"><label class="grid gap-2 text-sm font-medium text-ui-primary">Тип операції<BaseSelect v-model="form.type" :options="operationOptions" /></label><label class="grid gap-2 text-sm font-medium text-ui-primary">Кількість<BaseInput v-model.number="form.quantity" type="number" min="1" step="1" required /></label></div>
      <label v-if="!selectedProduct" class="grid gap-2 text-sm font-medium text-ui-primary">Штрихкод товару<BaseInput v-model="form.barcode" maxlength="64" placeholder="Вкажіть, якщо товар не вибрано" /></label>
      <label class="grid gap-2 text-sm font-medium text-ui-primary">Причина<BaseSelect v-if="form.type === 'write-off'" v-model="form.reason" :options="writeOffReasons" /><BaseInput v-else v-model="form.reason" required maxlength="255" placeholder="Причина операції обов’язкова" /><BaseInput v-if="requiresOtherReason" v-model="form.writeOffOtherReason" required maxlength="255" placeholder="Вкажіть іншу причину" /></label>
      <div class="grid gap-4 md:grid-cols-2"><label class="grid gap-2 text-sm font-medium text-ui-primary">Замовлення (необов’язково)<BaseInput v-model="form.order_id" type="number" min="1" /></label><label class="grid gap-2 text-sm font-medium text-ui-primary">Позиція замовлення (необов’язково)<BaseInput v-model="form.order_item_id" type="number" min="1" /></label></div>
      <p class="rounded-2xl bg-ui-subtle p-4 text-sm text-ui-secondary">Для звірки залишків немає загальної операції коригування. Проведіть <NuxtLink to="/inventory/counts" class="font-semibold text-ui-accent hover:underline">інвентаризацію</NuxtLink> та зафіксуйте її результат.</p>
      <p v-if="errorMessage" class="text-sm text-ui-danger" role="alert">{{ errorMessage }}</p>
      <BaseButton type="submit" variant="primary" :disabled="!isValid || pending" :loading="pending">Продовжити до підтвердження</BaseButton>
    </form>
    <ConfirmActionModal v-model="confirmOpen" title="Підтвердити операцію складу" :message="'Операція змінить залишок і не може бути скасована через цей екран.'" confirm-label="Зафіксувати операцію" :pending="pending" :destructive="form.type === 'write-off'" :context-items="[{ label: 'Тип', value: operationLabel }, { label: 'Товар', value: selectedProduct?.name || form.barcode }, { label: 'Кількість', value: String(form.quantity) }, { label: 'Причина', value: reasonValue }]" @confirm="performOperation" />
  </div>
</template>
