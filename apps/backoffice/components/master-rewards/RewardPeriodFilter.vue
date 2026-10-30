<script setup lang="ts">
import { CalendarDaysIcon } from '@heroicons/vue/24/outline'
import { rewardRange } from '~/utils/masterRewardsView'
const props = defineProps<{ from: string, to: string, disabled?: boolean }>()
const emit = defineEmits<{ apply: [range: { from: string, to: string }] }>()
const fromDraft = ref(props.from), toDraft = ref(props.to)
watch(() => [props.from, props.to], () => { fromDraft.value = props.from; toDraft.value = props.to })
const valid = computed(() => /^\d{4}-\d{2}-\d{2}$/.test(fromDraft.value) && /^\d{4}-\d{2}-\d{2}$/.test(toDraft.value) && fromDraft.value <= toDraft.value)
</script>
<template>
  <section aria-label="Період продажів" class="rounded-2xl border border-ui p-3 sm:p-4">
    <p class="mb-3 flex items-center gap-2 text-sm font-semibold"><CalendarDaysIcon class="h-5 w-5" aria-hidden="true" />Період продажів</p>
    <div class="flex flex-wrap items-center gap-2">
      <BaseButton variant="neutral" size="lg" :disabled="disabled" @click="emit('apply', rewardRange('week'))">Цей тиждень</BaseButton>
      <BaseButton variant="neutral" size="lg" :disabled="disabled" @click="emit('apply', rewardRange('month'))">Цей місяць</BaseButton>
    </div>
    <form class="mt-3 grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]" @submit.prevent="valid && emit('apply', { from: fromDraft, to: toDraft })">
      <BaseInput v-model="fromDraft" type="date" label="Продажі з" :max="toDraft || undefined" :disabled="disabled" />
      <BaseInput v-model="toDraft" type="date" label="Продажі до" :min="fromDraft || undefined" :disabled="disabled" />
      <BaseButton type="submit" variant="primary" size="lg" :disabled="disabled || !valid">Застосувати</BaseButton>
    </form>
    <p class="mt-2 text-xs text-ui-secondary">Дати продажів, часовий пояс Києва. Дату фактичної передачі показано окремо в історії.</p>
  </section>
</template>
