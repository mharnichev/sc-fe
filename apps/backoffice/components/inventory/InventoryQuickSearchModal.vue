<script setup lang="ts">
import { MagnifyingGlassIcon, XMarkIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/vue/24/outline'
import type { InventoryProduct } from '~/types/inventory'
import { inventoryApiErrorMessage } from '~/utils/inventory'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean], select: [product: InventoryProduct] }>()
const api = useBackofficeApi()
const route = useRoute()
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
        <InventoryBarcodeInput v-model="barcode" :loading="busy" :match="matched" :not-found="unknown" :show-not-found="false" :auto-focus="true" @submit="lookup" @clear="reset" />
        <p v-if="unknown" role="status" class="ui-status-warning rounded-xl p-3 text-sm">Штрихкод не знайдено. Спробуйте пошук за назвою або SKU.</p>
        <form class="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2" @submit.prevent="find()">
          <BaseInput v-model="search" label="Назва або SKU" placeholder="Наприклад, шампунь" :disabled="busy" maxlength="255"><template #icon><MagnifyingGlassIcon class="h-4 w-4" aria-hidden="true" /></template></BaseInput>
          <BaseButton type="submit" variant="primary" class="min-h-11" :loading="busy"><MagnifyingGlassIcon class="h-5 w-5" aria-hidden="true" /><span class="sr-only sm:not-sr-only">Пошук</span></BaseButton>
        </form>
        <p v-if="error" role="alert" class="text-sm text-ui-danger">{{ error }}</p>
        <p v-if="searched && !results.length && !busy" role="status" class="text-sm text-ui-secondary">Товарів не знайдено. Змініть назву або SKU.</p>
        <InventoryProductCard v-for="product in results" :key="product.id" :product="product">
          <BaseButton variant="primary" class="mt-2 min-h-11 w-full sm:w-auto" :disabled="busy" @click="choose(product)"><CheckIcon class="h-4 w-4" aria-hidden="true" />Вибрати товар</BaseButton>
        </InventoryProductCard>
        <div v-if="total > 10" class="flex items-center justify-between gap-2">
          <BaseButton variant="secondary" class="min-h-11" :disabled="busy || page <= 1" @click="find(page - 1)"><ChevronLeftIcon class="h-4 w-4" aria-hidden="true" />Назад</BaseButton>
          <span class="text-sm">{{ page }} / {{ Math.ceil(total / 10) }}</span>
          <BaseButton variant="secondary" class="min-h-11" :disabled="busy || page * 10 >= total" @click="find(page + 1)">Далі<ChevronRightIcon class="h-4 w-4" aria-hidden="true" /></BaseButton>
        </div>
      </div>
    </template>
  </BaseModal>
</template>
