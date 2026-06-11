<script setup lang="ts">
import { CheckCircleIcon } from '@heroicons/vue/24/solid'
import { Toaster } from 'vue-sonner'
import type { ToasterProps } from 'vue-sonner'
import 'vue-sonner/style.css'

const { theme } = useBackofficeTheme()

const toastOptions: ToasterProps['toastOptions'] = {
  classes: {
    toast: 'backoffice-toast',
    title: 'backoffice-toast-title',
    icon: 'backoffice-toast-icon',
    success: 'backoffice-toast-success',
    closeButton: 'backoffice-toast-close',
  },
}
</script>

<template>
  <Toaster
    :theme="theme"
    position="top-right"
    rich-colors
    close-button
    :duration="3600"
    :visible-toasts="4"
    :toast-options="toastOptions"
    container-aria-label="Сповіщення"
  >
    <template #success-icon>
      <CheckCircleIcon class="h-5 w-5" aria-hidden="true" />
    </template>
  </Toaster>
</template>

<style>
.backoffice-toast {
  min-height: 3.125rem;
  border-radius: 1rem !important;
  border: 1px solid rgba(255, 255, 255, 0.16) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    0 18px 48px rgba(0, 0, 0, 0.28) !important;
  font-family: inherit !important;
}

.backoffice-toast-title {
  font-size: 0.875rem !important;
  font-weight: 700 !important;
  line-height: 1.35 !important;
}

.backoffice-toast-icon {
  color: currentColor !important;
}

.backoffice-toast-success {
  border-color: rgba(74, 222, 128, 0.52) !important;
  background:
    linear-gradient(135deg, rgba(34, 197, 94, 0.96), rgba(21, 128, 61, 0.96)),
    #15803d !important;
  color: #ffffff !important;
}

.backoffice-toast-close {
  border-color: rgba(255, 255, 255, 0.24) !important;
  background: rgba(255, 255, 255, 0.16) !important;
  color: #ffffff !important;
}

.backoffice-toast-close:hover {
  background: rgba(255, 255, 255, 0.24) !important;
  color: #ffffff !important;
}
</style>
