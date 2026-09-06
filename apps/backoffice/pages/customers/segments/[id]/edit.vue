<script setup lang="ts">
import SegmentEditor from '~/components/segments/SegmentEditor.vue'
import { segmentApiError } from '~/utils/segmentRules.mjs'
const route = useRoute()
const api = useBackofficeApi()
const id = Number(route.params.id)
const { data, error, pending, refresh } = await useAsyncData(`segment-edit-${id}`, () => api.getSegment(id))
</script>
<template>
  <div class="space-y-6">
    <NuxtLink :to="`/customers/segments/${id}`" class="text-sm text-cyan-700 underline">← До сегмента</NuxtLink>
    <h1 class="text-3xl font-semibold text-ui-primary">Редагування сегмента</h1>
    <p v-if="pending" role="status">Завантаження…</p>
    <div v-else-if="error" role="alert" class="space-y-3 text-rose-600"><p>{{ segmentApiError(error) }}</p><BaseButton variant="neutral" @click="refresh()">Повторити</BaseButton></div>
    <BaseCard v-else-if="data?.status === 'archived'"><p>Архівний сегмент збережено для історії. Для нової аудиторії створіть копію.</p><NuxtLink :to="`/customers/segments/new?duplicate=${id}`" class="mt-3 inline-block text-cyan-700 underline">Дублювати сегмент</NuxtLink></BaseCard>
    <SegmentEditor v-else-if="data" :key="data.revision" :segment="data" />
  </div>
</template>
