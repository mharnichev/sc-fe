<script setup lang="ts">
import { MagnifyingGlassIcon, CheckIcon, LinkIcon, PlusIcon, ArrowPathIcon } from '@heroicons/vue/24/outline'
import type { InventoryProduct, InventoryProductCreate } from '~/types/inventory'
import { createInventoryIdempotencyKey, inventoryApiErrorMessage, isDefiniteInventoryRejection } from '~/utils/inventory'
const props = defineProps<{ disabled?: boolean, initialBarcode?: string, showSelected?: boolean }>()
const emit = defineEmits<{ select: [product: InventoryProduct, repeat?: boolean], clear: [] }>()
const api = useBackofficeApi()
const barcode = ref(props.initialBarcode || '')
const unknownCode = ref('')
const selected = ref<InventoryProduct | null>(null)
const binding = ref<InventoryProduct | null>(null)
const search = ref('')
const results = ref<InventoryProduct[]>([])
const page = ref(1)
const total = ref(0)
const searched = ref(false)
const busy = ref(false)
const error = ref('')
const createOpen = ref(false)
const name = ref('')
const sku = ref('')
const packageSize = ref('')
const price = ref('0.00')
const pending = ref<{ key: string, payload: InventoryProductCreate, uncertain?: boolean } | null>(null)
const auth = useAuthStore()
const ownerId = auth.user?.id
const storageKey = () => `backoffice:inventory:pending-product-create:${ownerId || 'unknown'}`
const locked = computed(() => Boolean(props.disabled || busy.value || pending.value || auth.user?.id !== ownerId))
let generation = 0
const status = (cause: unknown) => {
  const value = cause as { status?: number, statusCode?: number, response?: { status?: number } }
  return value?.response?.status ?? value?.statusCode ?? value?.status
}
const persist = () => {
  try {
    if (pending.value) localStorage.setItem(storageKey(), JSON.stringify(pending.value))
    else localStorage.removeItem(storageKey())
    return true
  }
  catch { error.value = 'Не вдалося зберегти повтор запиту. Створення заблоковано; перевірте доступність сховища браузера.'; return false }
}
const choose = (product: InventoryProduct, repeat = false) => {
  selected.value = product; binding.value = null; unknownCode.value = ''; createOpen.value = false
  emit('select', product, repeat)
}
const clear = () => {
  if (locked.value) return
  generation++; barcode.value = ''; selected.value = null; binding.value = null; unknownCode.value = ''; results.value = []; searched.value = false; search.value = ''; error.value = ''; createOpen.value = false
  emit('clear')
}
const scan = async (code: string) => {
  if (locked.value || !code.trim() || code.length > 64) return
  const request = ++generation
  const previousId = selected.value?.id
  busy.value = true; error.value = ''; selected.value = null; binding.value = null; unknownCode.value = ''; results.value = []; searched.value = false; createOpen.value = false
  emit('clear')
  try { const product = await api.lookupInventoryProductByBarcode(code); if (request === generation) choose(product, previousId === product.id) }
  catch (cause) { if (request === generation) { if (status(cause) === 404) unknownCode.value = code; else { barcode.value = code; error.value = inventoryApiErrorMessage(cause) } } }
  finally { if (request === generation) busy.value = false }
}
const find = async (nextPage = 1) => {
  if (locked.value) return
  const request = ++generation
  busy.value = true; error.value = ''; binding.value = null
  try {
    const response = await api.getInventoryStock(nextPage, 10, { search: search.value })
    if (request === generation) { results.value = response.items; total.value = response.total; page.value = nextPage; searched.value = true }
  }
  catch (cause) { if (request === generation) error.value = inventoryApiErrorMessage(cause) }
  finally { if (request === generation) busy.value = false }
}
const pick = (product: InventoryProduct) => {
  if (locked.value) return
  if (unknownCode.value) binding.value = product
  else choose(product)
}
const refreshConflict = async (code: string, productId?: number) => {
  try {
    const product = await api.lookupInventoryProductByBarcode(code)
    selected.value = product; results.value = [product]; total.value = 1
  }
  catch { /* Keep the original conflict visible if the code is still unbound. */ }
  if (productId) {
    try {
      const response = await api.getInventoryStock(1, 100, { search: binding.value?.sku || binding.value?.name || '' })
      binding.value = response.items.find(product => product.id === productId) || null
    }
    catch { binding.value = null }
  }
}
const bind = async () => {
  if (locked.value || !binding.value || !unknownCode.value) return
  const productId = binding.value.id; const code = unknownCode.value
  busy.value = true; error.value = ''
  try { choose(await api.bindInventoryBarcode(productId, code)) }
  catch (cause) { error.value = inventoryApiErrorMessage(cause); if (status(cause) === 409) await refreshConflict(code, productId) }
  finally { busy.value = false }
}
const create = async () => {
  if (busy.value || props.disabled || auth.user?.id !== ownerId) return
  if (!pending.value) {
    if (!unknownCode.value || name.value.trim().length < 2 || !/^\d{1,10}(\.\d{1,2})?$/.test(price.value)) { error.value = 'Вкажіть назву (від 2 символів) і коректну ціну продажу.'; return }
    pending.value = { key: createInventoryIdempotencyKey(), payload: Object.freeze({ name: name.value.trim(), barcode: unknownCode.value, sku: sku.value.trim() || null, package_size: packageSize.value.trim() || null, price: price.value }) }
  }
  if (!persist()) return
  busy.value = true; error.value = ''
  const request = pending.value
  const previouslyUncertain = Boolean(request.uncertain)
  request.uncertain = true
  if (!persist()) { busy.value = false; return }
  try {
    const product = await api.createInventoryProduct(request.payload, request.key)
    pending.value = null; persist(); choose(product)
  }
  catch (cause) {
    error.value = inventoryApiErrorMessage(cause)
    if (!previouslyUncertain && isDefiniteInventoryRejection(cause)) { pending.value = null; persist() }
    else if (status(cause) === 409) {
      await refreshConflict(request.payload.barcode)
      if (!selected.value && request.payload.sku) {
        try {
          const response = await api.getInventoryStock(1, 10, { search: request.payload.sku })
          results.value = response.items; total.value = response.total; page.value = 1; searched.value = true
        }
        catch { /* Original conflict remains visible. */ }
      }
      if (!previouslyUncertain || selected.value?.barcode === request.payload.barcode) { pending.value = null; persist(); createOpen.value = false }
    }
  }
  finally { busy.value = false }
}
onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey()) || 'null')
    if (saved && typeof saved.key === 'string' && saved.key.length > 0 && saved.key.length <= 128 && typeof saved.payload?.name === 'string' && typeof saved.payload?.barcode === 'string' && saved.payload.barcode.trim() && saved.payload.barcode.length <= 64 && saved.payload.name.trim().length >= 2 && saved.payload.name.length <= 255 && typeof saved.payload.price === 'string' && /^\d{1,10}(\.\d{1,2})?$/.test(saved.payload.price) && Object.keys(saved.payload).every(key => ['name', 'barcode', 'sku', 'package_size', 'price'].includes(key))) {
      pending.value = { key: saved.key, payload: Object.freeze(saved.payload), uncertain: Boolean(saved.uncertain) }; unknownCode.value = saved.payload.barcode; createOpen.value = true
    }
  }
  catch { error.value = 'Не вдалося відновити незавершений запит створення.' }
})
watch(() => props.initialBarcode, value => { if (value && !locked.value) barcode.value = value })
</script>

