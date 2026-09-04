<script setup lang="ts">
import { FunnelIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { useId } from 'vue'

defineOptions({ inheritAttrs: false })

type CardVariant = 'surface' | 'elevated' | 'subtle'
type CardPadding = 'none' | 'sm' | 'md' | 'lg'

const props = withDefaults(defineProps<{
  loading?: boolean
  disabled?: boolean
  applyLabel?: string
  clearLabel?: string
  showClear?: boolean
  ariaLabel?: string
  variant?: CardVariant
  padding?: CardPadding
  rootClass?: string
  cardClass?: string
  layoutClass?: string
  fieldsClass?: string
  actionsClass?: string
  active?: boolean | null
  activeCount?: number
  mobileTitle?: string
  mobileTriggerLabel?: string
}>(), {
  applyLabel: 'Застосувати',
  clearLabel: 'Очистити',
  showClear: true,
  ariaLabel: 'Фільтри',
  variant: 'surface',
  padding: 'md',
  rootClass: '',
  cardClass: '',
  layoutClass: '',
  fieldsClass: '',
  actionsClass: '',
  active: null,
  activeCount: 0,
  mobileTitle: 'Фільтри',
  mobileTriggerLabel: 'Фільтри',
})

const emit = defineEmits<{
  apply: []
  clear: []
}>()

const attrs = useAttrs()
const generatedId = useId()
const formId = `base-filter-panel-${generatedId}`
const unavailable = computed(() => props.loading || props.disabled)
const mobileOpen = ref(false)
const mobileClosing = ref(false)
const formRef = ref<HTMLFormElement | null>(null)
const triggerRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)
const previousBodyOverflow = ref('')
let desktopMedia: MediaQueryList | null = null
let closeTimer: ReturnType<typeof setTimeout> | null = null
const mobileVisible = computed(() => mobileOpen.value || mobileClosing.value)
const hasActiveFilters = computed(() => props.active ?? props.activeCount > 0)
const mobileStatusLabel = computed(() => {
  if (!hasActiveFilters.value) return 'Не застосовано'
  return props.activeCount > 0 ? `Активні: ${props.activeCount}` : 'Активні'
})
const mobileAccessibleLabel = computed(() =>
  `${props.mobileTriggerLabel}. ${hasActiveFilters.value ? mobileStatusLabel.value : 'Активних фільтрів немає'}`,
)

const focusableSelector = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const focusMobileTrigger = async () => {
  await nextTick()
  const trigger = triggerRef.value instanceof HTMLElement ? triggerRef.value : triggerRef.value?.$el
  trigger?.focus()
}

const finishMobileClose = () => {
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = null
  mobileOpen.value = false
  mobileClosing.value = false
  void focusMobileTrigger()
}

const closeMobilePanel = () => {
  if (!mobileOpen.value) return
  mobileOpen.value = false
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    finishMobileClose()
    return
  }
  mobileClosing.value = true
  closeTimer = setTimeout(finishMobileClose, 240)
}

const openMobilePanel = async () => {
  if (unavailable.value) return
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = null
  mobileClosing.value = false
  mobileOpen.value = true
  await nextTick()
  const initialTarget = formRef.value?.querySelector<HTMLElement>('[autofocus]')
    || formRef.value?.querySelector<HTMLElement>(focusableSelector)
    || formRef.value
  initialTarget?.focus()
}

const handleMobileKeydown = (event: KeyboardEvent) => {
  if (!mobileOpen.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    closeMobilePanel()
    return
  }
  if (event.key !== 'Tab') return

  const focusable = Array.from(formRef.value?.querySelectorAll<HTMLElement>(focusableSelector) || [])
    .filter(element => element.offsetParent !== null)
  if (!focusable.length) {
    event.preventDefault()
    formRef.value?.focus()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  }
  else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}

