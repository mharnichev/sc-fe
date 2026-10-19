<script setup lang="ts">
import type { ShipmentTone } from '~/utils/shipmentStatus'
defineProps<{ label: string, icon: string, tone: ShipmentTone }>()
</script>
<template>
  <BaseBadge :tone="tone === 'info' ? 'neutral' : tone" class="order-status-badge" :class="`order-status-badge--${tone}`" :data-tone="tone">
    <BaseIcon :name="icon" size="xs" /><span>{{ label }}</span>
  </BaseBadge>
</template>
<style scoped>
.order-status-badge { display: inline-flex; align-items: center; gap: .35rem; max-width: 100%; border: 0; border-radius: 999px; padding: .35rem .6rem; font-size: .75rem; font-weight: 700; line-height: 1.25; text-transform: none; letter-spacing: normal; }
.order-status-badge span { min-width: 0; overflow-wrap: anywhere; }
.order-status-badge--neutral { background: linear-gradient(110deg, #f7f8f9, #fdfdfd); color: #495057; }
.order-status-badge--warning { background: linear-gradient(110deg, #fffbed, #fffefa); color: #7a4d00; }
.order-status-badge--info { background: linear-gradient(110deg, #f0f6ff, #fcfdff); color: #1e40af; }
.order-status-badge--success { background: linear-gradient(110deg, #effaf3, #fcfefc); color: #166534; }
.order-status-badge--danger { background: linear-gradient(110deg, #fff2f2, #fffdfd); color: #b91c1c; }
</style>
