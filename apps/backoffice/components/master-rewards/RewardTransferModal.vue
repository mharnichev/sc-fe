<script setup lang="ts">
import type { RewardEntryView } from '~/types/masterRewardsView'
import { rewardDate, rewardMoney } from '~/utils/masterRewardsView'
const props = defineProps<{ modelValue: boolean, entries: RewardEntryView[], masterName: string, amountMinor: number, pending: boolean, error?: string, recoverable?: boolean }>()
const emit = defineEmits<{ close: [], confirm: [actualDate: string, reason: string] }>()
const actualDate = ref(''), reason = ref(''), confirmed = ref(false)
watch(() => props.modelValue, open => { if (open) { actualDate.value = ''; reason.value = ''; confirmed.value = false } })
const submit = () => { if (props.recoverable || (confirmed.value && actualDate.value && reason.value.trim() && props.entries.length)) emit('confirm', actualDate.value, reason.value.trim()) }
</script>
<template>
  <BaseModal :model-value="modelValue" aria-label="Підтвердити передачу винагороди" max-width-class="max-w-2xl" @close="!pending && emit('close')">
    <template #head><h2 class="text-xl font-semibold">Підтвердити передачу</h2></template>
    <template #body>
      <form class="space-y-4" @submit.prevent="submit">
        <p class="rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900">Гроші передаються вручну поза системою. Ця дія лише записує факт передачі.</p>
        <p class="font-semibold">{{ masterName }}</p>
        <ul class="max-h-64 space-y-2 overflow-y-auto text-sm"><li v-for="entry in entries" :key="entry.id" class="flex justify-between gap-3 rounded-xl border border-ui p-3"><span class="min-w-0 break-words">#{{ entry.id }} · {{ entry.product }}<span class="mt-1 block text-xs text-ui-secondary">{{ rewardDate(entry.soldAt) }} · Замовлення #{{ entry.orderId }}</span></span><strong class="shrink-0">{{ rewardMoney(entry.rewardMinor) }}</strong></li></ul>
        <p class="flex justify-between gap-2 border-t border-ui pt-3 font-semibold"><span>Разом до передачі</span><span>{{ rewardMoney(amountMinor) }}</span></p>
        <BaseInput v-model="actualDate" type="datetime-local" label="Дата та час фактичної передачі" required :disabled="pending || recoverable" />
        <BaseInput v-model="reason" label="Підстава запису про передачу" required maxlength="1000" :disabled="pending || recoverable" />
        <BaseCheckbox v-model="confirmed" :disabled="pending || recoverable">Я фактично передав/передала цю суму майстру за перелічені нарахування.</BaseCheckbox>
        <p v-if="error" role="alert" class="break-words text-sm text-ui-danger">{{ error }}</p>
        <div class="flex flex-wrap gap-2"><BaseButton variant="neutral" size="lg" :disabled="pending" @click="emit('close')">Закрити</BaseButton><BaseButton type="submit" variant="primary" size="lg" :loading="pending" :disabled="!recoverable && (!confirmed || !actualDate || !reason.trim() || !entries.length)">{{ recoverable ? 'Відновити той самий запит' : 'Підтвердити передачу' }}</BaseButton></div>
      </form>
    </template>
  </BaseModal>
</template>