watch(mobileVisible, isVisible => {
  if (!import.meta.client) return
  if (isVisible) {
    previousBodyOverflow.value = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  else {
    document.body.style.overflow = previousBodyOverflow.value
  }
})

const handleDesktopChange = (event: MediaQueryListEvent) => {
  if (event.matches && mobileVisible.value) finishMobileClose()
}

onMounted(() => {
  desktopMedia = window.matchMedia('(min-width: 768px)')
  desktopMedia.addEventListener('change', handleDesktopChange)
})

onBeforeUnmount(() => {
  if (closeTimer) clearTimeout(closeTimer)
  desktopMedia?.removeEventListener('change', handleDesktopChange)
  if (import.meta.client && mobileVisible.value) {
    document.body.style.overflow = previousBodyOverflow.value
  }
})

const handleSubmit = () => {
  if (unavailable.value) return
  emit('apply')
  closeMobilePanel()
}

const handleClear = () => {
  if (unavailable.value) return
  emit('clear')
  closeMobilePanel()
}
</script>

<template>
  <div class="base-filter-panel__host">
    <BaseButton
      ref="triggerRef"
      type="button"
      variant="neutral"
      class="base-filter-panel__mobile-trigger w-full justify-between md:hidden"
      :class="hasActiveFilters ? 'base-filter-panel__mobile-trigger--active' : ''"
      :disabled="unavailable"
      :aria-label="mobileAccessibleLabel"
      :aria-expanded="mobileOpen"
      :aria-controls="formId"
      data-testid="base-filter-trigger"
      :data-active="hasActiveFilters ? 'true' : 'false'"
      @click="openMobilePanel"
    >
      <span class="flex items-center gap-2">
        <span class="relative">
          <FunnelIcon class="h-5 w-5" aria-hidden="true" />
          <span v-if="hasActiveFilters" class="base-filter-panel__active-dot absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ring-2" aria-hidden="true" />
        </span>
        <span>{{ mobileTriggerLabel }}</span>
      </span>
      <span
        class="base-filter-panel__mobile-status rounded-full px-2.5 py-1 text-xs font-semibold"
        :class="hasActiveFilters ? 'base-filter-panel__mobile-status--active' : 'base-filter-panel__mobile-status--inactive'"
      >
        {{ mobileStatusLabel }}
      </span>
    </BaseButton>

    <Teleport to="body" :disabled="!mobileVisible">
      <div
        class="base-filter-panel__viewport"
        :class="[
          mobileVisible ? 'fixed inset-0 z-[160] flex items-end justify-center' : 'hidden md:block',
          mobileOpen ? 'base-filter-panel__viewport--open' : '',
          mobileClosing ? 'base-filter-panel__viewport--closing' : '',
        ]"
        @keydown="handleMobileKeydown"
      >
        <button
          v-if="mobileVisible"
          type="button"
          class="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
          aria-label="Закрити фільтри"
          @click="closeMobilePanel"
        />

        <form
          ref="formRef"
          :id="formId"
          class="base-filter-panel"
          :class="[
            rootClass,
            mobileVisible ? 'liquid-glass relative z-10 h-[90dvh] max-h-[90dvh] w-full overflow-hidden rounded-t-[1.5rem]' : '',
          ]"
          :aria-label="ariaLabel"
          :aria-busy="loading || undefined"
          :aria-disabled="disabled || undefined"
          :role="mobileVisible ? 'dialog' : undefined"
          :aria-modal="mobileVisible || undefined"
          :tabindex="mobileVisible ? -1 : undefined"
          data-testid="base-filter-panel"
          @submit.prevent="handleSubmit"
        >
          <fieldset
            :disabled="unavailable"
            class="m-0 min-w-0 border-0 p-0"
            :class="mobileVisible ? 'h-full' : ''"
          >
            <BaseCard
              v-bind="attrs"
              :variant="variant"
              :padding="padding"
              class="base-filter-panel__card"
              :class="[cardClass, mobileVisible ? 'base-filter-panel__card--mobile !h-full !overflow-y-auto !overscroll-contain !rounded-b-none' : '']"
            >
              <div v-if="mobileVisible" class="mb-4 flex items-center justify-between gap-3 border-b border-ui pb-3 md:hidden">
                <div>
                  <h2 class="text-lg font-semibold text-ui-primary">{{ mobileTitle }}</h2>
                  <p class="mt-0.5 text-xs text-ui-muted">{{ mobileStatusLabel }}</p>
                </div>
                <BaseButton type="button" variant="icon" aria-label="Закрити фільтри" @click="closeMobilePanel">
                  <XMarkIcon class="h-5 w-5" aria-hidden="true" />
                </BaseButton>
              </div>

              <div
                class="base-filter-panel__layout grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end"
                :class="layoutClass"
              >
                <div
                  class="base-filter-panel__fields grid min-w-0 gap-4 md:grid-cols-2"
                  :class="fieldsClass"
                >
                  <slot :loading="loading" :disabled="unavailable" />
                </div>

                <div
                  class="base-filter-panel__actions flex flex-col gap-3 sm:flex-row sm:flex-wrap xl:justify-end"
                  :class="actionsClass"
                >
                  <slot
                    name="actions"
                    :loading="loading"
                    :disabled="unavailable"
                    :apply="handleSubmit"
                    :clear="handleClear"
                  >
                    <BaseButton
                      type="submit"
                      variant="primary"
                      class="w-full sm:w-auto"
                      :loading="loading"
                      :disabled="disabled"
                      :loading-label="applyLabel"
                    >
                      <FunnelIcon class="h-4 w-4" aria-hidden="true" />
                      <span>{{ applyLabel }}</span>
                    </BaseButton>
                    <BaseButton
                      v-if="showClear"
                      type="button"
                      variant="neutral"
                      class="w-full sm:w-auto"
                      :disabled="unavailable"
                      @click="handleClear"
                    >
                      <XMarkIcon class="h-4 w-4" aria-hidden="true" />
                      <span>{{ clearLabel }}</span>
                    </BaseButton>
                  </slot>
                </div>
              </div>

              <div v-if="$slots.summary" class="base-filter-panel__summary mt-4">
                <slot name="summary" :loading="loading" :disabled="unavailable" />
              </div>

              <div v-if="$slots.after" class="base-filter-panel__after mt-4">
                <slot name="after" :loading="loading" :disabled="unavailable" />
              </div>
            </BaseCard>
          </fieldset>
        </form>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.base-filter-panel__mobile-trigger--active {
  border-color: color-mix(in srgb, var(--bo-success) 68%, var(--bo-border)) !important;
  background: var(--bo-success-surface) !important;
  color: var(--bo-success-text) !important;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--bo-success-text) 16%, transparent),
    0 0 0 4px color-mix(in srgb, var(--bo-success) 10%, transparent) !important;
}

