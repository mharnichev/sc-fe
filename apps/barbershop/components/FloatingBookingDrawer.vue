<script setup lang="ts">
const { locale, terms } = useTerms()
const { trackEvent } = useAnalytics()

const isOpen = ref(false)
let previousBodyOverflow = ''

const closeLabel = computed(() => locale.value === 'en' ? 'Close booking' : 'Закрити запис')
const loadingLabel = computed(() => locale.value === 'en' ? 'Loading booking...' : 'Завантажуємо запис...')

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
    class="fixed bottom-4 right-4 z-[75] inline-flex h-14 items-center justify-center gap-3 rounded-full border border-white/20 bg-neutral-950 px-4 text-sm font-semibold uppercase tracking-[0.16em] text-white shadow-[0_18px_45px_rgb(0_0_0_/_0.28)] transition hover:-translate-y-0.5 hover:bg-white hover:text-neutral-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700/70 sm:bottom-6 sm:right-6 sm:h-16 sm:px-5"
    :aria-expanded="isOpen"
    aria-controls="floating-booking-drawer"
    @click="openDrawer"
  >
    <svg class="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 4.5h10a1.5 1.5 0 0 1 1.5 1.5v8.7a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 5 4.5Z" stroke="currentColor" stroke-width="1.6" />
      <path d="M6.5 3.8v2.4M13.5 3.8v2.4M3.8 8.1h12.4M7.2 12.1l1.8 1.8 3.8-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <span class="hidden sm:inline">{{ terms.common.bookAppointment }}</span>
    <span class="sm:hidden">{{ terms.common.book }}</span>
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
  .booking-drawer-overlay-enter-active,
  .booking-drawer-overlay-leave-active,
  .booking-drawer-panel-enter-active,
  .booking-drawer-panel-leave-active {
    transition: none;
  }
}
</style>
