<script setup lang="ts">
import {
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
  PhoneIcon,
  PaperAirplaneIcon,
} from '@heroicons/vue/24/outline'
import type { Component } from 'vue'
import type { MessagingChannel } from '~/types/messaging'

const props = defineProps<{ channel: MessagingChannel | string }>()
const { channelLabel } = useMessagingUi()

const channelConfig: Record<string, { icon: Component, className: string }> = {
  telegram: {
    icon: PaperAirplaneIcon,
    className: 'is-telegram',
  },
  sms: {
    icon: PhoneIcon,
    className: 'is-sms',
  },
  whatsapp: {
    icon: ChatBubbleLeftRightIcon,
    className: 'is-whatsapp',
  },
  email: {
    icon: EnvelopeIcon,
    className: 'is-email',
  },
}

const config = computed(() => channelConfig[props.channel] || {
  icon: ChatBubbleLeftRightIcon,
  className: 'is-default',
})
</script>

<template>
  <span class="messaging-channel-badge inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold" :class="config.className">
    <component :is="config.icon" class="h-3.5 w-3.5" aria-hidden="true" />
    {{ channelLabel(channel) }}
  </span>
</template>
