<script setup lang="ts">
import { isNotificationType } from '~/utils/campaignAudience.mjs'
import { ArchiveBoxIcon, DocumentDuplicateIcon, PauseIcon, PlayIcon, ArrowPathIcon } from '@heroicons/vue/24/outline'

const route = useRoute()
const api = useBackofficeApi()
const { campaignTypeLabel } = useMessagingUi()
const { canSendMessagingCampaigns, canCreateMessagingDrafts } = useBackofficeAccess()

const campaignId = computed(() => route.params.id as string)
const { data: campaign, pending, error, refresh } = await useAsyncData(() => `messaging-campaign-${campaignId.value}`, () => api.getMessagingCampaign(campaignId.value), { watch: [campaignId] })
const logsPage = ref(1)
const legacyRecipientsPage = ref(1)
const emptyRecipients = () => ({ items: [], total: 0, page: 1, page_size: 50 })
const [
  { data: logs, pending: logsPending, error: logsError, refresh: refreshLogs },
  { data: recipients, pending: recipientsPending, error: recipientsError, refresh: refreshRecipients },
  { data: calculatedRecipients, pending: calculatedRecipientsPending, error: calculatedRecipientsError, refresh: refreshCalculatedRecipients },
] = await Promise.all([
  useAsyncData(() => `messaging-campaign-${campaignId.value}-logs`, () => api.getMessagingCampaignLogs(campaignId.value, logsPage.value, 50), { watch: [campaignId, logsPage] }),
  useAsyncData(() => `messaging-campaign-${campaignId.value}-recipients`, () => campaign.value?.segment_ids?.length ? Promise.resolve(emptyRecipients()) : api.getMessagingCampaignRecipients(campaignId.value, legacyRecipientsPage.value, 50), { watch: [campaignId, legacyRecipientsPage] }),
  useAsyncData(() => `messaging-campaign-${campaignId.value}-calculated-recipients`, () => campaign.value?.segment_ids?.length || isNotificationType(campaign.value?.type || '') ? Promise.resolve(emptyRecipients()) : api.getMessagingCampaignRecipients(campaignId.value, legacyRecipientsPage.value, 50, true), { watch: [campaignId, legacyRecipientsPage] }),
])

const isNotification = computed(() => !!campaign.value && isNotificationType(campaign.value.type))
const audienceDirty = ref(false)
const actionPending = ref(false)
const actionError = ref('')
const { apiErrorMessage } = useBookingFormatting()
const confirmRetry = ref(false)

const refreshRecipientViews = () => Promise.all([refreshRecipients(), refreshCalculatedRecipients()])

const setStatus = async (status: string) => {
  actionPending.value = true
  try {
    await api.updateMessagingCampaignStatus(campaignId.value, status)
    await Promise.all([refresh(), refreshRecipientViews()])
  }
  catch (cause) { actionError.value = apiErrorMessage(cause, 'Не вдалося виконати дію.') }
  finally {
    actionPending.value = false
  }
}

const duplicate = async () => {
  await api.duplicateMessagingCampaign(campaignId.value)
  await navigateTo(isNotification.value ? '/messaging/notifications' : '/messaging/campaigns')
}

const retryFailed = async () => {
  actionPending.value = true
  try {
    await api.retryMessagingCampaignFailed(campaignId.value)
    confirmRetry.value = false
    await Promise.all([refreshLogs(), refreshRecipients()])
  }
  catch (cause) { actionError.value = apiErrorMessage(cause, 'Не вдалося виконати дію.') }
  finally {
    actionPending.value = false
  }
}
</script>

