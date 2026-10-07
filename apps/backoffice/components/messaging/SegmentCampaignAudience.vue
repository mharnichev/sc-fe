<script setup lang="ts">
import { XMarkIcon } from '@heroicons/vue/24/outline'
import type { BaseMultiSelectOption, BaseMultiSelectValue } from '../BaseMultiSelect.vue'
import type { CustomerSegment } from '~/types/segments'
import { summarizeRules } from '~/utils/segmentRules.mjs'

const props = withDefaults(defineProps<{ modelValue: number[]; disabled?: boolean }>(), { disabled: false })
const emit = defineEmits<{ 'update:modelValue': [value: number[]]; valid: [value: boolean] }>()
const api = useBackofficeApi()
const { apiErrorMessage } = useBookingFormatting()
const segments = ref<CustomerSegment[]>([])
const selected = ref<CustomerSegment[]>([])
const loading = ref(false)
const error = ref('')
const total = ref(0)
const options = computed<BaseMultiSelectOption[]>(() => segments.value
  .filter(segment => segment.status === 'active')
  .map(segment => ({
    value: segment.id,
    label: segment.name,
    description: summarizeRules(segment.rules),
    disabled: props.disabled || (!props.modelValue.includes(segment.id) && props.modelValue.length >= 20),
  })))
const selectedSummaries = computed(() => props.modelValue.map(id => {
  const segment = selected.value.find(item => item.id === id) || segments.value.find(item => item.id === id)
  return { id, segment, name: segment?.name || `Сегмент #${id}` }
}))
let request = 0
const load = async () => {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    const items: CustomerSegment[] = []
    do {
      const result = await api.getSegments({ status: 'active', limit: 100, offset: items.length })
      items.push(...result.items)
      segments.value = [...items]
      total.value = result.total
      if (!result.items.length) break
    } while (items.length < total.value)
  }
  catch (cause) { error.value = apiErrorMessage(cause, 'Не вдалося завантажити сегменти.') }
  finally { loading.value = false }
}
const loadSelected = async () => {
  const current = ++request
  emit('valid', false)
  try {
    const result = await Promise.all(props.modelValue.map(id => {
      const cached = segments.value.find(segment => segment.id === id) || selected.value.find(segment => segment.id === id)
      return cached || api.getSegment(id)
    }))
    if (current !== request) return
    selected.value = result
    emit('valid', result.length > 0 && result.length <= 20 && result.every(segment => segment.status === 'active'))
  }
  catch (cause) {
    if (current !== request) return
    error.value = apiErrorMessage(cause, 'Не вдалося перевірити вибрані сегменти.')
    selected.value = []
  }
}
const setValue = (value: BaseMultiSelectValue[]) => {
  if (props.disabled) return
  const ids = [...new Set(value.map(Number))]
  const added = ids.filter(id => !props.modelValue.includes(id))
  if (ids.some(id => !Number.isSafeInteger(id) || id <= 0)) return
  if (added.some(id => !segments.value.some(segment => segment.id === id && segment.status === 'active'))) return
  if (ids.length > 20 && added.length) return
  emit('update:modelValue', ids)
}
const remove = (id: number) => setValue(props.modelValue.filter(value => value !== id))
watch(() => [...props.modelValue], loadSelected, { immediate: true })
onMounted(() => load())
</script>

<template>
  <div class="space-y-4" data-testid="campaign-segment-audience">
    <BaseMultiSelect
      :model-value="modelValue"
      :options="options"
      label="Збережені сегменти"
      :placeholder="modelValue.length ? modelValue.length + '/20 вибрано' : 'Виберіть сегменти'"
      search-placeholder="Пошук сегмента"
      empty-label="Сегментів не знайдено."
      :disabled="disabled"
      :max-selected="20"
      :show-limit="true"
      :show-selected-chips="false"
      @update:model-value="setValue"
    >
      <template #label>
        <MessagingCampaignFieldHelp
          label="Збережені сегменти"
          help="Обʼєднання до 20 вибраних сегментів: кожен клієнт потрапляє в аудиторію один раз. Доступність каналів перевіряється після збереження чернетки."
        />
      </template>
      <template #summary>{{ modelValue.length }}/20 вибрано</template>
    </BaseMultiSelect>
    <p v-if="error" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">{{ error }} <BaseButton @click="load(); loadSelected()">Повторити</BaseButton></p>
    <BaseLoader v-if="loading && !segments.length" label="Завантаження сегментів…" />
    <p v-if="!loading && !error && !segments.length" class="text-sm text-ui-muted">Активних сегментів немає. <NuxtLink to="/customers/segments/new" class="text-ui-accent underline">Створити сегмент</NuxtLink></p>
    <p v-if="loading && segments.length" role="status" class="text-sm text-ui-muted">Завантажено {{ segments.length }} із {{ total }} сегментів…</p>
    <div class="grid gap-x-4 gap-y-3 sm:grid-cols-2">
      <div v-for="item in selectedSummaries" :key="`selected-${item.id}`" class="min-w-0 text-sm">
        <div class="flex items-start justify-between gap-2">
          <NuxtLink :to="`/customers/segments/${item.id}`" class="min-w-0 break-words font-medium text-ui-accent underline">
            {{ item.name }}<template v-if="item.segment"> · версія {{ item.segment.revision }}</template>
          </NuxtLink>
          <BaseButton
            type="button"
            :disabled="disabled"
            class="campaign-segment-remove inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ui-muted disabled:opacity-50"
            :title="`Прибрати сегмент ${item.name}`"
            :aria-label="`Прибрати сегмент ${item.name}`"
            @click="remove(item.id)"
          >
            <XMarkIcon class="h-4 w-4" aria-hidden="true" />
          </BaseButton>
        </div>
        <p v-if="item.segment" class="mt-1 break-words text-xs text-ui-muted">{{ summarizeRules(item.segment.rules) }}</p>
        <p v-if="item.segment?.status === 'archived'" role="alert" class="mt-1 text-xs text-amber-700">Архівний сегмент. Історія збережена; для нового запуску приберіть або замініть сегмент.</p>
        <p v-else-if="!item.segment" class="mt-1 text-xs text-ui-muted">Сегмент ще не перевірено.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.campaign-segment-remove { width: 32px !important; min-width: 32px; min-height: 32px !important; padding: 0 !important; }
</style>
