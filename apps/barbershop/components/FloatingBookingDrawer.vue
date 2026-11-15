<script setup lang="ts">
import myAppointmentsCalendarImage from '~/assets/images/customer-activity/my-appointments-calendar.webp'
import bookEngImage from '~/assets/images/booking/booking-en.webp'
import bookUaImage from '~/assets/images/booking/booking-ua.webp'
import { isDobrodeskEnabled, isDobrodeskPublicRoute } from '~/utils/dobrodesk'
import { ChatBubbleBottomCenterTextIcon } from '@heroicons/vue/24/outline'
import { acquireBodyScrollLock, releaseBodyScrollLock } from '~/utils/bodyScrollLock'

const supportRoute = useRoute()
const supportConfig = useRuntimeConfig()
const { isPrivateReviewRoute } = useReviewPrivacy()
const supportOpenRequest = useState('dobrodesk-open-request', () => 0)
const supportModalOpen = useState('dobrodesk-mobile-modal-open', () => false)
const supportContainer = ref<HTMLElement | null>(null)
const { $supportModal } = useNuxtApp()
const supportTitle = computed(() => locale.value === 'en' ? 'Support' : 'Підтримка')
watch(supportContainer, container => $supportModal.setContainer(container), { flush: 'post' })
const showSupport = computed(() => isDobrodeskEnabled(supportConfig.public.dobrodeskEnabled)
  && !!supportConfig.public.dobrodeskIntegrationId
  && isDobrodeskPublicRoute(supportRoute, supportConfig.app.baseURL)
  && !isPrivateReviewRoute.value)
const { locale, terms } = useTerms()
const { trackEvent } = useAnalytics()
const {
  isOpen,
  open: openBookingDrawer,
  close: closeBookingDrawer,
} = useFloatingBookingDrawer()

const isCustomerActivityOpen = ref(false)
const isTriggerOverBooking = ref(false)
const actionsContainer = ref<HTMLDivElement | null>(null)
const phoneBar = ref<HTMLElement | null>(null)
const isBarCompact = ref(false)
const isBarOnDark = ref(false)
let lastScrollY = 0
let bodyScrollLock: symbol | null = null
let triggerPositionFrame = 0
let phoneViewport: MediaQueryList
let pageResizeObserver: ResizeObserver

const closeLabel = computed(() => locale.value === 'en' ? 'Close booking' : 'Закрити запис')
const loadingLabel = computed(() => locale.value === 'en' ? 'Loading booking...' : 'Завантажуємо запис...')
const triggerImage = computed(() => locale.value === 'en' ? bookEngImage : bookUaImage)
const triggerImageAlt = computed(() => locale.value === 'en' ? 'Book appointment' : 'Записатися')
const supportLabel = computed(() => locale.value === 'en' ? 'Open support chat' : 'Відкрити чат підтримки')
const appointmentsLabel = computed(() => locale.value === 'en' ? 'My appointments' : 'Мої записи')

const rectsIntersect = (first: DOMRect, second: DOMRect) =>
  first.left < second.right
  && first.right > second.left
  && first.top < second.bottom
  && first.bottom > second.top

const updateTriggerPosition = () => {
  if (!import.meta.client) return

  const bookingSection = document.getElementById('booking')
  const trigger = actionsContainer.value

  if (phoneViewport.matches) {
    const scrollY = window.scrollY
    if (scrollY <= 120 || Math.abs(scrollY - lastScrollY) >= 6) {
      isBarCompact.value = scrollY > 120 && scrollY > lastScrollY
      lastScrollY = scrollY
    }

    const booking = bookingSection?.getBoundingClientRect()
    isTriggerOverBooking.value = !!booking && booking.top < window.innerHeight && booking.bottom > 0
    const bar = phoneBar.value
    if (bar && !isTriggerOverBooking.value && !isOpen.value && !isCustomerActivityOpen.value) {
      const x = bar.offsetLeft + bar.offsetWidth / 2
      const y = bar.offsetTop + bar.offsetHeight / 2
      const section = document.elementsFromPoint(x, y)
        .map(element => element.closest<HTMLElement>('[data-header-theme]'))
        .find(Boolean)
      isBarOnDark.value = section?.dataset.headerTheme === 'dark'
    }
    return
  }

  if (!bookingSection || !trigger || isOpen.value) {
    isTriggerOverBooking.value = false
    return
  }

  isTriggerOverBooking.value = rectsIntersect(
    trigger.getBoundingClientRect(),
    bookingSection.getBoundingClientRect(),
  )
}

