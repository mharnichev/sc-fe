<script setup lang="ts">
const props = defineProps<{ modelValue: boolean, embedUrl: string | null, frameKey: number, busy: boolean, redirectUrl: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean], fallback: [], unavailable: [code: 'iframe_load_failed' | 'iframe_layout_unavailable'], closed: [] }>()
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
const frameError = (event: Event) => {
  const current = frame.value
  if (props.modelValue && current && event.currentTarget === current && current.dataset.frameKey === String(props.frameKey))
    emit('unavailable', 'iframe_load_failed')
}
watch(frame, (element, _previous, onCleanup) => {
  if (!element) return
  const checkGeometry = () => {
    if (!props.modelValue || frame.value !== element) return
    const content = element.parentElement
    if (!content || element.offsetWidth < 576 || element.offsetHeight < 576
      || content.clientWidth < element.offsetWidth || content.clientHeight < element.offsetHeight) emit('unavailable', 'iframe_layout_unavailable')
  }
  const observer = new ResizeObserver(checkGeometry)
  observer.observe(element)
  if (element.parentElement) observer.observe(element.parentElement)
  checkGeometry()
  onCleanup(() => observer.disconnect())
}, { flush: 'post' })
watch(() => [props.modelValue, props.frameKey], () => { fallbackRequested.value = false })
onMounted(() => window.addEventListener('message', message))
onBeforeUnmount(() => window.removeEventListener('message', message))
</script>

<template>
  <BaseModal :model-value="modelValue" type="right" root-class="mono-payment-modal" manage-focus @update:model-value="emit('update:modelValue', $event)" @after-leave="emit('closed')">
    <template #header-title>{{ paymentText.widgetTitle }}</template>
    <div v-if="busy && !embedUrl" class="mono-payment-modal__loading" role="status">{{ paymentText.loading }}</div>
    <iframe v-else-if="modelValue && embedUrl" :key="frameKey" ref="frame" :data-frame-key="frameKey"
      class="mono-payment-modal__frame" :src="embedUrl" :title="paymentText.widgetFrame"
      width="576" height="576" tabindex="0" allow="payment *" referrerpolicy="no-referrer" @error="frameError" />
    <template #bottom-buttons>
      <p v-if="fallbackRequested" class="mono-payment-modal__hint" role="status">{{ paymentText.widgetHint }}</p>
      <div class="mono-payment-modal__actions">
        <BaseButton v-if="redirectUrl" :disabled="busy" variant="borderless" @click="emit('fallback')">{{ paymentText.widgetFallback }}</BaseButton>
        <BaseButton variant="borderless" @click="close">{{ paymentText.widgetClose }}</BaseButton>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
:global(.base-modal.base-modal--right.mono-payment-modal:not(.base-modal--inline) .base-modal__container) { width: min(100vw, 608px); height: 100dvh; max-height: 100dvh; border-radius: 24px 0 0 24px; }
:global(.base-modal.mono-payment-modal .base-modal__content) { display: grid; place-items: center; }
:global(.base-modal.mono-payment-modal .base-modal__header) { height: 64px; min-height: 64px; }
:global(.base-modal.mono-payment-modal .base-modal__bottom-buttons) { padding: 12px 16px; }
.mono-payment-modal__frame { display: block; width: 576px; height: 576px; min-width: 576px; min-height: 576px; border: 0; border-radius: 24px; }
.mono-payment-modal__loading { display: grid; width: 576px; height: 576px; place-items: center; color: #525252; }
.mono-payment-modal__actions { display: flex; justify-content: space-between; gap: 8px; }
.mono-payment-modal__actions > * { min-width: 0; font-size: 12px; }
.mono-payment-modal__hint { margin-bottom: 8px; color: #525252; font-size: 12px; line-height: 18px; }
</style>
