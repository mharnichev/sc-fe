<script setup lang="ts">
import type { MessagingSettings } from '~/types/messaging'
import type { ReviewRequestSettings, ReviewRequestSettingsUpdate } from '~/types/reviews'

const api = useBackofficeApi()
const { campaignTypes } = useMessagingUi()
const { canSendMessagingCampaigns } = useBackofficeAccess()
const { apiErrorMessage } = useBookingFormatting()
const toast = useBaseToastNotification()
const saving = ref(false)
const reviewSaving = ref(false)

const { data, pending, error } = await useAsyncData('messaging-settings', () => api.getMessagingSettings())
const { data: reviewSettings, pending: reviewPending, error: reviewError, refresh: refreshReviewSettings } = await useAsyncData(
  'review-request-settings',
  () => api.getReviewRequestSettings(),
)

const form = reactive<Partial<MessagingSettings>>({
  telegram_bot_status: 'offline',
  default_review_links: { google: '', instagram: '', internal: '', custom: '' },
  default_template_ids: {
    manual: null,
    booking_confirmation: null,
    post_visit_review_request: null,
    appointment_reminder: null,
    birthday_greeting: null,
    re_engagement: null,
    first_visit_follow_up: null,
    loyalty_vip: null,
  },
  quiet_hours_from: '21:00',
  quiet_hours_to: '09:00',
  default_rate_limit: 20,
  default_timezone: 'Europe/Kyiv',
  opt_out_text: 'Напишіть STOP, щоб відписатися.',
  test_recipient_chat_id: '',
  multi_location_enabled: false,
})

const reviewForm = reactive<ReviewRequestSettings>({
  enabled: false,
  delay_minutes: 60,
  primary_channel: 'telegram',
  sms_fallback_enabled: true,
  quiet_hours_enabled: true,
  quiet_hours_from: '21:00',
  quiet_hours_to: '09:00',
  frequency_cap_count: 1,
  frequency_cap_days: 30,
  exclusions: [],
  template_preview: '',
})
const exclusionsText = ref('')

watch(data, value => {
  if (!value) return
  Object.assign(form, value)
}, { immediate: true })

watch(reviewSettings, value => {
  if (!value) return
  Object.assign(reviewForm, value, { primary_channel: 'telegram' })
  exclusionsText.value = (value.exclusions || []).join('\n')
}, { immediate: true })

const save = async () => {
  saving.value = true
  try {
    await api.updateMessagingSettings(form)
    toast.success('Налаштування збережено.')
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося зберегти налаштування.'))
  }
  finally {
    saving.value = false
  }
}

const saveReviewSettings = async () => {
  if (!canSendMessagingCampaigns.value) return
  reviewSaving.value = true
  try {
    const payload: ReviewRequestSettingsUpdate = {
      enabled: reviewForm.enabled,
      delay_minutes: Math.max(0, Number(reviewForm.delay_minutes) || 0),
      primary_channel: 'telegram',
      sms_fallback_enabled: reviewForm.sms_fallback_enabled,
      quiet_hours_enabled: reviewForm.quiet_hours_enabled,
      quiet_hours_from: reviewForm.quiet_hours_from,
      quiet_hours_to: reviewForm.quiet_hours_to,
      frequency_cap_count: Math.max(1, Number(reviewForm.frequency_cap_count) || 1),
      frequency_cap_days: Math.max(1, Number(reviewForm.frequency_cap_days) || 1),
      exclusions: exclusionsText.value.split('\n').map(value => value.trim()).filter(Boolean),
    }
    await api.updateReviewRequestSettings(payload)
    toast.success('Налаштування запитів відгуків збережено.')
    await refreshReviewSettings()
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося зберегти налаштування запитів відгуків.'))
  }
  finally {
    reviewSaving.value = false
  }
}
</script>

