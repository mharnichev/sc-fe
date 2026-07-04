<script setup lang="ts">
const { terms } = useBlogLocale()
const { openSubscribeModal } = useSubscribeModal()
const { trackBlogEvent } = useBlogAnalytics()
const route = useRoute()
const isOpen = ref(false)

const closeMenu = () => {
  isOpen.value = false
}

const toggleMenu = () => {
  isOpen.value = !isOpen.value
  trackBlogEvent(isOpen.value ? 'post_menu_open' : 'post_menu_close')
}

const handleHomeClick = () => {
  trackBlogEvent('navigation_click', {
    destination: 'blog_home',
    source: 'post_menu',
  })
  closeMenu()
}

const handleBarbershopClick = () => {
  trackBlogEvent('navigation_click', {
    destination: 'barbershop',
    source: 'post_menu',
  })
  closeMenu()
}

const handleBookingClick = () => {
  trackBlogEvent('navigation_click', {
    destination: 'barbershop_booking',
    source: 'post_menu',
  })
  closeMenu()
}

const handleSubscribeClick = () => {
  closeMenu()
  openSubscribeModal('', 'post_menu')
}

watch(() => route.fullPath, closeMenu)

watch(isOpen, (isMenuOpen) => {
  if (!import.meta.client) {
    return
  }

  document.documentElement.style.overflow = isMenuOpen ? 'hidden' : ''
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    document.documentElement.style.overflow = ''
  }
})
</script>

<template>
  <button
    type="button"
    class="fixed right-4 top-4 z-[70] flex h-12 w-12 items-center justify-center text-white transition hover:text-white/65 sm:right-6 sm:top-6"
    :aria-expanded="isOpen"
    aria-controls="post-menu-overlay"
    :aria-label="terms.menuOpen"
    @click="toggleMenu"
  >
    <span class="relative h-6 w-8" aria-hidden="true">
      <span
        class="absolute left-0 top-0 h-1 w-8 bg-current transition-transform duration-300"
        :class="isOpen ? 'translate-y-2.5 rotate-45' : ''"
      />
      <span
        class="absolute left-0 top-2.5 h-1 w-8 bg-current transition-opacity duration-300"
        :class="isOpen ? 'opacity-0' : 'opacity-100'"
      />
      <span
        class="absolute left-0 top-5 h-1 w-8 bg-current transition-transform duration-300"
        :class="isOpen ? '-translate-y-2.5 -rotate-45' : ''"
      />
    </span>
  </button>

  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isOpen"
      id="post-menu-overlay"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 px-6 text-center backdrop-blur"
    >
      <nav class="flex flex-col items-center gap-7" :aria-label="terms.postMenu">
        <NuxtLink
          to="/"
          class="text-4xl font-black uppercase leading-none tracking-[0.08em] text-white transition hover:text-white/70 sm:text-6xl"
          @click="handleHomeClick"
        >
          {{ terms.home }}
        </NuxtLink>
        <a
          href="/"
          class="text-4xl font-black uppercase leading-none tracking-[0.08em] text-white transition hover:text-white/70 sm:text-6xl"
          @click="handleBarbershopClick"
        >
          {{ terms.barbershopHome }}
        </a>
        <a
          href="/#booking-stepper"
          class="max-w-5xl break-words text-3xl font-black uppercase leading-[0.98] tracking-[0.04em] text-white transition hover:text-white/70 sm:text-5xl sm:tracking-[0.08em] lg:text-6xl"
          @click="handleBookingClick"
        >
          {{ terms.postMenuBookingCta }}
        </a>
        <div class="flex max-w-sm flex-col items-center gap-3 pt-2 text-white/75">
          <p class="text-sm font-medium leading-6 tracking-normal sm:text-base">
            {{ terms.postMenuSubscribeText }}
          </p>
          <BaseButton
            type="button"
            variant="light"
            size="sm"
            @click="handleSubscribeClick"
          >
            {{ terms.subscribe }}
          </BaseButton>
        </div>
      </nav>
    </div>
  </Transition>
</template>
