<script setup lang="ts">
import type { CustomerCommunicationProfile } from '~/types/messaging'

const props = defineProps<{ customerId: number | string }>()
const api = useBackofficeApi()
const { canCreateMessagingDrafts } = useBackofficeAccess()
const messageOpen = ref(false)
const preferencesOpen = ref(false)
const manualMessage = ref('')
const saving = ref(false)
const saved = ref('')

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
    saved.value = 'Повідомлення поставлено в чергу.'
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
    saved.value = 'Комунікаційні налаштування оновлено.'
    await refresh()
  }
  finally {
    saving.value = false
  }
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
        <button v-if="canCreateMessagingDrafts" class="rounded-full border border-slate-300 px-4 py-2 text-sm" @click="messageOpen = true">Надіслати повідомлення</button>
        <button class="rounded-full border border-slate-300 px-4 py-2 text-sm" @click="preferencesOpen = true">Оновити налаштування</button>
      </div>
    </div>

    <p v-if="saved" class="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">{{ saved }}</p>
    <p v-if="pending" class="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Завантажуємо комунікації...</p>
    <p v-else-if="error" class="mt-5 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">Комунікаційний профіль поки недоступний.</p>

    <template v-else-if="data">
      <div class="mt-5 grid gap-3 md:grid-cols-4">
        <div class="rounded-2xl bg-slate-50 p-4">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Telegram</p>
          <p class="mt-2 font-semibold text-slate-900">{{ data.telegram_chat_id || 'Немає chat_id' }}</p>
          <span class="mt-2 inline-flex rounded-full px-2 py-1 text-xs font-medium" :class="data.telegram_status === 'connected' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'">{{ data.telegram_status }}</span>
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
          <button class="rounded-full border border-slate-300 px-4 py-2 text-sm" @click="close">Закрити</button>
        </div>
      </template>
      <template #body>
        <textarea v-model="manualMessage" class="min-h-40 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm" placeholder="Текст Telegram повідомлення" />
        <button class="mt-4 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-50" :disabled="saving || !manualMessage.trim()" @click="sendMessage">
          {{ saving ? 'Відправляємо...' : 'Надіслати' }}
        </button>
      </template>
    </BaseModal>

    <BaseModal v-model="preferencesOpen" max-width-class="max-w-lg">
      <template #head="{ close }">
        <div class="flex items-center justify-between gap-4">
          <h2 class="text-2xl font-semibold text-slate-900">Налаштування комунікацій</h2>
          <button class="rounded-full border border-slate-300 px-4 py-2 text-sm" @click="close">Закрити</button>
        </div>
      </template>
      <template #body>
        <div class="space-y-4">
          <label class="inline-flex items-center gap-2 text-sm"><input v-model="preferences.marketing_consent" type="checkbox"> Є маркетингова згода</label>
          <label class="inline-flex items-center gap-2 text-sm"><input v-model="preferences.opt_out" type="checkbox"> Opt-out</label>
          <label class="grid gap-2 text-sm">
            <span class="font-medium text-slate-700">Мова</span>
            <select v-model="preferences.preferred_language" class="rounded-2xl border border-slate-300 px-4 py-3">
              <option value="uk">Українська</option>
              <option value="en">English</option>
            </select>
          </label>
          <button class="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white" :disabled="saving" @click="savePreferences">Зберегти</button>
        </div>
      </template>
    </BaseModal>
  </section>
</template>
