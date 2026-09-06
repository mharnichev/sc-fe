<script setup lang="ts">
import type { SegmentRules, SegmentPreviewResponse, SegmentExplanation } from '~/types/segments'
import { createPreviewGate, describeMember, formatSegmentTime, segmentApiError, summarizeCondition, validateRules } from '~/utils/segmentRules.mjs'
const props = defineProps<{ rules: SegmentRules; segmentId?: number; auto?: boolean }>()
const api = useBackofficeApi()
const result = ref<SegmentPreviewResponse | null>(null)
const pending = ref(false)
const error = ref('')
const stale = ref(false)
const gate = createPreviewGate()
const limit = 20
const invalid = computed(() => validateRules(props.rules).length > 0)
watch(() => props.rules, () => {
  gate.invalidate()
  stale.value = Boolean(result.value)
  pending.value = false
  error.value = ''
}, { deep: true, flush: 'sync' })
onBeforeUnmount(() => gate.invalidate())
async function preview(offset = 0, fresh = false) {
  if (invalid.value) return
  const token = gate.begin()
  pending.value = true
  error.value = ''
  const evaluated_at = !fresh && !stale.value ? result.value?.evaluated_at : undefined
  const rules = JSON.parse(JSON.stringify(props.rules)) as SegmentRules
  try {
    const response = props.segmentId
      ? await api.getSegmentMembers(props.segmentId, { limit, offset, evaluated_at })
      : await api.previewSegment({ rules, limit, offset, evaluated_at })
    if (!gate.isCurrent(token)) return
    result.value = response
    stale.value = false
  } catch (reason) {
    if (gate.isCurrent(token)) { error.value = segmentApiError(reason); stale.value = Boolean(result.value) }
  } finally {
    if (gate.isCurrent(token)) pending.value = false
  }
}
const factValue = (explanation: SegmentExplanation) => {
  const value = explanation.value
  if (value == null) return 'Немає відомого факту'
  if (typeof value === 'boolean') return value ? 'Так' : 'Ні'
  if (typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value)) return formatSegmentTime(value)
  return String(value)
}
onMounted(() => { if (props.auto) void preview(0, true) })
</script>
<template>
  <section class="space-y-4" aria-label="Перегляд аудиторії" :aria-busy="pending">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-xl font-semibold text-ui-primary">Аудиторія</h2>
      <BaseButton variant="secondary" :loading="pending" :disabled="invalid" @click="preview(0,true)">{{ result ? 'Оновити оцінку' : 'Оцінити аудиторію' }}</BaseButton>
    </div>
    <p class="text-sm text-ui-muted">Це динамічна аудиторія. Право на контакт і доступність каналів перевіряються окремо в кампанії.</p>
    <p v-if="invalid" class="text-sm text-ui-muted">Заповніть коректні умови, щоб оцінити аудиторію.</p>
    <p v-if="pending" role="status" class="text-sm text-ui-secondary">Оцінюємо аудиторію…</p>
    <p v-if="error" role="alert" class="text-sm text-rose-600">{{ error }}</p>
    <BaseCard v-if="stale" variant="subtle" padding="sm"><p role="status" class="text-sm text-ui-secondary">Попередня оцінка застаріла. Оновіть її для поточних умов.</p></BaseCard>
    <template v-if="result && !stale">
      <BaseCard variant="subtle" padding="sm">
        <p role="status" class="font-semibold text-ui-primary">Клієнтів в аудиторії: {{ result.total }}</p>
        <p class="mt-1 text-sm text-ui-muted">Оцінено {{ formatSegmentTime(result.evaluated_at) }} · Київ. Межі часу однакові для всіх сторінок; редагування фактів клієнтів може змінити склад.</p>
      </BaseCard>
      <BaseTable caption="Клієнти сегмента" min-width="40rem" :empty="!result.items.length" empty-title="За цими умовами клієнтів немає">
        <template #head><tr><th>Клієнт</th><th>Чому відповідає умовам</th></tr></template>
        <tr v-for="member in result.items" :key="member.customer_id">
          <td data-label="Клієнт">
            <NuxtLink :to="`/customers/${member.customer_id}`" class="font-medium text-cyan-700 underline">{{ member.name || `Клієнт #${member.customer_id}` }}</NuxtLink>
            <p class="mt-1 text-sm text-ui-muted">{{ member.phone }}</p>
          </td>
          <td data-label="Чому відповідає умовам" class="max-w-2xl text-sm text-ui-secondary">
            <p>{{ describeMember(member) }}</p>
            <details class="mt-2">
              <summary class="cursor-pointer font-medium">Факти та умови клієнта #{{ member.customer_id }}</summary>
              <ul class="mt-3 space-y-2">
                <li v-for="(explanation,index) in member.conditions" :key="`condition-${index}`">
                  {{ explanation.matched ? 'Відповідає' : 'Не відповідає' }}: {{ summarizeCondition(explanation.rule) }}. Факт: {{ factValue(explanation) }}.
                  <span v-if="explanation.period_start && explanation.period_end">Межі: {{ formatSegmentTime(String(explanation.period_start)) }} — {{ formatSegmentTime(String(explanation.period_end)) }}.</span>
                </li>
                <li v-for="(explanation,index) in member.exclusions" :key="`exclusion-${index}`">Виключення {{ explanation.matched ? 'спрацювало' : 'не спрацювало' }}: {{ summarizeCondition(explanation.rule) }}. Факт: {{ factValue(explanation) }}.</li>
              </ul>
            </details>
          </td>
        </tr>
      </BaseTable>
      <div class="flex flex-wrap items-center gap-3">
        <BaseButton variant="neutral" :disabled="pending || result.offset === 0" @click="preview(Math.max(0,result.offset-limit))">Попередня</BaseButton>
        <span class="text-sm text-ui-muted">Сторінка {{ Math.floor(result.offset / limit) + 1 }}</span>
        <BaseButton variant="neutral" :disabled="pending || result.offset + result.items.length >= result.total" @click="preview(result.offset+limit)">Наступна</BaseButton>
      </div>
    </template>
    <p v-else-if="!result && !pending && !error && !invalid" class="text-sm text-ui-muted">Запустіть оцінку, щоб побачити кількість клієнтів і причини включення.</p>
  </section>
</template>
