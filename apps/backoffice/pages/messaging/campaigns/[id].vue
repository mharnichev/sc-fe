<script setup lang="ts">
import { isNotificationType } from '~/utils/campaignAudience.mjs'
import { ArchiveBoxIcon, DocumentDuplicateIcon, PauseIcon, PlayIcon, ArrowPathIcon, PencilSquareIcon, XMarkIcon, ArrowLeftIcon, InformationCircleIcon, AdjustmentsHorizontalIcon, RocketLaunchIcon, TruckIcon, ChartBarIcon, ChevronDownIcon, FunnelIcon } from '@heroicons/vue/24/outline'

const route = useRoute()
const api = useBackofficeApi()
const { campaignTypeLabel } = useMessagingUi()
const { canSendMessagingCampaigns, canCreateMessagingDrafts, canViewMessagingAnalytics } = useBackofficeAccess()

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
const statusExplanation = computed(() => {
  if (editing.value) return 'Збережіть зміни, а потім перевірте отримувачів перед запуском.'
  if (isNotification.value) return campaign.value?.status === 'active' ? 'Правило увімкнене: повідомлення створюються після відповідної сервісної події.' : 'Сервісне правило. Його статус визначає, чи надсилати повідомлення після події.'
  return ({ draft: 'Перевірте умови та отримувачів, потім підтвердьте запуск.', active: 'Кампанію активовано. Стан черги та результати дивіться нижче.', paused: 'Відправку призупинено. Уже надіслані повідомлення залишаються в історії.', completed: 'Запуск завершено. Перегляньте результати доставки.', archived: 'Кампанія в архіві. Для нової розсилки створіть копію.' } as Record<string, string>)[campaign.value?.status || ''] || 'Перегляньте умови, готовність і результати кампанії.'
})
const displayDate = (value?: string | null) => {
  if (!value || Number.isNaN(Date.parse(value))) return '—'
  try { return new Date(value).toLocaleString('uk-UA', { timeZone: campaign.value?.timezone || 'Europe/Kyiv' }) }
  catch { return new Date(value).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' }) }
}
const audienceDescriptions = computed(() => (campaign.value?.audience_rules || []).map(rule => {
  const labels: Record<string, string> = { all_clients: 'Усі клієнти', selected_barber: 'Клієнти майстра', selected_service: 'Клієнти послуги', visited_date_range: 'Візити за період', inactive_clients: 'Неактивні клієнти', first_time_clients: 'Нові клієнти', vip_clients: 'VIP клієнти', birthday_this_month: 'День народження цього місяця', specific_clients: 'Вибрані клієнти' }
  const detail = rule.type === 'selected_barber' ? `№${rule.barber_id}` : rule.type === 'selected_service' ? `№${rule.service_id}` : rule.type === 'inactive_clients' ? `${rule.inactive_days} днів без візиту` : rule.type === 'visited_date_range' ? `${rule.date_from || 'Без початку'} — ${rule.date_to || 'Без завершення'}` : ''
  const clients = rule.type === 'specific_clients' ? (rule.client_ids || []).map(id => `№${id}`).join(', ') : ''
  return `${labels[rule.type] || 'Додаткова умова'}${detail || clients ? ` · ${detail || clients}` : ''}`
}))
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

    <BaseCard v-if="pending"><BaseLoader label="Завантажуємо кампанію…" /></BaseCard>
    <BaseCard v-else-if="error || !campaign" class="space-y-3"><p role="alert" class="text-ui-primary">Кампанію не знайдено або API недоступний.</p><BaseButton variant="neutral" @click="refresh"><ArrowPathIcon class="h-4 w-4" aria-hidden="true" />Повторити</BaseButton></BaseCard>
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
              <BaseButton v-if="canEdit && !editing" variant="neutral" :disabled="actionPending" @click="editing = true"><PencilSquareIcon class="h-4 w-4" aria-hidden="true" />Редагувати</BaseButton>
              <BaseButton v-if="editing" variant="neutral" :disabled="editorSaving" @click="requestCancelEditing"><XMarkIcon class="h-4 w-4" aria-hidden="true" />Скасувати редагування</BaseButton>
              <BaseButton v-if="canSendMessagingCampaigns && !isNewMaster && (isNotification || ['active', 'paused'].includes(campaign.status))" class="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm" :disabled="actionPending || editing" @click="setStatus(campaign.status === 'paused' ? 'active' : 'paused')">
                <PlayIcon v-if="campaign.status === 'paused'" class="h-4 w-4" /><PauseIcon v-else class="h-4 w-4" /> {{ campaign.status === 'paused' ? 'Поновити' : 'Пауза' }}
              </BaseButton>
              <BaseButton v-if="canSendMessagingCampaigns && !isNewMaster && !campaign.segment_ids?.length" class="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm" :disabled="actionPending || editing" @click="confirmRetry = true">
                <ArrowPathIcon class="h-4 w-4" /> Повторити невдалі
              </BaseButton>
              <details v-if="canCreateMessagingDrafts || canSendMessagingCampaigns" class="group relative">
                <summary class="base-button base-button--neutral flex cursor-pointer list-none items-center gap-2 px-4 py-2 text-sm">Інші дії<ChevronDownIcon class="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" /></summary>
                <BaseCard class="absolute right-0 z-30 mt-2 grid min-w-48 gap-2 shadow-lg">
              <BaseButton v-if="canCreateMessagingDrafts" class="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm" :disabled="actionPending || editing" @click="duplicate">
                <DocumentDuplicateIcon class="h-4 w-4" /> Дублювати
              </BaseButton>
              <BaseButton v-if="canSendMessagingCampaigns" class="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm" :disabled="actionPending || editing" @click="setStatus('archived')">
                <ArchiveBoxIcon class="h-4 w-4" /> Архівувати
              </BaseButton>
                </BaseCard>
              </details>
            </div>
          </div>

          <p class="mt-3 flex items-start gap-2 text-sm text-ui-secondary"><InformationCircleIcon class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{{ statusExplanation }}</p>
          <details class="mt-4"><summary class="cursor-pointer text-sm text-ui-muted">Відомості про кампанію</summary>
          <dl class="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div class="min-w-0"><dt class="text-ui-muted">Тип</dt><dd class="mt-1 font-medium text-ui-primary">{{ campaignTypeLabel(campaign.type) }}</dd></div>
            <div class="min-w-0"><dt class="text-ui-muted">Автор</dt><dd class="mt-1 font-medium text-ui-primary">{{ campaign.created_by }}</dd></div>
            <div class="min-w-0"><dt class="text-ui-muted">Заплановано</dt><dd class="mt-1 font-medium text-ui-primary">{{ campaign.scheduled_at ? displayDate(campaign.scheduled_at) : isNotification ? 'За сервісною подією' : 'Без відкладеного запуску' }}</dd></div>
            <div class="min-w-0"><dt class="text-ui-muted">Часовий пояс</dt><dd class="mt-1 font-medium text-ui-primary">{{ campaign.timezone || 'Europe/Kyiv' }}</dd></div>
          </dl>
          </details>
        </BaseCard>
        <div v-if="!isNewMaster" class="space-y-2"><p class="text-sm text-ui-muted">Приклад поточного повідомлення з тестовими даними</p><MessagingMessagePreview :body="campaign.message_body || ''" /></div>
      </section>

      <nav aria-label="Розділи кампанії" class="flex flex-wrap gap-2 text-sm">
        <a v-if="!isNotification && !editing" href="#campaign-launch" class="base-button base-button--neutral gap-2 px-4 py-2"><RocketLaunchIcon class="h-4 w-4" aria-hidden="true" />Підготовка та запуск</a>
        <a v-if="!isNotification" href="#campaign-conditions" class="base-button base-button--neutral gap-2 px-4 py-2"><AdjustmentsHorizontalIcon class="h-4 w-4" aria-hidden="true" />Умови</a>
        <a href="#delivery-journal" class="base-button base-button--neutral gap-2 px-4 py-2"><TruckIcon class="h-4 w-4" aria-hidden="true" />Доставка</a>
        <a v-if="isNewMaster && canViewMessagingAnalytics && !editing" href="#campaign-analytics" class="base-button base-button--neutral gap-2 px-4 py-2"><ChartBarIcon class="h-4 w-4" aria-hidden="true" />Аналітика</a>
      </nav>

      <p v-if="actionError" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">{{ actionError }}</p>
      <p v-if="editing" role="status" class="text-sm text-ui-accent">Режим редагування</p>
      <section v-if="!editing && !isNotification" id="campaign-launch" class="scroll-mt-6">
        <MessagingNewMasterCampaignReview v-if="isNewMaster && !editing" :key="`offer-review-${campaignId}`" :campaign="campaign" :dirty="newMasterDirty" @changed="refresh" />
        <MessagingCampaignRunPanel v-if="!editing && !isNewMaster && !isNotification && campaign.recipient === 'customer'" :key="`runs-${campaignId}`" :campaign="campaign" :dirty="audienceDirty" @launched="refresh" />
      </section>
      <section v-if="!isNotification" id="campaign-conditions" class="scroll-mt-6">
      <MessagingNewMasterCampaignEditor v-if="isNewMaster && editing" :key="`offer-editor-${campaignId}-${campaign.status}-${editing}-${editorVersion}`" :campaign="campaign" :readonly="!editing" :duplicated="route.query.duplicated === '1'" @saved="newMasterSaved" @dirty="newMasterDirty = $event" @busy="editorSaving = $event" />
        <details v-if="isNewMaster && !editing" class="group">
          <summary class="base-card flex cursor-pointer list-none items-center gap-3 rounded-2xl p-4 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-accent"><AdjustmentsHorizontalIcon class="h-5 w-5 text-ui-accent" aria-hidden="true" />Умови та повідомлення<ChevronDownIcon class="ml-auto h-4 w-4 transition group-open:rotate-180" aria-hidden="true" /></summary>
          <MessagingNewMasterCampaignEditor :key="`offer-view-${campaignId}-${campaign.status}-${editorVersion}`" :campaign="campaign" readonly :duplicated="route.query.duplicated === '1'" @dirty="newMasterDirty = $event" />
        </details>
      <MessagingCampaignAudienceEditor v-if="!isNewMaster && !isNotification && campaign.recipient === 'customer'" :key="`editor-${campaignId}-${editing}-${editorVersion}`" :campaign="campaign" :readonly="!editing" @saved="audienceSaved" @dirty="audienceDirty = $event" @busy="editorSaving = $event" />
      </section>

      <MessagingCampaignAnalyticsCards v-if="!isNewMaster && !campaign.segment_ids?.length" :metrics="campaign.metrics || { total_recipients: campaign.audience_size, sent: campaign.sent_count, failed: campaign.failed_count, skipped: 0, delivery_rate: campaign.audience_size ? Math.round((campaign.sent_count / campaign.audience_size) * 100) : 0 }" />

      <section v-if="!isNewMaster && !campaign.segment_ids?.length" class="grid gap-3 xl:grid-cols-2">
        <div v-if="!isNotification" class="base-card rounded-[1.75rem] p-5">
          <h2 class="text-xl font-semibold text-ui-primary">Фільтри аудиторії</h2>
          <ul class="mt-3 space-y-2 text-sm text-ui-secondary"><li v-for="(description, index) in audienceDescriptions" :key="index" class="flex gap-2"><FunnelIcon class="h-4 w-4 shrink-0 text-ui-muted" aria-hidden="true" />{{ description }}</li></ul>
        </div>
        <div class="base-card rounded-[1.75rem] p-5">
          <h2 class="text-xl font-semibold text-ui-primary">Налаштування розкладу</h2>
          <dl class="mt-4 space-y-3 text-sm">
            <div class="flex justify-between gap-4"><dt class="text-ui-muted">Посилання на відгук</dt><dd class="font-medium text-ui-primary">{{ campaign.review_link || '—' }}</dd></div>
            <div class="flex justify-between gap-4"><dt class="text-ui-muted">Створено</dt><dd class="font-medium text-ui-primary">{{ displayDate(campaign.created_at) }}</dd></div>
          </dl>
        </div>
      </section>

      <section id="delivery-journal" class="space-y-4">
        <h2 class="flex items-center gap-2 text-xl font-semibold text-ui-primary"><TruckIcon class="h-5 w-5 text-ui-accent" aria-hidden="true" />Доставка</h2>
        <p class="text-sm text-ui-muted">Статуси повідомлень після запуску. Прийняття провайдером ще не означає доставку клієнту.</p>
        <p v-if="logsError" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">Не вдалося завантажити журнал. <BaseButton @click="refreshLogs()">Повторити</BaseButton></p>
        <MessagingSendLogsTable v-else summary :logs="logs?.items || []" :pending="logsPending" />
        <div class="flex flex-wrap items-center gap-3"><BaseButton :disabled="logsPending || logsPage === 1" @click="logsPage--">Попередня</BaseButton><span class="text-sm">Сторінка {{ logsPage }} · {{ logs?.total ?? '—' }} повідомлень</span><BaseButton :disabled="logsPending || !logs || logsPage * 50 >= logs.total" @click="logsPage++">Наступна</BaseButton></div>
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
          <div class="base-card rounded-[1.25rem] p-4">
            <p class="text-xs uppercase tracking-[0.18em] text-ui-muted">У черзі / історії</p>
            <p class="mt-2 text-2xl font-semibold text-ui-primary">{{ recipients?.total || 0 }}</p>
          </div>
          <div v-if="!isNotification" class="base-card rounded-[1.25rem] p-4">
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
