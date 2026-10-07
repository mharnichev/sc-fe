<script setup lang="ts">
const props = withDefaults(defineProps<{ channel: 'telegram' | 'sms'; strategy?: string; disabled?: boolean }>(), { strategy: 'single' })
const emit = defineEmits<{ 'update:channel': [value: 'telegram' | 'sms']; 'update:strategy': [value: 'single' | 'telegram_then_sms'] }>()
const selected = computed(() => props.strategy === 'single' ? [props.channel] : ['telegram', 'sms'])
const toggle = (channel: 'telegram' | 'sms', checked: boolean) => {
  const next = checked ? [...new Set([...selected.value, channel])] : selected.value.filter(value => value !== channel)
  if (!next.length) return
  emit('update:channel', next.includes('telegram') ? 'telegram' : 'sms')
  emit('update:strategy', next.length === 2 ? 'telegram_then_sms' : 'single')
}
</script>

<template>
  <fieldset class="space-y-2">
    <legend class="text-sm font-medium text-ui-primary"><MessagingCampaignFieldHelp label="Канали" /></legend>
    <div class="grid gap-3 sm:grid-cols-4">
      <BaseCheckbox v-for="channelOption in (['telegram', 'sms'] as const)" :key="channelOption" :label-class="`flex items-center gap-2 rounded-lg border p-3 ${selected.includes(channelOption) ? 'messaging-choice-active' : 'messaging-choice-idle'}`" :model-value="selected.includes(channelOption)" :disabled="disabled || (selected.length === 1 && selected.includes(channelOption))" @update:model-value="toggle(channelOption, Boolean($event))"><MessagingChannelBadge :channel="channelOption" /></BaseCheckbox>
      <div v-for="channelOption in ['whatsapp', 'email']" :key="channelOption" class="messaging-choice-idle rounded-lg border p-3 opacity-60" aria-disabled="true"><MessagingChannelBadge :channel="channelOption" /><span class="mt-1 block text-xs text-ui-muted">Недоступно</span></div>
    </div>
    <p v-if="selected.length === 2" class="text-xs text-ui-muted">Telegram, інакше SMS. Один клієнт отримує одне повідомлення.</p>
  </fieldset>
</template>
