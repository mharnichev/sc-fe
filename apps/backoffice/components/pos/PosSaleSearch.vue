<script setup lang="ts">
import { ChevronLeftIcon, ChevronRightIcon, PhotoIcon, PlusIcon } from '@heroicons/vue/24/outline'
import type { PosOffer, PosPage } from '~/types/posSale'
import { posCanAddOffer, posMoney } from '~/composables/usePosSale'
const props = defineProps<{ results: PosPage<PosOffer>; loading: boolean; disabled: boolean; canStart: boolean; error: string; quantities: Record<number, number>; limits: { max_items: number; max_quantity: number } | null }>()
const emit = defineEmits<{ search: [query: string, page?: number]; select: [offer: PosOffer] }>()
const query = ref(''), searched = ref(false), failedImages = ref<number[]>([])
const selected = shallowRef<PosOffer | null>(null)
const atItemLimit = computed(() => Object.keys(props.quantities).length >= (props.limits?.max_items ?? 0))
const assetUrl = useAssetUrl(), api = useApi()
let debounce: ReturnType<typeof setTimeout> | undefined
const clearDebounce = () => { if (debounce !== undefined) clearTimeout(debounce); debounce = undefined }
const submit = (page = 1) => { clearDebounce(); if (props.disabled) return; searched.value = true; emit('search', query.value, page) }
defineExpose({ refresh: () => { if (query.value.trim()) submit() } })
const openCamera = clearDebounce
const scanned = (code: string) => { query.value = code; submit() }
watch(query, () => { clearDebounce(); if (!props.disabled) debounce = setTimeout(() => submit(), 275) }, { flush: 'sync' })
watch(() => props.disabled, disabled => { if (disabled) { clearDebounce(); selected.value = null } }, { flush: 'sync' })
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
  <BaseCard as="section" aria-label="Пошук товарів" padding="sm" class="space-y-2">
    <BaseFindGoodField
      v-model="query"
      searchbox
      label="Знайти товар"
      placeholder="Назва, бренд, SKU або штрихкод"
      :maxlength="120"
      :disabled="disabled"
      :loading="loading"
      search-while-loading
      :lookup-barcode="lookupBarcode"
      :show-clear="!!query"
      @camera-open="openCamera"
      @scan="scanned"
      @submit="submit()"
      @clear="query = ''; submit()"
    />
    <p v-if="error" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">{{ error }}</p>
    <BaseLoader v-if="loading" label="Шукаємо товари" />
    <BaseEmptyState v-else-if="searched && !results.items.length" title="Товарів не знайдено" description="Спробуйте іншу назву або штрихкод." compact />
    <BaseEmptyState v-else-if="!searched" title="Додайте товари до кошика" description="Введіть назву або скануйте штрихкод." compact />
    <div class="space-y-1.5">
      <BaseCard v-for="offer in results.items" :key="offer.id" as="article" variant="subtle" padding="none" class="flex items-center gap-1.5 !rounded-xl p-1.5">
        <BaseButton type="button" variant="unstyled" class="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg p-0.5 text-left focus-visible:outline focus-visible:outline-2" :aria-label="`Деталі: ${offer.name}`" :aria-describedby="`pos-offer-summary-${offer.id}`" :disabled="disabled" @click="selected = offer">
          <img v-if="offer.image_url && !failedImages.includes(offer.id)" :src="assetUrl(offer.image_url)" alt="" class="h-11 w-11 shrink-0 rounded-lg bg-ui-surface object-contain" @error="failedImages.push(offer.id)">
          <PhotoIcon v-else class="h-11 w-11 shrink-0 text-ui-muted" aria-hidden="true" />
          <span class="min-w-0 flex-1 space-y-0.5">
            <span class="block break-words text-sm font-semibold">{{ offer.name }}</span>
            <span :id="`pos-offer-summary-${offer.id}`" class="block space-y-0.5">
              <span v-if="offer.brand_name || offer.variant_label" class="block break-words text-xs text-ui-secondary">
                <span v-if="offer.brand_name" class="hidden sm:inline">{{ offer.brand_name }}{{ offer.variant_label ? ' · ' : '' }}</span>{{ offer.variant_label }}
              </span>
              <span class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <BaseBadge :tone="posCanAddOffer(offer) ? 'neutral' : 'warning'">
                  {{ posCanAddOffer(offer) ? `Доступно: ${offer.available_quantity} шт.` : 'Зараз недоступно' }}
                </BaseBadge>
                <span class="text-sm font-medium">{{ offer.amount_minor > 0 ? posMoney(offer.amount_minor) : 'Ціна в кошику' }}</span>
              </span>
            </span>
          </span>
        </BaseButton>
        <BaseButton variant="primary" class="!h-11 !w-11 shrink-0 !p-0" :disabled="disabled || !canStart || loading || !posCanAddOffer(offer) || (atItemLimit && !quantities[offer.id]) || Math.min(offer.available_quantity, limits?.max_quantity ?? 0) <= (quantities[offer.id] || 0)" :aria-label="`Додати: ${offer.name}`" @click="emit('select', offer)">
          <PlusIcon class="h-5 w-5" aria-hidden="true" />
        </BaseButton>
      </BaseCard>
    </div>
    <div v-if="results.total > results.page_size" class="flex items-center justify-between gap-2"><BaseButton variant="neutral" size="lg" :disabled="disabled || loading || results.page <= 1" @click="submit(results.page - 1)"><ChevronLeftIcon class="h-4 w-4" aria-hidden="true" />Назад</BaseButton><span class="text-xs text-ui-secondary">{{ results.page }} / {{ Math.ceil(results.total / results.page_size) }}</span><BaseButton variant="neutral" size="lg" :disabled="disabled || loading || results.page * results.page_size >= results.total" @click="submit(results.page + 1)">Далі<ChevronRightIcon class="h-4 w-4" aria-hidden="true" /></BaseButton></div>
  </BaseCard>
  <PosProductDetails :offer="selected" @close="selected = null" />
</template>
