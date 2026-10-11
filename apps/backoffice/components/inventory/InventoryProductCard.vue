<script setup lang="ts">
import type { InventoryProduct } from '~/types/inventory'
defineProps<{ product: InventoryProduct }>()
const assetUrl = useAssetUrl()
</script>

<template>
  <article class="flex min-w-0 gap-3 rounded-2xl border border-ui-border bg-ui-surface p-4">
    <img v-if="product.image_url" :src="assetUrl(product.image_url)" :alt="product.name" class="h-20 w-20 shrink-0 rounded-xl object-contain" loading="lazy">
    <div class="min-w-0 flex-1 space-y-1">
      <p class="break-words font-semibold text-ui-primary">{{ product.name }}</p>
      <p v-if="product.brand_name || product.model_name || product.package_size || product.volume_ml" class="text-sm text-ui-secondary">{{ [product.brand_name, product.model_name, product.package_size || (product.volume_ml ? `${product.volume_ml} мл` : null)].filter(Boolean).join(' · ') }}</p>
      <p class="break-words text-sm text-ui-secondary">Артикул: {{ product.sku || '—' }}</p>
      <p class="break-all text-sm text-ui-secondary">Штрихкод: <span class="whitespace-pre-wrap">{{ product.barcode || '—' }}</span></p>
      <p class="text-sm text-ui-primary">На складі: {{ product.on_hand }} · Резерв: {{ product.reserved }} · Доступно: {{ product.available }}</p>
      <slot />
    </div>
  </article>
</template>
