<script setup lang="ts">
import type { SegmentPreviewResponse } from '~/types/segments'
import { formatSegmentTime, segmentApiError, summarizeRules } from '~/utils/segmentRules.mjs'
const api = useBackofficeApi()
const status = ref<'active' | 'archived' | ''>('active')
const page = ref(1)
const limit = 20
const { data, pending, error, refresh } = await useAsyncData('customer-segments', () => api.getSegments({ status: status.value || undefined, limit, offset: (page.value - 1) * limit }), { watch: [page,status] })
watch(status, () => { page.value = 1 })
const counts = reactive<Record<number, Pick<SegmentPreviewResponse, 'total' | 'evaluated_at'> & { revision: number }>>({})
const counting = reactive<Record<number, boolean>>({})
const countErrors = reactive<Record<number, string>>({})
async function evaluate(id: number, revision: number) {
  if (counting[id]) return
  counting[id] = true
  countErrors[id] = ''
  try {
    const response = await api.getSegmentMembers(id, { limit: 1, offset: 0 })
    counts[id] = { total: response.total, evaluated_at: response.evaluated_at, revision }
  } catch (reason) { countErrors[id] = segmentApiError(reason) }
  finally { counting[id] = false }
}
</script>
<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div><p class="ui-eyebrow text-sm uppercase tracking-[0.3em]">Клієнти</p><h1 class="mt-2 text-3xl font-semibold text-ui-primary">Сегменти</h1></div>
      <NuxtLink to="/customers/segments/new" class="base-button base-button--primary px-4 py-2">Створити сегмент</NuxtLink>
    </div>
    <p class="text-sm text-ui-secondary">Збережені критерії визначають аудиторію. Повідомлення, канали та запуск налаштовуються в кампанії.</p>
    <BaseSelect v-model="status" label="Статус сегмента" :options="[{value:'active',label:'Активні'},{value:'archived',label:'Архівні'},{value:'',label:'Усі статуси'}]" class="max-w-sm" />
    <p v-if="pending" role="status" class="text-sm text-ui-muted">Завантаження сегментів…</p>
    <div v-if="error" role="alert" class="space-y-3 text-sm text-rose-600"><p>{{ segmentApiError(error) }}</p><BaseButton variant="neutral" @click="refresh()">Повторити</BaseButton></div>
    <template v-else-if="data">
      <p class="text-sm text-ui-muted">Усього сегментів: {{ data.total }}. Оцінка кількості виконується на запит.</p>
      <BaseTable caption="Сегменти клієнтів" min-width="60rem" :empty="!pending && !data.items.length" empty-title="Сегментів поки немає">
        <template #head><tr><th>Сегмент і критерії</th><th>Клієнти</th><th>Статус</th><th>Дії</th></tr></template>
        <tr v-for="segment in data.items" :key="segment.id">
          <td data-label="Сегмент і критерії" class="max-w-xl">
            <NuxtLink :to="`/customers/segments/${segment.id}`" class="font-semibold text-cyan-700 underline">{{ segment.name }}</NuxtLink>
            <p v-if="segment.description" class="mt-1 text-sm text-ui-secondary">{{ segment.description }}</p>
            <p class="mt-2 text-sm text-ui-muted">{{ summarizeRules(segment.rules) }}</p>
          </td>
          <td data-label="Клієнти" class="min-w-48">
            <template v-if="counts[segment.id]?.revision === segment.revision"><p class="font-medium text-ui-primary">{{ counts[segment.id]!.total }} клієнтів</p><p class="mt-1 text-xs text-ui-muted">{{ formatSegmentTime(counts[segment.id]!.evaluated_at) }} · Київ</p></template>
            <p v-else class="text-sm text-ui-muted">Ще не оцінено</p>
            <BaseButton variant="neutral" size="sm" class="mt-2" :loading="counting[segment.id]" :aria-label="`Оцінити кількість клієнтів: ${segment.name}`" @click="evaluate(segment.id,segment.revision)">Оцінити</BaseButton>
            <p v-if="countErrors[segment.id]" role="alert" class="mt-2 text-sm text-rose-600">{{ countErrors[segment.id] }}</p>
          </td>
          <td data-label="Статус"><BaseBadge :tone="segment.status === 'active' ? 'success' : 'neutral'">{{ segment.status === 'active' ? 'Активний' : 'Архівний' }}</BaseBadge></td>
          <td data-label="Дії"><div class="flex flex-col items-start gap-2 text-sm">
            <NuxtLink :to="`/customers/segments/${segment.id}`" class="text-cyan-700 underline">Переглянути</NuxtLink>
            <NuxtLink v-if="segment.status === 'active'" :to="`/customers/segments/${segment.id}/edit`" class="text-cyan-700 underline">Редагувати</NuxtLink>
            <NuxtLink :to="`/customers/segments/new?duplicate=${segment.id}`" class="text-cyan-700 underline">Дублювати</NuxtLink>
            <NuxtLink :to="`/customers/segments/${segment.id}#campaigns`" class="text-cyan-700 underline">Пов’язані кампанії</NuxtLink>
            <NuxtLink v-if="segment.status === 'active'" :to="`/messaging/campaigns/new?segment_id=${segment.id}`" class="text-cyan-700 underline">Створити кампанію</NuxtLink>
          </div></td>
        </tr>
      </BaseTable>
      <div class="flex flex-wrap items-center gap-3">
        <BaseButton variant="neutral" :disabled="pending || page === 1" @click="page--">Попередня</BaseButton><span class="text-sm text-ui-muted">Сторінка {{ page }}</span><BaseButton variant="neutral" :disabled="pending || page * limit >= data.total" @click="page++">Наступна</BaseButton>
      </div>
    </template>
  </div>
</template>
