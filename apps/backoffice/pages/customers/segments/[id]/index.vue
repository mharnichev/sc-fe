<script setup lang="ts">
import type { MessagingCampaign } from '~/types/messaging'
import SegmentMembers from '~/components/segments/SegmentMembers.vue'
import { formatSegmentTime, segmentApiError, summarizeRules } from '~/utils/segmentRules.mjs'
const route = useRoute()
const api = useBackofficeApi()
const id = Number(route.params.id)
const { data: segment, error, pending, refresh } = await useAsyncData(`segment-${id}`, () => api.getSegment(id))
const campaigns = ref<MessagingCampaign[]>([])
const campaignsPending = ref(false)
const campaignsError = ref('')
const archiveOpen = ref(false)
const archiving = ref(false)
const archiveError = ref('')
async function loadCampaigns() {
  campaignsPending.value = true
  campaignsError.value = ''
  try {
    const matched: MessagingCampaign[] = []
    let page = 1
    while (true) {
      const response = await api.getMessagingCampaigns(page, 100, { view: 'campaigns' })
      matched.push(...response.items.filter(item => item.segment_ids?.some(segmentId => Number(segmentId) === id)))
      if (page * 100 >= response.total || !response.items.length) break
      page += 1
    }
    campaigns.value = matched
  } catch (reason) { campaignsError.value = segmentApiError(reason) }
  finally { campaignsPending.value = false }
}
onMounted(loadCampaigns)
async function archive() {
  archiving.value = true
  archiveError.value = ''
  try {
    segment.value = await api.archiveSegment(id)
    archiveOpen.value = false
  } catch (reason) { archiveError.value = segmentApiError(reason) }
  finally { archiving.value = false }
}
</script>
<template>
  <div class="space-y-6">
    <NuxtLink to="/customers/segments" class="text-sm text-cyan-700 underline">← Сегменти</NuxtLink>
    <p v-if="pending" role="status">Завантаження…</p>
    <div v-else-if="error" role="alert" class="space-y-3 text-rose-600"><p>{{ segmentApiError(error) }}</p><BaseButton variant="neutral" @click="refresh()">Повторити</BaseButton></div>
    <template v-else-if="segment">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div><h1 class="text-3xl font-semibold text-ui-primary">{{ segment.name }}</h1><p v-if="segment.description" class="mt-2 text-ui-secondary">{{ segment.description }}</p></div>
        <BaseBadge :tone="segment.status === 'active' ? 'success' : 'neutral'">{{ segment.status === 'active' ? 'Активний' : 'Архівний' }}</BaseBadge>
      </div>
      <p class="text-sm text-ui-muted">Версія {{ segment.revision }} · Оновлено {{ formatSegmentTime(segment.updated_at) }} · Київ</p>
      <BaseCard v-if="segment.status === 'archived'" variant="subtle"><p class="text-sm text-ui-secondary">Архівовано {{ formatSegmentTime(segment.archived_at) }}. Історичні кампанії збережено. Для нової кампанії створіть копію сегмента.</p></BaseCard>
      <div class="flex flex-wrap gap-3">
        <NuxtLink v-if="segment.status === 'active'" :to="`/messaging/campaigns/new?segment_id=${id}`" class="base-button base-button--primary px-4 py-2">Створити кампанію</NuxtLink>
        <NuxtLink v-if="segment.status === 'active'" :to="`/customers/segments/${id}/edit`" class="base-button base-button--neutral px-4 py-2">Редагувати</NuxtLink>
        <NuxtLink :to="`/customers/segments/new?duplicate=${id}`" class="base-button base-button--neutral px-4 py-2">Дублювати</NuxtLink>
        <BaseButton v-if="segment.status === 'active'" variant="danger-outline" @click="archiveOpen = true">Архівувати</BaseButton>
      </div>
      <p v-if="segment.status === 'active'" class="text-sm text-ui-muted">«Створити кампанію» відкриває підготовку чернетки з цим сегментом. Запуск потребує окремого підтвердження в кампанії.</p>
      <BaseCard><h2 class="mb-3 text-xl font-semibold text-ui-primary">Критерії</h2><p class="text-sm text-ui-secondary">{{ summarizeRules(segment.rules) }}</p></BaseCard>
      <BaseCard><SegmentMembers :key="segment.revision" :segment-id="id" :rules="segment.rules" auto /></BaseCard>
      <BaseCard id="campaigns" class="space-y-3">
        <h2 class="text-xl font-semibold text-ui-primary">Пов’язані кампанії</h2>
        <p v-if="campaignsPending" role="status" class="text-sm text-ui-muted">Шукаємо кампанії…</p>
        <div v-else-if="campaignsError" role="alert" class="space-y-2 text-sm text-rose-600"><p>{{ campaignsError }}</p><BaseButton variant="neutral" @click="loadCampaigns">Повторити</BaseButton></div>
        <p v-else-if="!campaigns.length" class="text-sm text-ui-muted">Немає кампаній із поточним посиланням на цей сегмент. Історичні знімки доступні в результатах відповідних кампаній.</p>
        <ul v-else class="space-y-2"><li v-for="campaign in campaigns" :key="campaign.id"><NuxtLink :to="`/messaging/campaigns/${campaign.id}`" class="text-cyan-700 underline">{{ campaign.name }}{{ campaign.status === 'archived' ? ' (архів)' : '' }}</NuxtLink></li></ul>
      </BaseCard>
      <BaseModal v-model="archiveOpen" aria-label="Архівування сегмента" :close-on-backdrop="!archiving" :close-on-escape="!archiving">
        <template #body><div class="space-y-4"><h2 class="text-xl font-semibold text-ui-primary">Архівувати «{{ segment.name }}»?</h2><p class="text-sm text-ui-secondary">Історичні результати кампаній залишаться доступними. Запланована кампанія, яка ще не зафіксувала аудиторію, не зможе використати цей сегмент. Перевірте пов’язані кампанії перед архівуванням.</p><p v-if="archiveError" role="alert" class="text-sm text-rose-600">{{ archiveError }}</p><div class="flex flex-wrap gap-3"><BaseButton variant="danger" :loading="archiving" @click="archive">Архівувати сегмент</BaseButton><BaseButton variant="neutral" :disabled="archiving" @click="archiveOpen = false">Скасувати</BaseButton></div></div></template>
      </BaseModal>
    </template>
  </div>
</template>
