<script setup lang="ts">
const { terms } = useBlogLocale()
const { openSubscribeModal } = useSubscribeModal()
const route = useRoute()
const isOpen = ref(false)

const closeMenu = () => {
  isOpen.value = false
}

const handleSubscribeClick = () => {
  closeMenu()
  openSubscribeModal()
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
    @click="isOpen = !isOpen"
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
          @click="closeMenu"
        >
          {{ terms.home }}
        </NuxtLink>
        <button
          type="button"
          class="bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-950 transition hover:bg-white/85"
          @click="handleSubscribeClick"
        >
          {{ terms.subscribe }}
        </button>
      </nav>
    </div>
  </Transition>
</template>
