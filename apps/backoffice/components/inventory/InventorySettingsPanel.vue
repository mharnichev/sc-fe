<script setup lang="ts">
import { CheckIcon, ArrowsRightLeftIcon } from '@heroicons/vue/24/outline'
import { inventoryApiErrorMessage } from '~/utils/inventory'

const props = defineProps<{
  productId: number
  barcode?: string | null
  allowBackorder?: boolean
}>()

const emit = defineEmits<{ saved: [] }>()

const api = useBackofficeApi()
const toast = useBaseToastNotification()

const barcode = ref(props.barcode || '')
const allowBackorder = ref(Boolean(props.allowBackorder))
const saving = ref(false)
const errorMessage = ref('')

watch(() => [props.barcode, props.allowBackorder] as const, ([nextBarcode, nextAllowBackorder]) => {
  barcode.value = nextBarcode || ''
  allowBackorder.value = Boolean(nextAllowBackorder)
  errorMessage.value = ''
}, { immediate: true })

const save = async () => {
  if (saving.value) return
  saving.value = true
  errorMessage.value = ''
  try {
    await api.updateProductInventorySettings(props.productId, {
      barcode: barcode.value.trim() || null,
      allow_backorder: allowBackorder.value,
    })
    toast.success('Налаштування складу збережено.')
    emit('saved')
  }
  catch (cause) {
    errorMessage.value = inventoryApiErrorMessage(cause, 'Не вдалося зберегти налаштування складу.')
    toast.error(errorMessage.value)
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseCard as="section" padding="sm" class="space-y-3">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="ui-eyebrow text-xs uppercase tracking-[0.16em]">Склад</p>
        <h2 class="mt-1 text-lg font-semibold text-ui-primary">Налаштування товару</h2>
        <p class="mt-1 text-sm text-ui-secondary">Штрихкод має бути унікальним. Залиште поле порожнім, якщо його ще немає.</p>
      </div>
      <NuxtLink :to="`/inventory/movements?product_id=${productId}`" class="base-button base-button--neutral min-h-10 px-4 py-2 text-sm">
        <ArrowsRightLeftIcon class="h-4 w-4" aria-hidden="true" />Рух товару
      </NuxtLink>
    </div>

    <form class="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end" @submit.prevent="save">
      <BaseInput v-model="barcode" label="Штрихкод" hint="Унікальний код цього варіанта товару. Можна залишити порожнім." maxlength="64" autocomplete="off" placeholder="Наприклад, 482…" :disabled="saving" />
      <div class="space-y-2 rounded-xl bg-ui-subtle p-3">
        <BaseToggle v-model="allowBackorder" label="Замовляти під закупівлю" :disabled="saving" />
        <p class="text-xs text-ui-muted">Клієнт може замовити товар, навіть якщо його немає на складі.</p>
      </div>
      <div class="md:col-span-2 text-xs leading-5 text-ui-secondary">
        <p>Один штрихкод ідентифікує один варіант товару; однакові фізичні одиниці використовують той самий код.</p>
        <p>Інший розмір або варіант оформлюється як окремий товар. Якщо виробник не надав штрихкод, можна використати внутрішній код.</p>
      </div>
      <p v-if="errorMessage" class="md:col-span-2 text-sm text-ui-danger" role="alert">{{ errorMessage }}</p>
      <div class="md:col-span-2">
        <BaseButton type="submit" variant="primary" :loading="saving" class="w-full sm:w-auto"><CheckIcon class="h-4 w-4" aria-hidden="true" />Зберегти налаштування</BaseButton>
      </div>
    </form>
  </BaseCard>
</template>
