<script setup lang="ts">
import type { CampaignPayload } from '~/types/messaging'

const route = useRoute()
const api = useBackofficeApi()
const { campaignTypes, channels } = useMessagingUi()
const { canCreateMessagingDrafts, canSendMessagingCampaigns } = useBackofficeAccess()

const campaignId = computed(() => route.params.id as string)
const saving = ref(false)
const saved = ref(false)

const { data: campaign, pending, error } = await useAsyncData(() => `messaging-campaign-edit-${campaignId.value}`, () => api.getMessagingCampaign(campaignId.value), { watch: [campaignId] })

const form = reactive<Partial<CampaignPayload>>({
  name: '',
  type: 'manual',
  channel: 'telegram',
  status: 'draft',
  message_body: '',
  audience_rules: [{ type: 'all_clients' }],
  timezone: 'Europe/Kiev',
  schedule_mode: 'later',
  max_messages_per_minute: 20,
  quiet_hours_enabled: true,
  duplicate_protection_days: 30,
})

watch(campaign, value => {
  if (!value) return
  form.name = value.name
  form.type = value.type
  form.channel = value.channel
  form.status = value.status === 'active' ? 'active' : 'draft'
  form.message_body = value.message_body || ''
  form.audience_rules = value.audience_rules || [{ type: 'all_clients' }]
  form.review_link = value.review_link || ''
  form.timezone = value.timezone || 'Europe/Kiev'
  form.scheduled_at = value.scheduled_at
}, { immediate: true })

const save = async () => {
  if (!canCreateMessagingDrafts.value) return
  saving.value = true
  try {
    await api.updateMessagingCampaign(campaignId.value, form)
    saved.value = true
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="messaging-page space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Messaging</p>
        <h1 class="mt-2 text-3xl font-semibold text-slate-900">Редагувати кампанію</h1>
      </div>
      <NuxtLink :to="`/messaging/campaigns/${campaignId}`" class="rounded-full border border-slate-300 px-5 py-3 text-sm">До деталей</NuxtLink>
    </div>

    <div v-if="saved" class="rounded-[1.25rem] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">Зміни збережено.</div>
    <div v-if="pending" class="rounded-[1.75rem] bg-slate-100 p-8 text-sm text-slate-500">Завантажуємо кампанію...</div>
    <div v-else-if="error" class="rounded-[1.25rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">Не вдалося завантажити кампанію.</div>
    <section v-else class="grid gap-6 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm xl:grid-cols-[1fr_360px]">
      <div class="space-y-5">
        <label class="grid gap-2 text-sm">
          <span class="font-medium text-slate-700">Назва</span>
          <input v-model="form.name" class="rounded-2xl border border-slate-300 px-4 py-3">
        </label>
        <div class="grid gap-4 md:grid-cols-3">
          <label class="grid gap-2 text-sm">
            <span class="font-medium text-slate-700">Тип</span>
            <select v-model="form.type" class="rounded-2xl border border-slate-300 px-4 py-3">
              <option v-for="type in campaignTypes" :key="type.value" :value="type.value">{{ type.label }}</option>
            </select>
          </label>
          <label class="grid gap-2 text-sm">
            <span class="font-medium text-slate-700">Канал</span>
            <select v-model="form.channel" class="rounded-2xl border border-slate-300 px-4 py-3">
              <option v-for="channel in channels" :key="channel.value" :value="channel.value" :disabled="!channel.enabled">{{ channel.label }}</option>
            </select>
          </label>
          <label class="grid gap-2 text-sm">
            <span class="font-medium text-slate-700">Статус</span>
            <select v-model="form.status" class="rounded-2xl border border-slate-300 px-4 py-3">
              <option value="draft">Чернетка</option>
              <option value="active" :disabled="!canSendMessagingCampaigns">Активна</option>
            </select>
          </label>
        </div>
        <label class="grid gap-2 text-sm">
          <span class="font-medium text-slate-700">Повідомлення</span>
          <textarea v-model="form.message_body" class="min-h-52 rounded-2xl border border-slate-300 px-4 py-3 leading-6" />
        </label>
        <label class="grid gap-2 text-sm">
          <span class="font-medium text-slate-700">Review link</span>
          <input v-model="form.review_link" class="rounded-2xl border border-slate-300 px-4 py-3">
        </label>
        <button class="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-50" :disabled="saving || !form.name || !form.message_body || !canCreateMessagingDrafts" @click="save">
          {{ saving ? 'Збереження...' : 'Зберегти зміни' }}
        </button>
      </div>
      <MessagePreview :body="form.message_body || ''" />
    </section>
  </div>
</template>
