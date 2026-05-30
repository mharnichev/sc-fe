<script setup lang="ts">
import type { MessagingSettings } from '~/types/messaging'

const api = useBackofficeApi()
const { campaignTypes } = useMessagingUi()
const { canSendMessagingCampaigns } = useBackofficeAccess()
const saving = ref(false)
const saved = ref(false)

const { data, pending, error } = await useAsyncData('messaging-settings', () => api.getMessagingSettings())

const form = reactive<Partial<MessagingSettings>>({
  telegram_bot_status: 'offline',
  default_review_links: { google: '', instagram: '', internal: '', custom: '' },
  default_template_ids: {
    manual: null,
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
  default_timezone: 'Europe/Kiev',
  opt_out_text: 'Напишіть STOP, щоб відписатися.',
  test_recipient_chat_id: '',
  multi_location_enabled: false,
})

watch(data, value => {
  if (!value) return
  Object.assign(form, value)
}, { immediate: true })

const save = async () => {
  saving.value = true
  try {
    await api.updateMessagingSettings(form)
    saved.value = true
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="messaging-page space-y-6">
    <div>
      <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Messaging</p>
      <h1 class="mt-2 text-3xl font-semibold text-slate-900">Налаштування повідомлень</h1>
    </div>

    <div v-if="saved" class="rounded-[1.25rem] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">Налаштування збережено.</div>
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
          <input v-model="form.default_review_links!.google" class="rounded-2xl border border-slate-300 px-4 py-3">
        </label>
        <label class="grid gap-2 text-sm">
          <span class="font-medium text-slate-700">Instagram</span>
          <input v-model="form.default_review_links!.instagram" class="rounded-2xl border border-slate-300 px-4 py-3">
        </label>
        <label class="grid gap-2 text-sm">
          <span class="font-medium text-slate-700">Внутрішня сторінка відгуків</span>
          <input v-model="form.default_review_links!.internal" class="rounded-2xl border border-slate-300 px-4 py-3">
        </label>
      </div>

      <div class="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">Правила відправки</h2>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="grid gap-2 text-sm">
            <span class="font-medium text-slate-700">Quiet hours від</span>
            <input v-model="form.quiet_hours_from" type="time" class="rounded-2xl border border-slate-300 px-4 py-3">
          </label>
          <label class="grid gap-2 text-sm">
            <span class="font-medium text-slate-700">Quiet hours до</span>
            <input v-model="form.quiet_hours_to" type="time" class="rounded-2xl border border-slate-300 px-4 py-3">
          </label>
          <label class="grid gap-2 text-sm">
            <span class="font-medium text-slate-700">Rate limit</span>
            <input v-model.number="form.default_rate_limit" min="1" type="number" class="rounded-2xl border border-slate-300 px-4 py-3">
          </label>
          <label class="grid gap-2 text-sm">
            <span class="font-medium text-slate-700">Timezone</span>
            <select v-model="form.default_timezone" class="rounded-2xl border border-slate-300 px-4 py-3">
              <option value="Europe/Kiev">Europe/Kiev</option>
              <option value="Europe/Warsaw">Europe/Warsaw</option>
              <option value="UTC">UTC</option>
            </select>
          </label>
        </div>
        <label class="grid gap-2 text-sm">
          <span class="font-medium text-slate-700">Opt-out текст</span>
          <textarea v-model="form.opt_out_text" class="min-h-24 rounded-2xl border border-slate-300 px-4 py-3" />
        </label>
        <label class="grid gap-2 text-sm">
          <span class="font-medium text-slate-700">Admin test recipient chat_id</span>
          <input v-model="form.test_recipient_chat_id" class="rounded-2xl border border-slate-300 px-4 py-3">
        </label>
        <label class="inline-flex items-center gap-2 text-sm text-slate-700">
          <input v-model="form.multi_location_enabled" type="checkbox"> Multi-location режим
        </label>
      </div>

      <div class="space-y-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
        <h2 class="text-xl font-semibold text-slate-900">Шаблони за замовчуванням</h2>
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label v-for="type in campaignTypes" :key="type.value" class="grid gap-2 text-sm">
            <span class="font-medium text-slate-700">{{ type.label }}</span>
            <input v-model="form.default_template_ids![type.value]" class="rounded-2xl border border-slate-300 px-4 py-3" placeholder="Template ID">
          </label>
        </div>
      </div>
    </section>

    <button
      v-if="!pending"
      class="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
      :disabled="saving || !canSendMessagingCampaigns"
      @click="save"
    >
      {{ saving ? 'Збереження...' : 'Зберегти налаштування' }}
    </button>
  </div>
</template>