<template>
  <div class="messaging-page space-y-6">
    <div>
      <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Messaging</p>
      <h1 class="mt-2 text-3xl font-semibold text-slate-900">Налаштування повідомлень</h1>
    </div>

    <div v-if="pending" class="rounded-[1.75rem] bg-slate-100 p-8 text-sm text-slate-500">Завантажуємо налаштування...</div>
    <div v-else-if="error" class="rounded-[1.25rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">Не вдалося завантажити налаштування.</div>

    <section v-else class="grid gap-6 xl:grid-cols-2">
      <div class="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">Telegram та відгуки</h2>
        <div class="rounded-2xl bg-slate-50 p-4">
          <p class="text-sm text-slate-500">Статус бота</p>
          <span class="mt-2 inline-flex rounded-full px-3 py-1 text-xs font-medium" :class="form.telegram_bot_status === 'connected' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'">{{ form.telegram_bot_status }}</span>
        </div>
        <label class="grid gap-2 text-sm">
          <span class="font-medium text-slate-700">Google Reviews</span>
          <BaseInput v-model="form.default_review_links!.google" class="rounded-2xl border border-slate-300 px-4 py-3" />
        </label>
        <label class="grid gap-2 text-sm">
          <span class="font-medium text-slate-700">Instagram</span>
          <BaseInput v-model="form.default_review_links!.instagram" class="rounded-2xl border border-slate-300 px-4 py-3" />
        </label>
        <label class="grid gap-2 text-sm">
          <span class="font-medium text-slate-700">Внутрішня сторінка відгуків</span>
          <BaseInput v-model="form.default_review_links!.internal" class="rounded-2xl border border-slate-300 px-4 py-3" />
        </label>
      </div>

      <div class="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">Правила відправки</h2>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="grid gap-2 text-sm">
            <span class="font-medium text-slate-700">Quiet hours від</span>
            <BaseInput v-model="form.quiet_hours_from" type="time" class="rounded-2xl border border-slate-300 px-4 py-3" />
          </label>
          <label class="grid gap-2 text-sm">
            <span class="font-medium text-slate-700">Quiet hours до</span>
            <BaseInput v-model="form.quiet_hours_to" type="time" class="rounded-2xl border border-slate-300 px-4 py-3" />
          </label>
          <label class="grid gap-2 text-sm">
            <span class="font-medium text-slate-700">Rate limit</span>
            <BaseInput v-model.number="form.default_rate_limit" min="1" type="number" class="rounded-2xl border border-slate-300 px-4 py-3" />
          </label>
          <label class="grid gap-2 text-sm">
            <span class="font-medium text-slate-700">Timezone</span>
            <BaseSelect native v-model="form.default_timezone" class="rounded-2xl border border-slate-300 px-4 py-3">
              <option value="Europe/Kyiv">Europe/Kyiv</option>
              <option value="Europe/Warsaw">Europe/Warsaw</option>
              <option value="UTC">UTC</option>
            </BaseSelect>
          </label>
        </div>
        <label class="grid gap-2 text-sm">
          <span class="font-medium text-slate-700">Opt-out текст</span>
          <BaseTextarea v-model="form.opt_out_text" class="min-h-24 rounded-2xl border border-slate-300 px-4 py-3" />
        </label>
        <label class="grid gap-2 text-sm">
          <span class="font-medium text-slate-700">Admin test recipient chat_id</span>
          <BaseInput v-model="form.test_recipient_chat_id" class="rounded-2xl border border-slate-300 px-4 py-3" />
        </label>
        <label class="inline-flex items-center gap-2 text-sm text-slate-700">
          <BaseCheckbox v-model="form.multi_location_enabled" /> Multi-location режим
        </label>
      </div>

      <div class="space-y-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
        <h2 class="text-xl font-semibold text-slate-900">Шаблони за замовчуванням</h2>
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label v-for="type in campaignTypes" :key="type.value" class="grid gap-2 text-sm">
            <span class="font-medium text-slate-700">{{ type.label }}</span>
            <BaseInput v-model="form.default_template_ids![type.value]" class="rounded-2xl border border-slate-300 px-4 py-3" placeholder="Template ID" />
          </label>
        </div>
      </div>
    </section>

    <BaseButton
      v-if="!pending"
      class="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
      :disabled="saving || !canSendMessagingCampaigns"
      @click="save"
    >
      {{ saving ? 'Збереження...' : 'Зберегти налаштування' }}
    </BaseButton>

    <section class="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p class="text-sm uppercase tracking-[0.2em] text-cyan-700">Після завершеного візиту</p>
        <h2 class="mt-1 text-xl font-semibold text-slate-900">Запити внутрішніх відгуків</h2>
        <p class="mt-2 text-sm leading-6 text-slate-500">Frontend лише редагує backend-конфігурацію. Планування, доставка, одноразові посилання та переходи статусів залишаються на сервері.</p>
      </div>

      <div v-if="reviewPending" class="h-40 animate-pulse rounded-2xl bg-slate-100" />
      <p v-else-if="reviewError" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{{ apiErrorMessage(reviewError, 'Конфігурація запитів відгуків недоступна: потрібен backend settings contract.') }}</p>
      <div v-else class="grid gap-5 xl:grid-cols-2">
        <div class="space-y-4">
          <label class="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"><span>Автоматичні запити увімкнено</span><BaseCheckbox v-model="reviewForm.enabled" /></label>
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="grid gap-2 text-sm"><span class="font-medium text-slate-700">Затримка після завершення, хв</span><BaseInput v-model.number="reviewForm.delay_minutes" type="number" min="0" class="rounded-2xl border border-slate-300 px-4 py-3" /></label>
            <label class="grid gap-2 text-sm"><span class="font-medium text-slate-700">Основний канал</span><BaseInput value="Telegram" disabled class="rounded-2xl border border-slate-300 px-4 py-3" /></label>
          </div>
          <label class="flex items-center gap-2 text-sm text-slate-700"><BaseCheckbox v-model="reviewForm.sms_fallback_enabled" /> SMS fallback, якщо Telegram недоступний</label>
          <label class="flex items-center gap-2 text-sm text-slate-700"><BaseCheckbox v-model="reviewForm.quiet_hours_enabled" /> Дотримуватися quiet hours</label>
          <div v-if="reviewForm.quiet_hours_enabled" class="grid gap-4 sm:grid-cols-2">
            <label class="grid gap-2 text-sm"><span class="font-medium text-slate-700">Від</span><BaseInput v-model="reviewForm.quiet_hours_from" type="time" class="rounded-2xl border border-slate-300 px-4 py-3" /></label>
            <label class="grid gap-2 text-sm"><span class="font-medium text-slate-700">До</span><BaseInput v-model="reviewForm.quiet_hours_to" type="time" class="rounded-2xl border border-slate-300 px-4 py-3" /></label>
          </div>
        </div>

        <div class="space-y-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="grid gap-2 text-sm"><span class="font-medium text-slate-700">Максимум запитів</span><BaseInput v-model.number="reviewForm.frequency_cap_count" type="number" min="1" class="rounded-2xl border border-slate-300 px-4 py-3" /></label>
            <label class="grid gap-2 text-sm"><span class="font-medium text-slate-700">За період, днів</span><BaseInput v-model.number="reviewForm.frequency_cap_days" type="number" min="1" class="rounded-2xl border border-slate-300 px-4 py-3" /></label>
          </div>
          <label class="grid gap-2 text-sm"><span class="font-medium text-slate-700">Виключення (одне backend-правило на рядок)</span><BaseTextarea v-model="exclusionsText" class="min-h-28 rounded-2xl border border-slate-300 px-4 py-3" placeholder="customer_opted_out" /></label>
          <div class="rounded-2xl bg-slate-950 p-4 text-sm text-white"><p class="text-xs uppercase tracking-[0.18em] text-white/50">Попередній перегляд шаблону</p><p class="mt-3 whitespace-pre-wrap leading-6">{{ reviewForm.template_preview || 'Backend не надав preview шаблону.' }}</p></div>
        </div>
      </div>

      <BaseButton v-if="!reviewPending" variant="primary" :loading="reviewSaving" :disabled="!canSendMessagingCampaigns || Boolean(reviewError)" @click="saveReviewSettings">Зберегти правила запитів</BaseButton>
    </section>
  </div>
</template>
