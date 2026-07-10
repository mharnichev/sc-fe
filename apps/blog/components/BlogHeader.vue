<script setup lang="ts">
import type { BlogMenuLink, LocaleCode } from '~/data/locale'

type HeaderTheme = 'dark' | 'light'

const DESKTOP_NAV_QUERY = '(min-width: 1024px)'

const headerElement = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const headerTheme = ref<HeaderTheme>('dark')
const shouldRenderDesktopNav = ref(false)
const { locale, localeOptions, setLocale, terms } = useBlogLocale()
const { openSubscribeModal } = useSubscribeModal()
const { trackBlogEvent } = useBlogAnalytics()
const route = useRoute()

let desktopNavMediaQuery: MediaQueryList | null = null
let themeFrame: number | null = null
let desktopMenuCloseTimer: ReturnType<typeof setTimeout> | null = null

const menuItems = computed(() => terms.value.links)
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
const desktopMenuSurfaceClass = computed(() =>
  headerTheme.value === 'dark'
    ? 'border-white/10 bg-neutral-950/20'
    : 'border-neutral-950/10 bg-stone-100/35',
)
const mobileMenuLinkClass = 'group block text-left text-[42px] font-black uppercase leading-[1.08] text-white/35 transition-[opacity,transform,color] duration-300 hover:text-lime-300 min-[390px]:text-[52px] sm:text-7xl'
const mobileMenuLinkStyle = (index: number) => ({
  transitionDelay: `${index * 45}ms`,
})
const raggedMenuSurfaceStyle = {
  clipPath: 'polygon(0 4%, 6% 0, 18% 2%, 31% 0, 47% 3%, 64% 1%, 80% 3%, 100% 0, 97% 15%, 100% 32%, 97% 49%, 100% 67%, 98% 84%, 100% 100%, 84% 98%, 67% 100%, 50% 97%, 32% 100%, 15% 98%, 0 100%, 3% 84%, 0 67%, 3% 50%, 0 33%, 3% 16%)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
}

const isDesktopViewport = () => import.meta.client ? window.matchMedia(DESKTOP_NAV_QUERY).matches : false

const syncDesktopNavRender = () => {
  if (!import.meta.client) return

  shouldRenderDesktopNav.value = isDesktopViewport()
  if (!shouldRenderDesktopNav.value) {
    isOpen.value = false
  }
}

const openDesktopMenu = () => {
  if (desktopMenuCloseTimer !== null) {
    clearTimeout(desktopMenuCloseTimer)
    desktopMenuCloseTimer = null
  }

  if (isDesktopViewport()) {
    isOpen.value = true
  }
}

const closeDesktopMenu = () => {
  if (isDesktopViewport()) {
    isOpen.value = false
  }
}

const scheduleDesktopMenuClose = () => {
  if (!isDesktopViewport()) return

  if (desktopMenuCloseTimer !== null) {
    clearTimeout(desktopMenuCloseTimer)
  }

  desktopMenuCloseTimer = setTimeout(() => {
    desktopMenuCloseTimer = null
    closeDesktopMenu()
  }, 180)
}

const handleDesktopFocusOut = (event: FocusEvent) => {
  const nav = event.currentTarget as HTMLElement | null
  const nextTarget = event.relatedTarget as Node | null

  if (nav && nextTarget && nav.contains(nextTarget)) {
    return
  }

  closeDesktopMenu()
}

const toggleMobileMenu = () => {
  if (isDesktopViewport()) {
    return
  }

  isOpen.value = !isOpen.value
  trackBlogEvent(isOpen.value ? 'blog_menu_open' : 'blog_menu_close')
}

const closeMenu = () => {
  isOpen.value = false
}

const handleLocaleClick = (localeCode: LocaleCode) => {
  trackBlogEvent('locale_select', {
    locale: localeCode,
    source: 'menu',
  })
  setLocale(localeCode)
}

const navigateToMenuLink = async (item: BlogMenuLink) => {
  if (!import.meta.client) return

  trackBlogEvent('navigation_click', {
    destination: item.action || item.href,
    source: 'menu',
  })

  closeMenu()

  if (item.action === 'subscribe') {
    openSubscribeModal('', 'menu')
    return
  }

  if (item.external) {
    window.location.assign(item.href)
    return
  }

  await navigateTo(item.href)
}

