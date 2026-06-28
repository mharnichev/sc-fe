<script setup lang="ts">
import type { AudienceEstimate, AudienceRule, CampaignPayload, CampaignType, MessageTemplate, MessagingChannel, RecipientPreview } from '~/types/messaging'

const api = useBackofficeApi()
const router = useRouter()
const toast = useBaseToastNotification()
const { campaignTypes, channels, variables, sampleClient } = useMessagingUi()
const { apiErrorMessage } = useBookingFormatting()
const { canSendMessagingCampaigns, canCreateMessagingDrafts } = useBackofficeAccess()

const step = ref(1)
const saving = ref(false)
const showSendConfirm = ref(false)
const showRecipients = ref(false)
const audienceLoading = ref(false)
const recipientLoading = ref(false)
const recipientError = ref('')
const estimate = ref<AudienceEstimate | null>(null)
const recipients = ref<RecipientPreview[]>([])

const form = reactive<CampaignPayload>({
  name: '',
  type: 'manual',
  channel: 'telegram',
  status: 'draft',
  template_id: null,
  message_body: '',
  language_versions: { uk: '', en: '' },
  audience_rules: [{ type: 'all_clients' }],
  review_platform: 'google',
  review_link: '',
  promo_code: '',
  inline_button_text: 'Залишити відгук',
  follow_up_after_days: null,
  schedule_mode: 'later',
  scheduled_at: '',
  timezone: 'Europe/Kyiv',
  automation_delay: '24h',
  max_messages_per_minute: 20,
  quiet_hours_enabled: true,
  quiet_hours_from: '21:00',
  quiet_hours_to: '09:00',
  duplicate_protection_days: 30,
})

const [{ data: templates }, { data: masters }, { data: services }] = await Promise.all([
  useAsyncData('campaign-wizard-templates', () => api.getMessageTemplates(1, 100)),
  useAsyncData('campaign-wizard-masters', () => api.adminGetMasters(1, 100)),
  useAsyncData('campaign-wizard-services', () => api.adminGetServices(1, 100)),
])

const templateItems = computed(() => templates.value?.items || [])
const masterItems = computed(() => Array.isArray(masters.value) ? masters.value : masters.value?.items || [])
const serviceItems = computed(() => Array.isArray(services.value) ? services.value : services.value?.items || [])
const selectedTemplate = computed(() => templateItems.value.find(template => String(template.id) === String(form.template_id)))

watch(selectedTemplate, (template?: MessageTemplate) => {
  if (!template) return
  form.message_body = template.message_body
  form.type = template.campaign_type
  form.channel = template.channel
})

watch(
  () => form.audience_rules,
  async () => {
    audienceLoading.value = true
    try {
      estimate.value = await api.estimateMessagingAudience(form.audience_rules)
    }
    catch {
      estimate.value = { total: 0, eligible: 0, missing_chat_id: 0, opted_out: 0, excluded: 0 }
    }
    finally {
      audienceLoading.value = false
    }
  },
  { deep: true, immediate: true },
)

const requiredMissingVariables = computed(() => {
  if (form.type !== 'post_visit_review_request') return []
  return ['{{client_name}}', '{{review_link}}'].filter(variable => !form.message_body.includes(variable))
})

const validationErrors = computed(() => {
  const errors: string[] = []
  if (!form.name.trim()) errors.push('Вкажіть назву кампанії.')
  if (!form.message_body.trim()) errors.push('Додайте текст повідомлення.')
  if (!estimate.value?.eligible) errors.push('Аудиторія має містити хоча б одного доступного клієнта.')
  if (requiredMissingVariables.value.length) errors.push(`Додайте обовʼязкові змінні: ${requiredMissingVariables.value.join(', ')}.`)
  if (form.schedule_mode === 'later' && !form.scheduled_at) errors.push('Вкажіть дату та час відправки.')
  return errors
})

