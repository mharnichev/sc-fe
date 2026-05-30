<script setup lang="ts">
import type { AudienceEstimate, AudienceRule, AudienceRuleType } from '~/types/messaging'
import type { Master as BackofficeMaster, Service as BackofficeService } from '~/composables/useBackofficeApi'

const props = defineProps<{
  modelValue: AudienceRule[]
  masters?: BackofficeMaster[]
  services?: BackofficeService[]
  estimate?: AudienceEstimate | null
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: AudienceRule[]]
  preview: []
}>()

const { masterName } = useBookingFormatting()

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
  { value: 'specific_clients', label: 'Конкретний список', helper: 'Список ID клієнтів, розділених комами.' },
]

const clientIdsText = computed({
  get: () => (rule.value.client_ids || []).join(', '),
  set: value => updateRule({
    client_ids: value
      .split(',')
      .map(item => Number(item.trim()))
      .filter(Boolean),
  }),
})
</script>

<template>
  <div class="space-y-5">
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <label
        v-for="option in options"
        :key="option.value"
        class="cursor-pointer rounded-[1.25rem] border p-4 transition"
        :class="rule.type === option.value ? 'border-cyan-400 bg-cyan-50' : 'border-slate-200 bg-white hover:bg-slate-50'"
      >
        <input class="sr-only" type="radio" :checked="rule.type === option.value" @change="updateRule({ type: option.value })">
        <span class="block text-sm font-semibold text-slate-900">{{ option.label }}</span>
        <span class="mt-1 block text-xs leading-5 text-slate-500">{{ option.helper }}</span>
      </label>
    </div>

    <div class="grid gap-4 rounded-[1.25rem] bg-slate-50 p-4 md:grid-cols-2">
      <label v-if="['selected_barber'].includes(rule.type)" class="grid gap-2 text-sm">
        <span class="font-medium text-slate-700">Майстер</span>
        <select class="rounded-2xl border border-slate-300 px-4 py-3" :value="rule.barber_id || ''" @change="updateRule({ barber_id: Number(($event.target as HTMLSelectElement).value) || null })">
          <option value="">Оберіть майстра</option>
          <option v-for="master in masters || []" :key="master.id" :value="master.id">{{ masterName(master) }}</option>
        </select>
      </label>

      <label v-if="['selected_service'].includes(rule.type)" class="grid gap-2 text-sm">
        <span class="font-medium text-slate-700">Послуга</span>
        <select class="rounded-2xl border border-slate-300 px-4 py-3" :value="rule.service_id || ''" @change="updateRule({ service_id: Number(($event.target as HTMLSelectElement).value) || null })">
          <option value="">Оберіть послугу</option>
          <option v-for="service in services || []" :key="service.id" :value="service.id">{{ service.name }}</option>
        </select>
      </label>

      <template v-if="rule.type === 'visited_date_range'">
        <label class="grid gap-2 text-sm">
          <span class="font-medium text-slate-700">Дата від</span>
          <input class="rounded-2xl border border-slate-300 px-4 py-3" type="date" :value="rule.date_from || ''" @input="updateRule({ date_from: ($event.target as HTMLInputElement).value })">
        </label>
        <label class="grid gap-2 text-sm">
          <span class="font-medium text-slate-700">Дата до</span>
          <input class="rounded-2xl border border-slate-300 px-4 py-3" type="date" :value="rule.date_to || ''" @input="updateRule({ date_to: ($event.target as HTMLInputElement).value })">
        </label>
      </template>

      <label v-if="rule.type === 'inactive_clients'" class="grid gap-2 text-sm">
        <span class="font-medium text-slate-700">Днів без візиту</span>
        <input class="rounded-2xl border border-slate-300 px-4 py-3" min="1" type="number" :value="rule.inactive_days || 60" @input="updateRule({ inactive_days: Number(($event.target as HTMLInputElement).value) || 60 })">
      </label>

      <label v-if="rule.type === 'specific_clients'" class="grid gap-2 text-sm md:col-span-2">
        <span class="font-medium text-slate-700">ID клієнтів</span>
        <input v-model="clientIdsText" class="rounded-2xl border border-slate-300 px-4 py-3" placeholder="12, 48, 103">
      </label>
    </div>

    <div class="grid gap-3 rounded-[1.25rem] border border-slate-200 bg-white p-4 md:grid-cols-5">
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
      <button type="button" class="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" @click="emit('preview')">
        Переглянути список
      </button>
    </div>
  </div>
</template>