<template>
  <div class="messaging-page space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Комунікації</p>
        <h1 class="mt-2 text-3xl font-semibold text-slate-900">{{ campaign?.name || 'Кампанія' }}</h1>
      </div>
      <NuxtLink :to="isNotification ? '/messaging/notifications' : '/messaging/campaigns'" class="rounded-full border border-slate-300 px-5 py-3 text-sm">{{ isNotification ? 'До сповіщень' : 'До кампаній' }}</NuxtLink>
    </div>

    <div v-if="pending" class="rounded-[1.75rem] bg-slate-100 p-8 text-sm text-slate-500">Завантажуємо кампанію...</div>
    <div v-else-if="error || !campaign" class="rounded-[1.25rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">Кампанію не знайдено або API недоступний.</div>
    <template v-else>
      <section class="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex flex-wrap gap-2">
              <MessagingCampaignStatusBadge :status="campaign.status" />
              <MessagingCampaignTypeBadge :type="campaign.type" />
              <MessagingChannelBadge :channel="campaign.channel" />
            </div>
            <div class="flex flex-wrap gap-2">
              <BaseButton v-if="canSendMessagingCampaigns && (isNotification || ['active', 'paused'].includes(campaign.status))" class="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm" :disabled="actionPending" @click="setStatus(campaign.status === 'paused' ? 'active' : 'paused')">
                <PlayIcon v-if="campaign.status === 'paused'" class="h-4 w-4" /><PauseIcon v-else class="h-4 w-4" /> {{ campaign.status === 'paused' ? 'Поновити' : 'Пауза' }}
              </BaseButton>
              <BaseButton v-if="canSendMessagingCampaigns && !campaign.segment_ids?.length" class="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm" :disabled="actionPending" @click="confirmRetry = true">
                <ArrowPathIcon class="h-4 w-4" /> Повторити невдалі
              </BaseButton>
              <BaseButton v-if="canCreateMessagingDrafts" class="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm" @click="duplicate">
                <DocumentDuplicateIcon class="h-4 w-4" /> Дублювати
              </BaseButton>
              <BaseButton v-if="canSendMessagingCampaigns" class="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm" :disabled="actionPending" @click="setStatus('archived')">
                <ArchiveBoxIcon class="h-4 w-4" /> Архівувати
              </BaseButton>
            </div>
          </div>

          <dl class="mt-6 grid gap-4 text-sm md:grid-cols-2">
            <div class="rounded-2xl bg-slate-50 p-4"><dt class="text-slate-500">Тип</dt><dd class="mt-1 font-medium text-slate-900">{{ campaignTypeLabel(campaign.type) }}</dd></div>
            <div class="rounded-2xl bg-slate-50 p-4"><dt class="text-slate-500">Автор</dt><dd class="mt-1 font-medium text-slate-900">{{ campaign.created_by }}</dd></div>
            <div class="rounded-2xl bg-slate-50 p-4"><dt class="text-slate-500">Заплановано</dt><dd class="mt-1 font-medium text-slate-900">{{ campaign.scheduled_at ? new Date(campaign.scheduled_at).toLocaleString('uk-UA') : '—' }}</dd></div>
            <div class="rounded-2xl bg-slate-50 p-4"><dt class="text-slate-500">Timezone</dt><dd class="mt-1 font-medium text-slate-900">{{ campaign.timezone || 'Europe/Kyiv' }}</dd></div>
          </dl>
        </div>
        <div class="space-y-2"><p class="text-sm text-ui-muted">Приклад поточного повідомлення з тестовими даними</p><MessagingMessagePreview :body="campaign.message_body || ''" /></div>
      </section>

      <p v-if="actionError" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">{{ actionError }}</p>
      <MessagingCampaignAudienceEditor v-if="!isNotification && campaign.recipient === 'customer'" :key="`editor-${campaignId}`" :campaign="campaign" @saved="refresh" @dirty="audienceDirty = $event" />
      <MessagingCampaignRunPanel v-if="!isNotification && campaign.recipient === 'customer'" :key="`runs-${campaignId}`" :campaign="campaign" :dirty="audienceDirty" @launched="refresh" />

      <MessagingCampaignAnalyticsCards v-if="!campaign.segment_ids?.length" :metrics="campaign.metrics || { total_recipients: campaign.audience_size, sent: campaign.sent_count, failed: campaign.failed_count, skipped: 0, delivery_rate: campaign.audience_size ? Math.round((campaign.sent_count / campaign.audience_size) * 100) : 0 }" />

      <section v-if="!campaign.segment_ids?.length" class="grid gap-6 xl:grid-cols-2">
        <div v-if="!isNotification" class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
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

      <section id="delivery-journal" class="space-y-4">
        <h2 class="text-xl font-semibold text-slate-900">Журнал відправок</h2>
        <p v-if="logsError" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">Не вдалося завантажити журнал. <BaseButton @click="refreshLogs()">Повторити</BaseButton></p>
        <MessagingSendLogsTable v-else :logs="logs?.items || []" :pending="logsPending" />
        <div class="flex flex-wrap items-center gap-3"><BaseButton :disabled="logsPending || logsPage === 1" @click="logsPage--">Попередня</BaseButton><span class="text-sm">Сторінка {{ logsPage }} · {{ logs?.total ?? '—' }} записів</span><BaseButton :disabled="logsPending || !logs || logsPage * 50 >= logs.total" @click="logsPage++">Наступна</BaseButton></div>
      </section>

      <section v-if="!campaign.segment_ids?.length" id="recipients" class="space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 class="text-xl font-semibold text-slate-900">Отримувачі кампанії</h2>
            <p class="mt-1 text-sm text-slate-500">
              {{ isNotification ? 'Повідомлення, створені за подіями, та їхні статуси доставки.' : 'Фактична черга показує створені повідомлення, розрахована аудиторія показує клієнтів, які підпадають під правила кампанії.' }}
            </p>
          </div>
          <BaseButton class="messaging-secondary-action rounded-full px-4 py-2 text-sm font-medium" :disabled="recipientsPending || calculatedRecipientsPending" @click="refreshRecipientViews">
            Оновити
          </BaseButton>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
            <p class="text-xs uppercase tracking-[0.18em] text-slate-500">У черзі / історії</p>
            <p class="mt-2 text-2xl font-semibold text-slate-900">{{ recipients?.total || 0 }}</p>
          </div>
          <div v-if="!isNotification" class="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
            <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Розрахована аудиторія</p>
            <p class="mt-2 text-2xl font-semibold text-slate-900">{{ calculatedRecipients?.total || 0 }}</p>
          </div>
        </div>

        <p v-if="recipientsError || calculatedRecipientsError" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">Не вдалося завантажити отримувачів.</p>
        <div class="grid gap-6 xl:grid-cols-2">
          <div>
            <h3 class="mb-3 font-semibold text-slate-900">Фактична черга та статуси</h3>
            <MessagingCampaignRecipientsTable
              :recipients="recipients?.items || []"
              :pending="recipientsPending"
              empty-label="Повідомлення для цієї кампанії ще не створені."
            />
          </div>
          <div v-if="!isNotification">
            <h3 class="mb-3 font-semibold text-slate-900">Хто підпадає під правила</h3>
            <MessagingCampaignRecipientsTable
              :recipients="calculatedRecipients?.items || []"
              :pending="calculatedRecipientsPending"
              empty-label="За правилами кампанії отримувачів не знайдено."
            />
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-3"><BaseButton :disabled="recipientsPending || calculatedRecipientsPending || legacyRecipientsPage === 1" @click="legacyRecipientsPage--">Попередня</BaseButton><span class="text-sm">Сторінка {{ legacyRecipientsPage }}</span><BaseButton :disabled="recipientsPending || calculatedRecipientsPending || legacyRecipientsPage * 50 >= Math.max(recipients?.total || 0, calculatedRecipients?.total || 0)" @click="legacyRecipientsPage++">Наступна</BaseButton></div>
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
