<script setup lang="ts">
interface ContextItem {
  label: string
  value: string
}

withDefaults(defineProps<{
  modelValue: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  contextItems?: ContextItem[]
  pending?: boolean
  destructive?: boolean
}>(), {
  cancelLabel: 'Скасувати',
  contextItems: () => [],
  pending: false,
  destructive: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
}>()
</script>

<template>
  <BaseModal :model-value="modelValue" max-width-class="max-w-lg" @update:model-value="emit('update:modelValue', $event)">
    <template #head="{ close }">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-[0.25em]" :class="destructive ? 'text-rose-700' : 'text-cyan-700'">Підтвердження</p>
          <h2 class="mt-2 text-2xl font-semibold text-slate-900">{{ title }}</h2>
        </div>
        <button type="button" class="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700" :disabled="pending" @click="close">
          Закрити
        </button>
      </div>
    </template>

    <template #body="{ close }">
      <div class="space-y-5">
        <p class="text-sm leading-6 text-slate-600">{{ message }}</p>

        <dl v-if="contextItems.length" class="space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
          <div v-for="item in contextItems" :key="item.label" class="grid gap-1 sm:grid-cols-[130px_1fr]">
            <dt class="font-medium text-slate-500">{{ item.label }}</dt>
            <dd class="font-medium text-slate-900">{{ item.value }}</dd>
          </div>
        </dl>

        <div class="flex flex-wrap justify-end gap-3">
          <button type="button" class="rounded-full border border-slate-300 px-5 py-3 text-sm text-slate-700" :disabled="pending" @click="close">
            {{ cancelLabel }}
          </button>
          <button
            type="button"
            :disabled="pending"
            class="rounded-full px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
            :class="destructive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-950 hover:bg-slate-800'"
            @click="emit('confirm')"
          >
            {{ pending ? 'Виконується...' : confirmLabel }}
          </button>
        </div>
      </div>
    </template>
  </BaseModal>
</template>
