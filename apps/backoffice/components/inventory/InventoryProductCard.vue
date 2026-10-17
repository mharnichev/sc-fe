<script setup lang="ts">
import type { InventoryProduct } from '~/types/inventory'
withDefaults(defineProps<{ product: InventoryProduct, framed?: boolean }>(), { framed: true })
const assetUrl = useAssetUrl()
</script>

<template>
  <article class="inventory-product-card flex min-w-0 gap-3" :class="framed ? 'rounded-xl border border-ui-border bg-ui-surface p-3' : 'inventory-product-card--unframed'">
    <img v-if="product.image_url" :src="assetUrl(product.image_url)" :alt="product.name" class="h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-xl object-contain" loading="lazy">
    <div class="min-w-0 flex-1 space-y-1">
      <p class="break-words font-semibold text-ui-primary">{{ product.name }}</p>
      <p v-if="product.brand_name || product.model_name || product.package_size || product.volume_ml" class="text-sm text-ui-secondary">{{ [product.brand_name, product.model_name, product.package_size || (product.volume_ml ? `${product.volume_ml} мл` : null)].filter(Boolean).join(' · ') }}</p>
      <p class="break-words text-sm text-ui-secondary">Артикул: {{ product.sku || '—' }}</p>
      <p class="break-all text-sm text-ui-secondary">Штрихкод: <span class="whitespace-pre-wrap">{{ product.barcode || '—' }}</span></p>
      <div role="group" aria-label="Залишки товару" class="flex flex-wrap gap-1.5 text-xs">
        <span class="stock-chip stock-chip--on-hand">На складі: <strong>{{ product.on_hand }}</strong></span>
        <span class="stock-chip stock-chip--reserved">Резерв: <strong>{{ product.reserved }}</strong></span>
        <span class="stock-chip stock-chip--available">Доступно: <strong>{{ product.available }}</strong></span>
      </div>
      <slot />
    </div>
  </article>
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
