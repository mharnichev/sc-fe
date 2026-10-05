<script setup lang="ts">
import type { CampaignOfferAnalytics } from '~/types/newMaster'
import type { MessagingCampaign } from '~/types/messaging'
import type { CampaignRun } from '~/types/segments'
import { kyivLocalToIso } from '~/utils/newMasterCampaign.mjs'

const api = useBackofficeApi()
const { canViewMessagingAnalytics } = useBackofficeAccess()
const { apiErrorMessage } = useBookingFormatting()
const campaigns = ref<MessagingCampaign[]>([])
const runs = ref<CampaignRun[]>([])
const masters = ref<Array<{ id: number; name: string }>>([])
const promotions = ref<Array<{ id: number; name_uk: string }>>([])
const campaignId = ref(0)
const runId = ref(0)
const masterId = ref(0)
const promotionId = ref(0)
const periodFrom = ref('')
const periodTo = ref('')
const analytics = ref<CampaignOfferAnalytics | null>(null)
const loading = ref(false)
const error = ref('')
let request = 0
const metrics = computed(() => analytics.value ? [
  ['Аудиторія', analytics.value.audience_size],
  ['Доступні до зв’язку', analytics.value.communication_eligible_recipients],
  ['Прийнято провайдером', analytics.value.provider_accepted],
  ['Доставлено', analytics.value.delivered],
  ['Технічні запити посилань', analytics.value.raw_link_requests],
  ['Підтверджені відкриття', analytics.value.confirmed_page_opens],
  ['Унікальні клієнти з відкриттям', analytics.value.unique_confirmed_openers],
  ['Створено бронювань', analytics.value.bookings_created],
  ['Скасовано', analytics.value.cancelled_bookings],
  ['Неявки (no-show)', analytics.value.no_show],
  ['Завершені візити зі знижкою', analytics.value.completed_visits],
  ['Унікальні клієнти, що скористалися', analytics.value.unique_customers_redeemed],
  ['Загальна знижка', `${analytics.value.total_discount_amount.toLocaleString('uk-UA')} ₴`],
  ['Спостережена виручка завершених візитів', `${analytics.value.observed_completed_revenue.toLocaleString('uk-UA')} ₴`],
  ['Конверсія у бронювання', analytics.value.booking_conversion_percent == null ? '—' : `${analytics.value.booking_conversion_percent}%`],
  ['Конверсія у використання', analytics.value.redemption_conversion_percent == null ? '—' : `${analytics.value.redemption_conversion_percent}%`],
] : [])
const loadAnalytics = async () => {
  if (!canViewMessagingAnalytics.value) return
  const current = ++request
  error.value = ''
  const from = periodFrom.value ? kyivLocalToIso(periodFrom.value) : null
  const to = periodTo.value ? kyivLocalToIso(periodTo.value) : null
  if ((periodFrom.value && !from) || (periodTo.value && !to) || (from && to && from >= to)) { error.value = 'Вкажіть коректний період: початок раніше кінця.'; return }
  loading.value = true
  analytics.value = null
  try {
    const result = await api.getCampaignOfferAnalytics({
      ...(campaignId.value ? { campaign_id: campaignId.value } : {}),
      ...(runId.value ? { run_id: runId.value } : {}),
      ...(masterId.value ? { master_id: masterId.value } : {}),
      ...(promotionId.value ? { promotion_id: promotionId.value } : {}),
      ...(from ? { date_from: from } : {}), ...(to ? { date_to: to } : {}),
    })
    if (current === request) analytics.value = result
  } catch (cause) { if (current === request) error.value = apiErrorMessage(cause, 'Не вдалося завантажити аналітику.') }
  finally { if (current === request) loading.value = false }
}
watch(campaignId, async id => {
  runId.value = 0
  runs.value = []
  if (!id) return
  try { const result = await api.getCampaignRuns(id, 1, 100); if (campaignId.value === id) runs.value = result.items }
  catch (cause) { if (campaignId.value === id) error.value = apiErrorMessage(cause, 'Не вдалося завантажити запуски.') }
})
onMounted(async () => {
  if (!canViewMessagingAnalytics.value) return
  try {
    const [campaignResult, masterResult, promotionResult] = await Promise.all([
      api.getMessagingCampaigns(1, 100, { view: 'campaigns' }), api.adminGetMasters(1, 200), api.adminGetPromotions(1, 200),
    ])
    campaigns.value = campaignResult.items.filter(item => item.offer_master_id)
    masters.value = (Array.isArray(masterResult) ? masterResult : masterResult.items).map(item => ({ id: item.id, name: item.full_name_uk || item.full_name || item.name || `#${item.id}` }))
    promotions.value = promotionResult.items
  } catch (cause) { error.value = apiErrorMessage(cause, 'Не вдалося завантажити фільтри.') }
  await loadAnalytics()
})
</script>