.base-filter-panel__mobile-trigger--active:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--bo-success) 82%, var(--bo-border)) !important;
  background: color-mix(in srgb, var(--bo-success) 20%, var(--bo-control)) !important;
  color: var(--bo-success-text) !important;
}

.base-filter-panel__mobile-status--active {
  background: color-mix(in srgb, var(--bo-success) 18%, transparent);
  color: var(--bo-success-text) !important;
}

.base-filter-panel__mobile-status--inactive {
  background: var(--bo-control);
  color: var(--bo-text-muted) !important;
}

.base-filter-panel__active-dot {
  background: var(--bo-success);
  --tw-ring-color: var(--bo-surface);
}

@keyframes base-filter-backdrop-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes base-filter-backdrop-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes base-filter-panel-in {
  from {
    opacity: 0.7;
    transform: translate3d(0, 100%, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes base-filter-panel-out {
  from {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
  to {
    opacity: 0.7;
    transform: translate3d(0, 100%, 0);
  }
}

@media (max-width: 767px) {
  .base-filter-panel__card--mobile {
    display: flex;
    flex-direction: column;
  }

  .base-filter-panel__card--mobile > .base-filter-panel__layout {
    display: contents;
  }

  .base-filter-panel__card--mobile .base-filter-panel__fields {
    order: 1;
    flex-shrink: 0;
  }

  .base-filter-panel__card--mobile .base-filter-panel__summary {
    order: 2;
  }

  .base-filter-panel__card--mobile .base-filter-panel__after {
    order: 3;
  }

  .base-filter-panel__card--mobile .base-filter-panel__actions {
    order: 4;
    flex-shrink: 0;
    margin-top: auto;
    padding-top: 1.5rem;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  .base-filter-panel__viewport--open > button {
    animation: base-filter-backdrop-in 220ms ease-out both;
  }

  .base-filter-panel__viewport--open > .base-filter-panel {
    animation: base-filter-panel-in 280ms cubic-bezier(0.22, 1, 0.36, 1) both;
    will-change: transform, opacity;
  }

  .base-filter-panel__viewport--closing > button {
    animation: base-filter-backdrop-out 220ms ease-in both;
  }

  .base-filter-panel__viewport--closing > .base-filter-panel {
    animation: base-filter-panel-out 220ms cubic-bezier(0.4, 0, 1, 1) both;
    pointer-events: none;
    will-change: transform, opacity;
  }
}

@media (prefers-reduced-motion: reduce) {
  .base-filter-panel__viewport > button,
  .base-filter-panel__viewport > .base-filter-panel {
    animation: none;
  }
}
</style>
