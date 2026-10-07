<script setup lang="ts">
import { isNotificationType } from '~/utils/campaignAudience.mjs'
import { ArchiveBoxIcon, DocumentDuplicateIcon, PauseIcon, PlayIcon, ArrowPathIcon, PencilSquareIcon, XMarkIcon, ArrowLeftIcon } from '@heroicons/vue/24/outline'

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

const isNewMaster = computed(() => !!campaign.value?.offer_master_id || !!campaign.value?.offer_promotion_id)
const editing = ref(false)
const editorSaving = ref(false)
const editorVersion = ref(0)
const confirmCancelEditing = ref(false)
const canEdit = computed(() => canCreateMessagingDrafts.value && (isNewMaster.value ? campaign.value?.status === 'draft' : !isNotification.value && campaign.value?.status !== 'archived'))
watch(campaignId, () => { editing.value = false; editorVersion.value++ })
const newMasterDirty = ref(false)
const newMasterSaved = async (saved: typeof campaign.value) => { campaign.value = saved; newMasterDirty.value = false; editing.value = false; editorVersion.value++; await refresh() }
const isNotification = computed(() => !!campaign.value && isNotificationType(campaign.value.type))
const audienceDirty = ref(false)
const cancelEditing = () => {
  editing.value = false
  editorVersion.value++
  newMasterDirty.value = false
  audienceDirty.value = false
  confirmCancelEditing.value = false
}
const requestCancelEditing = () => {
  if (editorSaving.value) return
  if (newMasterDirty.value || audienceDirty.value) confirmCancelEditing.value = true
  else cancelEditing()
}
const audienceSaved = async () => { cancelEditing(); await refresh() }
const actionPending = ref(false)
const actionError = ref('')
const { apiErrorMessage } = useBookingFormatting()
const confirmRetry = ref(false)

const refreshRecipientViews = () => Promise.all([refreshRecipients(), refreshCalculatedRecipients()])

