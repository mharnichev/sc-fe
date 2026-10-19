<script setup lang="ts">
import { productDisplayImage } from '~/utils/productImages'
import { MagnifyingGlassIcon, XMarkIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, CameraIcon, PhotoIcon } from '@heroicons/vue/24/outline'
import type { InventoryProduct } from '~/types/inventory'
import { inventoryApiErrorMessage } from '~/utils/inventory'

const props = defineProps<{ modelValue: boolean, compactMobile?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean], select: [product: InventoryProduct] }>()
const api = useBackofficeApi()
const route = useRoute()
const assetUrl = useAssetUrl()
const scannerOpen = ref(false)
const scannerId = useId()
const failedImages = ref<number[]>([])
const barcode = ref('')
const search = ref('')
const results = ref<InventoryProduct[]>([])
const matched = ref<InventoryProduct | null>(null)
const busy = ref(false)
const error = ref('')
const unknown = ref(false)
const searched = ref(false)
const page = ref(1)
const total = ref(0)
let generation = 0

const reset = () => {
  generation++
  scannerOpen.value = false; failedImages.value = []
  barcode.value = ''; search.value = ''; results.value = []; matched.value = null
  busy.value = false; error.value = ''; unknown.value = false; searched.value = false
  page.value = 1; total.value = 0
}
const close = () => { reset(); emit('update:modelValue', false) }
watch(() => props.modelValue, reset)
watch(() => route.fullPath, close)
onBeforeUnmount(() => { generation++ })

const lookup = async (code: string) => {
  if (busy.value || !code.trim()) return
  const request = ++generation
  busy.value = true; error.value = ''; unknown.value = false; matched.value = null
  results.value = []; searched.value = false; total.value = 0; page.value = 1
  try {
    const product = await api.lookupInventoryProductByBarcode(code)
    if (request !== generation) return
    matched.value = product; results.value = [product]; searched.value = true; total.value = 1
  }
  catch (cause) {
    if (request !== generation) return
    barcode.value = code
    const failure = cause as { status?: number, statusCode?: number, response?: { status?: number } }
    if ((failure.response?.status ?? failure.statusCode ?? failure.status) === 404) unknown.value = true
    else error.value = inventoryApiErrorMessage(cause, 'Не вдалося знайти товар. Спробуйте ще раз.')
  }
  finally { if (request === generation) busy.value = false }
}
const find = async (nextPage = 1) => {
  if (busy.value) return
  const request = ++generation
  busy.value = true; error.value = ''; matched.value = null; unknown.value = false
  results.value = []; searched.value = false; total.value = 0
  try {
    const response = await api.getInventoryStock(nextPage, 10, { search: search.value.trim() || undefined })
    if (request !== generation) return
    results.value = response.items; total.value = response.total; page.value = nextPage; searched.value = true
  }
  catch (cause) { if (request === generation) error.value = inventoryApiErrorMessage(cause, 'Не вдалося завантажити товари. Спробуйте ще раз.') }
  finally { if (request === generation) busy.value = false }
}
const choose = (product: InventoryProduct) => {
  if (busy.value) return
  emit('select', product)
  close()
}
</script>

