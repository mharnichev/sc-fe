<script setup lang="ts">
import { ArrowsRightLeftIcon, ChatBubbleBottomCenterTextIcon, CheckIcon, CubeIcon, ListBulletIcon, MagnifyingGlassIcon, QrCodeIcon, ShoppingBagIcon } from '@heroicons/vue/24/outline'
import type { Product } from '~/composables/useBackofficeApi'
import type { InventoryManualOperationCreate } from '~/types/inventory'
import { createInventoryIdempotencyKey, inventoryApiErrorMessage } from '~/utils/inventory'

provide('compactFieldHints', true)

definePageMeta({
  middleware: () => {
    const auth = useAuthStore()
    if (!auth.user?.is_superuser && !auth.user?.can_post_inventory) return navigateTo('/dashboard')
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
const formSnapshot = () => JSON.stringify([form, selectedProduct.value?.id || Number(route.query.product_id) || null, productSearch.value])
const savedForm = ref(formSnapshot())
const hasUnsavedChanges = computed(() => formSnapshot() !== savedForm.value)
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
    savedForm.value = formSnapshot()
    resetIdempotencyKey()
  }
  catch (cause) { errorMessage.value = inventoryApiErrorMessage(cause, 'Не вдалося виконати операцію. Повторіть із тим самим ключем лише якщо результат невідомий.'); toast.error(errorMessage.value) }
  finally { pending.value = false }
}
</script>

<template>
  <div class="inventory-page space-y-3 sm:space-y-4">
    <div><div class="flex min-w-0 items-center gap-1"><h1 class="flex items-center gap-2 text-2xl font-semibold text-ui-primary sm:text-3xl"><ArrowsRightLeftIcon class="h-6 w-6 shrink-0" aria-hidden="true" />Ручна операція</h1><BaseFieldHelp text="Операція одразу змінює склад і потрапляє в журнал руху." label="Про сторінку" /></div></div>
    <InventorySectionNav />
    <InventoryUnsavedChangesGuard :dirty="hasUnsavedChanges" :busy="pending" />
    <BaseCard as="section" padding="sm" class="space-y-3 sm:space-y-4"><form class="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4" @submit.prevent="searchProducts"><BaseInput v-model="productSearch" type="search" field-class="min-w-0" label="Пошук товару" hint="Введіть назву товару або артикул SKU." aria-description="Введіть назву або артикул SKU." placeholder="Знайти товар" aria-label="Пошук товару для операції" ><template #icon><MagnifyingGlassIcon class="h-4 w-4" aria-hidden="true" /></template></BaseInput><BaseButton class="min-h-11" type="submit" variant="neutral" :loading="productsPending"><MagnifyingGlassIcon class="h-4 w-4 shrink-0" aria-hidden="true" />Знайти</BaseButton></form><div v-if="products.length" class="grid gap-2 md:grid-cols-2 xl:grid-cols-3"><BaseButton v-for="product in products" :key="product.id" variant="neutral" class="justify-start text-left" @click="chooseProduct(product)">{{ product.name }} <span class="ml-2 text-ui-muted">#{{ product.id }}</span></BaseButton></div><p v-if="selectedProduct" class="text-sm text-ui-secondary">Вибрано: <strong class="text-ui-primary">{{ selectedProduct.name }}</strong> · #{{ selectedProduct.id }}</p></BaseCard>
    <BaseCard as="section" padding="sm">
      <form class="grid gap-4" @submit.prevent="openConfirmation">
        <div class="grid gap-4 sm:grid-cols-2">
          <BaseSelect v-model="form.type" label="Тип операції" :options="operationOptions" hint="Операція змінить залишок після підтвердження." ><template #icon><ArrowsRightLeftIcon class="h-4 w-4" aria-hidden="true" /></template></BaseSelect>
          <BaseInput v-model.number="form.quantity" label="Кількість" hint="Кількість одиниць для цієї операції." type="number" inputmode="numeric" min="1" step="1" required ><template #icon><CubeIcon class="h-4 w-4" aria-hidden="true" /></template></BaseInput>
        </div>
        <BaseInput v-if="!selectedProduct" v-model="form.barcode" label="Штрихкод товару" hint="Введіть код або виберіть товар через пошук вище." maxlength="64" placeholder="Штрихкод" ><template #icon><QrCodeIcon class="h-4 w-4" aria-hidden="true" /></template></BaseInput>
        <BaseSelect v-if="form.type === 'write-off'" v-model="form.reason" label="Причина списання" :options="writeOffReasons" hint="Оберіть причину для історії складських операцій." ><template #icon><ChatBubbleBottomCenterTextIcon class="h-4 w-4" aria-hidden="true" /></template></BaseSelect>
        <BaseInput v-else v-model="form.reason" label="Причина" hint="Коротко поясніть причину операції." required maxlength="255" placeholder="Наприклад, повернення клієнта" ><template #icon><ChatBubbleBottomCenterTextIcon class="h-4 w-4" aria-hidden="true" /></template></BaseInput>
        <BaseInput v-if="requiresOtherReason" v-model="form.writeOffOtherReason" label="Інша причина" hint="Опишіть причину своїми словами." required maxlength="255" ><template #icon><ChatBubbleBottomCenterTextIcon class="h-4 w-4" aria-hidden="true" /></template></BaseInput>
        <details class="rounded-xl border border-ui-border px-3">
          <summary class="flex min-h-11 cursor-pointer items-center text-sm font-medium text-ui-primary">Зв’язок із замовленням · необов’язково</summary>
          <div class="grid grid-cols-2 gap-4 pb-3">
            <BaseInput v-model="form.order_id" label="Номер замовлення" hint="ID замовлення, якщо операція пов’язана з ним." type="number" inputmode="numeric" min="1" ><template #icon><ShoppingBagIcon class="h-4 w-4" aria-hidden="true" /></template></BaseInput>
            <BaseInput v-model="form.order_item_id" label="Номер позиції" hint="ID рядка в цьому замовленні." type="number" inputmode="numeric" min="1" ><template #icon><ListBulletIcon class="h-4 w-4" aria-hidden="true" /></template></BaseInput>
          </div>
        </details>
        <div class="flex items-center gap-2 text-xs"><NuxtLink to="/inventory/counts" class="font-semibold text-ui-accent hover:underline">Інвентаризація</NuxtLink><BaseFieldHelp text="Щоб звірити фактичну кількість із залишками, проведіть інвентаризацію." label="Коли потрібна інвентаризація" /></div>
        <p v-if="errorMessage" class="text-sm text-ui-danger" role="alert">{{ errorMessage }}</p>
        <BaseButton type="submit" variant="primary" class="min-h-11 w-full sm:w-auto" :disabled="!isValid || pending" :loading="pending"><CheckIcon class="h-4 w-4" aria-hidden="true" />Продовжити до підтвердження</BaseButton>
      </form>
    </BaseCard>
    <ConfirmActionModal v-model="confirmOpen" title="Підтвердити операцію складу" :message="'Операція змінить залишок і не може бути скасована через цей екран.'" confirm-label="Зафіксувати операцію" :pending="pending" :destructive="form.type === 'write-off'" :context-items="[{ label: 'Тип', value: operationLabel }, { label: 'Товар', value: selectedProduct?.name || form.barcode }, { label: 'Кількість', value: String(form.quantity) }, { label: 'Причина', value: reasonValue }]" @confirm="performOperation" />
  </div>
</template>
