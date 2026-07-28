<script lang="ts">
let activeModalLocks = 0
let lockedScrollY = 0
let previousBodyOverflow = ''
let previousBodyPosition = ''
let previousBodyTop = ''
let previousBodyWidth = ''
let previousBodyPaddingRight = ''
let previousDocumentOverflow = ''

const lockDocumentScroll = () => {
  if (!import.meta.client) return

  activeModalLocks += 1
  if (activeModalLocks > 1) return

  const { body, documentElement } = document
  const scrollbarWidth = window.innerWidth - documentElement.clientWidth

  lockedScrollY = window.scrollY
  previousBodyOverflow = body.style.overflow
  previousBodyPosition = body.style.position
  previousBodyTop = body.style.top
  previousBodyWidth = body.style.width
  previousBodyPaddingRight = body.style.paddingRight
  previousDocumentOverflow = documentElement.style.overflow

  documentElement.style.overflow = 'hidden'
  body.style.overflow = 'hidden'
  body.style.position = 'fixed'
  body.style.top = `-${lockedScrollY}px`
  body.style.width = '100%'
  if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`
}

const unlockDocumentScroll = () => {
  if (!import.meta.client || activeModalLocks === 0) return

  activeModalLocks -= 1
  if (activeModalLocks > 0) return

  const { body, documentElement } = document
  documentElement.style.overflow = previousDocumentOverflow
  body.style.overflow = previousBodyOverflow
  body.style.position = previousBodyPosition
  body.style.top = previousBodyTop
  body.style.width = previousBodyWidth
  body.style.paddingRight = previousBodyPaddingRight
  window.scrollTo(0, lockedScrollY)
}
</script>

<script setup lang="ts">
import { useId } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  maxWidthClass?: string
  ariaLabel?: string
  ariaLabelledby?: string
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
}>(), {
  maxWidthClass: 'max-w-3xl',
  ariaLabel: 'Діалогове вікно',
  closeOnBackdrop: true,
  closeOnEscape: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
}>()

let lockedByInstance = false
const panelRef = ref<HTMLElement | null>(null)
const previousFocusedElement = ref<HTMLElement | null>(null)
const generatedId = useId()
const titleId = `base-modal-${generatedId}-title`

const setScrollLock = (locked: boolean) => {
  if (locked && !lockedByInstance) {
    lockDocumentScroll()
    lockedByInstance = true
    return
  }

  if (!locked && lockedByInstance) {
    unlockDocumentScroll()
    lockedByInstance = false
  }
}

const close = () => {
  emit('update:modelValue', false)
  emit('close')
}

const focusableSelector = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const focusInitialElement = () => {
  const panel = panelRef.value
  if (!panel) return
  const target = panel.querySelector<HTMLElement>('[autofocus]')
    || panel.querySelector<HTMLElement>(focusableSelector)
    || panel
  target.focus()
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.closeOnEscape) {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Tab') return

  const panel = panelRef.value
  const focusable = Array.from(panel?.querySelectorAll<HTMLElement>(focusableSelector) || [])
    .filter(element => element.offsetParent !== null)
  if (!focusable.length) {
    event.preventDefault()
    panel?.focus()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}

watch(
  () => props.modelValue,
  async isOpen => {
    setScrollLock(isOpen)
    if (isOpen) {
      previousFocusedElement.value = document.activeElement instanceof HTMLElement ? document.activeElement : null
      await nextTick()
      focusInitialElement()
    } else {
      await nextTick()
      previousFocusedElement.value?.focus()
      previousFocusedElement.value = null
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  setScrollLock(false)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="base-modal__backdrop fixed inset-0 z-[300] flex items-end justify-center overflow-hidden overscroll-none px-0 py-0 backdrop-blur-md sm:items-center sm:px-4 sm:py-6"
      @click.self="closeOnBackdrop && close()"
      @keydown="handleKeydown"
    >
      <section
        ref="panelRef"
        class="backoffice-modal-panel base-modal__panel liquid-glass flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-[1.5rem] sm:max-h-[calc(100dvh-3rem)] sm:rounded-[1.75rem]"
        :class="maxWidthClass"
        role="dialog"
        aria-modal="true"
        :aria-label="ariaLabelledby ? undefined : ariaLabel"
        :aria-labelledby="ariaLabelledby"
        tabindex="-1"
      >
        <header v-if="$slots.head" class="base-modal__header shrink-0 border-b px-4 py-4 sm:px-6 sm:py-5">
          <slot name="head" :close="close" :title-id="titleId" />
        </header>

        <div v-if="$slots.body" class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 [-webkit-overflow-scrolling:touch] sm:px-6">
          <slot name="body" :close="close" />
        </div>
      </section>
    </div>
  </Teleport>
</template>