const scheduleTriggerPositionUpdate = () => {
  if (!import.meta.client || triggerPositionFrame) return

  triggerPositionFrame = window.requestAnimationFrame(() => {
    triggerPositionFrame = 0
    updateTriggerPosition()
  })
}

const openDrawer = () => {
  if (isOpen.value) return

  openBookingDrawer()
  trackEvent('booking_cta_click', {
    source: 'floating_button',
  })
}

const closeDrawer = () => {
  closeBookingDrawer()
}

const openCustomerActivity = () => {
  isCustomerActivityOpen.value = true
}

const closeCustomerActivity = () => {
  isCustomerActivityOpen.value = false
  nextTick(scheduleTriggerPositionUpdate)
}

const updateOverlayCloseCursor = (event: PointerEvent) => {
  const overlay = event.currentTarget
  if (!(overlay instanceof HTMLElement)) return

  overlay.style.setProperty('--overlay-close-cursor-x', `${event.clientX}px`)
  overlay.style.setProperty('--overlay-close-cursor-y', `${event.clientY}px`)
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeDrawer()
  }
}

watch(isOpen, (open) => {
  if (!import.meta.client) return

  if (open) {
    bodyScrollLock ??= acquireBodyScrollLock()
    if (!phoneViewport.matches) isTriggerOverBooking.value = false
    return
  }

  releaseBodyScrollLock(bodyScrollLock)
  bodyScrollLock = null
  nextTick(scheduleTriggerPositionUpdate)
})

onMounted(() => {
  phoneViewport = window.matchMedia('(width < 576px)')
  pageResizeObserver = new ResizeObserver(scheduleTriggerPositionUpdate)
  const main = document.querySelector('main')
  if (main) pageResizeObserver.observe(main)
  lastScrollY = window.scrollY
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('scroll', scheduleTriggerPositionUpdate, { passive: true })
  window.addEventListener('resize', scheduleTriggerPositionUpdate)
  nextTick(scheduleTriggerPositionUpdate)
})

watch(() => supportRoute.fullPath, () => nextTick(scheduleTriggerPositionUpdate))

onBeforeUnmount(() => {
  supportModalOpen.value = false
  if (supportContainer.value) $supportModal.setContainer(null)
  pageResizeObserver.disconnect()
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('scroll', scheduleTriggerPositionUpdate)
  window.removeEventListener('resize', scheduleTriggerPositionUpdate)

  if (triggerPositionFrame) {
    window.cancelAnimationFrame(triggerPositionFrame)
  }

  if (import.meta.client) {
    releaseBodyScrollLock(bodyScrollLock)
    bodyScrollLock = null
  }
})
</script>

