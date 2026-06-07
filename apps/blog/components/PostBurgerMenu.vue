<script setup lang="ts">
const { terms } = useBlogLocale()
const route = useRoute()
const isOpen = ref(false)

const closeMenu = () => {
  isOpen.value = false
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
    class="fixed right-4 top-4 z-[70] flex h-12 w-12 items-center justify-center border border-white/15 bg-black/70 text-white backdrop-blur transition hover:border-red-400 hover:text-red-200 sm:right-6 sm:top-6"
    :aria-expanded="isOpen"
    aria-controls="post-menu-overlay"
    aria-label="Open post menu"
    @click="isOpen = !isOpen"
  >
    <span class="relative h-5 w-6" aria-hidden="true">
      <span
        class="absolute left-0 top-0 h-0.5 w-6 bg-current transition-transform duration-300"
        :class="isOpen ? 'translate-y-2 rotate-45' : ''"
      />
      <span
        class="absolute left-0 top-2 h-0.5 w-6 bg-current transition-opacity duration-300"
        :class="isOpen ? 'opacity-0' : 'opacity-100'"
      />
      <span
        class="absolute left-0 top-4 h-0.5 w-6 bg-current transition-transform duration-300"
        :class="isOpen ? '-translate-y-2 -rotate-45' : ''"
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
      <nav class="flex flex-col items-center gap-7" aria-label="Post menu">
        <NuxtLink
          to="/"
          class="text-4xl font-black uppercase leading-none tracking-[0.08em] text-white transition hover:text-red-300 sm:text-6xl"
          @click="closeMenu"
        >
          Home
        </NuxtLink>
        <a
          href="#newsletter"
          class="border border-red-500 bg-red-500 px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white transition hover:border-red-600 hover:bg-red-600"
          @click="closeMenu"
        >
          {{ terms.subscribe }}
        </a>
      </nav>
    </div>
  </Transition>
</template>