const setStatus = async (status: string) => {
  if (!canSendMessagingCampaigns.value || editing.value) return
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
  if (!canCreateMessagingDrafts.value || actionPending.value) return
  actionPending.value = true
  actionError.value = ''
  try {
    const copy = await api.duplicateMessagingCampaign(campaignId.value)
    await navigateTo(isNewMaster.value ? `/messaging/campaigns/${copy.id}?duplicated=1` : isNotification.value ? '/messaging/notifications' : '/messaging/campaigns')
  } catch (cause) { actionError.value = apiErrorMessage(cause, 'Не вдалося створити копію.') }
  finally { actionPending.value = false }
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
  <div class="messaging-page space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Комунікації</p>
        <h1 class="mt-2 text-3xl font-semibold text-ui-primary">{{ campaign?.name || 'Кампанія' }}</h1>
      </div>
      <NuxtLink :to="isNotification ? '/messaging/notifications' : '/messaging/campaigns'" class="base-button base-button--neutral gap-2 px-5 py-3 text-sm"><ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />{{ isNotification ? 'До сповіщень' : 'До кампаній' }}</NuxtLink>
    </div>

    <div v-if="pending" class="rounded-[1.75rem] bg-slate-100 p-8 text-sm text-ui-muted">Завантажуємо кампанію...</div>
    <div v-else-if="error || !campaign" class="rounded-[1.25rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">Кампанію не знайдено або API недоступний.</div>
    <template v-else>
      <section class="grid gap-3" :class="!isNewMaster ? 'xl:grid-cols-[minmax(0,1fr)_320px]' : ''">
        <BaseCard>
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex flex-wrap gap-2">
              <MessagingCampaignStatusBadge :status="campaign.status" />
              <MessagingCampaignTypeBadge :type="campaign.type" />
              <MessagingChannelBadge :channel="campaign.channel" />
            </div>
            <div class="flex flex-wrap gap-2">
              <BaseButton v-if="canEdit && !editing" variant="primary" :disabled="actionPending" @click="editing = true"><PencilSquareIcon class="h-4 w-4" aria-hidden="true" />Редагувати</BaseButton>
              <BaseButton v-if="editing" variant="neutral" :disabled="editorSaving" @click="requestCancelEditing"><XMarkIcon class="h-4 w-4" aria-hidden="true" />Скасувати редагування</BaseButton>
              <BaseButton v-if="canSendMessagingCampaigns && !isNewMaster && (isNotification || ['active', 'paused'].includes(campaign.status))" class="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm" :disabled="actionPending || editing" @click="setStatus(campaign.status === 'paused' ? 'active' : 'paused')">
                <PlayIcon v-if="campaign.status === 'paused'" class="h-4 w-4" /><PauseIcon v-else class="h-4 w-4" /> {{ campaign.status === 'paused' ? 'Поновити' : 'Пауза' }}
              </BaseButton>
              <BaseButton v-if="canSendMessagingCampaigns && !isNewMaster && !campaign.segment_ids?.length" class="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm" :disabled="actionPending || editing" @click="confirmRetry = true">
                <ArrowPathIcon class="h-4 w-4" /> Повторити невдалі
              </BaseButton>
              <BaseButton v-if="canCreateMessagingDrafts" class="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm" :disabled="actionPending || editing" @click="duplicate">
                <DocumentDuplicateIcon class="h-4 w-4" /> Дублювати
              </BaseButton>
              <BaseButton v-if="canSendMessagingCampaigns" class="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm" :disabled="actionPending || editing" @click="setStatus('archived')">
                <ArchiveBoxIcon class="h-4 w-4" /> Архівувати
              </BaseButton>
            </div>
          </div>

          <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div class="min-w-0"><dt class="text-ui-muted">Тип</dt><dd class="mt-1 font-medium text-ui-primary">{{ campaignTypeLabel(campaign.type) }}</dd></div>
            <div class="min-w-0"><dt class="text-ui-muted">Автор</dt><dd class="mt-1 font-medium text-ui-primary">{{ campaign.created_by }}</dd></div>
            <div class="min-w-0"><dt class="text-ui-muted">Заплановано</dt><dd class="mt-1 font-medium text-ui-primary">{{ campaign.scheduled_at ? new Date(campaign.scheduled_at).toLocaleString('uk-UA') : '—' }}</dd></div>
            <div class="min-w-0"><dt class="text-ui-muted">Timezone</dt><dd class="mt-1 font-medium text-ui-primary">{{ campaign.timezone || 'Europe/Kyiv' }}</dd></div>
          </dl>
        </BaseCard>
        <div v-if="!isNewMaster" class="space-y-2"><p class="text-sm text-ui-muted">Приклад поточного повідомлення з тестовими даними</p><MessagingMessagePreview :body="campaign.message_body || ''" /></div>
      </section>

      <p v-if="actionError" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">{{ actionError }}</p>
      <p v-if="editing" role="status" class="text-sm text-ui-accent">Режим редагування</p>
      <MessagingNewMasterCampaignEditor v-if="isNewMaster" :key="`offer-editor-${campaignId}-${campaign.status}-${editing}-${editorVersion}`" :campaign="campaign" :readonly="!editing" :duplicated="route.query.duplicated === '1'" @saved="newMasterSaved" @dirty="newMasterDirty = $event" @busy="editorSaving = $event" />
      <MessagingNewMasterCampaignReview v-if="isNewMaster && !editing" :key="`offer-review-${campaignId}`" :campaign="campaign" :dirty="newMasterDirty" @changed="refresh" />
      <MessagingCampaignAudienceEditor v-if="!isNewMaster && !isNotification && campaign.recipient === 'customer'" :key="`editor-${campaignId}-${editing}-${editorVersion}`" :campaign="campaign" :readonly="!editing" @saved="audienceSaved" @dirty="audienceDirty = $event" @busy="editorSaving = $event" />
      <MessagingCampaignRunPanel v-if="!editing && !isNewMaster && !isNotification && campaign.recipient === 'customer'" :key="`runs-${campaignId}`" :campaign="campaign" :dirty="audienceDirty" @launched="refresh" />

      <MessagingCampaignAnalyticsCards v-if="!isNewMaster && !campaign.segment_ids?.length" :metrics="campaign.metrics || { total_recipients: campaign.audience_size, sent: campaign.sent_count, failed: campaign.failed_count, skipped: 0, delivery_rate: campaign.audience_size ? Math.round((campaign.sent_count / campaign.audience_size) * 100) : 0 }" />

      <section v-if="!isNewMaster && !campaign.segment_ids?.length" class="grid gap-3 xl:grid-cols-2">
        <div v-if="!isNotification" class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 class="text-xl font-semibold text-ui-primary">Фільтри аудиторії</h2>
          <pre class="mt-4 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">{{ campaign.audience_rules || [] }}</pre>
        </div>
        <div class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 class="text-xl font-semibold text-ui-primary">Налаштування розкладу</h2>
          <dl class="mt-4 space-y-3 text-sm">
            <div class="flex justify-between gap-4"><dt class="text-ui-muted">Review link</dt><dd class="font-medium text-ui-primary">{{ campaign.review_link || '—' }}</dd></div>
            <div class="flex justify-between gap-4"><dt class="text-ui-muted">Created</dt><dd class="font-medium text-ui-primary">{{ new Date(campaign.created_at).toLocaleString('uk-UA') }}</dd></div>
          </dl>
        </div>
      </section>

      <section id="delivery-journal" class="space-y-4">
        <h2 class="text-xl font-semibold text-ui-primary">Журнал відправок</h2>
        <p v-if="logsError" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">Не вдалося завантажити журнал. <BaseButton @click="refreshLogs()">Повторити</BaseButton></p>
        <MessagingSendLogsTable v-else :logs="logs?.items || []" :pending="logsPending" />
        <div class="flex flex-wrap items-center gap-3"><BaseButton :disabled="logsPending || logsPage === 1" @click="logsPage--">Попередня</BaseButton><span class="text-sm">Сторінка {{ logsPage }} · {{ logs?.total ?? '—' }} записів</span><BaseButton :disabled="logsPending || !logs || logsPage * 50 >= logs.total" @click="logsPage++">Наступна</BaseButton></div>
      </section>

      <section v-if="!isNewMaster && !campaign.segment_ids?.length" id="recipients" class="space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 class="text-xl font-semibold text-ui-primary">Отримувачі кампанії</h2>
            <p class="mt-1 text-sm text-ui-muted">
              {{ isNotification ? 'Повідомлення, створені за подіями, та їхні статуси доставки.' : 'Фактична черга показує створені повідомлення, розрахована аудиторія показує клієнтів, які підпадають під правила кампанії.' }}
            </p>
          </div>
          <BaseButton class="messaging-secondary-action rounded-full px-4 py-2 text-sm font-medium" :disabled="recipientsPending || calculatedRecipientsPending" @click="refreshRecipientViews">
            Оновити
          </BaseButton>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
            <p class="text-xs uppercase tracking-[0.18em] text-ui-muted">У черзі / історії</p>
            <p class="mt-2 text-2xl font-semibold text-ui-primary">{{ recipients?.total || 0 }}</p>
          </div>
          <div v-if="!isNotification" class="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
            <p class="text-xs uppercase tracking-[0.18em] text-ui-muted">Розрахована аудиторія</p>
            <p class="mt-2 text-2xl font-semibold text-ui-primary">{{ calculatedRecipients?.total || 0 }}</p>
          </div>
        </div>

        <p v-if="recipientsError || calculatedRecipientsError" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">Не вдалося завантажити отримувачів.</p>
        <div class="grid gap-3 xl:grid-cols-2">
          <div>
            <h3 class="mb-3 font-semibold text-ui-primary">Фактична черга та статуси</h3>
            <MessagingCampaignRecipientsTable
              :recipients="recipients?.items || []"
              :pending="recipientsPending"
              empty-label="Повідомлення для цієї кампанії ще не створені."
            />
          </div>
          <div v-if="!isNotification">
            <h3 class="mb-3 font-semibold text-ui-primary">Хто підпадає під правила</h3>
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

    <ConfirmActionModal v-model="confirmCancelEditing" title="Скасувати редагування?" message="Незбережені зміни буде втрачено. Збережені умови кампанії залишаться без змін." confirm-label="Скасувати зміни" @confirm="cancelEditing" />
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
