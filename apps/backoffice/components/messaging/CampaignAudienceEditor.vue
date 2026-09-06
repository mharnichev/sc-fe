<script setup lang="ts">
import type { MessagingCampaign } from '~/types/messaging'
import type { CampaignChannelStrategy } from '~/types/segments'
const props = defineProps<{ campaign: MessagingCampaign }>()
const emit = defineEmits<{ saved: []; dirty: [value: boolean] }>()
const api = useBackofficeApi()
const toast = useBaseToastNotification()
const { apiErrorMessage } = useBookingFormatting()
const { canCreateMessagingDrafts } = useBackofficeAccess()
const segmentIds = ref<number[]>([])
const useSegments = ref(false)
const valid = ref(false)
const strategy = ref<CampaignChannelStrategy>('single')
const channel = ref('telegram')
const upcoming = ref(true)
const returned = ref(true)
const frequency = ref(7)
const saving = ref(false)
const error = ref('')
const message = ref('')
const promo = ref('')
const scheduled = ref('')
const baseline = ref('')
const confirmInlineAudience = ref(false)
const switchingToInline = computed(() => !!props.campaign.segment_ids?.length && !useSegments.value)
const inlineIsAllCustomers = computed(() => !props.campaign.audience_rules?.length || props.campaign.audience_rules.some(rule => rule.type === 'all_clients'))
const serialized = computed(() => JSON.stringify([useSegments.value, segmentIds.value, strategy.value, channel.value, upcoming.value, returned.value, frequency.value, message.value, promo.value, scheduled.value]))
const dirty = computed(() => serialized.value !== baseline.value)
const isEditable = computed(() => canCreateMessagingDrafts.value && props.campaign.status !== 'archived')
const canUseSegments = computed(() => ['manual', 're_engagement'].includes(props.campaign.type))
const load = () => {
  confirmInlineAudience.value = false
  segmentIds.value = [...(props.campaign.segment_ids || [])]
  useSegments.value = !!segmentIds.value.length
  strategy.value = props.campaign.channel_strategy || 'single'
  channel.value = props.campaign.channel
  upcoming.value = props.campaign.exclude_upcoming_booking ?? true
  returned.value = props.campaign.exclude_returned_since_snapshot ?? true
  frequency.value = props.campaign.marketing_frequency_days ?? 7
  message.value = props.campaign.message_body || ''
  promo.value = props.campaign.promo_code || ''
  scheduled.value = props.campaign.scheduled_at || ''
  baseline.value = serialized.value
}
watch(() => props.campaign, load, { immediate: true })
watch(dirty, value => emit('dirty', value), { immediate: true })
const save = async () => {
  if ((switchingToInline.value && !confirmInlineAudience.value) || !isEditable.value || saving.value || !Number.isInteger(Number(frequency.value)) || Number(frequency.value) < 1 || Number(frequency.value) > 365 || !message.value.trim() || (useSegments.value && !valid.value)) return
  saving.value = true
  error.value = ''
  try {
    await api.updateMessagingCampaign(props.campaign.id, {
      name: props.campaign.name,
      type: props.campaign.type,
      status: props.campaign.status,
      recipient: props.campaign.recipient,
      purpose: props.campaign.purpose,
      timezone: props.campaign.timezone || 'Europe/Kyiv',
      review_link: props.campaign.review_link,
      location_key: props.campaign.location_key,
      metadata_json: props.campaign.metadata_json,
      // The legacy audience has fields absent from AudienceRule (limits, VIP thresholds, etc.).
      // Omit it to preserve the authoritative backend filter, including when restoring it.
      ...(useSegments.value ? { segment_ids: segmentIds.value } : switchingToInline.value ? { segment_ids: [] } : {}),
      channel_strategy: strategy.value,
      channel: channel.value as MessagingCampaign['channel'],
      exclude_upcoming_booking: upcoming.value,
      exclude_returned_since_snapshot: returned.value,
      marketing_frequency_days: Number(frequency.value),
      message_body: message.value,
      promo_code: promo.value,
      scheduled_at: scheduled.value ? new Date(scheduled.value).toISOString() : null,
      schedule_mode: scheduled.value ? 'later' : 'now',
    })
    baseline.value = serialized.value
    emit('saved')
    toast.success('Кампанію збережено. Оновіть попередній перегляд перед запуском.')
  }
  catch (cause) { error.value = apiErrorMessage(cause, 'Не вдалося зберегти кампанію.') }
  finally { saving.value = false }
}
</script>

