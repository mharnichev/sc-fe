<script setup lang="ts">
import { ArchiveBoxIcon, PhotoIcon, QrCodeIcon, ShoppingBagIcon, TagIcon } from '@heroicons/vue/24/outline'
import type { PosOffer } from '~/types/posSale'
import { posMoney } from '~/composables/usePosSale'
import { productDisplayImages } from '~/utils/productImages'

const props = defineProps<{ offer: PosOffer | null }>()
const emit = defineEmits<{ close: [] }>()
const api = useBackofficeApi()
const assetUrl = useAssetUrl()
const photos = ref<string[]>([])
const failed = ref<string[]>([])
const busy = ref(false)
const error = ref(false)
const visiblePhotos = computed(() => photos.value.filter(url => !failed.value.includes(url)))

watch(() => props.offer, async (offer, _, onCleanup) => {
  let current = true
  onCleanup(() => { current = false })
  photos.value = offer?.image_url ? [offer.image_url] : []
  failed.value = []
  error.value = false
  busy.value = !!offer
  if (!offer) return
  try {
    // The photo-only endpoint does not serialize product cost or inventory.
    const images = await api.getProductImages(offer.id)
    if (current) photos.value = productDisplayImages({ images, image_url: offer.image_url })
  } catch {
    if (current) error.value = true
  } finally {
    if (current) busy.value = false
  }
}, { immediate: true })
</script>

<template>
  <BaseModal :model-value="!!offer" aria-label="Деталі товару" max-width-class="max-w-lg" compact @close="emit('close')">
    <template #head>
      <div class="flex items-center justify-between gap-2">
        <h2 class="flex items-center gap-2 text-base font-semibold"><ShoppingBagIcon class="h-5 w-5 text-ui-secondary" aria-hidden="true" />Деталі товару</h2>
        <ModalCloseButton @click="emit('close')" />
      </div>
    </template>
    <template #body>
      <div v-if="offer" class="space-y-2.5">
        <div>
          <h3 class="break-words text-lg font-semibold">{{ offer.name }}</h3>
          <p v-if="offer.brand_name || offer.variant_label" class="text-sm text-ui-secondary">{{ [offer.brand_name, offer.variant_label].filter(Boolean).join(' · ') }}</p>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <BaseBadge tone="accent"><TagIcon class="h-4 w-4" aria-hidden="true" />{{ offer.amount_minor > 0 ? posMoney(offer.amount_minor) : 'Ціна в кошику' }}</BaseBadge>
          <BaseBadge :tone="offer.available_quantity > 0 ? 'success' : 'warning'"><ArchiveBoxIcon class="h-4 w-4" aria-hidden="true" />Доступно: {{ offer.available_quantity }} шт.</BaseBadge>
        </div>
        <p v-if="offer.sku || offer.barcode" class="flex items-start gap-1.5 break-all text-xs text-ui-secondary"><QrCodeIcon class="h-4 w-4 shrink-0" aria-hidden="true" />{{ [offer.sku && 'SKU: ' + offer.sku, offer.barcode && 'Штрихкод: ' + offer.barcode].filter(Boolean).join(' · ') }}</p>
        <div v-if="visiblePhotos.length" class="grid grid-cols-2 gap-1.5 sm:grid-cols-3" aria-label="Фото товару">
          <img v-for="(url, index) in visiblePhotos" :key="url" :src="assetUrl(url)" :alt="`${offer.name} · фото ${index + 1}`" class="aspect-square w-full rounded-lg border border-ui bg-ui-subtle object-contain" loading="lazy" @error="failed.push(url)">
        </div>
        <BaseLoader v-if="busy" inline size="sm" label="Завантажуємо фото" />
        <p v-else-if="error" role="status" class="text-xs text-ui-secondary">Не вдалося завантажити всі фото.</p>
        <BaseEmptyState v-else-if="!visiblePhotos.length" compact title="Фото відсутні"><template #icon><PhotoIcon class="h-5 w-5" aria-hidden="true" /></template></BaseEmptyState>
      </div>
    </template>
  </BaseModal>
</template>
