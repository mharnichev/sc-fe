<script setup lang="ts">
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline'
import type { RewardEntryView } from '~/types/masterRewardsView'
import { rewardDate, rewardMoney, rewardPercent } from '~/utils/masterRewardsView'
const props = defineProps<{ entries: RewardEntryView[], selected?: number[], admin?: boolean, disabled?: boolean, selectionDisabled?: boolean }>()
const emit = defineEmits<{ toggle: [id: number], review: [entry: RewardEntryView] }>()
const stateLabel = (entry: RewardEntryView) => entry.state === 'transferred' ? (entry.needsReview ? 'Передано · потребує рішення' : 'Передано') : entry.needsReview ? 'Потребує рішення' : 'Очікується'
</script>
<template>
  <div class="space-y-2" aria-label="Нарахування за товари">
    <p v-if="!entries.length" class="rounded-xl border border-dashed border-ui p-5 text-sm text-ui-secondary">Нарахувань за цей період немає.</p>
    <article v-for="entry in entries" :key="entry.id" class="min-w-0 rounded-xl border border-ui p-3">
      <div class="flex items-start gap-3">
        <input v-if="admin" type="checkbox" class="mt-1 h-5 w-5 shrink-0" :aria-label="`Обрати нарахування #${entry.id}: ${entry.product}`" :checked="selected?.includes(entry.id)" :disabled="disabled || selectionDisabled || !entry.canSettle || entry.needsReview" @change="emit('toggle', entry.id)">
        <div class="min-w-0 flex-1"><p class="break-words font-medium">{{ entry.product }}</p><p class="mt-1 text-xs text-ui-secondary">{{ rewardDate(entry.soldAt) }} · Замовлення #{{ entry.orderId }} · {{ entry.quantity }} шт.</p></div>
        <strong class="shrink-0 text-sm">{{ rewardMoney(entry.rewardMinor) }}</strong>
      </div>
      <div class="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs"><span class="text-ui-secondary">База {{ rewardMoney(entry.basisMinor) }} × {{ rewardPercent(entry.rateBps) }}</span><span class="rounded-lg px-2 py-1 font-medium" :class="entry.needsReview ? 'bg-amber-50 text-amber-900' : 'bg-ui-subtle text-ui-primary'">{{ stateLabel(entry) }}</span></div>
      <p v-if="entry.reason" class="mt-2 break-words text-sm text-ui-secondary">{{ entry.reason }}</p>
      <BaseButton v-if="admin" variant="ghost" class="mt-1 min-h-11 gap-2 text-xs" :disabled="disabled" @click="emit('review', entry)"><ExclamationTriangleIcon class="h-4 w-4" aria-hidden="true" />{{ entry.needsReview ? 'Розглянути позначку' : 'Позначити спір / повернення' }}</BaseButton>
    </article>
  </div>
</template>
