<script setup lang="ts">
type HeaderTheme = 'dark' | 'light'

const headerElement = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const headerTheme = ref<HeaderTheme>('dark')
const { locale, localeOptions, setLocale, terms } = useTerms()
const route = useRoute()

const menuItems = computed(() => terms.value.nav)
const menuButtonClass = computed(() =>
  headerTheme.value === 'dark'
    ? 'text-white hover:text-white/70'
    : 'text-neutral-950 hover:text-neutral-950/65',
)
const menuLinkClass = computed(() =>
  headerTheme.value === 'dark'
    ? 'text-white/60 hover:text-white/85'
    : 'text-neutral-950/45 hover:text-neutral-950/80',
)

const isDesktopViewport = () => import.meta.client && window.matchMedia('(min-width: 1024px)').matches

const openDesktopMenu = () => {
  if (isDesktopViewport()) {
    isOpen.value = true
  }
}

const closeDesktopMenu = () => {
  if (isDesktopViewport()) {
    isOpen.value = false
  }
}

const toggleMobileMenu = () => {
  if (isDesktopViewport()) {
    return
  }

  isOpen.value = !isOpen.value
}

const closeMenu = () => {
  isOpen.value = false
}

const waitForTarget = async (hash: string) => {
  const targetId = hash.replace(/^#/, '')

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const target = document.getElementById(targetId)
    if (target) return target

    await new Promise(resolve => window.setTimeout(resolve, 50))
  }

  return null
}

const scrollToHash = async (hash: string) => {
  if (!import.meta.client || !hash) return

  closeMenu()
  await nextTick()
  await new Promise(resolve => window.requestAnimationFrame(resolve))

  const target = await waitForTarget(hash)
  if (!target) return

  const top = target.getBoundingClientRect().top + window.scrollY

  window.history.replaceState(window.history.state, '', `/${hash}`)
  window.scrollTo({
    top,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  })

  requestHeaderThemeUpdate()
}

const handleMenuItemClick = async (href: string) => {
  if (!import.meta.client) return

  const url = new URL(href, window.location.origin)

  if (!url.hash) {
    closeMenu()
    window.location.assign(`${url.pathname}${url.search}`)
    return
  }

  if (url.pathname !== route.path) {
    closeMenu()
    await navigateTo(`${url.pathname}${url.hash}`)
    await scrollToHash(url.hash)
    return
  }

  await scrollToHash(url.hash)
}

const syncBodyOverflow = () => {
  if (!import.meta.client) {
    return
  }

  const isMobileMenu = window.matchMedia('(max-width: 1023px)').matches
  document.body.style.overflow = isOpen.value && isMobileMenu ? 'hidden' : ''
}

watch(isOpen, syncBodyOverflow)

let themeFrame: number | null = null

const readThemeFromElement = (element: Element | null): HeaderTheme | null => {
  const section = element?.closest<HTMLElement>('[data-header-theme]')
  const theme = section?.dataset.headerTheme

  return theme === 'dark' || theme === 'light' ? theme : null
}

const updateHeaderTheme = () => {
  if (!import.meta.client) {
    return
  }

  themeFrame = null

  const desktopNav = document.getElementById('desktop-nav')
  const rect = desktopNav?.getBoundingClientRect()
  const sampleX = rect ? rect.left + Math.min(rect.width * 0.5, 120) : 48
  const sampleY = rect ? rect.top + Math.min(rect.height * 0.5, 80) : 48
  const elements = document.elementsFromPoint(sampleX, sampleY)
  const backgroundElement = elements.find(element => !headerElement.value?.contains(element)) || null

  headerTheme.value = readThemeFromElement(backgroundElement) || 'light'
}

const requestHeaderThemeUpdate = () => {
  if (!import.meta.client || themeFrame !== null) {
    return
  }

  themeFrame = window.requestAnimationFrame(updateHeaderTheme)
}

