<script setup lang="ts">
const cart = useCartStore()
const favorites = useFavoritesStore()
const auth = useCustomerAuthStore()
const modal = useModalStore()
const route = useRoute()
const { terms } = useShopLocale()

const ALWAYS_SHOW_TOP = 120
const SCROLL_DELTA = 6
const DARK_LUMINANCE_THRESHOLD = 140

type SurfaceTheme = 'dark' | 'light'

const bottomBarElement = ref<HTMLElement | null>(null)
const isPartiallyHidden = ref(false)
const isOnDarkSurface = ref(false)
const lastYPosition = ref(0)
let toneFrame: number | undefined

const accountInitials = computed(() => {
  if (!auth.isAuthenticated) return ''
  return auth.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('')
})

const openCatalog = () => modal.openModal('CatalogModal')
const openBasket = () => modal.openModal('UserBasketModal')
const openFavorites = () => modal.openModal(auth.isAuthenticated ? 'UserFavoriteModal' : 'UserAuthModal')
const openAccount = () => modal.openModal(auth.isAuthenticated ? 'CabinetModal' : 'UserAuthModal')

const parseColor = (color: string) => {
  if (!color || color === 'transparent') return null

  const match = color.match(/rgba?\(([^)]+)\)/)
  if (!match) return null

  const [red, green, blue, alpha = '1'] = match[1]
    .split(',')
    .map(value => value.trim())

  return {
    red: Number.parseFloat(red || '255'),
    green: Number.parseFloat(green || '255'),
    blue: Number.parseFloat(blue || '255'),
    alpha: Number.parseFloat(alpha || '1'),
  }
}

const colorLuminance = (red: number, green: number, blue: number) =>
  (0.299 * red) + (0.587 * green) + (0.114 * blue)

const readThemeFromElement = (element: Element | null): SurfaceTheme | null => {
  const section = element?.closest<HTMLElement>('[data-header-theme]')
  const theme = section?.dataset.headerTheme

  return theme === 'dark' || theme === 'light' ? theme : null
}

const elementBackgroundColor = (element: Element | null) => {
  let current: Element | null = element

  while (current && current !== document.documentElement) {
    const color = parseColor(window.getComputedStyle(current).backgroundColor)
    if (color && color.alpha > 0.05) return color
    current = current.parentElement
  }

  return parseColor(window.getComputedStyle(document.body).backgroundColor) || { red: 255, green: 255, blue: 255, alpha: 1 }
}

const updateBottomBarTone = () => {
  if (!import.meta.client) return

  if (toneFrame) cancelAnimationFrame(toneFrame)

  toneFrame = requestAnimationFrame(() => {
    toneFrame = undefined
    const bar = bottomBarElement.value
    if (!bar) return

    const rect = bar.getBoundingClientRect()
    const previousPointerEvents = bar.style.pointerEvents
    bar.style.pointerEvents = 'none'

    try {
      const sampleY = Math.min(window.innerHeight - 1, Math.max(0, rect.top + (rect.height / 2)))
      const sampleXs = [0.18, 0.38, 0.5, 0.62, 0.82].map(position =>
        Math.min(window.innerWidth - 1, Math.max(0, rect.left + (rect.width * position))),
      )

      let themedSamples = 0
      let darkThemedSamples = 0
      let darkBackgroundSamples = 0

      sampleXs.forEach((x) => {
        const elements = document.elementsFromPoint(x, sampleY)
        const surfaceElements = elements.filter(candidate => !bar.contains(candidate))
        const themedElement = surfaceElements.find(candidate => readThemeFromElement(candidate))
        const element = themedElement || surfaceElements[0] || null
        const theme = readThemeFromElement(element)

        if (theme) {
          themedSamples += 1
          if (theme === 'dark') darkThemedSamples += 1
          return
        }

        const color = elementBackgroundColor(element)
        if (colorLuminance(color.red, color.green, color.blue) < DARK_LUMINANCE_THRESHOLD) {
          darkBackgroundSamples += 1
        }
      })

      isOnDarkSurface.value = themedSamples > 0
        ? darkThemedSamples >= Math.ceil(themedSamples / 2)
        : darkBackgroundSamples >= Math.ceil(sampleXs.length / 2)
    }
    finally {
      bar.style.pointerEvents = previousPointerEvents
    }
  })
}

const updateBottomBarVisibility = () => {
  const currentY = window.scrollY

  if (currentY <= ALWAYS_SHOW_TOP) {
    isPartiallyHidden.value = false
    lastYPosition.value = currentY
    updateBottomBarTone()
    return
  }

  const delta = currentY - lastYPosition.value
  if (Math.abs(delta) < SCROLL_DELTA) return

  isPartiallyHidden.value = delta > 0
  lastYPosition.value = currentY
  updateBottomBarTone()
}

watch(() => route.fullPath, async () => {
  await nextTick()
  updateBottomBarTone()
})

onMounted(() => {
  lastYPosition.value = window.scrollY
  updateBottomBarVisibility()
  updateBottomBarTone()
  window.addEventListener('scroll', updateBottomBarVisibility, { passive: true })
  window.addEventListener('resize', updateBottomBarTone)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateBottomBarVisibility)
  window.removeEventListener('resize', updateBottomBarTone)
  if (toneFrame) cancelAnimationFrame(toneFrame)
})
</script>

