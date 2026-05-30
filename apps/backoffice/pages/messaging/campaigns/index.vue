<script setup lang="ts">
import { ArchiveBoxIcon, DocumentDuplicateIcon, EyeIcon, PauseIcon, PencilIcon, PlayIcon, TrashIcon } from '@heroicons/vue/24/outline'
import type { MessagingCampaign } from '~/types/messaging'

const route = useRoute()
const api = useBackofficeApi()
const { campaignTypes, channels, channelLabel } = useMessagingUi()
const { masterName } = useBookingFormatting()
const { canSendMessagingCampaigns, canCreateMessagingDrafts } = useBackofficeAccess()

const page = ref(1)
const pageSize = 20
const filters = reactive({
  status: String(route.query.status || ''),
  type: '',
  channel: '',
  date_from: '',
  date_to: '',
  barber_id: null as number | null,
})

const [{ data, pending, error, refresh }, { data: masters }] = await Promise.all([
  useAsyncData('messaging-campaigns', () => api.getMessagingCampaigns(page.value, pageSize, filters), { watch: [page] }),
  useAsyncData('messaging-campaign-masters', () => api.adminGetMasters(1, 100)),
])

const masterItems = computed(() => Array.isArray(masters.value) ? masters.value : masters.value?.items || [])
const confirmAction = ref<{ campaign: MessagingCampaign, action: 'archived' | 'delete' | 'paused' | 'active' } | null>(null)
const actionPending = ref(false)

const applyFilters = async () => {
  page.value = 1
  await refresh()
}

const clearFilters = async () => {
  filters.status = ''
  filters.type = ''
  filters.channel = ''
  filters.date_from = ''
  filters.date_to = ''
  filters.barber_id = null
  page.value = 1
  await refresh()
}

const runAction = async () => {
  if (!confirmAction.value) return
  actionPending.value = true
  try {
    const { campaign, action } = confirmAction.value
    if (action === 'delete') await api.deleteMessagingCampaign(campaign.id)
    else await api.updateMessagingCampaignStatus(campaign.id, action)
    confirmAction.value = null
    await refresh()
  }
  finally {
    actionPending.value = false
  }
}

const duplicate = async (campaign: MessagingCampaign) => {
  await api.duplicateMessagingCampaign(campaign.id)
  await refresh()
}

const closeConfirm = (value: boolean) => {
  if (!value) confirmAction.value = null
}
</script>

