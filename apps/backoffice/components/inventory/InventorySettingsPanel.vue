<script setup lang="ts">
import { canManageCatalog } from '~/utils/catalogAccess'
import { CheckIcon, ArrowsRightLeftIcon, Cog6ToothIcon, QrCodeIcon } from '@heroicons/vue/24/outline'
import { inventoryApiErrorMessage } from '~/utils/inventory'

const catalogAuth = useAuthStore()
const catalogEditable = computed(() => canManageCatalog(catalogAuth.user))

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
  if (!catalogEditable.value || saving.value) return
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
  <BaseCard v-if="catalogEditable" as="section" padding="sm" class="min-w-0 space-y-3">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="flex items-center gap-2 text-base font-semibold text-ui-primary"><Cog6ToothIcon class="h-4 w-4 shrink-0 text-ui-muted" aria-hidden="true" />Налаштування товару<BaseFieldHelp label="Налаштування товару" text="Штрихкод має бути унікальним для варіанта товару. Однакові фізичні одиниці використовують той самий код; інший розмір або варіант — окремий товар. Якщо виробник не надав штрихкод, можна використати внутрішній код або залишити поле порожнім." /></h2>
      </div>
      <NuxtLink :to="`/inventory/movements?product_id=${productId}`" class="base-button base-button--neutral flex min-h-9 items-center justify-center gap-1.5 px-3 py-2 text-xs">
        <ArrowsRightLeftIcon class="h-4 w-4" aria-hidden="true" />Рух товару
      </NuxtLink>
    </div>

    <form class="grid gap-3" @submit.prevent="save">
      <BaseInput v-model="barcode" label="Штрихкод" hint="Унікальний код цього варіанта товару. Можна залишити порожнім." maxlength="64" autocomplete="off" placeholder="Наприклад, 482…" :disabled="saving"><template #icon><QrCodeIcon class="h-4 w-4 shrink-0" aria-hidden="true" /></template></BaseInput>
      <div class="space-y-2 rounded-xl bg-ui-subtle p-3">
        <div class="flex items-center gap-2"><BaseToggle v-model="allowBackorder" label="Замовляти під закупівлю" :disabled="saving" /><BaseFieldHelp label="Замовляти під закупівлю" text="Клієнт може замовити товар, навіть якщо його немає на складі." /></div>
      </div>
      <p v-if="errorMessage" class="text-sm text-ui-danger" role="alert">{{ errorMessage }}</p>
      <div>
        <BaseButton type="submit" variant="primary" size="sm" :loading="saving" class="w-full"><CheckIcon class="h-4 w-4" aria-hidden="true" />Зберегти налаштування</BaseButton>
      </div>
    </form>
  </BaseCard>
</template>