<template>
  <div class="messaging-page space-y-6" data-testid="offer-analytics-page">
    <div class="flex flex-wrap justify-between gap-3"><h1 class="text-3xl font-semibold">Аналітика персональних пропозицій</h1><NuxtLink to="/messaging/campaigns" class="text-ui-accent underline">До кампаній</NuxtLink></div>
    <p v-if="!canViewMessagingAnalytics">Аналітика доступна адміністратору.</p>
    <template v-else>
      <section class="base-card space-y-4 rounded-3xl p-5">
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label class="grid gap-1">Кампанія<select v-model.number="campaignId" data-testid="analytics-campaign" class="new-master-control rounded-xl border p-3"><option :value="0">Усі</option><option v-for="item in campaigns" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
          <label class="grid gap-1">Запуск<select v-model.number="runId" :disabled="!campaignId" class="new-master-control rounded-xl border p-3"><option :value="0">Усі</option><option v-for="item in runs" :key="item.id" :value="item.id">#{{ item.id }}</option></select></label>
          <label class="grid gap-1">Майстер<select v-model.number="masterId" data-testid="analytics-master" class="new-master-control rounded-xl border p-3"><option :value="0">Усі</option><option v-for="item in masters" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
          <label class="grid gap-1">Акція<select v-model.number="promotionId" data-testid="analytics-promotion" class="new-master-control rounded-xl border p-3"><option :value="0">Усі</option><option v-for="item in promotions" :key="item.id" :value="item.id">{{ item.name_uk }}</option></select></label>
          <label class="grid gap-1">Від · Europe/Kyiv<input v-model="periodFrom" type="datetime-local" class="new-master-control rounded-xl border p-3" /></label>
          <label class="grid gap-1">До, виключно · Europe/Kyiv<input v-model="periodTo" type="datetime-local" class="new-master-control rounded-xl border p-3" /></label>
        </div>
        <p class="text-sm text-ui-muted">Період відбирає когорту запусків за часом фіксації аудиторії (або створення до фіксації). Показники містять накопичені результати цих запусків, включно з подіями після кінця періоду.</p>
        <button class="rounded-full bg-cyan-700 px-5 py-3 text-white disabled:opacity-50" :disabled="loading" @click="loadAnalytics">{{ loading ? 'Завантаження…' : 'Застосувати фільтри' }}</button>
      </section>
      <p v-if="error" role="alert" class="text-red-500">{{ error }}</p>
      <section v-if="analytics" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="offer-analytics-metrics"><article v-for="metric in metrics" :key="String(metric[0])" class="base-card rounded-2xl p-4"><p class="text-sm text-ui-muted">{{ metric[0] }}</p><strong class="mt-2 block text-2xl">{{ metric[1] }}</strong></article></section>
      <p class="text-sm text-ui-muted">Конверсія бронювання = створені бронювання / доступні до зв’язку; конверсія використання = унікальні клієнти із завершеним візитом / доступні до зв’язку. За відсутності знаменника показано «—». Скасування та неявки не є використанням знижки. Технічні запити, сканери та попередній перегляд посилання не є підтвердженим відкриттям. Прийняття провайдером не підтверджує доставку. Виручка спостережена, її не можна вважати додатковою.</p>
    </template>
  </div>
</template>

<style scoped>
.new-master-control:not([type="checkbox"]) {
  color: var(--bo-text-primary);
  background: var(--input-bg);
  border-color: var(--input-border);
  color-scheme: dark;
}
.new-master-control option { background: var(--select-menu-bg); color: var(--select-menu-item-text); }
:global([data-backoffice-theme="light"]) .new-master-control { color-scheme: light; }
.new-master-control:focus-visible { outline: 2px solid var(--bo-focus-border); outline-offset: 2px; }
</style>
