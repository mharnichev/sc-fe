<script setup lang="ts">
import { CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon } from '@heroicons/vue/24/solid'
import { Toaster } from 'vue-sonner'
import type { ToasterProps } from 'vue-sonner'
import 'vue-sonner/style.css'

const { theme } = useBackofficeTheme()
const isDesktop = ref(false)

const updateViewport = () => {
  if (!import.meta.client) return
  isDesktop.value = window.matchMedia('(min-width: 768px)').matches
}

onMounted(() => {
  updateViewport()
  window.addEventListener('resize', updateViewport, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewport)
})

const toastPosition = computed<ToasterProps['position']>(() =>
  isDesktop.value ? 'top-right' : 'top-center',
)

const toastOptions: ToasterProps['toastOptions'] = {
  classes: {
    toast: 'backoffice-toast',
    title: 'backoffice-toast-title',
    content: 'backoffice-toast-content',
    icon: 'backoffice-toast-icon',
    success: 'backoffice-toast-success',
    warning: 'backoffice-toast-warning',
    error: 'backoffice-toast-error',
    closeButton: 'backoffice-toast-close',
  },
  closeButtonAriaLabel: 'Закрити сповіщення',
  closeButtonPosition: 'top-right',
}
</script>

<template>
  <Toaster
    class="backoffice-toaster"
    :theme="theme"
    :position="toastPosition"
    close-button
    :duration="5000"
    :visible-toasts="4"
    :toast-options="toastOptions"
    :mobile-offset="{ top: '0.75rem', right: '0.75rem', left: '0.75rem' }"
    :offset="{ top: '1rem', right: '1rem' }"
    container-aria-label="Сповіщення"
  >
    <template #success-icon>
      <CheckCircleIcon class="h-5 w-5" aria-hidden="true" />
    </template>
    <template #warning-icon>
      <ExclamationTriangleIcon class="h-5 w-5" aria-hidden="true" />
    </template>
    <template #error-icon>
      <XCircleIcon class="h-5 w-5" aria-hidden="true" />
    </template>
  </Toaster>
</template>

<style>
.backoffice-toaster {
  z-index: 9999;
}

.backoffice-toast {
  min-height: 3.125rem;
  border-radius: 1rem !important;
  border: 1px solid var(--backoffice-toast-border, rgba(255, 255, 255, 0.16)) !important;
  border-left-width: 0.35rem !important;
  border-left-color: var(--backoffice-toast-accent, rgba(255, 255, 255, 0.64)) !important;
  background: var(--backoffice-toast-bg, rgba(18, 18, 18, 0.96)) !important;
  color: var(--backoffice-toast-text, #ffffff) !important;
  padding-right: 2.75rem !important;
  box-shadow:
    inset 0 1px 0 var(--backoffice-toast-highlight, rgba(255, 255, 255, 0.18)),
    0 18px 48px var(--backoffice-toast-shadow, rgba(0, 0, 0, 0.28)) !important;
  font-family: inherit !important;
}

.backoffice-toast-content {
  min-width: 0;
}

.backoffice-toast-title {
  font-size: 0.875rem !important;
  font-weight: 700 !important;
  line-height: 1.35 !important;
  color: inherit !important;
}

.backoffice-toast-icon {
  color: var(--backoffice-toast-icon, currentColor) !important;
}

.backoffice-toast-success {
  --backoffice-toast-accent: #34d399;
  --backoffice-toast-bg: linear-gradient(135deg, rgba(20, 83, 45, 0.98), rgba(22, 101, 52, 0.98));
  --backoffice-toast-border: rgba(74, 222, 128, 0.44);
  --backoffice-toast-icon: #bbf7d0;
}

.backoffice-toast-warning {
  --backoffice-toast-accent: #facc15;
  --backoffice-toast-bg: linear-gradient(135deg, rgba(113, 63, 18, 0.98), rgba(146, 64, 14, 0.98));
  --backoffice-toast-border: rgba(250, 204, 21, 0.48);
  --backoffice-toast-icon: #fef08a;
}

.backoffice-toast-error {
  --backoffice-toast-accent: #fb7185;
  --backoffice-toast-bg: linear-gradient(135deg, rgba(127, 29, 29, 0.98), rgba(159, 18, 57, 0.98));
  --backoffice-toast-border: rgba(251, 113, 133, 0.48);
  --backoffice-toast-icon: #fecdd3;
}

.backoffice-toast-close {
  left: auto !important;
  right: 0.75rem !important;
  top: 0.75rem !important;
  transform: none !important;
  border-color: var(--backoffice-toast-close-border, rgba(255, 255, 255, 0.24)) !important;
  background: var(--backoffice-toast-close-bg, rgba(255, 255, 255, 0.16)) !important;
  color: var(--backoffice-toast-close-text, #ffffff) !important;
}

.backoffice-toast-close:hover {
  background: var(--backoffice-toast-close-hover-bg, rgba(255, 255, 255, 0.24)) !important;
  color: var(--backoffice-toast-close-text, #ffffff) !important;
}

html[data-backoffice-theme="light"] .backoffice-toast {
  --backoffice-toast-text: #0f172a;
  --backoffice-toast-highlight: rgba(255, 255, 255, 0.9);
  --backoffice-toast-shadow: rgba(15, 23, 42, 0.16);
  --backoffice-toast-close-border: rgba(15, 23, 42, 0.12);
  --backoffice-toast-close-bg: rgba(15, 23, 42, 0.06);
  --backoffice-toast-close-hover-bg: rgba(15, 23, 42, 0.10);
  --backoffice-toast-close-text: #0f172a;
}

html[data-backoffice-theme="light"] .backoffice-toast-success {
  --backoffice-toast-bg: #ecfdf5;
  --backoffice-toast-border: rgba(5, 150, 105, 0.28);
  --backoffice-toast-icon: #047857;
}

html[data-backoffice-theme="light"] .backoffice-toast-warning {
  --backoffice-toast-bg: #fffbeb;
  --backoffice-toast-border: rgba(217, 119, 6, 0.30);
  --backoffice-toast-icon: #b45309;
}

html[data-backoffice-theme="light"] .backoffice-toast-error {
  --backoffice-toast-bg: #fff1f2;
  --backoffice-toast-border: rgba(225, 29, 72, 0.30);
  --backoffice-toast-icon: #be123c;
}

@media (max-width: 767px) {
  .backoffice-toaster[data-sonner-toaster] {
    --width: calc(100vw - 1.5rem) !important;
  }

  .backoffice-toast {
    width: calc(100vw - 1.5rem) !important;
  }
}
</style>
