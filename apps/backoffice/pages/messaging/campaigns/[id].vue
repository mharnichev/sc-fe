<script setup lang="ts">
import { ArchiveBoxIcon, DocumentDuplicateIcon, PauseIcon, PlayIcon, ArrowPathIcon } from '@heroicons/vue/24/outline'

const route = useRoute()
const api = useBackofficeApi()
const { campaignTypeLabel, channelLabel } = useMessagingUi()
const { canSendMessagingCampaigns, canCreateMessagingDrafts } = useBackofficeAccess()

const campaignId = computed(() => route.params.id as string)
const [{ data: campaign, pending, error, refresh }, { data: logs, pending: logsPending, refresh: refreshLogs }] = await Promise.all([
  useAsyncData(() => `messaging-campaign-${campaignId.value}`, () => api.getMessagingCampaign(campaignId.value), { watch: [campaignId] }),
  useAsyncData(() => `messaging-campaign-${campaignId.value}-logs`, () => api.getMessagingCampaignLogs(campaignId.value, 1, 50), { watch: [campaignId] }),
])

const actionPending = ref(false)
const confirmRetry = ref(false)

const setStatus = async (status: string) => {
  actionPending.value = true
  try {
    await api.updateMessagingCampaignStatus(campaignId.value, status)
    await refresh()
  }
  finally {
    actionPending.value = false
  }
}

const duplicate = async () => {
  await api.duplicateMessagingCampaign(campaignId.value)
  await navigateTo('/messaging/campaigns')
}

const retryFailed = async () => {
  actionPending.value = true
  try {
    await api.retryMessagingCampaignFailed(campaignId.value)
    confirmRetry.value = false
    await refreshLogs()
  }
  finally {
    actionPending.value = false
  }
}
</script>

<template>
  <div class="messaging-page space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Messaging</p>
        <h1 class="mt-2 text-3xl font-semibold text-slate-900">{{ campaign?.name || 'Кампанія' }}</h1>
      </div>
      <NuxtLink to="/messaging/campaigns" class="rounded-full border border-slate-300 px-5 py-3 text-sm">До кампаній</NuxtLink>
    </div>

    <div v-if="pending" class="rounded-[1.75rem] bg-slate-100 p-8 text-sm text-slate-500">Завантажуємо кампанію...</div>
    <div v-else-if="error || !campaign" class="rounded-[1.25rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">Кампанію не знайдено або API недоступний.</div>
    <template v-else>
      <section class="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex flex-wrap gap-2">
              <CampaignStatusBadge :status="campaign.status" />
              <CampaignTypeBadge :type="campaign.type" />
              <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{{ channelLabel(campaign.channel) }}</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <button v-if="canSendMessagingCampaigns" class="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm" :disabled="actionPending" @click="setStatus(campaign.status === 'paused' ? 'active' : 'paused')">
                <PlayIcon v-if="campaign.status === 'paused'" class="h-4 w-4" /><PauseIcon v-else class="h-4 w-4" /> {{ campaign.status === 'paused' ? 'Resume' : 'Pause' }}
              </button>
              <button v-if="canSendMessagingCampaigns" class="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm" :disabled="actionPending" @click="confirmRetry = true">
                <ArrowPathIcon class="h-4 w-4" /> Retry failed
              </button>
              <button v-if="canCreateMessagingDrafts" class="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm" @click="duplicate">
                <DocumentDuplicateIcon class="h-4 w-4" /> Duplicate
              </button>
              <button v-if="canSendMessagingCampaigns" class="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm" :disabled="actionPending" @click="setStatus('archived')">
                <ArchiveBoxIcon class="h-4 w-4" /> Archive
              </button>
            </div>
          </div>

          <dl class="mt-6 grid gap-4 text-sm md:grid-cols-2">
            <div class="rounded-2xl bg-slate-50 p-4"><dt class="text-slate-500">Тип</dt><dd class="mt-1 font-medium text-slate-900">{{ campaignTypeLabel(campaign.type) }}</dd></div>
            <div class="rounded-2xl bg-slate-50 p-4"><dt class="text-slate-500">Автор</dt><dd class="mt-1 font-medium text-slate-900">{{ campaign.created_by }}</dd></div>
            <div class="rounded-2xl bg-slate-50 p-4"><dt class="text-slate-500">Заплановано</dt><dd class="mt-1 font-medium text-slate-900">{{ campaign.scheduled_at ? new Date(campaign.scheduled_at).toLocaleString('uk-UA') : '—' }}</dd></div>
            <div class="rounded-2xl bg-slate-50 p-4"><dt class="text-slate-500">Timezone</dt><dd class="mt-1 font-medium text-slate-900">{{ campaign.timezone || 'Europe/Kyiv' }}</dd></div>
          </dl>
        </div>
        <MessagePreview :body="campaign.message_body || ''" />
      </section>

      <CampaignAnalyticsCards :metrics="campaign.metrics || { total_recipients: campaign.audience_size, sent: campaign.sent_count, failed: campaign.failed_count, skipped: 0, delivery_rate: campaign.audience_size ? Math.round((campaign.sent_count / campaign.audience_size) * 100) : 0 }" />

      <section class="grid gap-6 xl:grid-cols-2">
        <div class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 class="text-xl font-semibold text-slate-900">Фільтри аудиторії</h2>
          <pre class="mt-4 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">{{ campaign.audience_rules || [] }}</pre>
        </div>
        <div class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 class="text-xl font-semibold text-slate-900">Налаштування розкладу</h2>
          <dl class="mt-4 space-y-3 text-sm">
            <div class="flex justify-between gap-4"><dt class="text-slate-500">Review link</dt><dd class="font-medium text-slate-900">{{ campaign.review_link || '—' }}</dd></div>
            <div class="flex justify-between gap-4"><dt class="text-slate-500">Created</dt><dd class="font-medium text-slate-900">{{ new Date(campaign.created_at).toLocaleString('uk-UA') }}</dd></div>
          </dl>
        </div>
      </section>

      <section class="space-y-4">
        <h2 class="text-xl font-semibold text-slate-900">Журнал відправок</h2>
        <SendLogsTable :logs="logs?.items || []" :pending="logsPending" />
      </section>
    </template>

    <ConfirmActionModal
      v-model="confirmRetry"
      title="Повторити невдалі відправки?"
      message="Система повторно поставить у чергу тільки повідомлення зі статусом failed."
      confirm-label="Повторити"
      :pending="actionPending"
      @confirm="retryFailed"
    />
  </div>
</template>
