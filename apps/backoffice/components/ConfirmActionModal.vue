<script setup lang="ts">
import { CheckCircleIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/vue/24/outline'

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
        <ModalCloseButton :disabled="pending" @click="close" />
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

        <div class="backoffice-modal-actions">
          <BaseButton type="button" class="backoffice-modal-action-button backoffice-modal-action-neutral" :disabled="pending" @click="close">
            <XMarkIcon class="h-4 w-4" aria-hidden="true" />
            {{ cancelLabel }}
          </BaseButton>
          <BaseButton
            type="button"
            :disabled="pending"
            class="backoffice-modal-action-button"
            :class="destructive ? 'backoffice-modal-action-danger' : 'backoffice-modal-action-primary'"
            @click="emit('confirm')"
          >
            <component :is="destructive ? ExclamationTriangleIcon : CheckCircleIcon" v-if="!pending" class="h-4 w-4" aria-hidden="true" />
            {{ pending ? 'Виконується...' : confirmLabel }}
          </BaseButton>
        </div>
      </div>
    </template>
  </BaseModal>
</template>