const insertVariable = (variable: string) => {
  form.message_body = `${form.message_body}${form.message_body ? ' ' : ''}${variable}`
}

const previewRecipients = async () => {
  showRecipients.value = true
  recipientLoading.value = true
  recipientError.value = ''
  try {
    recipients.value = await api.previewMessagingRecipients(form.audience_rules, 50)
  }
  catch {
    recipientError.value = 'Не вдалося завантажити список отримувачів.'
  }
  finally {
    recipientLoading.value = false
  }
}

const save = async (activate = false) => {
  if (!canCreateMessagingDrafts.value) return
  if (activate && (!canSendMessagingCampaigns.value || validationErrors.value.length)) return
  saving.value = true
  try {
    const payload = { ...form, status: activate ? 'active' as const : form.status }
    const campaign = await api.createMessagingCampaign(payload)
    toast.success(activate ? 'Кампанію активовано.' : 'Чернетку збережено.')
    await router.push(`/messaging/campaigns/${campaign.id}`)
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, activate ? 'Не вдалося активувати кампанію.' : 'Не вдалося зберегти чернетку.'))
  }
  finally {
    saving.value = false
    showSendConfirm.value = false
  }
}

const stepValid = computed(() => ({
  1: Boolean(form.name.trim() && form.channel),
  2: Boolean(estimate.value?.eligible),
  3: Boolean(form.message_body.trim() && !requiredMissingVariables.value.length),
  4: true,
  5: form.schedule_mode !== 'later' || Boolean(form.scheduled_at),
  6: validationErrors.value.length === 0,
}))

const nextStep = () => {
  if (step.value < 6) step.value += 1
}
</script>

