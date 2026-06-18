<script setup lang="ts">
import bookEngImage from '~/assets/images/booking/booking-en.webp'
import bookUaImage from '~/assets/images/booking/booking-ua.webp'

const { locale, terms } = useTerms()
const { trackEvent } = useAnalytics()

const isOpen = ref(false)
let previousBodyOverflow = ''

const closeLabel = computed(() => locale.value === 'en' ? 'Close booking' : 'Закрити запис')
const loadingLabel = computed(() => locale.value === 'en' ? 'Loading booking...' : 'Завантажуємо запис...')
const triggerImage = computed(() => locale.value === 'en' ? bookEngImage : bookUaImage)
const triggerImageAlt = computed(() => locale.value === 'en' ? 'Book appointment' : 'Записатися')

const openDrawer = () => {
  if (isOpen.value) return

  isOpen.value = true
  trackEvent('booking_start', {
    source: 'floating_button',
  })
}

const closeDrawer = () => {
  isOpen.value = false
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeDrawer()
  }
}

watch(isOpen, (open) => {
  if (!import.meta.client) return

  if (open) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return
  }

  document.body.style.overflow = previousBodyOverflow
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)

  if (import.meta.client) {
    document.body.style.overflow = previousBodyOverflow
  }
})
</script>

<template>
  <button
    v-show="!isOpen"
    type="button"
    class="booking-trigger-button fixed bottom-4 right-4 z-[75] inline-flex h-[96px] w-[96px] items-center justify-center overflow-hidden rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700/70 sm:bottom-6 sm:right-6"
    :aria-expanded="isOpen"
    aria-controls="floating-booking-drawer"
    :aria-label="triggerImageAlt"
    @click="openDrawer"
  >
    <img
      :src="triggerImage"
      :alt="triggerImageAlt"
      class="booking-trigger-image h-[84px] w-[84px] object-contain"
      draggable="false"
    >
  </button>

  <Transition name="booking-drawer-overlay">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[90] bg-neutral-950/72 backdrop-blur-sm"
      aria-hidden="true"
      @click="closeDrawer"
    />
  </Transition>

  <Transition name="booking-drawer-panel">
    <aside
      v-if="isOpen"
      id="floating-booking-drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="floating-booking-drawer-title"
      class="fixed inset-x-0 bottom-0 z-[100] flex h-[88svh] max-h-[88svh] flex-col rounded-t-lg border border-white/15 bg-neutral-950 text-white shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:h-full md:max-h-none md:w-[min(45rem,92vw)] md:rounded-none md:border-y-0 md:border-r-0"
    >
      <div class="flex shrink-0 items-start justify-between gap-4 border-b border-white/15 px-4 py-4 sm:px-5 md:px-6">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">{{ terms.home.booking.label }}</p>
          <h2 id="floating-booking-drawer-title" class="mt-1 text-2xl font-semibold leading-tight text-white sm:text-3xl">
            {{ terms.common.bookAppointment }}
          </h2>
        </div>
        <button
          type="button"
          class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:border-white/45 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          :aria-label="closeLabel"
          @click="closeDrawer"
        >
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="m5.5 5.5 9 9M14.5 5.5l-9 9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <div class="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-5 md:p-6">
        <Suspense>
          <BookingSection
            analytics-source="floating_booking"
            id-prefix="floating-booking"
            :listen-for-external-select="false"
            mode="drawer"
          />
          <template #fallback>
            <div class="border border-white/15 bg-white/[0.03] p-6 text-sm text-white/60">
              {{ loadingLabel }}
            </div>
          </template>
        </Suspense>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.booking-trigger-button {
  border: 6px solid rgb(255 202 43 / 0.32);

  background:
    linear-gradient(135deg, rgb(255 255 255 / 0.26), rgb(255 255 255 / 0.08)),
    rgb(16 16 16 / 0.34);
  backdrop-filter: blur(14px) saturate(1.35);
  -webkit-backdrop-filter: blur(14px) saturate(1.35);
  filter: drop-shadow(0 18px 28px rgb(0 0 0 / 0.28));
  transition:
    border-color 180ms ease,
    filter 180ms ease,
    transform 180ms ease;
}

.booking-trigger-button:hover {
  border-color: rgb(255 255 255 / 0.58);
  filter: drop-shadow(0 20px 34px rgb(0 0 0 / 0.34));
  transform: scale(1.1);
}

.booking-trigger-image {
  animation: booking-trigger-spin 13s linear infinite;
  transform-origin: center;
}

@keyframes booking-trigger-spin {
  to {
    transform: rotate(360deg);
  }
}

.booking-drawer-overlay-enter-active,
.booking-drawer-overlay-leave-active {
  transition: opacity 220ms ease;
}

.booking-drawer-overlay-enter-from,
.booking-drawer-overlay-leave-to {
  opacity: 0;
}

.booking-drawer-panel-enter-active,
.booking-drawer-panel-leave-active {
  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.booking-drawer-panel-enter-from,
.booking-drawer-panel-leave-to {
  transform: translateY(100%);
}

@media (min-width: 768px) {
  .booking-drawer-panel-enter-from,
  .booking-drawer-panel-leave-to {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .booking-trigger-button {
    transition: none;
  }

  .booking-trigger-image {
    animation: none;
  }

  .booking-drawer-overlay-enter-active,
  .booking-drawer-overlay-leave-active,
  .booking-drawer-panel-enter-active,
  .booking-drawer-panel-leave-active {
    transition: none;
  }
}
</style>