<template>
  <BaseModal :model-value="modelValue" aria-label="Швидкий пошук товару" max-width-class="max-w-2xl" @close="close">
    <template #head>
      <div class="flex items-center justify-between gap-3">
        <h2 class="flex items-center gap-2 text-lg font-semibold"><MagnifyingGlassIcon class="h-5 w-5 shrink-0" aria-hidden="true" />Знайти товар</h2>
        <BaseButton variant="secondary" class="min-h-11" aria-label="Закрити пошук" @click="close"><XMarkIcon class="h-5 w-5" aria-hidden="true" /></BaseButton>
      </div>
    </template>
    <template #body>
      <div class="space-y-4">
        <InventoryBarcodeInput v-if="!compactMobile" v-model="barcode" :loading="busy" :match="matched" :not-found="unknown" :show-not-found="false" :auto-focus="true" @submit="lookup" @clear="reset" />
        <form class="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2" @submit.prevent="find()">
          <BaseInput v-model="search" label="Назва або SKU" placeholder="Наприклад, шампунь" :disabled="busy" maxlength="255"><template #icon><MagnifyingGlassIcon class="h-4 w-4" aria-hidden="true" /></template></BaseInput>
          <BaseButton type="submit" variant="primary" class="min-h-11" :loading="busy"><MagnifyingGlassIcon class="h-5 w-5" aria-hidden="true" /><span class="sr-only sm:not-sr-only">Пошук</span></BaseButton>
        </form>
        <div v-if="compactMobile" class="space-y-3">
          <BaseButton variant="neutral" size="lg" block :aria-expanded="scannerOpen" :aria-controls="scannerId" @click="scannerOpen = !scannerOpen"><CameraIcon class="h-5 w-5" aria-hidden="true" />{{ scannerOpen ? 'Сховати сканер' : 'Сканувати' }}</BaseButton>
          <div v-if="scannerOpen" :id="scannerId">
            <InventoryBarcodeInput v-model="barcode" :loading="busy" :match="matched" :not-found="unknown" :show-not-found="false" :auto-focus="true" @submit="lookup" @clear="reset" />
          </div>
        </div>
        <p v-if="unknown" role="status" class="ui-status-warning rounded-xl p-3 text-sm">Штрихкод не знайдено. Спробуйте пошук за назвою або SKU.</p>
        <p v-if="error" role="alert" class="text-sm text-ui-danger">{{ error }}</p>
        <p v-if="searched && !results.length && !busy" role="status" class="text-sm text-ui-secondary">Товарів не знайдено. Змініть назву або SKU.</p>
        <div v-if="compactMobile" class="space-y-2 sm:hidden">
          <p v-if="results.length" class="text-sm text-ui-secondary">Натисніть на товар, щоб додати.</p>
          <button v-for="product in results" :key="product.id" type="button"
            class="flex min-h-16 w-full items-center gap-3 rounded-xl border border-ui bg-ui-subtle p-3 text-left transition hover:bg-ui-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-50"
            :aria-label="`Додати: ${product.name}`" :disabled="busy" @click="choose(product)">
            <img v-if="productDisplayImage(product) && !failedImages.includes(product.id)" :src="assetUrl(productDisplayImage(product))" alt="" class="h-14 w-14 shrink-0 rounded-lg bg-white object-contain" loading="lazy" @error="failedImages.push(product.id)">
            <span v-else class="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-ui-surface text-ui-secondary" aria-hidden="true"><PhotoIcon class="h-7 w-7" /></span>
            <span class="min-w-0 flex-1"><span class="block break-words font-semibold">{{ product.name }}</span><span class="mt-1 block text-sm text-ui-secondary">Доступно: {{ product.available }} шт.</span></span>
            <PlusIcon class="h-6 w-6 shrink-0" aria-hidden="true" />
          </button>
        </div>
        <div :class="compactMobile ? 'hidden space-y-4 sm:block' : 'space-y-4'">
          <InventoryProductCard v-for="product in results" :key="product.id" :product="product">
            <BaseButton variant="primary" class="mt-2 min-h-11 w-full sm:w-auto" :disabled="busy" @click="choose(product)"><CheckIcon class="h-4 w-4" aria-hidden="true" />Вибрати товар</BaseButton>
          </InventoryProductCard>
        </div>
        <div v-if="total > 10" class="flex items-center justify-between gap-2">
          <BaseButton variant="secondary" class="min-h-11" :disabled="busy || page <= 1" @click="find(page - 1)"><ChevronLeftIcon class="h-4 w-4" aria-hidden="true" />Назад</BaseButton>
          <span class="text-sm">{{ page }} / {{ Math.ceil(total / 10) }}</span>
          <BaseButton variant="secondary" class="min-h-11" :disabled="busy || page * 10 >= total" @click="find(page + 1)">Далі<ChevronRightIcon class="h-4 w-4" aria-hidden="true" /></BaseButton>
        </div>
      </div>
    </template>
  </BaseModal>
</template>
