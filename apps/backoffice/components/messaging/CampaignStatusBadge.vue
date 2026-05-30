<script setup lang="ts">
import type { CampaignStatus } from '~/types/messaging'

defineProps<{ status: CampaignStatus | string }>()
const { statusLabel, statusClass } = useMessagingUi()
</script>

<template>
  <span class="inline-flex rounded-full px-3 py-1 text-xs font-medium" :class="statusClass(status)">
    {{ statusLabel(status) }}
  </span>
</template>