<template>
  <section class="space-y-3">
    <InventoryBarcodeInput v-model="barcode" :disabled="locked" :loading="busy" :match="selected" :not-found="Boolean(unknownCode)" :show-not-found="false" @submit="scan" @clear="clear" />
    <p v-if="unknownCode" class="rounded-xl bg-ui-subtle p-3 text-sm text-ui-primary">Штрихкод не знайдено. Знайдіть товар за назвою, щоб прив’язати код.<br>Код: <strong class="whitespace-pre-wrap break-all">{{ unknownCode }}</strong></p>
    <p v-if="error" role="alert" class="text-sm text-ui-danger">{{ error }}</p>
    <InventoryProductCard v-if="selected && showSelected !== false" :product="selected">
      <BaseButton variant="secondary" class="min-h-11" v-if="unknownCode" type="button" :disabled="locked" @click="choose(selected)">Вибрати знайдений товар</BaseButton>
    </InventoryProductCard>
    <form class="flex gap-2" @submit.prevent="find(1)">
      <BaseInput v-model="search" label="Назва або артикул" placeholder="Наприклад, шампунь або SKU" hint="Шукаємо лише у вашій базі товарів." maxlength="255" :disabled="locked" field-class="min-w-0 flex-1" />
      <BaseButton type="submit" :disabled="locked" variant="primary" class="min-h-11 shrink-0 self-start mt-7 whitespace-nowrap"><MagnifyingGlassIcon class="h-5 w-5 shrink-0" aria-hidden="true" /><span class="hidden sm:inline">Пошук</span><span class="sr-only sm:hidden">Пошук</span></BaseButton>
    </form>
    <div v-for="product in results" :key="product.id" class="space-y-2">
      <InventoryProductCard :product="product"><BaseButton variant="secondary" class="min-h-11" type="button" :disabled="locked" @click="pick(product)"><component :is="unknownCode ? LinkIcon : CheckIcon" class="h-4 w-4 shrink-0" aria-hidden="true" />{{ unknownCode ? 'Прив’язати цей товар' : 'Вибрати' }}</BaseButton></InventoryProductCard>
    </div>
    <p v-if="searched && !results.length" class="text-sm text-ui-secondary">Товари не знайдено.</p>
    <div v-if="total > 10" class="flex items-center justify-between gap-2">
      <BaseButton variant="secondary" class="min-h-11" type="button" :disabled="locked || page <= 1" @click="find(page - 1)">Назад</BaseButton>
      <span class="text-sm">{{ page }} / {{ Math.ceil(total / 10) }}</span>
      <BaseButton variant="secondary" class="min-h-11" type="button" :disabled="locked || page * 10 >= total" @click="find(page + 1)">Далі</BaseButton>
    </div>
    <BaseCard v-if="binding" padding="sm" variant="subtle" class="space-y-3">
      <p class="font-semibold">Підтвердьте прив’язку</p>
      <InventoryProductCard :product="binding" />
      <p v-if="binding.barcode && binding.barcode !== unknownCode" role="alert" class="text-sm text-ui-danger">Цей товар уже має інший штрихкод. Виберіть інший товар; наявний код не можна замінити тут.</p>
      <p class="whitespace-pre-wrap break-all">Новий код: {{ unknownCode }}</p>
      <p class="text-sm text-ui-secondary">Прив’язка не змінює залишки. Інший наявний штрихкод замінити тут неможливо.</p>
      <BaseButton variant="primary" class="min-h-11 w-full" type="button" :disabled="locked || Boolean(binding.barcode && binding.barcode !== unknownCode)" @click="bind"><LinkIcon class="h-5 w-5 shrink-0" aria-hidden="true" />Підтвердити прив’язку / повторити</BaseButton>
      <BaseButton variant="secondary" class="min-h-11" type="button" :disabled="locked" @click="binding = null">Скасувати</BaseButton>
    </BaseCard>
    <BaseButton variant="secondary" class="min-h-11" v-if="unknownCode && searched && !createOpen" type="button" :disabled="locked" @click="createOpen = true"><PlusIcon class="h-5 w-5 shrink-0" aria-hidden="true" />Немає відповідного товару — створити картку</BaseButton>
    <form v-if="createOpen" class="space-y-3 rounded-2xl border border-ui-border p-4" @submit.prevent="create">
      <p class="font-semibold">Новий товар</p>
      <p class="whitespace-pre-wrap break-all text-sm">Штрихкод: {{ pending?.payload.barcode || unknownCode }}</p>
      <template v-if="!pending">
        <BaseInput v-model="name" label="Коротка назва" hint="Назва, за якою майстер впізнає товар." required minlength="2" maxlength="255" :disabled="busy || disabled" />
        <BaseInput v-model="sku" label="Артикул (необов’язково)" hint="Внутрішній код товару або код постачальника." maxlength="100" :disabled="busy || disabled" />
        <BaseInput v-model="packageSize" label="Об’єм / упаковка (необов’язково)" hint="Наприклад: 250 мл, 100 г або 1 шт." maxlength="64" :disabled="busy || disabled" />
        <BaseInput v-model="price" label="Ціна продажу, грн" hint="Ціна для покупця. Закупівельну вартість вкажіть у прийманні." inputmode="decimal" required :disabled="busy || disabled" />
      </template>
      <p v-else class="text-sm">Незавершений запит: {{ pending.payload.name }} · {{ pending.payload.sku || 'без артикула' }} · {{ pending.payload.package_size || 'без упаковки' }} · {{ pending.payload.price }} грн. Повтор використовує ті самі дані та ключ.</p>
      <p class="text-sm text-ui-secondary">Картка створюється прихованою, з нульовим залишком. Закупочну ціну вкажіть у прийманні.</p>
      <BaseButton variant="primary" class="min-h-11 w-full" type="submit" :loading="busy" :disabled="busy || disabled"><component :is="pending ? ArrowPathIcon : PlusIcon" class="h-5 w-5 shrink-0" aria-hidden="true" />{{ pending ? 'Повторити незавершений запит' : 'Створити товар' }}</BaseButton>
      <BaseButton variant="secondary" class="min-h-11" v-if="!pending" type="button" :disabled="busy || disabled" @click="createOpen = false">Скасувати</BaseButton>
    </form>
  </section>
</template>
