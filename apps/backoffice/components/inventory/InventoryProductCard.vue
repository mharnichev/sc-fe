<script setup lang="ts">
import { productDisplayImage, productDisplayImages } from '~/utils/productImages'
import type { InventoryProduct } from '~/types/inventory'
const props = withDefaults(defineProps<{ product: InventoryProduct, framed?: boolean, showStock?: boolean }>(), { framed: true, showStock: true })
const photosOpen = ref(false)
const photoIndex = ref(0)
const photos = computed(() => productDisplayImages(props.product))
watch(() => props.product.id, () => { photosOpen.value = false; photoIndex.value = 0 })
const assetUrl = useAssetUrl()
</script>

<template>
  <article class="inventory-product-card min-w-0" :class="framed ? 'rounded-xl bg-ui-subtle p-3' : 'inventory-product-card--unframed'">
    <div class="flex min-w-0 gap-3">
    <button v-if="photos.length" type="button" class="shrink-0 self-start rounded-xl p-1 text-ui-accent focus-visible:outline focus-visible:outline-2" :aria-label="`Переглянути всі фото: ${product.name}`" @click="photoIndex = 0; photosOpen = true">
      <img :src="assetUrl(productDisplayImage(product))" :alt="product.name" class="h-16 w-16 rounded-lg object-contain sm:h-20 sm:w-20" loading="lazy">
      <span class="mt-1 block text-xs font-medium">Фото · {{ photos.length }}</span>
    </button>
    <div class="min-w-0 flex-1 space-y-1">
      <p class="break-words font-semibold text-ui-primary">{{ product.name }}</p>
      <p v-if="product.brand_name || product.model_name" class="text-sm text-ui-secondary">{{ [product.brand_name, product.model_name].filter(Boolean).join(' · ') }}</p>
      <p v-if="product.package_size || product.volume_ml" class="inline-block rounded-lg bg-ui-subtle px-2 py-1 text-sm font-semibold text-ui-primary">Об’єм / упаковка: {{ product.package_size || `${product.volume_ml} мл` }}</p>
      <p class="break-words text-sm text-ui-secondary">Артикул: {{ product.sku || '—' }}</p>
      <p class="break-all text-sm text-ui-secondary">Штрихкод: <span class="whitespace-pre-wrap">{{ product.barcode || '—' }}</span></p>
      <div v-if="showStock" role="group" aria-label="Залишки товару" class="flex flex-wrap gap-1.5 text-xs">
        <span class="stock-chip stock-chip--on-hand">На складі: <strong>{{ product.on_hand }}</strong></span>
        <span class="stock-chip stock-chip--reserved">Резерв: <strong>{{ product.reserved }}</strong></span>
        <span class="stock-chip stock-chip--available">Доступно: <strong>{{ product.available }}</strong></span>
      </div>
      <slot />
    </div>
    </div>
    <div v-if="$slots.actions" class="mt-3"><slot name="actions" /></div>
  </article>
  <BaseModal v-model="photosOpen" style="--modal-bg: var(--bo-surface)" max-width-class="max-w-4xl" :aria-label="`Фото: ${product.name}`">
    <template #head><div class="flex items-center justify-between gap-3"><h2 class="min-w-0 break-words font-semibold">{{ product.name }}</h2><BaseButton variant="neutral" class="min-h-11 shrink-0" @click="photosOpen = false">Закрити</BaseButton></div></template>
    <template #body>
      <img v-if="photos[photoIndex]" :src="assetUrl(photos[photoIndex])" :alt="`${product.name} — фото ${photoIndex + 1}`" class="h-[50dvh] w-full rounded-xl object-contain">
      <p role="status" class="my-3 text-center text-sm text-ui-secondary">{{ photoIndex + 1 }} / {{ photos.length }} · Натисніть мініатюру для перегляду</p>
      <div class="flex flex-wrap justify-center gap-2"><button v-for="(photo, index) in photos" :key="photo" type="button" :aria-label="`Фото ${index + 1}`" :aria-pressed="photoIndex === index" class="rounded-xl p-1" :class="photoIndex === index ? 'bg-ui-accent text-white' : 'bg-ui-subtle'" @click="photoIndex = index"><img :src="assetUrl(photo)" alt="" class="h-16 w-16 rounded-lg object-contain" loading="lazy"></button></div>
    </template>
  </BaseModal>
</template>

<style scoped>
.stock-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.5rem;
  line-height: 1rem;
}
.stock-chip--on-hand {
  background: var(--bo-info-surface);
  color: var(--bo-info-text);
}
.stock-chip--reserved {
  background: var(--bo-warning-surface);
  color: var(--bo-warning-text);
}
.stock-chip--available {
  background: var(--bo-success-surface);
  color: var(--bo-success-text);
}
</style>
