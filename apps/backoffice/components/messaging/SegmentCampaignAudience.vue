<script setup lang="ts">
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
let request = 0
const load = async (more = false) => {
  loading.value = true
  error.value = ''
  try {
    const result = await api.getSegments({ status: 'active', limit: 50, offset: more ? segments.value.length : 0 })
    segments.value = more ? [...segments.value, ...result.items] : result.items
    total.value = result.total
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
const toggle = (id: number, checked: boolean) => emit('update:modelValue', checked ? [...new Set([...props.modelValue, id])] : props.modelValue.filter(value => value !== id))
watch(() => [...props.modelValue], loadSelected, { immediate: true })
onMounted(() => load())
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-ui-muted">Обʼєднання вибраних сегментів: кожен клієнт потрапляє в аудиторію один раз. Доступність каналів перевіряється після збереження чернетки.</p>
    <p v-if="error" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">{{ error }} <BaseButton @click="load(); loadSelected()">Повторити</BaseButton></p>
    <BaseLoader v-if="loading && !segments.length" label="Завантаження сегментів…" />
    <fieldset class="space-y-2" :disabled="disabled">
      <legend class="mb-2 font-medium text-ui-primary">Збережені сегменти</legend>
      <label v-for="segment in segments" :key="segment.id" class="base-card flex cursor-pointer items-start gap-3 rounded-xl p-3">
        <BaseCheckbox :model-value="modelValue.includes(segment.id)" :disabled="disabled || (!modelValue.includes(segment.id) && modelValue.length >= 20)" @update:model-value="toggle(segment.id, Boolean($event))" />
        <span class="min-w-0 text-sm"><span class="block font-medium text-ui-primary">{{ segment.name }}</span><span class="mt-1 block text-ui-muted">{{ summarizeRules(segment.rules) }}</span></span>
      </label>
    </fieldset>
    <p v-if="!loading && !error && !segments.length" class="text-sm text-ui-muted">Активних сегментів немає. <NuxtLink to="/customers/segments/new" class="text-ui-accent underline">Створити сегмент</NuxtLink></p>
    <BaseButton v-if="segments.length < total" :disabled="loading" @click="load(true)">Завантажити ще</BaseButton>
    <div v-for="segment in selected" :key="`selected-${segment.id}`" class="base-card rounded-xl p-3 text-sm">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <NuxtLink :to="`/customers/segments/${segment.id}`" class="font-medium text-ui-accent underline">{{ segment.name }} · версія {{ segment.revision }}</NuxtLink>
        <BaseButton v-if="!disabled" size="sm" :aria-label="`Прибрати сегмент ${segment.name}`" @click="toggle(segment.id, false)">Прибрати</BaseButton>
      </div>
      <p class="mt-2 text-ui-muted">{{ summarizeRules(segment.rules) }}</p>
      <p v-if="segment.status === 'archived'" role="alert" class="mt-2 text-amber-700">Архівний сегмент. Історія збережена; для нового запуску приберіть або замініть сегмент.</p>
    </div>
  </div>
</template>
