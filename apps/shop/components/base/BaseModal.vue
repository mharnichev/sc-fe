<script setup lang="ts">
type ModalType = 'default' | 'right' | 'left' | 'bottom' | 'top' | 'fullscreen'
type ContentType = 'primary' | 'secondary'

const props = withDefaults(defineProps<{
  modelValue: boolean
  type?: ModalType
  mobileType?: ModalType
  blockClose?: boolean
  showOverlay?: boolean
  showHeader?: boolean
  fullHeight?: boolean
  rootClass?: string
  inline?: boolean
  isCenter?: boolean
  contentType?: ContentType
}>(), {
  type: 'default',
  mobileType: 'default',
  blockClose: false,
  showOverlay: true,
  showHeader: true,
  fullHeight: false,
  rootClass: '',
  inline: false,
  isCenter: false,
  contentType: 'primary',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
  'after-leave': []
}>()

const modalElement = ref<HTMLElement | null>(null)
const previousOverflow = ref('')
const { terms } = useShopLocale()

const endType = computed(() => props.type || props.mobileType)

const close = (force = false) => {
  if (!force && props.blockClose) return

  emit('update:modelValue', false)
  emit('close')
}

const forceClose = () => close(true)

const onKeyUp = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.modelValue) close()
}

watch(() => props.modelValue, value => {
  if (!import.meta.client) return

  if (value) {
    previousOverflow.value = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  else {
    document.body.style.overflow = previousOverflow.value
  }
}, { immediate: true })

onMounted(() => {
  window.addEventListener('keyup', onKeyUp)
})

onBeforeUnmount(() => {
  window.removeEventListener('keyup', onKeyUp)
  if (import.meta.client) document.body.style.overflow = previousOverflow.value
})

defineExpose({
  close: forceClose,
})
</script>

<template>
  <Teleport to=".app-modal-teleport" :disabled="inline">
    <Transition name="base-modal" appear :duration="300" @after-leave="$emit('after-leave')">
      <div
        v-if="modelValue"
        ref="modalElement"
        :class="[
          'base-modal',
          `base-modal--${endType}`,
          {
            'base-modal--center': isCenter,
            'base-modal--full-height': fullHeight,
            'base-modal--inline': inline,
          },
          rootClass,
        ]"
        role="dialog"
        aria-modal="true"
      >
        <button
          v-if="!inline && showOverlay"
          class="base-modal__overlay"
          type="button"
          :aria-label="terms.common.closeDialog"
          @click="close(false)"
        />

        <section class="base-modal__container">
          <header v-if="showHeader" class="base-modal__header">
            <slot name="header" :close="forceClose">
              <h2 class="base-modal__header-title">
                <slot name="header-title" />
              </h2>
              <div class="base-modal__header-buttons">
                <slot name="header-buttons" :close="forceClose" />
                <BaseButton
                  v-if="!blockClose"
                  class="base-modal__close"
                  type="button"
                  variant="outline-dark"
                  size="sm"
                  shape="circle"
                  :aria-label="terms.common.closeDialog"
                  @click="forceClose"
                >
                  <BaseIcon name="close" size="xxs" />
                </BaseButton>
              </div>
            </slot>
          </header>

          <div :class="['base-modal__content', `is-${contentType}`]">
            <slot :close="forceClose" />
          </div>

          <footer v-if="$slots['bottom-buttons']" class="base-modal__bottom-buttons">
            <slot name="bottom-buttons" />
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.base-modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
}

.base-modal__overlay {
  position: fixed;
  inset: 0;
  z-index: 1;
  cursor: pointer;
  border: 0;
  background: rgb(0 0 0 / 0.32);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}

.base-modal__container {
  position: fixed;
  z-index: 2;
  display: flex;
  width: min(100vw, 28rem);
  max-width: 100vw;
  max-height: calc(100vh - 2rem);
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgb(10 10 10 / 0.12);
  background: #ffffff;
}

.base-modal__header {
  display: flex;
  min-height: 4rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid rgb(10 10 10 / 0.1);
  background: #ffffff;
  padding: 0.875rem 1rem;
}

.base-modal__header-title {
  min-width: 0;
  overflow: hidden;
  color: #0a0a0a;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1.2;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.base-modal__header-buttons {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.5rem;
}

.base-modal__close {
  flex: 0 0 auto;
}