<template>
  <div class="messaging-page space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Messaging</p>
        <h1 class="mt-2 text-3xl font-semibold text-slate-900">Кампанії</h1>
      </div>
      <NuxtLink
        v-if="canCreateMessagingDrafts"
        to="/messaging/campaigns/new"
        class="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white"
      >
        Нова кампанія
      </NuxtLink>
    </div>

    <section class="grid gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3 xl:grid-cols-6">
      <select v-model="filters.status" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
        <option value="">Усі статуси</option>
        <option value="draft">Чернетка</option>
        <option value="active">Активна</option>
        <option value="scheduled">Запланована</option>
        <option value="paused">На паузі</option>
        <option value="completed">Завершена</option>
        <option value="failed">Помилка</option>
      </select>
      <select v-model="filters.type" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
        <option value="">Усі типи</option>
        <option v-for="type in campaignTypes" :key="type.value" :value="type.value">{{ type.label }}</option>
      </select>
      <select v-model="filters.channel" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
        <option value="">Усі канали</option>
        <option v-for="channel in channels" :key="channel.value" :value="channel.value">{{ channel.label }}</option>
      </select>
      <input v-model="filters.date_from" type="date" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
      <input v-model="filters.date_to" type="date" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
      <select v-model="filters.barber_id" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
        <option :value="null">Усі майстри</option>
        <option v-for="master in masterItems" :key="master.id" :value="Number(master.id)">{{ masterName(master) }}</option>
      </select>
      <div class="flex gap-3 md:col-span-3 xl:col-span-6">
        <button class="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white" @click="applyFilters">Застосувати</button>
        <button class="rounded-full border border-slate-300 px-5 py-3 text-sm" @click="clearFilters">Очистити</button>
      </div>
    </section>

    <div v-if="error" class="rounded-[1.25rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">Не вдалося завантажити кампанії.</div>
    <div class="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
      <div v-if="pending" class="p-6 text-sm text-slate-500">Завантажуємо кампанії...</div>
      <table v-else-if="data?.items.length" class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Назва</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Тип</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Канал</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Статус</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Аудиторія</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Sent / failed</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Заплановано</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Автор</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Дії</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="campaign in data.items" :key="campaign.id">
            <td data-label="Назва" class="px-4 py-3 font-medium text-slate-900">{{ campaign.name }}</td>
            <td data-label="Тип" class="px-4 py-3"><CampaignTypeBadge :type="campaign.type" /></td>
            <td data-label="Канал" class="px-4 py-3 text-slate-700">{{ channelLabel(campaign.channel) }}</td>
            <td data-label="Статус" class="px-4 py-3"><CampaignStatusBadge :status="campaign.status" /></td>
            <td data-label="Аудиторія" class="px-4 py-3 text-slate-700">{{ campaign.audience_size }}</td>
            <td data-label="Sent / failed" class="px-4 py-3 text-slate-700">{{ campaign.sent_count }} / {{ campaign.failed_count }}</td>
            <td data-label="Заплановано" class="px-4 py-3 text-slate-700">{{ campaign.scheduled_at ? new Date(campaign.scheduled_at).toLocaleString('uk-UA') : '—' }}</td>
            <td data-label="Автор" class="px-4 py-3 text-slate-700">{{ campaign.created_by }}</td>
            <td data-label="Дії" class="px-4 py-3">
              <div class="flex flex-wrap gap-2">
                <NuxtLink :to="`/messaging/campaigns/${campaign.id}`" class="rounded-full border border-slate-300 p-2" title="Деталі"><EyeIcon class="h-4 w-4" /></NuxtLink>
                <NuxtLink v-if="canCreateMessagingDrafts" :to="`/messaging/campaigns/${campaign.id}/edit`" class="rounded-full border border-slate-300 p-2" title="Редагувати"><PencilIcon class="h-4 w-4" /></NuxtLink>
                <button v-if="canCreateMessagingDrafts" class="rounded-full border border-slate-300 p-2" title="Дублювати" @click="duplicate(campaign)"><DocumentDuplicateIcon class="h-4 w-4" /></button>
                <button v-if="canSendMessagingCampaigns" class="rounded-full border border-slate-300 p-2" :title="campaign.status === 'paused' ? 'Активувати' : 'Пауза'" @click="confirmAction = { campaign, action: campaign.status === 'paused' ? 'active' : 'paused' }">
                  <PlayIcon v-if="campaign.status === 'paused'" class="h-4 w-4" /><PauseIcon v-else class="h-4 w-4" />
                </button>
                <button v-if="canSendMessagingCampaigns" class="rounded-full border border-slate-300 p-2" title="Архів" @click="confirmAction = { campaign, action: 'archived' }"><ArchiveBoxIcon class="h-4 w-4" /></button>
                <button v-if="canSendMessagingCampaigns" class="rounded-full border border-rose-200 p-2 text-rose-700" title="Видалити" @click="confirmAction = { campaign, action: 'delete' }"><TrashIcon class="h-4 w-4" /></button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="p-8 text-center text-sm text-slate-500">Кампаній за цими фільтрами немає.</p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <button :disabled="page === 1" class="rounded-full border border-slate-300 px-4 py-2 text-sm disabled:opacity-50" @click="page = Math.max(1, page - 1)">Попередня</button>
      <span class="text-sm text-slate-500">Сторінка {{ page }}</span>
      <button :disabled="!data || page * pageSize >= data.total" class="rounded-full border border-slate-300 px-4 py-2 text-sm disabled:opacity-50" @click="page += 1">Наступна</button>
    </div>

    <ConfirmActionModal
      :model-value="Boolean(confirmAction)"
      :title="confirmAction?.action === 'delete' ? 'Видалити кампанію?' : 'Підтвердити дію'"
      :message="confirmAction?.action === 'delete' ? 'Кампанію буде видалено. Цю дію не можна скасувати.' : 'Статус кампанії буде змінено.'"
      :confirm-label="confirmAction?.action === 'delete' ? 'Видалити' : 'Підтвердити'"
      :pending="actionPending"
      :destructive="confirmAction?.action === 'delete'"
      @update:model-value="closeConfirm"
      @confirm="runAction"
    />
  </div>
</template>
