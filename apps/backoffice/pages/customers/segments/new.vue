<script setup lang="ts">
import SegmentEditor from '~/components/segments/SegmentEditor.vue'
import { segmentApiError } from '~/utils/segmentRules.mjs'
const route = useRoute()
const api = useBackofficeApi()
const duplicateId = Number(route.query.duplicate)
const { data, error, pending, refresh } = await useAsyncData(`segment-duplicate-${duplicateId}`, () => duplicateId > 0 ? api.getSegment(duplicateId) : Promise.resolve(null))
</script>
<template>
  <div class="space-y-6">
    <NuxtLink to="/customers/segments" class="text-sm text-cyan-700 underline">← Сегменти</NuxtLink>
    <h1 class="text-3xl font-semibold text-ui-primary">{{ duplicateId > 0 ? 'Дублювати сегмент' : 'Новий сегмент' }}</h1>
    <p v-if="pending" role="status">Завантаження…</p>
    <div v-else-if="error" role="alert" class="space-y-3 text-rose-600"><p>{{ segmentApiError(error) }}</p><BaseButton variant="neutral" @click="refresh()">Повторити</BaseButton></div>
    <SegmentEditor v-else :segment="data || undefined" :duplicate="duplicateId > 0" />
  </div>
</template>
