<script setup lang="ts">
import type { MessagingCampaign } from '~/types/messaging'
import { summarizeRules } from '~/utils/segmentRules.mjs'
import { channelStrategyLabel, deliveryReasonLabel, previewPageSummary } from '~/utils/campaignAudience.mjs'
import type { SegmentRules } from '~/types/segments'
const props = defineProps<{ campaign: MessagingCampaign; dirty?: boolean }>()
const emit = defineEmits<{ launched: [] }>()
const api = useBackofficeApi()
const { apiErrorMessage } = useBookingFormatting()
const { canSendMessagingCampaigns } = useBackofficeAccess()
const toast = useBaseToastNotification()
type Preview = Awaited<ReturnType<typeof api.previewCampaignAudience>>
type Run = Awaited<ReturnType<typeof api.getCampaignRun>>
type Members = Awaited<ReturnType<typeof api.getCampaignRunMembers>>
const preview = ref<Preview | null>(null)
const previewPage = ref(1)
const previewLoading = ref(false)
const previewError = ref('')
let previewRequest = 0
const previewSummary = computed(() => previewPageSummary(preview.value))
const previewStale = ref(false)
const runs = ref<Awaited<ReturnType<typeof api.getCampaignRuns>> | null>(null)
const runsPage = ref(1)
const runsLoading = ref(false)
const runsError = ref('')
const run = ref<Run | null>(null)
const members = ref<Members | null>(null)
const memberPage = ref(1)
const runLoading = ref(false)
const runError = ref('')
let runRequest = 0
const showLaunch = ref(false)
const launching = ref(false)
const launchError = ref('')
// Keep the key across an uncertain network response; only a successful launch retires it.
const launchKey = ref('')
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString('uk-UA') : 'Ще не зафіксовано'
const statusLabels: Record<string, string> = { pending: 'Очікують', queued: 'У черзі', sent: 'Надіслано (прийнято провайдером)', delivered: 'Доставлено', failed: 'Помилки', skipped: 'Пропущено', scheduled: 'Заплановано', completed: 'Завершено', processing: 'Виконується', snapshotted: 'Аудиторію зафіксовано' }
const snapshotText = (key: string) => String(run.value?.campaign_snapshot?.[key] ?? '—')
const snapshotSegments = computed(() => (run.value?.segment_snapshots || []) as { id: number; name: string; revision: number; rules: SegmentRules }[])
const launchContext = computed(() => [
  { label: 'Кампанія', value: props.campaign.name },
  { label: 'Аудиторія', value: `${preview.value?.total ?? '—'} унікальних клієнтів; доступні на показаній сторінці: ${previewSummary.value.eligible}/${previewSummary.value.shown}` },
  { label: 'Канали', value: channelStrategyLabel(props.campaign.channel_strategy, props.campaign.channel) },
  { label: 'Повідомлення', value: props.campaign.message_body || 'Текст із збереженого шаблону' },
  { label: 'Пропозиція', value: props.campaign.promo_code || 'Без промокоду' },
  { label: 'Розклад', value: props.campaign.scheduled_at ? formatDate(props.campaign.scheduled_at) : 'Одразу після запуску' },
  { label: 'Оцінено', value: formatDate(preview.value?.evaluated_at) },
])
const loadPreview = async (page = 1) => {
  const current = ++previewRequest
  previewLoading.value = true
  previewError.value = ''
  preview.value = null
  previewPage.value = page
  try {
    const result = await api.previewCampaignAudience(props.campaign.id, page, 50)
    if (current !== previewRequest) return
    preview.value = result
    previewStale.value = false
  }
  catch (cause) { if (current === previewRequest) previewError.value = apiErrorMessage(cause, 'Не вдалося перевірити аудиторію.') }
  finally { if (current === previewRequest) previewLoading.value = false }
}
const loadRuns = async () => {
  runsLoading.value = true
  runsError.value = ''
  try { runs.value = await api.getCampaignRuns(props.campaign.id, runsPage.value, 20) }
  catch (cause) { runsError.value = apiErrorMessage(cause, 'Не вдалося завантажити історію запусків.') }
  finally { runsLoading.value = false }
}
const inspectRun = async (id: number | string, page = 1) => {
  const current = ++runRequest
  runLoading.value = true
  runError.value = ''
  members.value = null
  memberPage.value = page
  try {
    const [detail, result] = await Promise.all([api.getCampaignRun(props.campaign.id, id), api.getCampaignRunMembers(props.campaign.id, id, page, 50)])
    if (current !== runRequest) return
    run.value = detail
    members.value = result
  }
  catch (cause) { if (current === runRequest) runError.value = apiErrorMessage(cause, 'Не вдалося завантажити запуск.') }
  finally { if (current === runRequest) runLoading.value = false }
}
const launch = async () => {
  if (launching.value || !canSendMessagingCampaigns.value || !preview.value || previewStale.value || props.dirty || ['archived', 'paused'].includes(props.campaign.status)) return
  launching.value = true
  launchError.value = ''
  launchKey.value ||= crypto.randomUUID()
  try {
    const result = await api.createCampaignRun(props.campaign.id, { idempotency_key: launchKey.value })
    launchKey.value = ''
    showLaunch.value = false
    toast.success('Запуск створено.')
    await loadRuns()
    await inspectRun(result.id)
    emit('launched')
  }
  catch (cause) { launchError.value = apiErrorMessage(cause, 'Не вдалося створити запуск. Повтор використовує той самий ключ, щоб уникнути дублювання.') }
  finally { launching.value = false }
}
watch(() => [props.campaign.updated_at, props.dirty], () => { previewStale.value = true; showLaunch.value = false; ++previewRequest; previewLoading.value = false })
watch(runsPage, loadRuns)
onMounted(loadRuns)
</script>

