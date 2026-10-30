<script setup lang="ts">
import { ClockIcon } from '@heroicons/vue/24/outline'
import type { RewardSettlementView } from '~/types/masterRewardsView'
import { rewardDate, rewardMoney } from '~/utils/masterRewardsView'
defineProps<{ settlements: RewardSettlementView[] }>()
</script>
<template>
  <details class="rounded-2xl border border-ui p-4"><summary class="min-h-8 cursor-pointer text-sm font-semibold"><ClockIcon class="mr-1 inline h-5 w-5" aria-hidden="true" />Історія передач</summary>
    <p v-if="!settlements.length" class="mt-3 text-sm text-ui-secondary">Підтверджених передач немає.</p>
    <article v-for="settlement in settlements" :key="settlement.id" class="mt-3 rounded-xl bg-ui-subtle p-3 text-sm"><div class="flex flex-wrap justify-between gap-2"><p class="font-medium">Передача #{{ settlement.id }}</p><strong>{{ rewardMoney(settlement.amountMinor) }}</strong></div><p class="mt-1 font-medium">{{ settlement.master }}</p><p class="mt-1">Фактично передано: {{ rewardDate(settlement.handedAt) }}</p><p class="mt-1 text-xs text-ui-secondary">Записано: {{ rewardDate(settlement.recordedAt) }} · Нарахування: {{ settlement.entryIds.map(id => `#${id}`).join(', ') }}</p></article>
  </details>
</template>
