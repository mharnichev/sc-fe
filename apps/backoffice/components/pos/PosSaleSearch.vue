<script setup lang="ts">
import { CameraIcon, PhotoIcon } from '@heroicons/vue/24/outline'
import type { PosOffer, PosPage } from '~/types/posSale'
import { posMoney } from '~/composables/usePosSale'
const props = defineProps<{ results: PosPage<PosOffer>; loading: boolean; disabled: boolean; canStart: boolean; error: string }>()
const emit = defineEmits<{ search: [query: string, page?: number]; select: [offer: PosOffer] }>()
const query = ref(''), cameraOpen = ref(false), searched = ref(false), failedImages = ref<number[]>([])
const assetUrl = useAssetUrl(), api = useApi()
let debounce: ReturnType<typeof setTimeout> | undefined
const clearDebounce = () => { if (debounce !== undefined) clearTimeout(debounce); debounce = undefined }
const submit = (page = 1) => { clearDebounce(); if (props.disabled) return; searched.value = true; emit('search', query.value, page) }
const openCamera = () => { clearDebounce(); if (!props.disabled) cameraOpen.value = true }
const scanned = (code: string) => { cameraOpen.value = false; query.value = code; submit() }
watch(query, () => { clearDebounce(); if (!props.disabled) debounce = setTimeout(() => submit(), 275) }, { flush: 'sync' })
watch(() => props.disabled, disabled => { if (disabled) { clearDebounce(); cameraOpen.value = false } }, { flush: 'sync' })
onScopeDispose(clearDebounce)
const lookupBarcode = async (barcode: string): Promise<{ barcode: string }> => {
  if (props.disabled) throw { response: { status: 403 } }
  const page = await api<PosPage<PosOffer>>('/backoffice/pos/products', { query: { q: barcode, page: 1, page_size: 50 }, retry: 0, cache: 'no-store' })
  const matches = page.items.filter(offer => offer.barcode === barcode)
  if (matches.length !== 1) throw { response: { status: matches.length ? 409 : 404 } }
  return { barcode }
}
</script>
<template>
  <BaseCard class="space-y-4">
    <form class="space-y-2" @submit.prevent="submit()">
      <BaseInput v-model="query" type="search" label="Знайти товар" placeholder="Назва, бренд, SKU або штрихкод" maxlength="120" :disabled="disabled" :aria-busy="loading || undefined" input-class="base-control px-3 py-3 text-base" />
    </form>
    <BaseButton variant="neutral" size="lg" block :disabled="disabled || loading" @click="openCamera"><CameraIcon class="h-5 w-5" aria-hidden="true" />Сканувати штрихкод</BaseButton>
    <p v-if="error" role="alert" class="text-sm text-ui-danger">{{ error }}</p>
    <BaseLoader v-if="loading" label="Шукаємо товари" />
    <BaseEmptyState v-else-if="searched && !results.items.length" title="Товарів не знайдено" description="Спробуйте іншу назву або штрихкод." compact />
    <p v-else-if="!searched" class="text-sm text-ui-secondary">Знайдіть товар і натисніть на нього, щоб показати клієнту QR для оплати.</p>
    <div class="space-y-2">
      <BaseButton v-for="offer in results.items" :key="offer.id" variant="neutral" block class="gap-3 rounded-2xl p-3 text-left" :disabled="disabled || !canStart || loading || !offer.can_sell || offer.available_quantity < 1" :aria-label="`Продати: ${offer.name}, ${posMoney(offer.amount_minor)}`" @click="emit('select', offer)">
        <img v-if="offer.image_url && !failedImages.includes(offer.id)" :src="assetUrl(offer.image_url)" alt="" class="h-14 w-14 shrink-0 rounded-xl object-contain" @error="failedImages.push(offer.id)">
        <PhotoIcon v-else class="h-12 w-12 shrink-0 text-ui-muted" aria-hidden="true" />
        <span class="min-w-0 flex-1"><span class="block break-words text-sm font-semibold">{{ offer.name }}</span><span v-if="offer.brand_name || offer.variant_label" class="mt-1 block break-words text-xs text-ui-secondary">{{ [offer.brand_name, offer.variant_label].filter(Boolean).join(' · ') }}</span><span class="mt-1 block text-xs text-ui-secondary">{{ offer.can_sell ? `Доступно: ${offer.available_quantity} шт.` : 'Зараз недоступно' }}</span></span>
        <span class="shrink-0 text-sm font-semibold">{{ posMoney(offer.amount_minor) }}</span>
      </BaseButton>
    </div>
    <div v-if="results.total > results.page_size" class="flex items-center justify-between gap-2"><BaseButton variant="neutral" size="lg" :disabled="disabled || loading || results.page <= 1" @click="submit(results.page - 1)">Назад</BaseButton><span class="text-xs text-ui-secondary">{{ results.page }} / {{ Math.ceil(results.total / results.page_size) }}</span><BaseButton variant="neutral" size="lg" :disabled="disabled || loading || results.page * results.page_size >= results.total" @click="submit(results.page + 1)">Далі</BaseButton></div>
  </BaseCard>
  <InventoryBarcodeCamera v-if="cameraOpen" :lookup-barcode="lookupBarcode" @close="cameraOpen = false" @recognized="scanned" />
</template>
