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
const props = withDefaults(defineProps<{
  modelValue: boolean
  maxWidthClass?: string
}>(), {
  maxWidthClass: 'max-w-3xl',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
}>()

let lockedByInstance = false

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

watch(
  () => props.modelValue,
  setScrollLock,
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
      class="fixed inset-0 z-[300] flex items-end justify-center overflow-hidden overscroll-none bg-black/62 px-0 py-0 backdrop-blur-md sm:items-center sm:px-4 sm:py-6"
      @click.self="close"
    >
      <section
        class="backoffice-modal-panel liquid-glass flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-[1.5rem] shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:rounded-[1.75rem]"
        :class="maxWidthClass"
        role="dialog"
        aria-modal="true"
      >
        <header v-if="$slots.head" class="shrink-0 border-b border-white/10 px-4 py-4 sm:px-6 sm:py-5">
          <slot name="head" :close="close" />
        </header>

        <div v-if="$slots.body" class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 [-webkit-overflow-scrolling:touch] sm:px-6">
          <slot name="body" :close="close" />
        </div>
      </section>
    </div>
  </Teleport>
</template>