const syncPageOverflow = () => {
  if (!import.meta.client) {
    return
  }

  const nextOverflow = isOpen.value && !isDesktopViewport() ? 'hidden' : ''

  document.body.style.overflow = nextOverflow
  document.documentElement.style.overflow = nextOverflow
}

watch(isOpen, syncPageOverflow)
watch(() => route.fullPath, closeMenu)

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

  const desktopNav = document.getElementById('blog-desktop-nav')
  const rect = desktopNav?.getBoundingClientRect()
  const sampleX = rect ? rect.left + Math.min(rect.width * 0.5, 120) : 48
  const sampleY = rect ? rect.top + Math.min(rect.height * 0.5, 80) : 48
  const elements = document.elementsFromPoint(sampleX, sampleY)
  const backgroundElement = elements.find(element => !headerElement.value?.contains(element)) || null

  headerTheme.value = readThemeFromElement(backgroundElement) || 'dark'
}

const requestHeaderThemeUpdate = () => {
  if (!import.meta.client || themeFrame !== null) {
    return
  }

  themeFrame = window.requestAnimationFrame(updateHeaderTheme)
}

onMounted(() => {
  if (!import.meta.client) return

  desktopNavMediaQuery = window.matchMedia(DESKTOP_NAV_QUERY)
  shouldRenderDesktopNav.value = desktopNavMediaQuery.matches
  desktopNavMediaQuery.addEventListener('change', syncDesktopNavRender)
  window.addEventListener('resize', syncPageOverflow)
  window.addEventListener('scroll', requestHeaderThemeUpdate, { passive: true })
  window.addEventListener('resize', requestHeaderThemeUpdate)
  requestHeaderThemeUpdate()
})

onBeforeUnmount(() => {
  if (!import.meta.client) return

  desktopNavMediaQuery?.removeEventListener('change', syncDesktopNavRender)
  window.removeEventListener('resize', syncPageOverflow)
  window.removeEventListener('scroll', requestHeaderThemeUpdate)
  window.removeEventListener('resize', requestHeaderThemeUpdate)

  if (themeFrame !== null) {
    window.cancelAnimationFrame(themeFrame)
  }

  if (desktopMenuCloseTimer !== null) {
    clearTimeout(desktopMenuCloseTimer)
  }

  document.body.style.overflow = ''
  document.documentElement.style.overflow = ''
})
</script>

