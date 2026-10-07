<script setup lang="ts">
import type { AudienceEstimate, AudienceRule, AudienceRuleType } from '~/types/messaging'
import type { Master as BackofficeMaster, Service as BackofficeService } from '~/composables/useBackofficeApi'

const props = defineProps<{
  modelValue: AudienceRule[]
  masters?: BackofficeMaster[]
  services?: Pick<BackofficeService, 'id' | 'name'>[]
  estimate?: AudienceEstimate | null
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: AudienceRule[]]
  preview: []
}>()

const rule = computed({
  get: () => props.modelValue[0] || { type: 'all_clients' as AudienceRuleType },
  set: value => emit('update:modelValue', [value]),
})

const updateRule = (patch: Partial<AudienceRule>) => {
  rule.value = { ...rule.value, ...patch }
}

const options: Array<{ value: AudienceRuleType, label: string, helper: string }> = [
  { value: 'all_clients', label: 'Усі клієнти', helper: 'Усі клієнти з Telegram та дозволом на маркетинг.' },
  { value: 'selected_barber', label: 'Клієнти майстра', helper: 'Клієнти, які записувались до вибраного майстра.' },
  { value: 'visited_date_range', label: 'Візити за період', helper: 'Клієнти з візитами в указаному діапазоні.' },
  { value: 'inactive_clients', label: 'Неактивні клієнти', helper: 'Клієнти без візитів за останні N днів.' },
  { value: 'first_time_clients', label: 'Нові клієнти', helper: 'Клієнти з одним першим візитом.' },
  { value: 'vip_clients', label: 'VIP клієнти', helper: 'Клієнти з високою сумою витрат або VIP ознакою.' },
  { value: 'birthday_this_month', label: 'День народження цього місяця', helper: 'Клієнти з датою народження у поточному місяці.' },
  { value: 'selected_service', label: 'Використали послугу', helper: 'Клієнти, які бронювали вибрану послугу.' },
]

</script>

<template>
  <div class="space-y-3">
    <MessagingCampaignFieldHelp label="Правило відбору" help="Виберіть правило для цієї кампанії. Остаточна аудиторія враховує доступність Telegram та згоду клієнтів на маркетинг; перевірте список перед запуском." />
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <label
        v-for="option in options"
        :key="option.value"
        class="cursor-pointer rounded-[1.25rem] border p-4 transition"
        :class="rule.type === option.value ? 'messaging-choice-active' : 'messaging-choice-idle'"
      >
        <BaseRadioButton class="sr-only" :checked="rule.type === option.value" @change="updateRule({ type: option.value })" />
        <span class="block text-sm font-semibold text-slate-900">{{ option.label }}</span>
        <span class="mt-1 block text-xs leading-5 text-slate-500">{{ option.helper }}</span>
      </label>
    </div>

    <div class="grid gap-3 md:grid-cols-2">
        <MasterSelect
          v-if="['selected_barber'].includes(rule.type)"
          label="Майстер"
          :model-value="rule.barber_id || null"
          :masters="masters || []"
          value-type="number"
          placeholder="Оберіть майстра"
          menu-class="z-[220]"
          @update:model-value="updateRule({ barber_id: Number($event) || null })"
        >
          <template #label><MessagingCampaignFieldHelp label="Майстер" help="Відбирає клієнтів, які раніше записувалися до вибраного майстра." /></template>
        </MasterSelect>

      <BaseSelect v-if="['selected_service'].includes(rule.type)" label="Послуга" :model-value="rule.service_id || ''" :options="[{ value: '', label: 'Оберіть послугу' }, ...(services || []).map(service => ({ value: service.id, label: service.name }))]" @update:model-value="updateRule({ service_id: Number($event) || null })">
        <template #label><MessagingCampaignFieldHelp label="Послуга" help="Відбирає клієнтів, які бронювали цю послугу. Перед запуском перевірте відповідність списку отримувачів." /></template>
      </BaseSelect>

      <template v-if="rule.type === 'visited_date_range'">
        <BaseCalendar label="Дата від" class="rounded-2xl border border-slate-300 px-4 py-3" :model-value="rule.date_from || ''" @update:model-value="updateRule({ date_from: $event })">
          <template #label><MessagingCampaignFieldHelp label="Дата від" help="Початок діапазону дат візитів для відбору клієнтів." /></template>
        </BaseCalendar>
        <BaseCalendar label="Дата до" class="rounded-2xl border border-slate-300 px-4 py-3" :model-value="rule.date_to || ''" @update:model-value="updateRule({ date_to: $event })">
          <template #label><MessagingCampaignFieldHelp label="Дата до" help="Кінець діапазону дат візитів. Перевірте, що він не раніше початкової дати." /></template>
        </BaseCalendar>
      </template>

      <BaseInput v-if="rule.type === 'inactive_clients'" label="Днів без візиту" class="rounded-2xl border border-slate-300 px-4 py-3" min="1" max="3650" step="1" type="number" :model-value="rule.inactive_days ?? null" @update:model-value="updateRule({ inactive_days: $event === null || $event === '' ? null : Number($event) })">
        <template #label><MessagingCampaignFieldHelp label="Днів без візиту" help="Мінімальний період неактивності клієнта. Відлік ведеться від останнього візиту; значення має бути додатним цілим числом." /></template>
      </BaseInput>


    </div>

    <div class="grid items-center gap-3 md:grid-cols-5">
      <div>
        <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Аудиторія</p>
        <p class="mt-1 text-2xl font-semibold text-slate-900">{{ loading ? '...' : estimate?.eligible || 0 }}</p>
      </div>
      <div>
        <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Усього</p>
        <p class="mt-1 text-lg font-semibold text-slate-900">{{ estimate?.total || 0 }}</p>
      </div>
      <div>
        <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Без chat_id</p>
        <p class="mt-1 text-lg font-semibold text-amber-700">{{ estimate?.missing_chat_id || 0 }}</p>
      </div>
      <div>
        <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Opt-out</p>
        <p class="mt-1 text-lg font-semibold text-rose-700">{{ estimate?.opted_out || 0 }}</p>
      </div>
      <BaseButton type="button" class="messaging-secondary-action rounded-full px-4 py-2 text-sm font-medium" @click="emit('preview')">
        Переглянути список
      </BaseButton>
    </div>
  </div>
</template>
