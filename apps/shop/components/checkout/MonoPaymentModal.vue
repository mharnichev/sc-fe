<script setup lang="ts">
const props = defineProps<{ modelValue: boolean, embedUrl: string | null, frameKey: number, loading: boolean, redirectUrl: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean], fallback: [], unavailable: [], closed: [] }>()
const { paymentText } = usePaymentDisplay()
const frame = ref<HTMLIFrameElement | null>(null)
const fallbackRequested = ref(false)
const close = () => emit('update:modelValue', false)
const message = (event: MessageEvent) => {
  const current = frame.value
  if (!props.modelValue || !props.embedUrl || !current || current.dataset.frameKey !== String(props.frameKey)
    || current.getAttribute('src') !== props.embedUrl || event.source !== current.contentWindow
    || event.origin !== 'https://pay.mbnk.biz') return
  // Mono documents JSON strings. Bound parsing; never forward data.value or infer settlement.
  if (typeof event.data !== 'string' || event.data.length > 4096) return
  try {
    const data: unknown = JSON.parse(event.data)
    if (!data || typeof data !== 'object' || !('message' in data)) return
    if (data.message === 'close-button') close()
    else if (data.message === 'monopay-link') fallbackRequested.value = true
  } catch {}
}
watch(frame, (element, _previous, onCleanup) => {
  if (!element) return
  const checkGeometry = () => {
    if (!props.modelValue) return
    const container = element.closest<HTMLElement>('.base-modal__container')
    const viewport = window.visualViewport
    if (container && container.offsetWidth < element.offsetWidth) { emit('unavailable'); return }
    if (element.offsetWidth < 576 || element.offsetHeight < 576 || !container
      || container.offsetWidth + 32 > Math.min(window.innerWidth, viewport?.width ?? window.innerWidth)
      || container.offsetHeight + 32 > Math.min(window.innerHeight, viewport?.height ?? window.innerHeight)) emit('unavailable')
  }
  const observer = new ResizeObserver(checkGeometry)
  observer.observe(element)
  if (element.parentElement) observer.observe(element.parentElement)
  const container = element.closest('.base-modal__container')
  if (container) observer.observe(container)
  checkGeometry()
  onCleanup(() => observer.disconnect())
}, { flush: 'post' })
watch(() => [props.modelValue, props.frameKey], () => { fallbackRequested.value = false })
onMounted(() => window.addEventListener('message', message))
onBeforeUnmount(() => window.removeEventListener('message', message))
</script>

<template>
  <BaseModal :model-value="modelValue" root-class="mono-payment-modal" manage-focus @update:model-value="emit('update:modelValue', $event)" @after-leave="emit('closed')">
    <template #header-title>{{ paymentText.widgetTitle }}</template>
    <div v-if="loading" class="mono-payment-modal__loading" role="status">{{ paymentText.loading }}</div>
    <iframe v-else-if="modelValue && embedUrl" :key="frameKey" ref="frame" :data-frame-key="frameKey"
      class="mono-payment-modal__frame" :src="embedUrl" :title="paymentText.widgetFrame"
      width="576" height="576" tabindex="0" allow="payment *" referrerpolicy="no-referrer" />
    <template #bottom-buttons>
      <p v-if="fallbackRequested" class="mono-payment-modal__hint" role="status">{{ paymentText.widgetHint }}</p>
      <div class="mono-payment-modal__actions">
        <BaseButton v-if="redirectUrl" variant="borderless" @click="emit('fallback')">{{ paymentText.widgetFallback }}</BaseButton>
        <BaseButton variant="borderless" @click="close">{{ paymentText.widgetClose }}</BaseButton>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
/* Keep the provider at its real size throughout the BaseModal fade, including enter/leave. */
:global(.base-modal.mono-payment-modal.base-modal--default:not(.base-modal--inline) .base-modal__container) { transform: none; }
:global(.base-modal.mono-payment-modal .base-modal__container) { width: 576px; max-width: none; max-height: none; border-radius: 24px; }
:global(.base-modal.mono-payment-modal .base-modal__content) { flex: 0 0 576px; height: 576px; overflow: visible; }
:global(.base-modal.mono-payment-modal .base-modal__header) { height: 64px; min-height: 64px; }
:global(.base-modal.mono-payment-modal .base-modal__bottom-buttons) { padding: 12px 16px; }
.mono-payment-modal__frame { display: block; width: 576px; height: 576px; min-width: 576px; min-height: 576px; border: 0; border-radius: 24px; }
.mono-payment-modal__loading { display: grid; width: 576px; height: 576px; place-items: center; color: #525252; }
.mono-payment-modal__actions { display: flex; justify-content: space-between; gap: 8px; }
.mono-payment-modal__actions > * { min-width: 0; font-size: 12px; }
.mono-payment-modal__hint { margin-bottom: 8px; color: #525252; font-size: 12px; line-height: 18px; }
</style>