<template>
  <section class="base-card space-y-5 rounded-3xl p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div><h2 class="text-xl font-semibold text-ui-primary">Аудиторія та запуск</h2><p class="mt-1 text-sm text-ui-muted">Сервер обʼєднує сегменти без дублікатів і перевіряє згоду, обмеження та доступні канали.</p></div>
      <BaseButton :disabled="previewLoading || dirty" @click="loadPreview()">{{ previewLoading ? 'Перевіряємо…' : 'Перевірити отримувачів' }}</BaseButton>
    </div>
    <p v-if="dirty" role="status" class="ui-status-warning rounded-xl p-3 text-sm">Спочатку збережіть зміни аудиторії.</p>
    <p v-if="previewStale && preview" role="status" class="ui-status-warning rounded-xl p-3 text-sm">Попередній перегляд застарів. Оновіть його перед запуском.</p>
    <p v-if="previewError" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">{{ previewError }}</p>
    <BaseLoader v-if="previewLoading" label="Перевірка отримувачів…" />
    <template v-if="preview">
      <div class="grid gap-3 sm:grid-cols-2">
        <BaseCard variant="subtle" padding="sm"><p class="text-sm text-ui-muted">Загальна аудиторія без дублікатів</p><p class="text-2xl font-semibold text-ui-primary">{{ preview.total }}</p></BaseCard>
        <BaseCard variant="subtle" padding="sm"><p class="text-sm text-ui-muted">Доступні до відправки на цій сторінці</p><p class="text-2xl font-semibold text-ui-primary">{{ previewSummary.eligible }} / {{ previewSummary.shown }}</p><p class="text-xs text-ui-muted">Telegram {{ previewSummary.telegram }} · SMS {{ previewSummary.sms }} · Виключено {{ previewSummary.excluded }}</p></BaseCard>
      </div>
      <p class="text-sm text-ui-muted">Оцінено {{ formatDate(preview.evaluated_at) }}. Доступність показана лише для поточної сторінки; загальний підсумок доступних API не надає. Перед відправкою сервер повторно перевірить обмеження.</p>
      <BaseTable caption="Попередній перегляд отримувачів" :empty="!preview.items.length" empty-title="Аудиторія порожня" min-width="45rem">
        <template #head><tr><th>Клієнт</th><th>Доступність каналів</th><th>Вибраний канал</th><th>Допуск / причина</th></tr></template>
        <tr v-for="item in preview.items" :key="item.customer_id"><td><NuxtLink :to="`/customers/${item.customer_id}`" class="text-ui-accent underline">{{ item.name || `Клієнт #${item.customer_id}` }}</NuxtLink></td><td>Telegram: {{ item.reachability.telegram ? 'так' : 'ні' }} · SMS: {{ item.reachability.sms ? 'так' : 'ні' }}</td><td>{{ item.channel || '—' }}</td><td>{{ item.eligible ? 'Доступний' : deliveryReasonLabel(item.exclusion_reason) }}</td></tr>
      </BaseTable>
      <div class="flex flex-wrap items-center gap-3"><BaseButton :disabled="previewLoading || previewPage === 1" @click="loadPreview(previewPage - 1)">Попередня</BaseButton><span class="text-sm">Сторінка {{ previewPage }} · {{ preview.total }} клієнтів</span><BaseButton :disabled="previewLoading || previewPage * 50 >= preview.total" @click="loadPreview(previewPage + 1)">Наступна</BaseButton></div>
      <p class="text-sm text-ui-muted">Вартість SMS та атрибуція бронювань / акцій недоступні в поточному API.</p>
      <p v-if="campaign.status === 'paused'" class="text-sm text-ui-muted">Кампанія на паузі. Поновіть її перед створенням нового запуску.</p>
      <BaseButton v-if="canSendMessagingCampaigns" variant="primary" :disabled="dirty || previewStale || previewLoading || !preview.total || ['archived', 'paused'].includes(campaign.status)" @click="showLaunch = true">{{ campaign.scheduled_at ? 'Перевірити та запланувати запуск' : 'Перевірити та запустити' }}</BaseButton>
    </template>
  </section>

  <section class="base-card space-y-5 rounded-3xl p-5">
    <div class="flex flex-wrap justify-between gap-3"><h2 class="text-xl font-semibold text-ui-primary">Історія запусків</h2><BaseButton :disabled="runsLoading" @click="loadRuns">Оновити історію</BaseButton></div>
    <p v-if="runsError" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">{{ runsError }}</p>
    <BaseTable caption="Запуски кампанії" :loading="runsLoading" :empty="!runs?.items.length" empty-title="Запусків ще немає" min-width="35rem">
      <template #head><tr><th>Запуск</th><th>Статус</th><th>Зафіксовано</th><th>Аудиторія знімка</th><th>Дія</th></tr></template>
      <tr v-for="item in runs?.items || []" :key="item.id"><td>#{{ item.id }}</td><td>{{ statusLabels[item.status] || item.status }}</td><td>{{ formatDate(item.evaluated_at) }}</td><td>{{ item.evaluated_at ? item.audience_count : 'Очікує фіксації' }}</td><td><BaseButton size="sm" :aria-label="`Переглянути запуск ${item.id}`" @click="inspectRun(item.id)">Результати</BaseButton></td></tr>
    </BaseTable>
    <div v-if="runs && runs.total > 20" class="flex flex-wrap items-center gap-3"><BaseButton :disabled="runsLoading || runsPage === 1" @click="runsPage--">Попередня</BaseButton><span class="text-sm">Сторінка {{ runsPage }}</span><BaseButton :disabled="runsLoading || runsPage * 20 >= runs.total" @click="runsPage++">Наступна</BaseButton></div>
    <BaseLoader v-if="runLoading" label="Завантаження знімка й результатів…" />
    <p v-if="runError" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">{{ runError }}</p>
    <article v-if="run && !runLoading && !runError" class="space-y-4 border-t border-ui pt-5">
      <h3 class="text-lg font-semibold text-ui-primary">Запуск #{{ run.id }} · незмінний знімок</h3>
      <p class="text-sm text-ui-muted">{{ run.evaluated_at ? `Аудиторія ${run.audience_count} клієнтів зафіксована ${formatDate(run.evaluated_at)}. Поточні правила сегментів не змінюють цей знімок.` : `Заплановано: ${formatDate(run.scheduled_at)}. Знімок буде створено при першому виконанні; зміни кампанії та сегментів до цього моменту впливають на аудиторію.` }}</p>
      <p v-if="run.campaign_snapshot.snapshot_error" role="alert" class="ui-status-danger rounded-xl p-3">{{ run.campaign_snapshot.snapshot_error }}</p>
      <div class="grid gap-3 sm:grid-cols-3"><BaseCard v-for="status in ['pending', 'queued', 'sent', 'delivered', 'failed', 'skipped']" :key="status" variant="subtle" padding="sm"><p class="text-xs text-ui-muted">{{ statusLabels[status] }}</p><p class="text-xl font-semibold">{{ status === 'queued' ? (run.delivery_counts[status] ?? 'Немає даних') : (run.delivery_counts[status] ?? 0) }}</p></BaseCard></div>
      <p class="text-sm text-ui-muted">«Надіслано» означає прийняття провайдером, «Доставлено» — підтвердження доставки. Це не підтверджує прочитання.</p>
      <template v-if="run.evaluated_at">
        <p class="text-sm">{{ channelStrategyLabel(snapshotText('channel_strategy'), snapshotText('channel')) }} · Промокод: {{ snapshotText('discount_code') }}</p>
        <div class="base-card rounded-xl p-4"><h4 class="text-sm font-medium">Зафіксований текст шаблону</h4><p class="mt-2 whitespace-pre-wrap text-sm">{{ snapshotText('message_body') }}</p><p class="mt-2 text-xs text-ui-muted">Персоналізований текст кожного отримувача збережено в деталях повідомлення нижче.</p></div>
        <div v-for="segment in snapshotSegments" :key="segment.id" class="base-card rounded-xl p-3 text-sm"><NuxtLink :to="`/customers/segments/${segment.id}`" class="text-ui-accent underline">{{ segment.name }} · зафіксована версія {{ segment.revision }}</NuxtLink><p class="mt-1 text-ui-muted">{{ summarizeRules(segment.rules) }}</p></div>
      </template>
      <BaseTable caption="Отримувачі знімка та результати доставки" :empty="!members?.items.length" empty-title="Отримувачів немає" min-width="50rem">
        <template #head><tr><th>Клієнт</th><th>Канал / статус</th><th>Час доставки</th><th>Причина / спроби</th><th>Деталі повідомлення</th></tr></template>
        <tr v-for="item in members?.items || []" :key="item.id"><td><NuxtLink :to="`/customers/${item.customer_id}`" class="text-ui-accent underline">Клієнт #{{ item.customer_id }}</NuxtLink></td><td>{{ item.channel }} · {{ statusLabels[item.status] || item.status }}</td><td>{{ item.delivered_at ? formatDate(item.delivered_at) : '—' }}</td><td>{{ deliveryReasonLabel(item.last_error) }} · {{ item.attempts }} спроб</td><td><details><summary class="cursor-pointer text-ui-accent">Повідомлення та доставка</summary><p class="mt-2 whitespace-pre-wrap">{{ item.rendered_message || '—' }}</p><p class="mt-2">ID провайдера: {{ item.provider_message_id || '—' }}</p><p>Надіслано: {{ item.sent_at ? formatDate(item.sent_at) : '—' }}</p><p>Резервування відправки: {{ item.send_started_at ? formatDate(item.send_started_at) : '—' }}</p></details></td></tr>
      </BaseTable>
      <p class="text-xs text-ui-muted">Канали та причини наведено для кожного отримувача. Загальний розподіл за каналами, вартість і атрибуція не надаються API.</p>
      <div v-if="members" class="flex flex-wrap items-center gap-3"><BaseButton :disabled="memberPage === 1" @click="inspectRun(run.id, memberPage - 1)">Попередня</BaseButton><span class="text-sm">Сторінка {{ memberPage }} · {{ members.total }} отримувачів</span><BaseButton :disabled="memberPage * 50 >= members.total" @click="inspectRun(run.id, memberPage + 1)">Наступна</BaseButton></div>
      <NuxtLink to="#delivery-journal" class="inline-block text-sm text-ui-accent underline">Перейти до журналу кампанії</NuxtLink>
    </article>
  </section>
  <p v-if="launchError" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">{{ launchError }}</p>
  <ConfirmActionModal v-model="showLaunch" title="Підтвердити запуск кампанії?" message="Ця дія створить запуск і дозволить надсилання реальним клієнтам. Для запланованого запуску аудиторія фіксується під час виконання. Перевірте збережений текст, пропозицію, канали та розклад." confirm-label="Підтвердити запуск" :context-items="launchContext" :pending="launching" @confirm="launch" />
</template>
