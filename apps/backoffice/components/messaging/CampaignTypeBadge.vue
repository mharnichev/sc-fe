<script setup lang="ts">
import type { CampaignType } from '~/types/messaging'

defineProps<{ type: CampaignType | string }>()
const { campaignTypeLabel } = useMessagingUi()
</script>

<template>
  <span class="inline-flex rounded-full bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-800">
    {{ campaignTypeLabel(type) }}
  </span>
</template>
