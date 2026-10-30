<script setup lang="ts">
import type { RewardEntryView } from '~/types/masterRewardsView'
const props = defineProps<{ entry: RewardEntryView | null, pending: boolean, error?: string, recoverable?: boolean }>()
const emit = defineEmits<{ close: [], confirm: [reason: string] }>()
const reason = ref('')
watch(() => props.entry?.id, () => { reason.value = '' })
</script>
<template>
  <BaseModal :model-value="!!entry" aria-label="Спір або повернення" @close="!pending && emit('close')">
    <template #head><h2 class="text-xl font-semibold">{{ entry?.needsReview ? 'Зняти позначку після розгляду' : 'Потрібне ручне рішення' }}</h2></template>
    <template #body><form class="space-y-4" @submit.prevent="emit('confirm', reason.trim())"><p class="break-words text-sm">Нарахування #{{ entry?.id }} · {{ entry?.product }}</p><p class="text-sm text-ui-secondary">{{ entry?.needsReview ? 'Зняття позначки фіксує ваше ручне рішення. Сервер окремо перевіряє інші блокування.' : 'Закриття нарахування буде заблоковано.' }} Якщо гроші вже передано, позначка не створює борг і не утримує інші винагороди.</p><BaseInput v-model="reason" label="Підстава спору або повернення" required maxlength="1000" :disabled="pending || recoverable" /><p v-if="error" role="alert" class="text-sm text-ui-danger">{{ error }}</p><div class="flex flex-wrap gap-2"><BaseButton variant="neutral" size="lg" :disabled="pending" @click="emit('close')">Закрити</BaseButton><BaseButton type="submit" variant="primary" size="lg" :loading="pending" :disabled="!recoverable && !reason.trim()">{{ recoverable ? 'Відновити той самий запит' : (entry?.needsReview ? 'Зняти позначку' : 'Позначити для розгляду') }}</BaseButton></div></form></template>
  </BaseModal>
</template>
