<script setup lang="ts">
import { CheckCircleIcon, PaperAirplaneIcon } from '@heroicons/vue/24/outline'
import type { CustomerCommunicationProfile } from '~/types/messaging'

const props = defineProps<{ customerId: number | string }>()
const api = useBackofficeApi()
const { canCreateMessagingDrafts } = useBackofficeAccess()
const { apiErrorMessage } = useBookingFormatting()
const toast = useBaseToastNotification()
const messageOpen = ref(false)
const preferencesOpen = ref(false)
const manualMessage = ref('')
const saving = ref(false)
const connectLink = ref('')
const connectLinkLoading = ref(false)

const { data, pending, error, refresh } = await useAsyncData(
  () => `customer-${props.customerId}-communication`,
  () => api.getCustomerCommunication(props.customerId),
)

const preferences = reactive<Partial<CustomerCommunicationProfile>>({
  marketing_consent: false,
  opt_out: false,
  preferred_language: 'uk',
})

watch(data, value => {
  if (!value) return
  preferences.marketing_consent = value.marketing_consent
  preferences.opt_out = value.opt_out
  preferences.preferred_language = value.preferred_language
}, { immediate: true })

const sendMessage = async () => {
  if (!manualMessage.value.trim()) return
  saving.value = true
  try {
    await api.sendCustomerManualMessage(props.customerId, manualMessage.value)
    manualMessage.value = ''
    messageOpen.value = false
    toast.success('Повідомлення поставлено в чергу.')
    await refresh()
  }
  finally {
    saving.value = false
  }
}

const savePreferences = async () => {
  saving.value = true
  try {
    await api.updateCustomerCommunication(props.customerId, preferences)
    preferencesOpen.value = false
    toast.success('Комунікаційні налаштування оновлено.')
    await refresh()
  }
  finally {
    saving.value = false
  }
}

const loadConnectLink = async () => {
  connectLinkLoading.value = true
  try {
    const response = await api.getCustomerTelegramConnectLink(props.customerId)
    connectLink.value = response.connect_link
    toast.success('Telegram посилання створено.')
  }
  catch (cause) {
    connectLink.value = ''
    toast.error(apiErrorMessage(cause, 'Не вдалося створити Telegram посилання.'))
  }
  finally {
    connectLinkLoading.value = false
  }
}

const copyConnectLink = async () => {
  if (!connectLink.value || !import.meta.client) return
  await navigator.clipboard.writeText(connectLink.value)
  toast.success('Telegram посилання скопійовано.')
}
</script>

