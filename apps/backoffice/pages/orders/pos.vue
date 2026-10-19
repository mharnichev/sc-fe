<script setup lang="ts">
import { productDisplayImage } from '~/utils/productImages'
import { ArrowLeftIcon, ArrowRightIcon, MagnifyingGlassIcon, ShoppingBagIcon, MinusIcon, PlusIcon, UserIcon, BeakerIcon, QrCodeIcon, CheckIcon, PhotoIcon } from '@heroicons/vue/24/outline'
import type { InventoryProduct } from '~/types/inventory'
import type { PosOrderCreate } from '~/composables/useBackofficeApi'
const api = useBackofficeApi()
const assetUrl = useAssetUrl()
const failedImages = ref<number[]>([])
const auth = useAuthStore()
const { isAdmin, isBarber } = useBackofficeAccess()
const { data: capabilities, error: capabilityError, refresh } = await useAsyncData('pos-capabilities', () => api.getPosCapabilities())
watch(() => auth.user?.id, () => { rows.value = []; customerName.value = ''; customerPhone.value = ''; promoCode.value = ''; simulation.value = false; void refresh() })
const pickerOpen = ref(false)
const rows = ref<{ product: InventoryProduct, quantity: number }[]>([])
const customerName = ref('')
const customerPhone = ref('')
const promoCode = ref('')
const method = ref<'pickup'>('pickup')
const simulation = ref(false)
const command = useOrderSalesCommand<PosOrderCreate>('prepare', 'new', ['unsupported_zero_total_pos'])
const saleSimulation = computed({
  get: () => command.intent.value?.body.simulation ?? simulation.value,
  set: (value: boolean) => { simulation.value = value },
})
const locked = computed(() => command.busy.value || !!command.intent.value)
const canPrepare = computed(() => capabilities.value?.can_prepare === true && (!saleSimulation.value || capabilities.value?.simulation_available === true) && (!isBarber.value || (saleSimulation.value && capabilities.value?.simulation_available === true)))
const validQuantities = computed(() => rows.value.every(row => Number.isSafeInteger(Number(row.quantity)) && Number(row.quantity) > 0))
const itemCount = computed(() => rows.value.reduce((total, row) => total + (Number.isSafeInteger(Number(row.quantity)) && Number(row.quantity) > 0 ? Number(row.quantity) : 0), 0))
const add = (product: InventoryProduct) => {
  if (locked.value) return
  const existing = rows.value.find(row => row.product.id === product.id)
  if (existing) existing.quantity++
  else rows.value.push({ product, quantity: 1 })
}
const prepare = () => {
  if (!canPrepare.value || (!command.intent.value && (!rows.value.length || !validQuantities.value))) return
  const body: PosOrderCreate = {
    items: rows.value.map(row => ({ product_id: row.product.id, quantity: Number(row.quantity) })),
    customer_name: customerName.value.trim() || undefined, customer_phone: customerPhone.value.trim() || undefined,
    promo_code: promoCode.value.trim() || undefined, fulfillment_method: method.value, simulation: saleSimulation.value,
  }
  return command.execute(body, api.createPosOrder, id => navigateTo(`/orders/${id}`))
}
</script>
<template>
  <div class="pos-page mx-auto max-w-4xl space-y-4">
    <header class="space-y-3">
      <NuxtLink to="/orders" class="inline-flex min-h-11 items-center gap-2 text-sm text-ui-secondary"><ArrowLeftIcon class="h-5 w-5" aria-hidden="true" />До замовлень</NuxtLink>
      <div><p class="ui-eyebrow">Продаж у салоні</p><h1 class="mt-1 text-2xl font-semibold sm:text-3xl">Продати товар</h1><p class="mt-2 text-sm text-ui-secondary">Додайте товари → перевірте суму → перейдіть до оплати.</p></div>
    </header>
    <ol aria-label="Кроки продажу" class="grid grid-cols-3 gap-2 text-xs sm:text-sm">
      <li aria-current="step" class="flex flex-col items-center gap-1 rounded-xl bg-cyan-50 p-2 font-semibold text-cyan-900 sm:flex-row sm:justify-center"><ShoppingBagIcon class="h-5 w-5 shrink-0" aria-hidden="true" />1. Товари</li>
      <li class="flex flex-col items-center gap-1 rounded-xl bg-ui-subtle p-2 text-ui-secondary sm:flex-row sm:justify-center"><QrCodeIcon class="h-5 w-5 shrink-0" aria-hidden="true" />2. Оплата</li>
      <li class="flex flex-col items-center gap-1 rounded-xl bg-ui-subtle p-2 text-ui-secondary sm:flex-row sm:justify-center"><CheckIcon class="h-5 w-5 shrink-0" aria-hidden="true" />3. Видача</li>
    </ol>
    <section aria-label="Режим продажу" class="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <p class="flex items-center gap-2 font-semibold"><BeakerIcon class="h-5 w-5 shrink-0" aria-hidden="true" />Без реальних платежів</p>
      <p>Гроші не списуються, чеки до ДПС не надсилаються.</p>
      <label v-if="capabilities?.simulation_available" class="flex min-h-11 cursor-pointer items-center gap-3"><input v-model="saleSimulation" type="checkbox" class="h-5 w-5 shrink-0" :disabled="locked">Тестовий режим (без реальної оплати)</label>
      <p v-if="capabilityError || (capabilities && !capabilities.can_prepare)" role="alert" class="text-ui-danger">Підготовка продажу недоступна. Попросіть адміністратора перевірити ваші права та доступність тестового режиму.</p>
      <p v-if="isBarber && capabilities?.can_prepare && !saleSimulation" role="status">Увімкніть тестовий режим для перевірки продажу.</p>
      <details v-if="isAdmin && capabilities?.blocking_reasons?.length"><summary class="min-h-11 cursor-pointer py-3">Технічні причини</summary><p v-for="reason in capabilities.blocking_reasons" :key="reason" class="mt-2 break-words">{{ reason }}</p></details>
    </section>
    <BaseButton v-if="command.intent.value?.resultId" variant="neutral" size="lg" @click="command.clear(); rows = []; customerName = ''; customerPhone = ''; promoCode = ''"><PlusIcon class="h-5 w-5" aria-hidden="true" />Нове замовлення</BaseButton>
    <p v-if="command.intent.value" role="status" class="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">Запит збережено. Натисніть «Відновити підготовку», щоб отримати те саме замовлення без дублювання. Склад і контакти зафіксовані.</p>
    <BaseCard class="space-y-4">
      <div class="flex items-center gap-2"><ShoppingBagIcon class="h-5 w-5 text-ui-secondary" aria-hidden="true" /><h2 class="text-lg font-semibold">Товари <span class="text-ui-secondary">({{ rows.length }})</span></h2></div>
      <BaseButton variant="primary" size="lg" block :disabled="locked || capabilities?.can_prepare !== true" @click="pickerOpen = true"><MagnifyingGlassIcon class="h-5 w-5 shrink-0" aria-hidden="true" />Знайти / сканувати товар</BaseButton>
      <InventoryQuickSearchModal v-model="pickerOpen" compact-mobile @select="add" />
      <div v-if="!rows.length && !command.intent.value" class="rounded-2xl border border-dashed border-ui px-4 py-6 text-center"><ShoppingBagIcon class="mx-auto mb-2 h-8 w-8 text-ui-secondary" aria-hidden="true" /><p class="font-medium">Додайте перший товар</p><p class="mt-1 text-sm text-ui-secondary">Натисніть кнопку вище: введіть назву, SKU або скануйте штрихкод.</p></div>
      <article v-for="(row, index) in rows" :key="row.product.id" class="space-y-2 rounded-xl border border-ui p-2.5">
        <div class="flex min-w-0 items-center gap-2.5">
          <img v-if="productDisplayImage(row.product) && !failedImages.includes(row.product.id)" :src="assetUrl(productDisplayImage(row.product))" alt="" class="h-12 w-12 shrink-0 rounded-lg bg-white object-contain" loading="lazy" @error="failedImages.push(row.product.id)">
          <span v-else class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-ui-subtle text-ui-secondary" aria-hidden="true"><PhotoIcon class="h-6 w-6" /></span>
          <div class="min-w-0"><h3 class="break-words text-sm font-semibold leading-snug">{{ row.product.name }}</h3><p class="mt-1 text-xs text-ui-secondary">Доступно: {{ row.product.available }} шт.</p></div>
        </div>
        <div class="flex items-center justify-between gap-2">
          <div class="grid min-w-0 grid-cols-[2.75rem_4rem_2.75rem] items-center gap-1">
            <BaseButton variant="neutral" class="h-11 w-11 shrink-0 p-0" :aria-label="`Зменшити кількість: ${row.product.name}`" :disabled="locked || Number(row.quantity) <= 1" @click="row.quantity = Math.max(1, Number(row.quantity) - 1)"><MinusIcon class="h-5 w-5" aria-hidden="true" /></BaseButton>
            <BaseInput v-model="row.quantity" class="w-16 min-w-0" input-class="base-control px-1 py-3 text-center" type="number" :aria-label="`Кількість: ${row.product.name}`" inputmode="numeric" min="1" step="1" :disabled="locked" />
            <BaseButton variant="neutral" class="h-11 w-11 shrink-0 p-0" :aria-label="`Збільшити кількість: ${row.product.name}`" :disabled="locked" @click="row.quantity = (Number(row.quantity) || 0) + 1"><PlusIcon class="h-5 w-5" aria-hidden="true" /></BaseButton>
          </div>
          <BaseButton variant="danger" class="h-11 w-11 shrink-0 p-0" :aria-label="`Прибрати: ${row.product.name}`" :disabled="locked" @click="rows.splice(index, 1)"><TrashIcon class="h-5 w-5 shrink-0" aria-hidden="true" /></BaseButton>
        </div>
      </article>
      <p v-if="rows.length && !validQuantities" role="alert" class="text-sm text-ui-danger">Вкажіть цілу кількість від 1 для кожного товару.</p>
      <details class="rounded-2xl border border-ui px-3"><summary class="min-h-11 cursor-pointer py-3 text-sm font-medium"><UserIcon class="mr-1 inline h-5 w-5 align-text-bottom" aria-hidden="true" />Клієнт і промокод · необов’язково</summary>
        <p class="mt-1 text-sm text-ui-secondary">Можна продати без контакту. Отримання — у салоні.</p>
        <div class="my-4 grid gap-4 sm:grid-cols-2">
          <BaseInput v-model="customerName" label="Ім’я клієнта (необов’язково)" autocomplete="name" :disabled="locked" />
          <BaseInput v-model="customerPhone" label="Телефон (необов’язково)" type="tel" autocomplete="tel" :disabled="locked" />
          <BaseInput v-model="promoCode" label="Промокод" :disabled="locked" />
        </div>
      </details>
    </BaseCard>
    <section aria-label="Підготовка замовлення" class="space-y-3 rounded-2xl border border-ui bg-ui-subtle p-4">
      <p v-if="rows.length" class="text-sm font-medium" aria-live="polite">У кошику: {{ itemCount }} шт.</p>
      <p class="text-sm text-ui-secondary">{{ rows.length || command.intent.value ? 'Далі — точна сума та знижки. Оплата й видача підтверджуються окремо.' : 'Спочатку додайте товар, щоб перевірити суму.' }}</p>
      <BaseButton variant="primary" size="lg" block :disabled="!canPrepare || (!command.intent.value && (!rows.length || !validQuantities))" :loading="command.busy.value" @click="prepare">{{ command.intent.value ? 'Відновити підготовку' : 'Перевірити суму' }}<ArrowRightIcon class="h-5 w-5 shrink-0" aria-hidden="true" /></BaseButton>
      <p v-if="command.error.value" role="alert" class="break-words text-sm text-ui-danger">{{ command.error.value }}</p>
    </section>
  </div>
</template>

<style scoped>
/* Keep iOS from zooming the page when entering quantities or customer details. */
.pos-page :deep(input:not([type='checkbox'])) { font-size: 16px; }
</style>