<template>
  <div
    ref="actionsContainer"
    v-show="!isOpen && !isCustomerActivityOpen"
    class="floating-booking-actions fixed bottom-4 right-4 z-[75] flex flex-col items-center gap-2 sm:bottom-6 sm:right-6"
    :class="{ 'floating-booking-actions--over-booking': isTriggerOverBooking }"
    :inert="isTriggerOverBooking"
  >
    <button
      v-if="showSupport"
      type="button"
      class="floating-desktop-action inline-flex h-14 w-14 items-center justify-center rounded-full border border-neutral-700 bg-[#ffca2b] text-neutral-950 shadow-lg transition-colors hover:bg-[#ffda68] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
      :aria-label="supportLabel"
      @click="supportOpenRequest++"
    >
      <ChatBubbleBottomCenterTextIcon class="h-7 w-7" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="my-appointments-button floating-desktop-action group relative inline-flex h-14 w-14 items-center justify-center text-white outline-none focus-visible:ring-2 focus-visible:ring-[#ffca2b] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      aria-label="Мої записи"
      @click="openCustomerActivity"
    >
      <span class="my-appointments-label pointer-events-none absolute right-full mr-2 hidden whitespace-nowrap rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-md md:block md:group-hover:opacity-100 md:group-focus-visible:opacity-100">
        Мої записи
      </span>
      <img
        :src="myAppointmentsCalendarImage"
        alt=""
        class="object-contain drop-shadow-[0_6px_8px_rgb(0_0_0/0.24)]"
        aria-hidden="true"
      >
    </button>

    <button
      type="button"
      class="booking-trigger-button inline-flex h-[96px] w-[96px] items-center justify-center overflow-hidden rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700/70"
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
  </div>

  <div
    v-show="!isOpen && !isCustomerActivityOpen"
    ref="phoneBar"
    class="phone-action-bar"
    :class="{
      'phone-action-bar--compact': isBarCompact,
      'phone-action-bar--on-dark': isBarOnDark,
      'phone-action-bar--over-booking': isTriggerOverBooking,
    }"
    :inert="isTriggerOverBooking"
    role="group"
    :aria-label="locale === 'en' ? 'Quick actions' : 'Швидкі дії'"
  >
    <button v-if="showSupport" type="button" aria-haspopup="dialog" @click="supportModalOpen = true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
        <path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
        <path d="M7 9h10M7 13h7" />
      </svg>
      <span>{{ supportTitle }}</span>
    </button>
    <button type="button" @click="openCustomerActivity">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4m10-4v4M3 10h18m-12 5 2 2 4-4" />
      </svg>
      <span>{{ appointmentsLabel }}</span>
    </button>
  </div>

  <BaseModal
    v-model="supportModalOpen"
    :dialog-label="supportTitle"
    :close-label="locale === 'en' ? 'Close support' : 'Закрити підтримку'"
  >
    <template #header>
      <h2 class="py-1 text-lg font-semibold">{{ supportTitle }}</h2>
    </template>

    <div class="relative h-full bg-neutral-950 text-white">
      <div ref="supportContainer" class="support-chat-frame absolute inset-0" />
      <p v-if="$supportModal.status.value !== 'ready'" class="relative p-4 text-sm" role="status">
        <template v-if="$supportModal.status.value === 'error'">
          {{ locale === 'en' ? 'Chat is temporarily unavailable.' : 'Чат тимчасово недоступний.' }}
        </template>
        <template v-else>
          {{ locale === 'en' ? 'Loading chat…' : 'Завантажуємо чат…' }}
        </template>
      </p>
    </div>
  </BaseModal>

  <CustomerActivityModal
    v-if="isCustomerActivityOpen"
    @closed="closeCustomerActivity"
  />

  <Transition name="booking-drawer-overlay">
    <div
      v-if="isOpen"
      class="booking-drawer-overlay fixed inset-0 z-[90] bg-neutral-950/72 backdrop-blur-sm"
      aria-hidden="true"
      @click="closeDrawer"
      @pointermove="updateOverlayCloseCursor"
    />
  </Transition>

  <Transition name="booking-drawer-panel">
    <aside
      v-if="isOpen"
      id="floating-booking-drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="floating-booking-drawer-title"
      class="fixed inset-x-0 bottom-0 z-[100] flex h-[calc(100svh-60px)] max-h-[calc(100svh-60px)] flex-col rounded-t-lg bg-neutral-950 text-white md:inset-y-0 md:left-auto md:right-0 md:h-full md:max-h-none md:w-[min(45rem,92vw)] md:rounded-none"
    >
      <div class="flex shrink-0 items-start justify-between gap-3 px-3 py-2.5 sm:px-4 sm:py-3 md:px-5">
        <div>
          <p class="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/45 sm:text-xs sm:tracking-[0.22em]">{{ terms.home.booking.label }}</p>
          <h2 id="floating-booking-drawer-title" class="mt-0.5 text-xl font-semibold leading-tight text-white sm:mt-1 sm:text-2xl md:text-3xl">
            {{ terms.common.bookAppointment }}
          </h2>
        </div>
        <BaseButton
          type="button"
          class="modal-close-button shrink-0"
          variant="light"
          shape="circle"
          size="xs"
          :aria-label="closeLabel"
          @click="closeDrawer"
        >
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="m5.5 5.5 9 9M14.5 5.5l-9 9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
          </svg>
        </BaseButton>
      </div>

      <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Suspense>
          <LazyBookingSection
            analytics-source="floating_booking"
            id-prefix="floating-booking"
            :listen-for-external-select="false"
            mode="drawer"
          />
          <template #fallback>
            <div class="bg-white/[0.03] p-6 text-sm text-white/60">
              {{ loadingLabel }}
            </div>
          </template>
        </Suspense>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.floating-booking-actions {
  transition: opacity 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.floating-booking-actions--over-booking {
  /* Keep geometry stable for overlap detection while clearing clicks and focus. */
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.phone-action-bar {
  display: none;
}

.support-chat-frame {
  bottom: env(safe-area-inset-bottom);
}

.support-chat-frame :deep(iframe) {
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
  border-radius: 0 !important;
}

@media (width < 576px) {
  .floating-booking-actions .floating-desktop-action {
    display: none;
  }

  .phone-action-bar {
    position: fixed;
    left: 8px;
    right: 8px;
    bottom: calc(8px + env(safe-area-inset-bottom));
    z-index: 81;
    display: flex;
    height: 44px;
    overflow: hidden;
    border: 1px solid rgb(255 255 255 / 0.5);
    border-radius: 4px;
    background: linear-gradient(160deg, rgb(255 255 255 / 0.88), rgb(245 245 245 / 0.76));
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.65), 0 2px 12px rgb(0 0 0 / 0.1);
    -webkit-backdrop-filter: blur(18px) saturate(1.3);
    backdrop-filter: blur(18px) saturate(1.3);
    color: #0a0a0a;
    transform: scale(1);
    transform-origin: center bottom;
    transition: transform 600ms cubic-bezier(0.3, 1, 0.3, 1), visibility 0s;
  }

  .phone-action-bar--compact {
    transform: scale(0.9);
  }

  .phone-action-bar--on-dark {
    border-color: rgb(255 255 255 / 0.22);
    background: linear-gradient(160deg, rgb(45 45 45 / 0.88), rgb(20 20 20 / 0.8));
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.18), 0 2px 12px rgb(0 0 0 / 0.22);
    color: #fff;
  }

  .phone-action-bar button {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 0.75rem;
    font-weight: 700;
    transition: background-color 180ms ease;
  }

  .phone-action-bar button:is(:hover, :focus-visible) {
    background: rgb(10 10 10 / 0.05);
  }

  .phone-action-bar--on-dark button:is(:hover, :focus-visible) {
    background: rgb(255 255 255 / 0.12);
  }

  .phone-action-bar button:focus-visible {
    outline: 1px solid currentColor;
    outline-offset: -3px;
  }

  .phone-action-bar svg {
    width: 20px;
    height: 20px;
  }

  .floating-booking-actions {
    right: -48px;
    bottom: calc(64px + env(safe-area-inset-bottom));
    transition: transform 600ms cubic-bezier(0.3, 1, 0.3, 1), visibility 0s;
  }

  .phone-action-bar--over-booking,
  .floating-booking-actions--over-booking {
    transform: translateY(calc(100% + 80px + env(safe-area-inset-bottom)));
    visibility: hidden;
    pointer-events: none;
    transition-delay: 0s, 600ms;
  }

  .floating-booking-actions--over-booking {
    opacity: 1;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .phone-action-bar {
    background: #f5f5f5;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }

  .phone-action-bar--on-dark {
    background: #202020;
  }
}

.my-appointments-button {
  transition: transform 180ms ease;
}

.my-appointments-button:hover {
  transform: translateY(-1px);
}

.my-appointments-label {
  transition: opacity 160ms ease;
}

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

.booking-drawer-overlay {
  cursor: pointer;
}

.modal-close-button {
  border: 0;
  box-shadow: none;
}

@media (pointer: fine) {
  .booking-drawer-overlay {
    cursor: none;
  }

  .booking-drawer-overlay::after {
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

  .booking-drawer-overlay:hover::after {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
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
  .phone-action-bar,
  .floating-booking-actions,
  .my-appointments-button,
  .my-appointments-label,
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
