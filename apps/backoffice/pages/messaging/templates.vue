<script setup lang="ts">
import { CheckCircleIcon, DocumentDuplicateIcon, FunnelIcon, PencilIcon, TrashIcon } from '@heroicons/vue/24/outline'
import type { MessageTemplate, MessageTemplatePayload } from '~/types/messaging'

const api = useBackofficeApi()
const { campaignTypes, channels, campaignTypeLabel } = useMessagingUi()
const { canCreateMessagingDrafts, canSendMessagingCampaigns } = useBackofficeAccess()

const page = ref(1)
const pageSize = 20
const filters = reactive({ search: '', campaign_type: '', channel: '', language: '', is_active: null as boolean | null })
const editorOpen = ref(false)
const editingId = ref<number | string | null>(null)
const saving = ref(false)
const deleting = ref<MessageTemplate | null>(null)

const emptyTemplate = (): MessageTemplatePayload => ({
  name: '',
  campaign_type: 'manual',
  channel: 'telegram',
  language: 'uk',
  message_body: '',
  variables: [],
  is_active: true,
  is_default: false,
})

const templateForm = ref<MessageTemplatePayload>(emptyTemplate())

const { data, pending, error, refresh } = await useAsyncData('messaging-templates', () => api.getMessageTemplates(page.value, pageSize, filters), { watch: [page] })

const applyFilters = async () => {
  page.value = 1
  await refresh()
}

const openCreate = () => {
  editingId.value = null
  templateForm.value = emptyTemplate()
  editorOpen.value = true
}

const openEdit = (template: MessageTemplate) => {
  editingId.value = template.id
  templateForm.value = {
    name: template.name,
    campaign_type: template.campaign_type,
    channel: template.channel,
    language: template.language,
    message_body: template.message_body,
    variables: template.variables || [],
    is_active: template.is_active,
    is_default: template.is_default,
  }
  editorOpen.value = true
}

const saveTemplate = async () => {
  saving.value = true
  try {
    if (editingId.value) await api.updateMessageTemplate(editingId.value, templateForm.value)
    else await api.createMessageTemplate(templateForm.value)
    editorOpen.value = false
    await refresh()
  }
  finally {
    saving.value = false
  }
}

const duplicate = async (template: MessageTemplate) => {
  await api.duplicateMessageTemplate(template.id)
  await refresh()
}

const deleteTemplate = async () => {
  if (!deleting.value) return
  await api.deleteMessageTemplate(deleting.value.id)
  deleting.value = null
  await refresh()
}

const closeDeleteConfirm = (value: boolean) => {
  if (!value) deleting.value = null
}
</script>

<template>
  <div class="messaging-page space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Messaging</p>
        <h1 class="mt-2 text-3xl font-semibold text-slate-900">Шаблони повідомлень</h1>
      </div>
      <BaseButton v-if="canCreateMessagingDrafts" class="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white" @click="openCreate">Новий шаблон</BaseButton>
    </div>

    <section class="grid gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-5">
      <BaseInput v-model="filters.search" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm" placeholder="Пошук шаблону" />
      <BaseSelect native v-model="filters.campaign_type" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
        <option value="">Усі типи</option>
        <option v-for="type in campaignTypes" :key="type.value" :value="type.value">{{ type.label }}</option>
      </BaseSelect>
      <BaseSelect native v-model="filters.channel" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
        <option value="">Усі канали</option>
        <option v-for="channel in channels" :key="channel.value" :value="channel.value">{{ channel.label }}</option>
      </BaseSelect>
      <BaseSelect native v-model="filters.language" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
        <option value="">Усі мови</option>
        <option value="uk">Українська</option>
        <option value="en">English</option>
      </BaseSelect>
      <BaseButton class="backoffice-modal-action-button backoffice-modal-action-primary" @click="applyFilters">
        <FunnelIcon class="h-4 w-4" aria-hidden="true" />
        <span>Застосувати</span>
      </BaseButton>
    </section>

    <div v-if="error" class="rounded-[1.25rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">Не вдалося завантажити шаблони.</div>
    <div class="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
      <div v-if="pending" class="p-6 text-sm text-slate-500">Завантажуємо шаблони...</div>
      <table v-else-if="data?.items.length" class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Назва</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Тип</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Канал</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Мова</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Статус</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Дії</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="template in data.items" :key="template.id">
            <td data-label="Назва" class="px-4 py-3">
              <p class="font-medium text-slate-900">{{ template.name }}</p>
              <p v-if="template.is_default" class="mt-1 text-xs text-cyan-700">За замовчуванням</p>
            </td>
            <td data-label="Тип" class="px-4 py-3 text-slate-700">{{ campaignTypeLabel(template.campaign_type) }}</td>
            <td data-label="Канал" class="px-4 py-3"><MessagingChannelBadge :channel="template.channel" /></td>
            <td data-label="Мова" class="px-4 py-3 text-slate-700">{{ template.language }}</td>
            <td data-label="Статус" class="px-4 py-3">
              <span class="rounded-full px-3 py-1 text-xs font-medium" :class="template.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">{{ template.is_active ? 'активний' : 'неактивний' }}</span>
            </td>
            <td data-label="Дії" class="px-4 py-3">
              <div class="flex gap-2">
                <BaseButton v-if="canCreateMessagingDrafts" class="rounded-full border border-slate-300 p-2" @click="openEdit(template)"><PencilIcon class="h-4 w-4" /></BaseButton>
                <BaseButton v-if="canCreateMessagingDrafts" class="rounded-full border border-slate-300 p-2" @click="duplicate(template)"><DocumentDuplicateIcon class="h-4 w-4" /></BaseButton>
                <BaseButton v-if="canSendMessagingCampaigns" class="rounded-full border border-rose-200 p-2 text-rose-700" @click="deleting = template"><TrashIcon class="h-4 w-4" /></BaseButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="p-8 text-center text-sm text-slate-500">Шаблонів ще немає.</p>
    </div>

    <BaseModal v-model="editorOpen" max-width-class="max-w-6xl">
      <template #head="{ close }">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-sm uppercase tracking-[0.25em] text-cyan-700">Шаблон</p>
            <h2 class="mt-2 text-2xl font-semibold text-slate-900">{{ editingId ? 'Редагувати шаблон' : 'Новий шаблон' }}</h2>
          </div>
          <ModalCloseButton @click="close" />
        </div>
      </template>
      <template #body>
        <MessageTemplateEditor v-model="templateForm" />
        <div class="backoffice-modal-actions mt-6 border-t border-slate-200 pt-5">
          <BaseButton class="backoffice-modal-action-button backoffice-modal-action-primary" :disabled="saving || !templateForm.name || !templateForm.message_body" @click="saveTemplate">
            <CheckCircleIcon v-if="!saving" class="h-4 w-4" aria-hidden="true" />
            {{ saving ? 'Збереження...' : 'Зберегти' }}
          </BaseButton>
        </div>
      </template>
    </BaseModal>

    <ConfirmActionModal
      :model-value="Boolean(deleting)"
      title="Видалити шаблон?"
      message="Шаблон буде видалено. Існуючі кампанії не зміняться, але нові кампанії більше не зможуть його обрати."
      confirm-label="Видалити"
      destructive
      @update:model-value="closeDeleteConfirm"
      @confirm="deleteTemplate"
    />
  </div>
</template>