onMounted(() => {
  if (import.meta.client) {
    window.addEventListener('resize', syncBodyOverflow)
    window.addEventListener('scroll', requestHeaderThemeUpdate, { passive: true })
    window.addEventListener('resize', requestHeaderThemeUpdate)
    requestHeaderThemeUpdate()
  }
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    window.removeEventListener('resize', syncBodyOverflow)
    window.removeEventListener('scroll', requestHeaderThemeUpdate)
    window.removeEventListener('resize', requestHeaderThemeUpdate)
    if (themeFrame !== null) {
      window.cancelAnimationFrame(themeFrame)
    }
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <header ref="headerElement">
    <div class="fixed right-4 top-4 z-50 flex items-center gap-1 rounded-full border border-white/10 bg-neutral-950 px-1 py-1 text-white">
      <button
        v-for="option in localeOptions"
        :key="option.code"
        type="button"
        class="rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition-all duration-200"
        :class="locale === option.code ? 'bg-white text-neutral-950' : 'text-white/50 hover:text-white'"
        @click="setLocale(option.code)"
      >
        {{ option.label }}
      </button>

      <div class="mx-0.5 h-4 w-px bg-white/10 lg:hidden" />

      <button
        type="button"
        class="px-3 py-1.5 text-sm font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:text-white/60 lg:hidden"
        :aria-expanded="isOpen"
        @click="toggleMobileMenu"
      >
        {{ terms.common.menu }}
      </button>
    </div>

    <nav
      id="desktop-nav"
      class="pointer-events-none fixed left-4 top-4 z-40 hidden max-h-[calc(100vh-2rem)] flex-col items-start overflow-y-auto pr-3 lg:flex"
      :aria-label="terms.common.menu"
      @mouseenter="openDesktopMenu"
      @mouseleave="closeDesktopMenu"
      @focusin="openDesktopMenu"
      @focusout="closeDesktopMenu"
    >
      <div class="pointer-events-auto">
        <button
          type="button"
          class="group relative block text-left font-black uppercase leading-[1.05] transition-colors duration-300"
          :class="menuButtonClass"
          style="font-size: clamp(2.2rem, 3.5vw, 4rem);"
          :aria-expanded="isOpen"
          @click="openDesktopMenu"
        >
          <AnimatedMenuText :text="terms.common.menu" />
        </button>
      </div>

      <div class="pointer-events-none flex flex-col items-start">
        <div
          v-for="(item, index) in menuItems"
          :key="item.href"
          class="transition-[opacity,transform] duration-200 ease-out"
          :class="isOpen ? 'pointer-events-auto opacity-100 translate-y-0' : 'pointer-events-none -translate-y-2.5 opacity-0'"
          :style="{ transitionDelay: isOpen ? `${index * 50}ms` : '0ms' }"
        >
          <NuxtLink
            :to="item.href"
            class="group block text-left font-black uppercase leading-[1.05] transition-colors duration-300"
            :class="menuLinkClass"
            style="font-size: clamp(2.2rem, 3.5vw, 4rem);"
            @click.prevent="handleMenuItemClick(item.href)"
          >
            <AnimatedMenuText :text="item.label" />
          </NuxtLink>
        </div>
      </div>
    </nav>

    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="isOpen" class="fixed inset-0 z-[60] bg-neutral-950 text-white lg:hidden">
        <BaseButton
          type="button"
          class="absolute right-4 top-4 z-10"
          variant="light"
          shape="circle"
          size="sm"
          :aria-label="terms.common.close"
          @click="closeMenu"
        >
          ×
        </BaseButton>

        <nav class="flex min-h-screen flex-col justify-center overflow-y-auto px-8 py-20" :aria-label="terms.common.menu">
          <NuxtLink
            v-for="(item, index) in menuItems"
            :key="item.href"
            :to="item.href"
            class="group block text-left text-[42px] font-black uppercase leading-[1.08] text-white/35 transition-[opacity,transform,color] duration-300 hover:text-lime-300 min-[390px]:text-[52px] sm:text-7xl"
            :style="{ transitionDelay: `${index * 45}ms` }"
            @click.prevent="handleMenuItemClick(item.href)"
          >
            <AnimatedMenuText :text="item.label" />
          </NuxtLink>
        </nav>
      </div>
    </Transition>
  </header>
</template>
