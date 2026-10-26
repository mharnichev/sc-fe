<script setup lang="ts">
import { LockOpenIcon } from '@heroicons/vue/24/outline'
import type { Master } from '~/composables/useBackofficeApi'

withDefaults(defineProps<{
  modelValue: boolean
  admin?: boolean
  masters?: Master[]
  disabled?: boolean
  initialDate?: string
  initialMasterId?: number | null
  initialStartTime?: string
  initialEndTime?: string
}>(), { admin: false, masters: () => [], disabled: false })
const emit = defineEmits<{ 'update:modelValue': [value: boolean], saved: [message: string] }>()
const busy = ref(false)
const close = () => { if (!busy.value) emit('update:modelValue', false) }
const complete = () => emit('update:modelValue', false)
</script>

<template>
  <BaseModal :model-value="modelValue" fill-height max-width-class="availability-modal max-w-4xl" aria-label="Відкрити для запису" :close-on-backdrop="!busy" :close-on-escape="!busy" @update:model-value="close">
    <template #head>
      <div class="flex items-start justify-between gap-2.5">
        <div>
          <p class="hidden text-[11px] uppercase tracking-[0.18em] text-ui-muted sm:block">{{ admin ? 'Адмін · Доступність' : 'Доступність' }}</p>
          <h2 class="flex items-center gap-2 text-base font-semibold text-ui-primary sm:mt-1 sm:text-lg"><LockOpenIcon class="h-5 w-5 text-ui-muted" aria-hidden="true" />Графік для запису</h2>
        </div>
        <ModalCloseButton :disabled="busy" @click="close" />
      </div>
    </template>
    <template #body>
      <AvailabilityWindowForm
        v-if="modelValue"
        :admin="admin"
        :masters="masters"
        :disabled="disabled"
        :initial-date="initialDate"
        :initial-master-id="initialMasterId"
        :initial-start-time="initialStartTime"
        :initial-end-time="initialEndTime"
        @busy="busy = $event"
        @saved="emit('saved', $event)"
        @complete="complete"
      />
    </template>
  </BaseModal>
</template>

<style>
@media (max-width: 639px) {
  .availability-modal .base-modal__header .backoffice-modal-close-button { min-height: 32px; height: 32px; width: 32px; }
  .availability-modal .base-modal__header { padding: 6px; }
  .availability-modal .base-modal__header + div { padding: 6px; }
}
</style>