<template>
  <section class="messaging-page rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 class="text-xl font-semibold text-slate-900">Комунікації</h2>
        <p class="mt-1 text-sm text-slate-500">Telegram, маркетингова згода, історія повідомлень і запити відгуків.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <BaseButton v-if="canCreateMessagingDrafts" class="rounded-full border border-slate-300 px-4 py-2 text-sm" @click="messageOpen = true">Надіслати повідомлення</BaseButton>
        <BaseButton class="rounded-full border border-slate-300 px-4 py-2 text-sm" @click="preferencesOpen = true">Оновити налаштування</BaseButton>
      </div>
    </div>

    <p v-if="pending" class="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Завантажуємо комунікації...</p>
    <p v-else-if="error" class="mt-5 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">Комунікаційний профіль поки недоступний.</p>

    <template v-else-if="data">
      <div class="mt-5 grid gap-3 md:grid-cols-4">
        <div class="rounded-2xl bg-slate-50 p-4">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Telegram</p>
          <p class="mt-2 font-semibold text-slate-900">{{ data.telegram_chat_id || 'Немає chat_id' }}</p>
          <span class="mt-2 inline-flex rounded-full px-2 py-1 text-xs font-medium" :class="data.telegram_status === 'connected' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'">{{ data.telegram_status }}</span>
          <BaseButton v-if="data.telegram_status !== 'connected'" class="mt-3 rounded-full border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50" :disabled="connectLinkLoading" @click="loadConnectLink">
            {{ connectLinkLoading ? 'Створюємо...' : 'Створити Telegram лінк' }}
          </BaseButton>
        </div>
        <div class="rounded-2xl bg-slate-50 p-4">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Маркетинг</p>
          <p class="mt-2 font-semibold" :class="data.marketing_consent ? 'text-emerald-700' : 'text-rose-700'">{{ data.marketing_consent ? 'Дозволено' : 'Немає згоди' }}</p>
        </div>
        <div class="rounded-2xl bg-slate-50 p-4">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Opt-out</p>
          <p class="mt-2 font-semibold" :class="data.opt_out ? 'text-rose-700' : 'text-emerald-700'">{{ data.opt_out ? 'Відписаний' : 'Активний' }}</p>
        </div>
        <div class="rounded-2xl bg-slate-50 p-4">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Мова</p>
          <p class="mt-2 font-semibold text-slate-900">{{ data.preferred_language }}</p>
        </div>
      </div>

      <div v-if="connectLink" class="mt-4 rounded-2xl border border-sky-100 bg-sky-50 p-4">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Telegram connect link</p>
        <p class="mt-2 break-all text-sm text-slate-700">{{ connectLink }}</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <BaseButton class="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white" @click="copyConnectLink">Скопіювати</BaseButton>
          <NuxtLink :to="connectLink" target="_blank" rel="noopener noreferrer" class="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Відкрити</NuxtLink>
        </div>
      </div>

      <div class="mt-6 grid gap-6 xl:grid-cols-2">
        <div>
          <h3 class="font-semibold text-slate-900">Історія повідомлень</h3>
          <SendLogsTable class="mt-3" :logs="data.message_history || []" />
        </div>
        <div>
          <h3 class="font-semibold text-slate-900">Запити відгуків</h3>
          <SendLogsTable class="mt-3" :logs="data.review_requests || []" />
        </div>
      </div>
    </template>

    <BaseModal v-model="messageOpen" max-width-class="max-w-lg">
      <template #head="{ close }">
        <div class="flex items-center justify-between gap-4">
          <h2 class="text-2xl font-semibold text-slate-900">Ручне повідомлення</h2>
          <ModalCloseButton @click="close" />
        </div>
      </template>
      <template #body>
        <BaseTextarea v-model="manualMessage" class="min-h-40 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm" placeholder="Текст Telegram повідомлення" />
        <div class="backoffice-modal-actions mt-4">
          <BaseButton class="backoffice-modal-action-button backoffice-modal-action-primary" :disabled="saving || !manualMessage.trim()" @click="sendMessage">
            <PaperAirplaneIcon v-if="!saving" class="h-4 w-4" aria-hidden="true" />
            {{ saving ? 'Відправляємо...' : 'Надіслати' }}
          </BaseButton>
        </div>
      </template>
    </BaseModal>

    <BaseModal v-model="preferencesOpen" max-width-class="max-w-lg">
      <template #head="{ close }">
        <div class="flex items-center justify-between gap-4">
          <h2 class="text-2xl font-semibold text-slate-900">Налаштування комунікацій</h2>
          <ModalCloseButton @click="close" />
        </div>
      </template>
      <template #body>
        <div class="space-y-4">
          <label class="inline-flex items-center gap-2 text-sm"><BaseCheckbox v-model="preferences.marketing_consent" /> Є маркетингова згода</label>
          <label class="inline-flex items-center gap-2 text-sm"><BaseCheckbox v-model="preferences.opt_out" /> Opt-out</label>
          <label class="grid gap-2 text-sm">
            <span class="font-medium text-slate-700">Мова</span>
            <BaseSelect native v-model="preferences.preferred_language" class="rounded-2xl border border-slate-300 px-4 py-3">
              <option value="uk">Українська</option>
              <option value="en">English</option>
            </BaseSelect>
          </label>
          <div class="backoffice-modal-actions">
            <BaseButton class="backoffice-modal-action-button backoffice-modal-action-primary" :disabled="saving" @click="savePreferences">
              <CheckCircleIcon v-if="!saving" class="h-4 w-4" aria-hidden="true" />
              Зберегти
            </BaseButton>
          </div>
        </div>
      </template>
    </BaseModal>
  </section>
</template>