<template>
  <nav
    ref="bottomBarElement"
    :class="[
      'base-bottom-bar',
      {
        'base-bottom-bar--partially-hidden': isPartiallyHidden,
        'base-bottom-bar--on-dark': isOnDarkSurface,
      },
    ]"
    :aria-label="terms.header.shopActions"
  >
    <NuxtLink to="/" class="base-bottom-bar__btn" :aria-label="terms.common.main">
      <BaseIcon name="home" size="xxs" effect="button" />
    </NuxtLink>

    <button class="base-bottom-bar__btn" type="button" :aria-label="terms.common.catalog" @click="openCatalog">
      <BaseIcon name="catalog" size="xxs" effect="button" />
    </button>

    <button class="base-bottom-bar__btn" type="button" :aria-label="terms.common.cart" @click="openBasket">
      <span class="base-bottom-bar__icon-wrap">
        <BaseIcon name="shopping-cart" size="xxs" effect="button" />
        <span v-if="cart.count" class="base-bottom-bar__count">{{ cart.count }}</span>
      </span>
    </button>

    <button class="base-bottom-bar__btn" type="button" :aria-label="terms.common.favorites" @click="openFavorites">
      <span class="base-bottom-bar__icon-wrap">
        <BaseIcon name="heart" size="xxs" effect="button" />
        <span v-if="favorites.count" class="base-bottom-bar__count">{{ favorites.count }}</span>
      </span>
    </button>

    <button class="base-bottom-bar__btn" type="button" :aria-label="terms.common.account" @click="openAccount">
      <span v-if="accountInitials" class="base-bottom-bar__avatar">{{ accountInitials }}</span>
      <BaseIcon v-else name="user" size="xxs" effect="button" />
    </button>
  </nav>
</template>

<style scoped>
.base-bottom-bar {
  position: fixed;
  right: 8px;
  bottom: 8px;
  left: 8px;
  z-index: 60;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  height: 44px;
  -webkit-backdrop-filter: blur(18px) saturate(1.3);
  backdrop-filter: blur(18px) saturate(1.3);
  transform: translateY(0);
  transition: transform 280ms cubic-bezier(0.3, 1, 0.3, 1);
  will-change: transform;
}

.base-bottom-bar--partially-hidden {
  transform: translateY(28px);
}

.base-bottom-bar__btn {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  border: 0;
  background: transparent;
  color: #0a0a0a;
  cursor: pointer;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0;
}

.base-bottom-bar__btn:hover,
.base-bottom-bar__btn:focus-visible {
  background: rgb(10 10 10 / 0.05);
  outline: none;
}

.base-bottom-bar__btn.router-link-active,
.base-bottom-bar__btn.router-link-exact-active {
  border: 0;
  background: transparent;
  outline: none;
}

.base-bottom-bar__btn :deep(.base-icon--effect-button),
.base-bottom-bar__btn.router-link-active :deep(.base-icon--effect-button),
.base-bottom-bar__btn.router-link-exact-active :deep(.base-icon--effect-button) {
  --base-icon-bg: transparent;
  --base-icon-text: #0a0a0a;
  --base-icon-fill: transparent;
  --base-icon-hover-text: #0a0a0a;
  --base-icon-border: transparent;

  border: 0;
  border-radius: 0;
  background: transparent;
  color: #0a0a0a;
}

.base-bottom-bar__btn :deep(.base-icon__surface),
.base-bottom-bar__btn :deep(.base-icon__fill) {
  border-radius: 0;
}

.base-bottom-bar__btn :deep(.base-icon__glyph svg) {
  color: currentColor;
}

.base-bottom-bar__btn :deep(.base-icon__glyph svg[fill]:not([fill="none"])) {
  fill: currentColor;
}

.base-bottom-bar__btn :deep(.base-icon__glyph svg [fill]:not([fill="none"])) {
  fill: currentColor;
}

.base-bottom-bar__btn :deep(.base-icon__glyph svg[stroke]:not([stroke="none"])) {
  stroke: currentColor;
}

.base-bottom-bar__btn :deep(.base-icon__glyph svg [stroke]:not([stroke="none"])) {
  stroke: currentColor;
}

.base-bottom-bar--on-dark .base-bottom-bar__btn {
  color: #ffffff;
}

.base-bottom-bar--on-dark .base-bottom-bar__btn:hover,
.base-bottom-bar--on-dark .base-bottom-bar__btn:focus-visible {
  background: rgb(255 255 255 / 0.12);
}

.base-bottom-bar--on-dark .base-bottom-bar__btn :deep(.base-icon--effect-button),
.base-bottom-bar--on-dark .base-bottom-bar__btn.router-link-active :deep(.base-icon--effect-button),
.base-bottom-bar--on-dark .base-bottom-bar__btn.router-link-exact-active :deep(.base-icon--effect-button) {
  --base-icon-bg: transparent;
  --base-icon-text: #ffffff;
  --base-icon-fill: transparent;
  --base-icon-hover-text: #ffffff;
  --base-icon-border: transparent;

  border: 0;
  border-radius: 0;
  background: transparent;
  color: #ffffff;
}

.base-bottom-bar__icon-wrap {
  position: relative;
  display: inline-flex;
}

.base-bottom-bar__count {
  position: absolute;
  right: -0.65rem;
  top: -0.5rem;
  display: inline-flex;
  min-width: 1rem;
  height: 1rem;
  align-items: center;
  justify-content: center;
  border: 1px solid #ffffff;
  border-radius: 999px;
  background: #0a0a0a;
  color: #ffffff;
  font-size: 0.6rem;
  line-height: 1;
}

.base-bottom-bar__avatar {
  display: inline-flex;
  height: 1.35rem;
  width: 1.35rem;
  align-items: center;
  justify-content: center;
  background: #0a0a0a;
  color: #ffffff;
  font-size: 0.62rem;
  font-weight: 800;
}

.base-bottom-bar--on-dark .base-bottom-bar__avatar {
  background: #ffffff;
  color: #0a0a0a;
}

@media (min-width: 768px) {
  .base-bottom-bar {
    display: none;
  }
}
</style>