<template>
  <div class="messaging-page space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Messaging</p>
        <h1 class="mt-2 text-3xl font-semibold text-slate-900">Нова кампанія</h1>
      </div>
      <NuxtLink to="/messaging#campaigns" class="messaging-secondary-action rounded-full px-5 py-3 text-sm">До списку</NuxtLink>
    </div>

    <div class="grid gap-6 xl:grid-cols-[260px_1fr]">
      <aside class="messaging-wizard-steps rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
        <BaseButton
          v-for="item in 6"
          :key="item"
          type="button"
          class="mb-2 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm"
          :class="step === item ? 'messaging-choice-active font-semibold' : 'messaging-choice-idle'"
          @click="step = item"
        >
          <span class="messaging-step-number flex h-7 w-7 items-center justify-center rounded-full text-xs">{{ item }}</span>
          <span class="messaging-step-label">{{ ['Основи', 'Аудиторія', 'Повідомлення', 'Відгук / промо', 'Розклад', 'Фінальна перевірка'][item - 1] }}</span>
        </BaseButton>
      </aside>

      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div v-if="step === 1" class="space-y-5">
          <h2 class="text-xl font-semibold text-slate-900">Основи кампанії</h2>
          <label class="grid gap-2 text-sm">
            <span class="font-medium text-slate-700">Назва кампанії</span>
            <BaseInput v-model="form.name" class="rounded-2xl border border-slate-300 px-4 py-3" placeholder="Наприклад: Відгук після візиту" />
          </label>
          <div class="grid gap-3 md:grid-cols-2">
            <label v-for="type in campaignTypes" :key="type.value" class="cursor-pointer rounded-[1.25rem] border p-4" :class="form.type === type.value ? 'messaging-choice-active' : 'messaging-choice-idle'">
              <BaseRadioButton v-model="form.type" class="sr-only" :value="type.value" />
              <span class="block text-sm font-semibold text-slate-900">{{ type.label }}</span>
              <span class="mt-1 block text-xs leading-5 text-slate-500">{{ type.helper }}</span>
            </label>
          </div>
          <div>
            <p class="text-sm font-medium text-slate-700">Канал</p>
            <div class="mt-2 grid gap-3 sm:grid-cols-4">
              <label v-for="channel in channels" :key="channel.value" class="rounded-2xl border p-4 text-sm" :class="form.channel === channel.value ? 'messaging-choice-active' : 'messaging-choice-idle'">
                <BaseRadioButton v-model="form.channel" class="sr-only" :value="channel.value" :disabled="!channel.enabled" />
                <MessagingChannelBadge :channel="channel.value" />
                <span v-if="!channel.enabled" class="mt-1 block text-xs text-slate-500">Скоро</span>
              </label>
            </div>
          </div>
          <label class="grid max-w-xs gap-2 text-sm">
            <span class="font-medium text-slate-700">Початковий статус</span>
            <BaseSelect native v-model="form.status" class="rounded-2xl border border-slate-300 px-4 py-3">
              <option value="draft">Чернетка</option>
              <option value="active" :disabled="!canSendMessagingCampaigns">Активна</option>
            </BaseSelect>
          </label>
        </div>

        <div v-else-if="step === 2" class="space-y-5">
          <h2 class="text-xl font-semibold text-slate-900">Аудиторія</h2>
          <AudienceFilterBuilder v-model="form.audience_rules" :masters="masterItems" :services="serviceItems" :estimate="estimate" :loading="audienceLoading" @preview="previewRecipients" />
          <p v-if="estimate?.excluded" class="messaging-tone-warning rounded-2xl p-4 text-sm">
            {{ estimate.excluded }} клієнтів буде виключено через відсутній Telegram chat_id або відмову від маркетингу.
          </p>
        </div>

        <div v-else-if="step === 3" class="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div class="space-y-5">
            <h2 class="text-xl font-semibold text-slate-900">Повідомлення</h2>
            <label class="grid gap-2 text-sm">
              <span class="font-medium text-slate-700">Шаблон</span>
              <BaseSelect native v-model="form.template_id" class="rounded-2xl border border-slate-300 px-4 py-3">
                <option :value="null">Кастомне повідомлення</option>
                <option v-for="template in templateItems" :key="template.id" :value="template.id">{{ template.name }}</option>
              </BaseSelect>
            </label>
            <label class="grid gap-2 text-sm">
              <span class="font-medium text-slate-700">Текст</span>
              <BaseTextarea v-model="form.message_body" class="min-h-52 rounded-2xl border border-slate-300 px-4 py-3 leading-6" />
              <span class="text-xs text-slate-500">{{ form.message_body.length }} символів</span>
            </label>
            <VariablePicker @select="insertVariable" />
            <div v-if="requiredMissingVariables.length" class="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
              Не вистачає змінних: {{ requiredMissingVariables.join(', ') }}
            </div>
            <div class="grid gap-3 md:grid-cols-2">
              <label class="grid gap-2 text-sm">
                <span class="font-medium text-slate-700">Українська версія</span>
                <BaseTextarea v-model="form.language_versions!.uk" class="min-h-28 rounded-2xl border border-slate-300 px-4 py-3" />
              </label>
              <label class="grid gap-2 text-sm">
                <span class="font-medium text-slate-700">English version</span>
                <BaseTextarea v-model="form.language_versions!.en" class="min-h-28 rounded-2xl border border-slate-300 px-4 py-3" />
              </label>
            </div>
          </div>
          <MessagePreview :body="form.message_body" :button-text="form.inline_button_text" :sample="sampleClient" />
        </div>

        <div v-else-if="step === 4" class="space-y-5">
          <h2 class="text-xl font-semibold text-slate-900">Відгук та промо</h2>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="grid gap-2 text-sm">
              <span class="font-medium text-slate-700">Платформа відгуку</span>
              <BaseSelect native v-model="form.review_platform" class="rounded-2xl border border-slate-300 px-4 py-3">
                <option value="google">Google Reviews</option>
                <option value="instagram">Instagram</option>
                <option value="internal">Внутрішня сторінка</option>
                <option value="custom">Custom URL</option>
              </BaseSelect>
            </label>
            <label class="grid gap-2 text-sm">
              <span class="font-medium text-slate-700">Посилання</span>
              <BaseInput v-model="form.review_link" class="rounded-2xl border border-slate-300 px-4 py-3" placeholder="https://..." />
            </label>
            <label class="grid gap-2 text-sm">
              <span class="font-medium text-slate-700">Промокод</span>
              <BaseInput v-model="form.promo_code" class="rounded-2xl border border-slate-300 px-4 py-3" placeholder="SOUL10" />
            </label>
            <label class="grid gap-2 text-sm">
              <span class="font-medium text-slate-700">Текст кнопки Telegram</span>
              <BaseInput v-model="form.inline_button_text" class="rounded-2xl border border-slate-300 px-4 py-3" />
            </label>
            <label class="grid gap-2 text-sm">
              <span class="font-medium text-slate-700">Follow-up через N днів</span>
              <BaseInput v-model.number="form.follow_up_after_days" min="1" type="number" class="rounded-2xl border border-slate-300 px-4 py-3" />
            </label>
          </div>
        </div>

        <div v-else-if="step === 5" class="space-y-5">
          <h2 class="text-xl font-semibold text-slate-900">Розклад та правила</h2>
          <div class="grid gap-3 sm:grid-cols-3">
            <label class="rounded-2xl border p-4" :class="form.schedule_mode === 'now' ? 'messaging-choice-active' : 'messaging-choice-idle'"><BaseRadioButton v-model="form.schedule_mode" value="now" /> Надіслати зараз</label>
            <label class="rounded-2xl border p-4" :class="form.schedule_mode === 'later' ? 'messaging-choice-active' : 'messaging-choice-idle'"><BaseRadioButton v-model="form.schedule_mode" value="later" /> Запланувати</label>
            <label class="rounded-2xl border p-4" :class="form.schedule_mode === 'automated' ? 'messaging-choice-active' : 'messaging-choice-idle'"><BaseRadioButton v-model="form.schedule_mode" value="automated" /> Автоматично</label>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <label v-if="form.schedule_mode === 'later'" class="grid gap-2 text-sm">
              <span class="font-medium text-slate-700">Дата і час</span>
              <BaseCalendar v-model="form.scheduled_at" class="rounded-2xl border border-slate-300 px-4 py-3" mode="datetime" />
            </label>
            <label class="grid gap-2 text-sm">
              <span class="font-medium text-slate-700">Timezone</span>
              <BaseSelect native v-model="form.timezone" class="rounded-2xl border border-slate-300 px-4 py-3">
                <option value="Europe/Kyiv">Europe/Kyiv</option>
                <option value="Europe/Warsaw">Europe/Warsaw</option>
                <option value="UTC">UTC</option>
              </BaseSelect>
            </label>
            <label v-if="form.schedule_mode === 'automated'" class="grid gap-2 text-sm">
              <span class="font-medium text-slate-700">Після завершення візиту</span>
              <BaseSelect native v-model="form.automation_delay" class="rounded-2xl border border-slate-300 px-4 py-3">
                <option value="immediate">Одразу</option>
                <option value="1h">1 година</option>
                <option value="24h">24 години</option>
                <option value="custom">Custom</option>
              </BaseSelect>
            </label>
            <label class="grid gap-2 text-sm">
              <span class="font-medium text-slate-700">Макс. повідомлень за хвилину</span>
              <BaseInput v-model.number="form.max_messages_per_minute" min="1" type="number" class="rounded-2xl border border-slate-300 px-4 py-3" />
            </label>
            <label class="grid gap-2 text-sm">
              <span class="font-medium text-slate-700">Не дублювати протягом днів</span>
              <BaseInput v-model.number="form.duplicate_protection_days" min="0" type="number" class="rounded-2xl border border-slate-300 px-4 py-3" />
            </label>
          </div>
          <label class="inline-flex items-center gap-2 text-sm text-slate-700">
            <BaseCheckbox v-model="form.quiet_hours_enabled" /> Не надсилати вночі
          </label>
          <div v-if="form.quiet_hours_enabled" class="grid max-w-md gap-4 sm:grid-cols-2">
            <BaseInput v-model="form.quiet_hours_from" type="time" class="rounded-2xl border border-slate-300 px-4 py-3" />
            <BaseInput v-model="form.quiet_hours_to" type="time" class="rounded-2xl border border-slate-300 px-4 py-3" />
          </div>
        </div>

        <div v-else class="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div class="space-y-5">
            <h2 class="text-xl font-semibold text-slate-900">Фінальна перевірка</h2>
            <dl class="grid gap-3 rounded-[1.25rem] bg-slate-50 p-4 text-sm md:grid-cols-2">
              <div><dt class="text-slate-500">Назва</dt><dd class="font-medium text-slate-900">{{ form.name || '—' }}</dd></div>
              <div><dt class="text-slate-500">Аудиторія</dt><dd class="font-medium text-slate-900">{{ estimate?.eligible || 0 }} доступних, {{ estimate?.excluded || 0 }} виключено</dd></div>
              <div><dt class="text-slate-500">Канал</dt><dd class="mt-1"><MessagingChannelBadge :channel="form.channel" /></dd></div>
              <div><dt class="text-slate-500">Розклад</dt><dd class="font-medium text-slate-900">{{ form.schedule_mode }}</dd></div>
            </dl>
            <div v-if="validationErrors.length" class="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
              <p v-for="item in validationErrors" :key="item">{{ item }}</p>
            </div>
            <div class="flex flex-wrap gap-3">
              <BaseButton class="messaging-secondary-action rounded-full px-5 py-3 text-sm font-medium" :disabled="saving || !canCreateMessagingDrafts" @click="save(false)">Зберегти чернетку</BaseButton>
              <BaseButton class="messaging-accent-action rounded-full px-5 py-3 text-sm font-medium" :disabled="saving || validationErrors.length > 0">Надіслати тест</BaseButton>
              <BaseButton class="messaging-primary-action rounded-full px-5 py-3 text-sm font-medium disabled:opacity-50" :disabled="saving || validationErrors.length > 0 || !canSendMessagingCampaigns" @click="showSendConfirm = true">
                {{ form.schedule_mode === 'later' ? 'Запланувати кампанію' : 'Активувати кампанію' }}
              </BaseButton>
            </div>
          </div>
          <MessagePreview :body="form.message_body" :button-text="form.inline_button_text" />
        </div>

        <div class="mt-8 flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-5">
          <BaseButton class="messaging-secondary-action rounded-full px-5 py-3 text-sm" :disabled="step === 1" @click="step -= 1">Назад</BaseButton>
          <BaseButton v-if="step < 6" class="messaging-primary-action rounded-full px-5 py-3 text-sm font-medium disabled:opacity-50" :disabled="!stepValid[step as keyof typeof stepValid]" @click="nextStep">Далі</BaseButton>
        </div>
      </section>
    </div>

    <BaseModal v-model="showRecipients" max-width-class="max-w-5xl">
      <template #head="{ close }">
        <div class="flex items-center justify-between gap-4">
          <h2 class="text-2xl font-semibold text-slate-900">Попередній список отримувачів</h2>
          <ModalCloseButton @click="close" />
        </div>
      </template>
      <template #body>
        <RecipientPreviewTable :recipients="recipients" :pending="recipientLoading" :error="recipientError" />
      </template>
    </BaseModal>

    <ConfirmActionModal
      v-model="showSendConfirm"
      title="Запустити реальну кампанію?"
      message="Повідомлення буде надіслано доступним клієнтам згідно з аудиторією та правилами. Перевірте текст, посилання та час відправки."
      confirm-label="Запустити"
      :pending="saving"
      @confirm="save(true)"
    />
  </div>
</template>
