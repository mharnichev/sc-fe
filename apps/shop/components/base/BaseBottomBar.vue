<script setup lang="ts">
const cart = useCartStore()
const favorites = useFavoritesStore()
const auth = useCustomerAuthStore()
const modal = useModalStore()
const route = useRoute()
const { terms } = useShopLocale()
const isHydrated = ref(false)
const isCabinet = computed(() => route.path === '/cabinet' || route.path.startsWith('/cabinet/'))
const isCatalogRoute = computed(() => route.name === 'slug' || ['/catalog', '/products', '/brands', '/top'].some(path => route.path === path || route.path.startsWith(`${path}/`)))
const isCheckoutRoute = computed(() => ['/checkout', '/payment'].some(path => route.path === path || route.path.startsWith(`${path}/`)))
const isFavoritesRoute = computed(() => route.path === '/favorites' || route.path.startsWith('/favorites/'))
const cabinetLinks = computed(() => [
  { to: '/cabinet/purchase-history', icon: 'clock', label: terms.value.cabinet.myOrders, active: route.path.startsWith('/cabinet/purchase-history') || route.path.startsWith('/cabinet/orders/') },
  { to: '/cabinet/settings', icon: 'settings', label: terms.value.cabinet.settings, active: route.path === '/cabinet' || route.path === '/cabinet/settings' || route.path.startsWith('/cabinet/settings/') },
  { to: '/cabinet/favorites', icon: 'heart', label: terms.value.common.favorites, active: route.path === '/cabinet/favorites' || route.path.startsWith('/cabinet/favorites/') },
])

onMounted(() => {
  isHydrated.value = true
})

const ALWAYS_SHOW_TOP = 120
const SCROLL_DELTA = 6
const DARK_LUMINANCE_THRESHOLD = 140

type SurfaceTheme = 'dark' | 'light'

const bottomBarElement = ref<HTMLElement | null>(null)
const isCompact = ref(false)
const isOnDarkSurface = ref(false)
const lastYPosition = ref(0)
let toneFrame: number | undefined

const accountInitials = computed(() => {
  if (!isHydrated.value || !auth.isAuthenticated) return ''
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
    isCompact.value = false
    lastYPosition.value = currentY
    updateBottomBarTone()
    return
  }

  const delta = currentY - lastYPosition.value
  if (Math.abs(delta) < SCROLL_DELTA) return

  isCompact.value = delta > 0
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
        'base-bottom-bar--compact': isCompact && !isCabinet,
        'base-bottom-bar--cabinet': isCabinet,
        'base-bottom-bar--on-dark': isOnDarkSurface,
      },
    ]"
    :aria-label="isCabinet ? terms.common.cabinet : terms.header.shopActions"
  >
    <NuxtLink to="/" class="base-bottom-bar__btn" :class="{ 'base-bottom-bar__btn--active': route.path === '/' }" :aria-label="terms.common.main">
      <BaseIcon name="home" size="xxs" effect="button" />
    </NuxtLink>

    <template v-if="isCabinet">
      <NuxtLink
        v-for="item in cabinetLinks"
        :key="item.to"
        :to="item.to"
        class="base-bottom-bar__btn"
        :class="{ 'base-bottom-bar__btn--active': item.active }"
        :aria-label="item.label"
        :aria-current="item.active ? 'page' : undefined"
      >
        <BaseIcon :name="item.icon" size="xxs" effect="button" />
      </NuxtLink>
    </template>

    <template v-else>
    <button class="base-bottom-bar__btn" type="button" :class="{ 'base-bottom-bar__btn--active': isCatalogRoute }" :aria-current="isCatalogRoute ? 'page' : undefined" :aria-label="terms.common.catalog" @click="openCatalog">
      <BaseIcon name="catalog" size="xxs" effect="button" />
    </button>

    <button class="base-bottom-bar__btn" type="button" :class="{ 'base-bottom-bar__btn--active': isCheckoutRoute }" :aria-current="isCheckoutRoute ? 'page' : undefined" :aria-label="terms.common.cart" @click="openBasket">
      <span class="base-bottom-bar__icon-wrap">
        <BaseIcon name="shopping-cart" size="xxs" effect="button" />
        <span v-if="cart.count" class="base-bottom-bar__count">{{ cart.count }}</span>
      </span>
    </button>

    <button class="base-bottom-bar__btn" type="button" :class="{ 'base-bottom-bar__btn--active': isFavoritesRoute }" :aria-current="isFavoritesRoute ? 'page' : undefined" :aria-label="terms.common.favorites" @click="openFavorites">
      <span class="base-bottom-bar__icon-wrap">
        <BaseIcon name="heart" size="xxs" effect="button" />
        <span v-if="favorites.count" class="base-bottom-bar__count">{{ favorites.count }}</span>
      </span>
    </button>

    </template>

    <button class="base-bottom-bar__btn" type="button" :class="{ 'base-bottom-bar__btn--active': isCabinet }" :aria-current="isCabinet ? 'page' : undefined" :aria-label="terms.common.account" @click="openAccount">
      <span v-if="accountInitials" class="base-bottom-bar__avatar">{{ accountInitials }}</span>
      <FeedbackFace v-else class="base-bottom-bar__account-face" name="content-smile" />
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
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 0.5);
  border-radius: 4px;
  background: linear-gradient(160deg, rgb(255 255 255 / 0.88), rgb(245 245 245 / 0.76));
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.65), 0 2px 12px rgb(0 0 0 / 0.1);
  -webkit-backdrop-filter: blur(18px) saturate(1.3);
  backdrop-filter: blur(18px) saturate(1.3);
  transform: scale(1);
  transform-origin: center bottom;
  transition: transform 600ms cubic-bezier(0.3, 1, 0.3, 1);
}

.base-bottom-bar--compact {
  transform: scale(0.9);
}

.base-bottom-bar--on-dark {
  border-color: rgb(255 255 255 / 0.22);
  background: linear-gradient(160deg, rgb(45 45 45 / 0.88), rgb(20 20 20 / 0.8));
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.18), 0 2px 12px rgb(0 0 0 / 0.22);
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
  transition: background-color 180ms ease, box-shadow 180ms ease;
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

.base-bottom-bar__btn :deep(.base-icon) {
  scale: 0.85;
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

.base-bottom-bar .base-bottom-bar__btn--active {
  margin: 4px;
  border-radius: 8px;
  background: #eeece7;
  box-shadow: inset 0 0 0 1px rgb(105 94 75 / 0.04);
}

.base-bottom-bar--on-dark .base-bottom-bar__btn--active {
  background: #46443f;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.07);
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

.base-bottom-bar__account-face {
  width: 1.5rem;
}

.base-bottom-bar--on-dark .base-bottom-bar__avatar {
  background: #ffffff;
  color: #0a0a0a;
}

@media (prefers-reduced-motion: reduce) {
  .base-bottom-bar {
    transition: none;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .base-bottom-bar {
    background: #f5f5f5;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }

  .base-bottom-bar--on-dark {
    background: #202020;
  }
}

@media (min-width: 768px) {
  .base-bottom-bar {
    display: none;
  }
}
</style>
