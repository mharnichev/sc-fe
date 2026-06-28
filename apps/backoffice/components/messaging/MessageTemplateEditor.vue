<script setup lang="ts">
import type { CampaignType, MessageTemplatePayload, MessagingChannel } from '~/types/messaging'

const props = defineProps<{
  modelValue: MessageTemplatePayload
}>()

const emit = defineEmits<{ 'update:modelValue': [value: MessageTemplatePayload] }>()
const { campaignTypes, channels, variables } = useMessagingUi()

const form = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const update = (patch: Partial<MessageTemplatePayload>) => {
  form.value = { ...form.value, ...patch }
}

const insertVariable = (variable: string) => {
  update({
    message_body: `${form.value.message_body || ''}${form.value.message_body ? ' ' : ''}${variable}`,
    variables: Array.from(new Set([...(form.value.variables || []), variable])),
  })
}
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-[1fr_360px]">
    <div class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2">
        <label class="grid gap-2 text-sm">
          <span class="font-medium text-slate-700">Назва шаблону</span>
          <BaseInput class="rounded-2xl border border-slate-300 px-4 py-3" :value="form.name" @input="update({ name: ($event.target as HTMLInputElement).value })" />
        </label>
        <label class="grid gap-2 text-sm">
          <span class="font-medium text-slate-700">Тип кампанії</span>
          <BaseSelect native class="rounded-2xl border border-slate-300 px-4 py-3" :value="form.campaign_type" @change="update({ campaign_type: ($event.target as HTMLSelectElement).value as CampaignType })">
            <option v-for="type in campaignTypes" :key="type.value" :value="type.value">{{ type.label }}</option>
          </BaseSelect>
        </label>
        <label class="grid gap-2 text-sm">
          <span class="font-medium text-slate-700">Канал</span>
          <BaseSelect native class="rounded-2xl border border-slate-300 px-4 py-3" :value="form.channel" @change="update({ channel: ($event.target as HTMLSelectElement).value as MessagingChannel })">
            <option v-for="channel in channels" :key="channel.value" :value="channel.value" :disabled="!channel.enabled">{{ channel.label }}</option>
          </BaseSelect>
        </label>
        <label class="grid gap-2 text-sm">
          <span class="font-medium text-slate-700">Мова</span>
          <BaseSelect native class="rounded-2xl border border-slate-300 px-4 py-3" :value="form.language" @change="update({ language: ($event.target as HTMLSelectElement).value })">
            <option value="uk">Українська</option>
            <option value="en">English</option>
          </BaseSelect>
        </label>
      </div>

      <label class="grid gap-2 text-sm">
        <span class="font-medium text-slate-700">Текст повідомлення</span>
        <BaseTextarea class="min-h-44 rounded-2xl border border-slate-300 px-4 py-3 leading-6" :value="form.message_body" @input="update({ message_body: ($event.target as HTMLTextAreaElement).value })" />
        <span class="text-xs text-slate-500">{{ form.message_body.length }} символів</span>
      </label>

      <div class="space-y-2">
        <p class="text-sm font-medium text-slate-700">Змінні</p>
        <VariablePicker @select="insertVariable" />
      </div>

      <div class="flex flex-wrap gap-3">
        <label class="inline-flex items-center gap-2 text-sm text-slate-700">
          <BaseCheckbox  :checked="form.is_active" @change="update({ is_active: ($event.target as HTMLInputElement).checked })" />
          Активний
        </label>
        <label class="inline-flex items-center gap-2 text-sm text-slate-700">
          <BaseCheckbox  :checked="form.is_default" @change="update({ is_default: ($event.target as HTMLInputElement).checked })" />
          Шаблон за замовчуванням
        </label>
      </div>
    </div>

    <MessagePreview :body="form.message_body" />
  </div>
</template>
