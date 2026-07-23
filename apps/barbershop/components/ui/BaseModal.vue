<script setup lang="ts">
type ModalType = 'default' | 'right'

const props = withDefaults(defineProps<{
  modelValue: boolean
  dialogLabel: string
  closeLabel: string
  type?: ModalType
  blockClose?: boolean
}>(), {
  type: 'default',
  blockClose: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const dialog = ref<HTMLElement | null>(null)
let previousActiveElement: HTMLElement | null = null
let previousBodyOverflow = ''

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const close = () => {
  if (props.blockClose) return
  emit('update:modelValue', false)
}

const updateOverlayCloseCursor = (event: PointerEvent) => {
  if (props.blockClose) return

  const overlay = event.currentTarget
  if (!(overlay instanceof HTMLElement)) return

  overlay.style.setProperty('--overlay-close-cursor-x', `${event.clientX}px`)
  overlay.style.setProperty('--overlay-close-cursor-y', `${event.clientY}px`)
}

const focusDialog = async () => {
  await nextTick()
  const target = dialog.value
  if (!target) return

  const firstFocusable = target.querySelector<HTMLElement>(focusableSelector)
  ;(firstFocusable || target).focus()
}

const onKeydown = (event: KeyboardEvent) => {
  if (!props.modelValue) return

  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }

  if (event.key !== 'Tab' || !dialog.value) return

  const focusableElements = [...dialog.value.querySelectorAll<HTMLElement>(focusableSelector)]
  if (!focusableElements.length) {
    event.preventDefault()
    dialog.value.focus()
    return
  }

  const first = focusableElements[0]
  const last = focusableElements.at(-1)

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  }
  else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}

watch(
  () => props.modelValue,
  async (isOpen) => {
    if (!import.meta.client) return

    if (isOpen) {
      previousActiveElement = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
      previousBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      await focusDialog()
      return
    }

    document.body.style.overflow = previousBodyOverflow
    previousActiveElement?.focus()
    previousActiveElement = null
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.body.style.overflow = previousBodyOverflow
  previousActiveElement?.focus()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="base-modal" appear>
      <div
        v-if="modelValue"
        :class="[
          'base-modal fixed inset-0 z-[1000] flex max-w-full overflow-hidden',
          `base-modal--${type}`,
        ]"
        @keydown="onKeydown"
      >
        <button
          class="base-modal__overlay absolute inset-0 bg-neutral-950/72 backdrop-blur-sm"
          :class="{ 'base-modal__overlay--closeable': !blockClose }"
          type="button"
          :disabled="blockClose"
          :aria-label="closeLabel"
          @click="close"
          @pointermove="updateOverlayCloseCursor"
        />

        <section
          ref="dialog"
          class="base-modal__container relative z-10 flex min-w-0 max-w-full flex-col overflow-hidden bg-white text-neutral-950"
          role="dialog"
          aria-modal="true"
          :aria-label="dialogLabel"
          tabindex="-1"
        >
          <div
            v-if="!blockClose"
            class="absolute right-3 top-3 z-20"
          >
            <BaseButton
              class="modal-close-button"
              type="button"
              variant="light"
              shape="circle"
              size="xs"
              :aria-label="closeLabel"
              @click="close"
            >
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="m5.5 5.5 9 9M14.5 5.5l-9 9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
              </svg>
            </BaseButton>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto">
            <slot />
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.base-modal--default {
  align-items: center;
  justify-content: center;
  padding: 0;
}

.base-modal--default .base-modal__container {
  width: 100vw;
  max-height: 100svh;
}

.base-modal--right {
  align-items: flex-end;
  justify-content: center;
}

.base-modal--right .base-modal__container {
  width: 100vw;
  height: 88svh;
  max-height: 88svh;
  border-radius: 0.5rem 0.5rem 0 0;
}

.base-modal__overlay {
  border: 0;
}

.base-modal__overlay--closeable {
  cursor: pointer;
}

.modal-close-button {
  border: 0;
  box-shadow: none;
}

@media (pointer: fine) {
  .base-modal__overlay--closeable {
    cursor: none;
  }

  .base-modal__overlay--closeable::after {
    position: fixed;
    top: var(--overlay-close-cursor-y, -3rem);
    left: var(--overlay-close-cursor-x, -3rem);
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 18 18' fill='none'%3E%3Cpath d='M13.5 4.5L4.5 13.5' stroke='%23fff' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M4.5 4.5L13.5 13.5' stroke='%23fff' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / 18px 18px no-repeat,
      #101010;
    box-shadow: 0 6px 18px rgb(0 0 0 / 0.28);
    content: '';
    opacity: 0;
    pointer-events: none;
    transform: translate(-50%, -50%) scale(0);
    transition:
      opacity 176ms ease,
      transform 242ms cubic-bezier(0.22, 1, 0.36, 1);
    will-change: transform, opacity;
  }

  .base-modal__overlay--closeable:hover::after {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

.base-modal-enter-active .base-modal__overlay,
.base-modal-leave-active .base-modal__overlay {
  transition: opacity 220ms ease;
}

.base-modal-enter-active .base-modal__container,
.base-modal-leave-active .base-modal__container {
  transition:
    opacity 220ms ease,
    transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.base-modal-enter-from .base-modal__overlay,
.base-modal-leave-to .base-modal__overlay,
.base-modal-enter-from.base-modal--default .base-modal__container,
.base-modal-leave-to.base-modal--default .base-modal__container {
  opacity: 0;
}

.base-modal-enter-from.base-modal--default .base-modal__container,
.base-modal-leave-to.base-modal--default .base-modal__container {
  transform: translateY(1rem) scale(0.985);
}

.base-modal-enter-from.base-modal--right .base-modal__container,
.base-modal-leave-to.base-modal--right .base-modal__container {
  transform: translateY(100%);
}

@media (min-width: 640px) {
  .base-modal--default {
    padding: 1.5rem;
  }

  .base-modal--default .base-modal__container {
    width: min(94vw, 64rem);
    max-height: calc(100svh - 3rem);
  }
}

@media (min-width: 768px) {
  .base-modal--right {
    align-items: stretch;
    justify-content: flex-end;
  }

  .base-modal--right .base-modal__container {
    width: min(45rem, 92vw);
    height: 100%;
    max-height: none;
    border-radius: 0;
  }

  .base-modal-enter-from.base-modal--right .base-modal__container,
  .base-modal-leave-to.base-modal--right .base-modal__container {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .base-modal-enter-active .base-modal__overlay,
  .base-modal-leave-active .base-modal__overlay,
  .base-modal-enter-active .base-modal__container,
  .base-modal-leave-active .base-modal__container {
    transition: none;
  }
}
</style>