.base-modal__content {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

.base-modal__content.is-primary {
  background: #ffffff;
}

.base-modal__content.is-secondary {
  background: #f5f5f4;
}

.base-modal__bottom-buttons {
  flex: 0 0 auto;
  border-top: 1px solid rgb(10 10 10 / 0.1);
  background: #ffffff;
  padding: 1rem;
}

.base-modal--inline {
  position: absolute;
  z-index: auto;
}

.base-modal--inline .base-modal__container {
  position: relative;
  height: 100%;
  min-width: 0;
  max-height: none;
}

.base-modal--default:not(.base-modal--inline) {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.base-modal--default:not(.base-modal--inline) .base-modal__container {
  position: relative;
}

.base-modal--fullscreen:not(.base-modal--inline) .base-modal__container {
  inset: 0;
  width: 100vw;
  height: 100vh;
  max-height: 100vh;
}

.base-modal--right:not(.base-modal--inline) .base-modal__container,
.base-modal--left:not(.base-modal--inline) .base-modal__container {
  top: 0;
  width: min(100vw, 36rem);
  height: 100vh;
  max-height: 100vh;
}

.base-modal--right:not(.base-modal--inline) .base-modal__container {
  right: 0;
  border-right: 0;
}

.base-modal--left:not(.base-modal--inline) .base-modal__container {
  left: 0;
  border-left: 0;
}

.base-modal--bottom:not(.base-modal--inline) .base-modal__container {
  right: 0;
  bottom: 0;
  left: 0;
  width: 100vw;
  height: 80vh;
  height: 80dvh;
  max-height: min(90vh, 42rem);
  border-bottom: 0;
}

.base-modal--top:not(.base-modal--inline) .base-modal__container {
  top: 0;
  right: 0;
  left: 0;
  width: 100vw;
  max-height: min(90vh, 42rem);
  border-top: 0;
}

.base-modal--full-height .base-modal__content {
  flex: 1 1 auto;
}

.base-modal--center .base-modal__container {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.base-modal-enter-from .base-modal__overlay,
.base-modal-leave-to .base-modal__overlay {
  opacity: 0;
}

.base-modal-enter-from.base-modal--right .base-modal__container,
.base-modal-leave-to.base-modal--right .base-modal__container {
  transform: translateX(100%);
}

.base-modal-enter-from.base-modal--left .base-modal__container,
.base-modal-leave-to.base-modal--left .base-modal__container {
  transform: translateX(-100%);
}

.base-modal-enter-from.base-modal--bottom .base-modal__container,
.base-modal-leave-to.base-modal--bottom .base-modal__container {
  transform: translateY(100%);
}

.base-modal-enter-from.base-modal--top .base-modal__container,
.base-modal-leave-to.base-modal--top .base-modal__container {
  transform: translateY(-100%);
}

.base-modal-enter-from.base-modal--default,
.base-modal-leave-to.base-modal--default {
  opacity: 0;
}

.base-modal-enter-from.base-modal--default .base-modal__container,
.base-modal-leave-to.base-modal--default .base-modal__container {
  transform: scale(0.96);
}

.base-modal-enter-active,
.base-modal-leave-active {
  transition: opacity 300ms ease;
}

.base-modal-enter-active .base-modal__overlay,
.base-modal-leave-active .base-modal__overlay {
  transition: opacity 300ms ease;
}

.base-modal-enter-active .base-modal__container,
.base-modal-leave-active .base-modal__container {
  transition: transform 300ms ease;
}

@media (max-width: 575px) {
  .base-modal__container {
    width: min(100vw, 24rem);
  }

  .base-modal--bottom:not(.base-modal--inline) .base-modal__container {
    width: 100vw;
    height: 80vh;
    height: 80dvh;
    max-height: 80vh;
    max-height: 80dvh;
  }
}

@media (min-width: 576px) {
  .base-modal--bottom:not(.base-modal--inline) .base-modal__container {
    top: 0;
    right: 0;
    bottom: auto;
    left: auto;
    width: min(100vw, 36rem);
    height: 100vh;
    max-height: 100vh;
    border-right: 0;
    border-bottom: 1px solid rgb(10 10 10 / 0.12);
  }

  .base-modal-enter-from.base-modal--bottom .base-modal__container,
  .base-modal-leave-to.base-modal--bottom .base-modal__container {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .base-modal-enter-active,
  .base-modal-leave-active,
  .base-modal-enter-active .base-modal__overlay,
  .base-modal-leave-active .base-modal__overlay,
  .base-modal-enter-active .base-modal__container,
  .base-modal-leave-active .base-modal__container {
    transition: none;
  }
}
</style>
