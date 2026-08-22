<script setup lang="ts">
import type { CampaignType } from '~/types/messaging'

defineProps<{ type: CampaignType | string }>()
const { campaignTypeLabel } = useMessagingUi()
</script>

<template>
  <span class="ui-status-info inline-flex rounded-full px-3 py-1 text-xs font-medium">
    {{ campaignTypeLabel(type) }}
  </span>
</template>