<template>
  <section class="base-card space-y-4 rounded-3xl p-5">
    <h2 class="text-xl font-semibold text-ui-primary">Підготовка кампанії</h2>
    <p class="text-sm text-ui-muted">Зміни впливають на майбутні запуски. Збереження не надсилає повідомлень; історичні знімки залишаються незмінними.</p>
    <fieldset :disabled="!isEditable || saving" class="space-y-4">
      <legend class="sr-only">Повідомлення, аудиторія та розклад</legend>
      <label class="grid gap-2 text-sm"><span>Повідомлення</span><BaseTextarea v-model="message" class="min-h-32" /></label>
      <div class="grid gap-4 md:grid-cols-2">
        <label class="grid gap-2 text-sm"><span>Канал</span><BaseSelect native v-model="channel"><option value="telegram">Telegram</option><option value="sms">SMS</option><option v-if="!['telegram', 'sms'].includes(campaign.channel)" :value="campaign.channel">{{ campaign.channel }}</option></BaseSelect></label>
        <label class="grid gap-2 text-sm"><span>Стратегія каналів</span><BaseSelect native v-model="strategy"><option value="single">Лише вибраний канал</option><option value="telegram_then_sms">Telegram, інакше SMS</option><option value="sms_then_telegram">SMS, інакше Telegram</option></BaseSelect></label>
      </div>
      <p class="text-xs text-ui-muted">Кожен клієнт отримує повідомлення лише одним каналом. Резервний канал обирається за доступністю адреси, а не через непрочитання чи помилку провайдера.</p>
      <label v-if="canUseSegments" class="flex items-center gap-2 text-sm"><BaseCheckbox v-model="useSegments" /> Використовувати збережені сегменти</label>
      <MessagingSegmentCampaignAudience v-if="useSegments" v-model="segmentIds" :disabled="!isEditable || saving" @valid="valid = $event" />
      <p v-else class="text-sm text-ui-muted">{{ inlineIsAllCustomers ? 'Поточні фільтри охоплюють усіх клієнтів; доступність відправки перевіряється окремо.' : 'Використовуються наявні фільтри цієї кампанії.' }} {{ canUseSegments ? 'Можна перейти на збережені сегменти.' : 'Сегменти підтримуються для ручних кампаній і повернення клієнтів.' }}</p>
      <label v-if="switchingToInline" class="ui-status-warning flex items-start gap-2 rounded-xl p-3 text-sm"><BaseCheckbox v-model="confirmInlineAudience" /> {{ inlineIsAllCustomers ? 'Розумію: вимкнення сегментів розширює аудиторію до всіх клієнтів. Перевірю її перед запуском.' : 'Повернути попередні фільтри цієї кампанії замість сегментів.' }}</label>
      <label class="flex items-center gap-2 text-sm"><BaseCheckbox v-model="upcoming" /> Виключити клієнтів із майбутніми бронюваннями</label>
      <label class="flex items-center gap-2 text-sm"><BaseCheckbox v-model="returned" /> Виключити клієнтів, які повернулися після фіксації аудиторії</label>
      <div class="grid gap-4 md:grid-cols-2">
        <label class="grid gap-2 text-sm"><span>Мінімум днів між маркетинговими повідомленнями</span><BaseInput v-model.number="frequency" type="number" min="1" max="365" /></label>
        <label class="grid gap-2 text-sm"><span>Промокод наявної акції (необовʼязково)</span><BaseInput v-model="promo" /></label>
        <label class="grid gap-2 text-sm"><span>Дата й час запуску (порожньо — одразу)</span><BaseCalendar v-model="scheduled" mode="datetime" /></label>
        <BaseButton v-if="scheduled" type="button" @click="scheduled = ''">Прибрати розклад</BaseButton>
      </div>
      <p class="text-xs text-ui-muted">Умови пропозиції налаштовуються в <NuxtLink to="/promotions" class="text-ui-accent underline">Акціях</NuxtLink>. Для запланованого запуску аудиторія фіксується під час виконання.</p>
    </fieldset>
    <p v-if="error" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">{{ error }}</p>
    <div v-if="isEditable" class="flex flex-wrap gap-3"><BaseButton :disabled="(switchingToInline && !confirmInlineAudience) || saving || !dirty || !message.trim() || (useSegments && !valid) || !Number.isInteger(Number(frequency)) || Number(frequency) < 1 || Number(frequency) > 365" @click="save">{{ saving ? 'Збереження…' : 'Зберегти зміни' }}</BaseButton><BaseButton :disabled="saving || !dirty" @click="load">Скасувати зміни</BaseButton></div>
  </section>
</template>
