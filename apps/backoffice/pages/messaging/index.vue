<script setup lang="ts">
import {
  ChatBubbleLeftRightIcon,
  DocumentDuplicateIcon,
  ExclamationTriangleIcon,
  PaperAirplaneIcon,
  PlusIcon,
} from '@heroicons/vue/24/outline'

const api = useBackofficeApi()
const { statusLabel, statusClass } = useMessagingUi()

const { data, pending, error, refresh } = await useAsyncData('messaging-dashboard', () => api.getMessagingDashboard())

const cards = computed(() => [
  { label: 'Активні кампанії', value: data.value?.active_campaigns || 0 },
  { label: 'Заплановані', value: data.value?.scheduled_campaigns || 0 },
  { label: 'Надіслано', value: data.value?.messages_sent || 0 },
  { label: 'Помилки', value: data.value?.failed_messages || 0 },
  { label: 'Доставка', value: `${data.value?.delivery_rate || 0}%` },
  { label: 'Запити відгуків', value: data.value?.review_requests_sent || 0 },
])
</script>

<template>
  <div class="messaging-page space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Messaging</p>
        <h1 class="mt-2 text-3xl font-semibold text-slate-900">Комунікації з клієнтами</h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Telegram кампанії, автоматичні запити відгуків, шаблони та контроль відправок.
        </p>
      </div>
      <NuxtLink to="/messaging/campaigns/new" class="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white">
        <PlusIcon class="h-5 w-5" />
        Створити кампанію
      </NuxtLink>
    </div>

    <div v-if="pending" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <div v-for="index in 6" :key="index" class="h-28 animate-pulse rounded-[1.25rem] bg-slate-100" />
    </div>
    <div v-else-if="error" class="rounded-[1.25rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
      Не вдалося завантажити dashboard. <button class="font-semibold underline" @click="refresh()">Спробувати ще раз</button>
    </div>
    <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <div v-for="card in cards" :key="card.label" class="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
        <p class="text-xs uppercase tracking-[0.18em] text-slate-500">{{ card.label }}</p>
        <p class="mt-2 text-2xl font-semibold text-slate-900">{{ card.value }}</p>
      </div>
    </div>

    <section class="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-xl font-semibold text-slate-900">Остання активність</h2>
          <NuxtLink to="/messaging/campaigns" class="text-sm font-medium text-cyan-700">Усі кампанії</NuxtLink>
        </div>
        <div v-if="data?.recent_activity?.length" class="mt-5 space-y-3">
          <article v-for="item in data.recent_activity" :key="item.id" class="rounded-2xl bg-slate-50 p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="font-medium text-slate-900">{{ item.title }}</p>
                <p class="mt-1 text-sm text-slate-500">{{ item.description }}</p>
              </div>
              <span class="rounded-full px-3 py-1 text-xs font-medium" :class="statusClass(item.status)">{{ statusLabel(item.status) }}</span>
            </div>
            <p class="mt-3 text-xs text-slate-500">{{ new Date(item.created_at).toLocaleString('uk-UA') }}</p>
          </article>
        </div>
        <p v-else class="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
          Активності ще немає. Створіть першу кампанію або шаблон.
        </p>
      </div>

      <div class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">Швидкі дії</h2>
        <div class="mt-5 grid gap-3">
          <NuxtLink to="/messaging/campaigns/new" class="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-900">
            <PaperAirplaneIcon class="h-5 w-5 text-cyan-700" /> Створити кампанію
          </NuxtLink>
          <NuxtLink to="/messaging/templates" class="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-900">
            <DocumentDuplicateIcon class="h-5 w-5 text-cyan-700" /> Створити шаблон
          </NuxtLink>
          <NuxtLink to="/messaging/settings" class="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-900">
            <ChatBubbleLeftRightIcon class="h-5 w-5 text-cyan-700" /> Тестовий отримувач
          </NuxtLink>
          <NuxtLink to="/messaging/campaigns?status=failed" class="flex items-center gap-3 rounded-2xl bg-rose-50 p-4 text-sm font-medium text-rose-800">
            <ExclamationTriangleIcon class="h-5 w-5" /> Переглянути помилки
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>