<template>
  <header ref="headerElement">
    <div class="fixed right-4 top-4 z-50 flex items-center gap-1 rounded-full border border-white/10 bg-neutral-950 px-1 py-1 text-white">
      <button
        v-for="option in localeOptions"
        :key="option.code"
        type="button"
        :data-locale-code="option.code"
        class="rounded-full px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition-all duration-200 sm:px-3 sm:text-xs sm:tracking-[0.14em]"
        :class="locale === option.code ? 'bg-white text-neutral-950' : 'text-white/50 hover:text-white'"
        :aria-pressed="locale === option.code"
        @click="handleLocaleClick(option.code)"
      >
        <span class="sm:hidden">{{ option.shortLabel }}</span>
        <span class="hidden sm:inline">{{ option.label }}</span>
      </button>

      <div class="mx-0.5 h-4 w-px bg-white/10 lg:hidden" />

      <button
        type="button"
        class="px-3 py-1.5 text-sm font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:text-white/60 lg:hidden"
        :aria-expanded="isOpen"
        aria-controls="blog-mobile-menu"
        @click="toggleMobileMenu"
      >
        {{ terms.menu }}
      </button>
    </div>

    <nav
      v-if="shouldRenderDesktopNav"
      id="blog-desktop-nav"
      class="fixed left-4 top-4 z-40 hidden max-h-[calc(100vh-2rem)] flex-col items-start overflow-y-auto pr-3 lg:flex"
      :class="isOpen ? 'pointer-events-auto' : 'pointer-events-none'"
      :aria-label="terms.menu"
      @mouseenter="openDesktopMenu"
      @mouseleave="scheduleDesktopMenuClose"
      @focusin="openDesktopMenu"
      @focusout="handleDesktopFocusOut"
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
          <AnimatedMenuText :text="terms.menu" />
        </button>
      </div>

      <div
        class="relative -ml-3 mt-1 flex flex-col items-start px-3 py-2"
        :class="isOpen ? 'pointer-events-auto' : 'pointer-events-none'"
      >
        <div
          class="absolute -inset-x-2 -inset-y-1 border transition-opacity duration-200"
          :class="[desktopMenuSurfaceClass, isOpen ? 'opacity-100' : 'opacity-0']"
          :style="raggedMenuSurfaceStyle"
          aria-hidden="true"
        />
        <div
          v-for="(item, index) in menuItems"
          :key="`${item.href}-${item.label}`"
          class="relative z-10 transition-[opacity,transform] duration-200 ease-out"
          :class="isOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2.5 opacity-0'"
          :style="{ transitionDelay: isOpen ? `${index * 50}ms` : '0ms' }"
        >
          <button
            v-if="item.action"
            type="button"
            class="group block text-left font-black uppercase leading-[1.05] transition-colors duration-300"
            :class="menuLinkClass"
            style="font-size: clamp(2.2rem, 3.5vw, 4rem);"
            @click="navigateToMenuLink(item)"
          >
            <AnimatedMenuText :text="item.label" />
          </button>
          <a
            v-else-if="item.external"
            :href="item.href"
            class="group block text-left font-black uppercase leading-[1.05] transition-colors duration-300"
            :class="menuLinkClass"
            style="font-size: clamp(2.2rem, 3.5vw, 4rem);"
            @click.prevent="navigateToMenuLink(item)"
          >
            <AnimatedMenuText :text="item.label" />
          </a>
          <NuxtLink
            v-else
            :to="item.href"
            class="group block text-left font-black uppercase leading-[1.05] transition-colors duration-300"
            :class="menuLinkClass"
            style="font-size: clamp(2.2rem, 3.5vw, 4rem);"
            @click.prevent="navigateToMenuLink(item)"
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
      <div
        v-if="isOpen"
        id="blog-mobile-menu"
        class="fixed inset-0 z-[60] bg-neutral-950 text-white lg:hidden"
      >
        <div class="absolute right-4 top-4 z-10">
          <BaseButton
            type="button"
            variant="light"
            shape="circle"
            size="sm"
            :aria-label="terms.close"
            @click="closeMenu"
          >
            x
          </BaseButton>
        </div>

        <nav class="flex min-h-screen flex-col justify-center overflow-y-auto px-8 py-20" :aria-label="terms.menu">
          <div class="relative w-full max-w-[44rem] px-3 py-4">
            <div
              class="absolute -inset-x-2 -inset-y-1 border border-white/10 bg-white/5"
              :style="raggedMenuSurfaceStyle"
              aria-hidden="true"
            />
            <template
              v-for="(item, index) in menuItems"
              :key="`${item.href}-${item.label}`"
            >
              <button
                v-if="item.action"
                type="button"
                :class="[mobileMenuLinkClass, 'relative z-10']"
                :style="mobileMenuLinkStyle(index)"
                @click="navigateToMenuLink(item)"
              >
                <AnimatedMenuText :text="item.label" />
              </button>
              <a
                v-else-if="item.external"
                :href="item.href"
                :class="[mobileMenuLinkClass, 'relative z-10']"
                :style="mobileMenuLinkStyle(index)"
                @click.prevent="navigateToMenuLink(item)"
              >
                <AnimatedMenuText :text="item.label" />
              </a>
              <NuxtLink
                v-else
                :to="item.href"
                :class="[mobileMenuLinkClass, 'relative z-10']"
                :style="mobileMenuLinkStyle(index)"
                @click.prevent="navigateToMenuLink(item)"
              >
                <AnimatedMenuText :text="item.label" />
              </NuxtLink>
            </template>
          </div>
        </nav>
      </div>
    </Transition>
  </header>
</template>
