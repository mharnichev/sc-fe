<script setup lang="ts">
import type { CategoryTreeNodeDto } from '@shared-types'
import { categoryDestination } from '~/utils/category-routing'
const shopAsset = useShopAsset()

const { categoryDisplayName } = useCategoryDisplay()

const emit = defineEmits<{
  visibilityChange: [state: { visible: boolean, height: number }]
}>()

const ALWAYS_SHOW_TOP = 120
const SCROLL_DELTA = 6
const MENU_OPEN_DELAY = 160
const MENU_CLOSE_DELAY = 180
const HEADER_CATEGORY_LINKS = [
  { slug: 'kosmetika-dlia-borodi', path: '/kosmetika/kosmetika-dlia-borodi', uk: 'ДЛЯ БОРОДИ', en: 'FOR BEARD' },
  { slug: 'kosmetika-dlia-volossia', path: '/kosmetika/kosmetika-dlia-volossia', uk: 'ДЛЯ ВОЛОССЯ', en: 'FOR HAIR' },
  { slug: 'kosmetika-dlia-golinnia', path: '/kosmetika/kosmetika-dlia-golinnia', uk: 'ДЛЯ ГОЛІННЯ', en: 'FOR SHAVING' },
  { slug: 'kosmetika-dlia-tila', path: '/kosmetika/kosmetika-dlia-tila', uk: 'ДЛЯ ТІЛА', en: 'FOR BODY' },
  { slug: 'profesiini-grebeni-ta-shchitki', path: '/profesiini-grebeni-ta-shchitki/goods/', uk: 'ГРЕБЕНІ ТА ЩІТКИ', en: 'COMBS AND BRUSHES' },
] as const

const cart = useCartStore()
const favorites = useFavoritesStore()
const auth = useCustomerAuthStore()
const modal = useModalStore()
const domain = useCatalogDomain()
const route = useRoute()
const { locale, localeOptions, setLocale, terms } = useShopLocale()
const { data: initialHeaderCategories } = await useAsyncData(
  'shop-header-category-tree',
  domain.getCategoryTree,
)

const shopHeader = ref<HTMLElement | null>(null)
const desktopSearch = ref<{ closeSearch: () => void } | null>(null)
const categoryTree = ref<CategoryTreeNodeDto[]>(initialHeaderCategories.value || [])
const activeCategory = ref<CategoryTreeNodeDto | null>(null)
const activeMenuKey = ref<string | null>(null)
const activeMenuAnchor = shallowRef<HTMLElement | null>(null)
const categoryMenuLeft = ref(24)
const isSearchFocus = ref(false)
const isHeaderHidden = ref(false)
const lastYPosition = ref(0)
let menuOpenTimer: ReturnType<typeof setTimeout> | undefined
let menuCloseTimer: ReturnType<typeof setTimeout> | undefined
let categoryLoadPromise: Promise<void> | undefined
let headerResizeObserver: ResizeObserver | null = null
let lastHeaderVisible: boolean | undefined
let lastHeaderHeight = -1

const isMenuOpen = computed(() => Boolean(activeMenuKey.value))
const isHeaderActive = computed(() => isMenuOpen.value || isSearchFocus.value)
const isPageDimmed = computed(() => isMenuOpen.value || isSearchFocus.value)
const categoryMenuStyle = computed(() => {
  const compactRows = (activeCategory.value?.children.length || 0) + 1

  return {
    '--category-menu-left': `${categoryMenuLeft.value}px`,
    '--category-menu-width': 'min(24rem, calc(100vw - 3rem))',
    '--category-menu-height': `${Math.min(26, Math.max(12, 5 + compactRows * 2.65))}rem`,
  }
})
const activeRouteCategorySlug = computed(() =>
  Array.isArray(route.query.category)
    ? String(route.query.category[0] || '')
    : String(route.query.category || '')
      || (Array.isArray(route.params.slug)
        ? String(route.params.slug[route.params.slug.length - 1] || '')
        : String(route.params.slug || '')),
)
const findCategory = (nodes: CategoryTreeNodeDto[], slug: string): CategoryTreeNodeDto | null => {
  for (const category of nodes) {
    if (category.slug === slug) return category
    const child = findCategory(category.children, slug)
    if (child) return child
  }
  return null
}
const headerCategoryLinks = computed(() => HEADER_CATEGORY_LINKS.map(link => ({
  ...link,
  category: findCategory(categoryTree.value, link.slug),
})))

const syncBodyOverflow = () => {
  if (!import.meta.client) return
  document.body.style.overflow = isPageDimmed.value ? 'hidden' : ''
}

watch(isPageDimmed, syncBodyOverflow)

const setMenuAnchor = (target?: EventTarget | null) => {
  if (!import.meta.client || !(target instanceof HTMLElement)) return
  activeMenuAnchor.value = target
}

const updateCategoryMenuPosition = () => {
  if (!import.meta.client || !shopHeader.value || !activeMenuAnchor.value) return

  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  const gutter = rootFontSize * 1.5
  const desiredWidth = rootFontSize * 24
  const menuWidth = Math.min(desiredWidth, window.innerWidth - gutter * 2)
  const headerRect = shopHeader.value.getBoundingClientRect()
  const anchorRect = activeMenuAnchor.value.getBoundingClientRect()
  const rawLeft = anchorRect.left - headerRect.left
  const maxLeft = Math.max(gutter, Math.min(headerRect.width, window.innerWidth) - menuWidth - gutter)

  categoryMenuLeft.value = Math.min(Math.max(rawLeft, gutter), maxLeft)
}

const refreshCategoryMenuPosition = async () => {
  await nextTick()
  updateCategoryMenuPosition()
}

watch(locale, refreshCategoryMenuPosition)

const loadCategories = async () => {
  if (categoryTree.value.length) return

  categoryLoadPromise ||= domain.getCategoryTree()
    .then(categories => {
      categoryTree.value = categories
    })
    .finally(() => {
      categoryLoadPromise = undefined
    })

  await categoryLoadPromise
}

const popularMenuKey = (category: CategoryTreeNodeDto) => `popular-${category.slug}`

const openPopularCategoryMenu = async (category: CategoryTreeNodeDto, anchor?: EventTarget | null) => {
  const key = popularMenuKey(category)

  cancelMenuOpen()
  cancelMenuClose()
  desktopSearch.value?.closeSearch()
  setMenuAnchor(anchor)
  activeMenuKey.value = key
  await loadCategories()
  if (activeMenuKey.value !== key) return
  activeCategory.value = findCategory(categoryTree.value, category.slug) || category
  await refreshCategoryMenuPosition()
}

const isPopularCategoryActive = (slug: string) =>
  activeMenuKey.value === `popular-${slug}` || activeRouteCategorySlug.value === slug

const closeMenu = () => {
  cancelMenuOpen()
  cancelMenuClose()
  activeMenuKey.value = null
  activeMenuAnchor.value = null
}

const cancelMenuOpen = () => {
  if (!menuOpenTimer) return
  clearTimeout(menuOpenTimer)
  menuOpenTimer = undefined
}

const cancelMenuClose = () => {
  if (!menuCloseTimer) return
  clearTimeout(menuCloseTimer)
  menuCloseTimer = undefined
}

const scheduleMenuOpen = (open: () => Promise<void>) => {
  cancelMenuOpen()
  cancelMenuClose()
  menuOpenTimer = setTimeout(() => {
    menuOpenTimer = undefined
    void open()
  }, MENU_OPEN_DELAY)
}

const schedulePopularCategoryMenuOpen = (category: CategoryTreeNodeDto, anchor?: EventTarget | null) => {
  scheduleMenuOpen(() => openPopularCategoryMenu(category, anchor))
}

const handlePopularCategoryEnter = (category: CategoryTreeNodeDto | null, target?: EventTarget | null) => {
  if (category?.children.length) schedulePopularCategoryMenuOpen(category, target)
}

const handlePopularCategoryFocus = (category: CategoryTreeNodeDto | null, target?: EventTarget | null) => {
  if (category?.children.length) void openPopularCategoryMenu(category, target)
}

const scheduleMenuClose = () => {
  cancelMenuOpen()
  cancelMenuClose()
  menuCloseTimer = setTimeout(() => {
    activeMenuKey.value = null
    activeMenuAnchor.value = null
    menuCloseTimer = undefined
  }, MENU_CLOSE_DELAY)
}

const closeOverlays = () => {
  closeMenu()
  desktopSearch.value?.closeSearch()
}

const handleSearchActive = (value: boolean) => {
  if (value) closeMenu()
  isSearchFocus.value = value
}

const openMobileSearch = () => {
  closeMenu()
  modal.openModal('SearchModal')
}

const categoryLink = (category: CategoryTreeNodeDto) => categoryDestination(categoryTree.value, category)

const openBasket = () => modal.openModal('UserBasketModal')
const isHydrated = ref(false)

onMounted(() => {
  isHydrated.value = true
})

const openAccount = async () => {
  closeOverlays()
  if (auth.isAuthenticated) {
    await navigateTo('/cabinet')
    return
  }
  modal.openModal('UserAuthModal', { redirectTo: '/cabinet' })
}
const openFavorites = async () => {
  if (auth.isAuthenticated) {
    await navigateTo('/cabinet/favorites')
    return
  }
  modal.openModal('UserAuthModal')
}

const updateHeaderVisibility = () => {
  const currentY = window.scrollY

  if (currentY <= ALWAYS_SHOW_TOP) {
    isHeaderHidden.value = false
    lastYPosition.value = currentY
    return
  }

  const delta = currentY - lastYPosition.value
  if (Math.abs(delta) < SCROLL_DELTA) return

  isHeaderHidden.value = delta > 0 && !isPageDimmed.value
  lastYPosition.value = currentY
}

const syncHeaderState = () => {
  const visible = !isHeaderHidden.value
  const height = Math.ceil(shopHeader.value?.getBoundingClientRect().height || 0)

  if (
    visible === lastHeaderVisible
    && height === lastHeaderHeight
  ) return

  lastHeaderVisible = visible
  lastHeaderHeight = height
  emit('visibilityChange', { visible, height })
}

const handleWindowResize = () => {
  updateCategoryMenuPosition()
  syncHeaderState()
}

watch(isHeaderHidden, syncHeaderState, { flush: 'post' })

onMounted(() => {
  lastYPosition.value = window.scrollY
  updateHeaderVisibility()
  void loadCategories()
  syncHeaderState()

  if (typeof window.ResizeObserver === 'function' && shopHeader.value) {
    headerResizeObserver = new ResizeObserver(syncHeaderState)
    headerResizeObserver.observe(shopHeader.value)
  }

  window.addEventListener('scroll', updateHeaderVisibility, { passive: true })
  window.addEventListener('resize', handleWindowResize, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateHeaderVisibility)
  window.removeEventListener('resize', handleWindowResize)
  headerResizeObserver?.disconnect()
  cancelMenuOpen()
  cancelMenuClose()
  document.body.style.overflow = ''
})
</script>

<template>
  <header
    ref="shopHeader"
    :class="[
      'shop-header',
      {
        'shop-header--hidden': isHeaderHidden,
        'shop-header--active': isHeaderActive,
      },
    ]"
  >
    <div :class="['shop-header__desktop', { 'shop-header__desktop--searching': isSearchFocus }]">
      <div class="shop-header__row shop-header__row--main">
        <div class="shop-header__primary">
          <NuxtLink to="/" class="shop-header__soulcuts" :aria-label="terms.brand.homeLabel" @click="closeOverlays">
            <img
              class="shop-header__soulcuts-logo"
              :src="shopAsset('/soulcuts/sc-logo-name-dark.webp')"
              alt="Soul Cuts"
              width="180"
              height="52"
              decoding="async"
            >
          </NuxtLink>

          <HeaderSearch
            ref="desktopSearch"
            :category-tree="categoryTree"
            @active-change="handleSearchActive"
          />
        </div>

        <div class="shop-header__tools">
          <nav class="shop-header__actions" :aria-label="terms.header.shopActions">
            <button class="shop-header__action" type="button" :aria-label="terms.common.favorites" @click="openFavorites">
              <span class="shop-header__action-icon">
                <BaseIcon name="heart" size="xs" />
                <span v-if="favorites.count" class="shop-header__badge">{{ favorites.count }}</span>
              </span>
              <span class="sr-only">{{ terms.common.favorites }}</span>
            </button>

            <button class="shop-header__action" type="button" :aria-label="terms.common.cart" @click="openBasket">
              <span class="shop-header__action-icon">
                <BaseIcon name="shopping-cart" size="xs" />
                <span v-if="cart.count" class="shop-header__badge">{{ cart.count }}</span>
              </span>
              <span class="sr-only">{{ terms.common.cart }}</span>
            </button>

            <button class="shop-header__action" type="button" :aria-label="terms.common.account" @click="openAccount">
              <BaseIcon name="user" size="xs" />
              <span class="sr-only">{{ isHydrated && auth.isAuthenticated ? terms.common.cabinet : terms.common.signIn }}</span>
            </button>
          </nav>

          <div class="shop-header__locale" :aria-label="terms.header.language">
            <button
              v-for="option in localeOptions"
              :key="option.code"
              type="button"
              class="shop-header__locale-btn"
              :class="{ 'shop-header__locale-btn--active': locale === option.code }"
              :aria-pressed="locale === option.code"
              @click="setLocale(option.code)"
            >
              <span class="shop-header__locale-short">{{ option.shortLabel }}</span>
              <span class="shop-header__locale-label">{{ option.label }}</span>
            </button>
          </div>
        </div>
      </div>

      <div
        class="shop-header__row shop-header__row--nav"
        @mouseenter="cancelMenuClose"
        @mouseleave="scheduleMenuClose"
      >
        <nav
          class="shop-header__popular"
          :aria-label="terms.header.popularNavigation"
        >
          <NuxtLink
            v-for="link in headerCategoryLinks"
            :key="link.slug"
            :to="link.path"
            :class="['shop-header__popular-btn', { 'shop-header__popular-btn--active': isPopularCategoryActive(link.slug) }]"
            :data-category-slug="link.slug"
            :aria-expanded="link.category?.children.length ? activeMenuKey === popularMenuKey(link.category) : undefined"
            @mouseenter="handlePopularCategoryEnter(link.category, $event.currentTarget)"
            @mouseleave="scheduleMenuClose"
            @focus="handlePopularCategoryFocus(link.category, $event.currentTarget)"
            @click="closeOverlays"
          >
            <BaseAnimatedMenuText :text="link[locale]" />
          </NuxtLink>
          <NuxtLink
            to="/brands"
            class="shop-header__popular-btn"
            @mouseenter="closeMenu()"
            @focus="closeMenu()"
            @click="closeOverlays"
          >
            <BaseAnimatedMenuText :text="terms.home.brandsEyebrow" />
          </NuxtLink>
        </nav>
      </div>
    </div>

    <div class="shop-header__mobile">
      <NuxtLink to="/" class="shop-header__mobile-logo" :aria-label="terms.brand.homeLabel" @click="closeOverlays">
        <img :src="shopAsset('/soulcuts/sc-logo-name-dark.webp')" alt="Soul Cuts" width="140" height="40">
      </NuxtLink>
      <div class="shop-header__mobile-actions">
        <button class="shop-header__mobile-btn" type="button" :aria-label="terms.common.search" @click="openMobileSearch">
          <BaseIcon name="search" size="xs" />
        </button>
        <button class="shop-header__mobile-btn" type="button" :aria-label="terms.common.cart" @click="openBasket">
          <span class="shop-header__action-icon">
            <BaseIcon name="shopping-cart" size="xs" />
            <span v-if="cart.count" class="shop-header__badge">{{ cart.count }}</span>
          </span>
        </button>
      </div>
    </div>

    <Transition name="fade">
      <section
        v-show="isMenuOpen"
        class="simple-category-list shop-header__category-list shop-header__category-list--compact"
        :style="categoryMenuStyle"
        @mouseenter="cancelMenuClose"
        @mouseleave="scheduleMenuClose"
      >
        <div class="simple-category-list__container">
          <div class="cl__category_list cl__category_list--compact">
            <ul v-if="activeCategory" class="cl__compact-list">
              <li v-for="subCategory in activeCategory.children" :key="subCategory.id">
                <NuxtLink class="cl__compact-link" :to="categoryLink(subCategory)" @click="closeOverlays">
                  <span><BaseHoverUnderlineText>{{ categoryDisplayName(subCategory) }}</BaseHoverUnderlineText></span>
                </NuxtLink>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </Transition>

    <Teleport to="body">
      <span
        :class="['full-page-dim-background', { 'is-active': isPageDimmed }]"
        aria-hidden="true"
        @click="closeOverlays"
      />
    </Teleport>
  </header>
</template>

<style scoped>
.fade-enter-active {
  transition:
    opacity 360ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 360ms cubic-bezier(0.22, 1, 0.36, 1);
}

.fade-leave-active {
  transition:
    opacity 220ms ease,
    transform 220ms ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-0.35rem);
}

.shop-header {
  position: sticky;
  top: 0;
  z-index: 60;
  background: #ffffff;
  color: #0a0a0a;
  transition:
    background-color 220ms ease,
    transform 300ms ease;
}

.shop-header--active {
  z-index: 80;
  background: #ffffff;
}

.shop-header--hidden {
  transform: translateY(-100%);
}

.shop-header__desktop {
  display: none;
}

.shop-header__row {
  margin: 0 auto;
  display: flex;
  max-width: 1480px;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1.5rem;
}

.shop-header__row--nav {
  justify-content: flex-start;
  padding-top: 0;
}

.shop-header__primary,
.shop-header__tools,
.shop-header__actions,
.shop-header__popular {
  display: flex;
  align-items: center;
}

.shop-header__primary {
  min-width: 0;
  flex: 1 1 auto;
  gap: 1rem;
}

.shop-header__tools {
  flex: 0 0 auto;
  gap: 0.75rem;
}

.shop-header__soulcuts {
  display: inline-flex;
  width: 8rem;
  flex: 0 0 auto;
  align-items: center;
  transition: opacity 180ms ease;
}

.shop-header__soulcuts-logo {
  display: block;
  width: 100%;
  height: auto;
  object-fit: contain;
}

.shop-header__actions {
  gap: 0.15rem;
}

.shop-header__action,
.shop-header__mobile-btn {
  position: relative;
  display: inline-flex;
  height: 2.5rem;
  width: 2.5rem;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: #0a0a0a;
  cursor: pointer;
  transition:
    background-color 180ms ease,
    opacity 180ms ease;
}

.shop-header__action:hover,
.shop-header__action:focus-visible,
.shop-header__mobile-btn:hover,
.shop-header__mobile-btn:focus-visible {
  background: rgb(10 10 10 / 0.05);
  outline: none;
}

.shop-header__action-icon {
  position: relative;
  display: inline-flex;
}

.shop-header__badge {
  position: absolute;
  right: -0.55rem;
  top: -0.5rem;
  display: inline-flex;
  min-width: 1rem;
  height: 1rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #0a0a0a;
  color: #ffffff;
  font-size: 0.6rem;
  line-height: 1;
}

.shop-header__locale {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: 999px;
  background: #0a0a0a;
  padding: 0.25rem;
  color: #ffffff;
}

.shop-header__locale-btn {
  border: 0;
  border-radius: 999px;
  background: transparent;
  padding: 0.4rem 0.7rem;
  color: rgb(255 255 255 / 0.5);
  cursor: pointer;
  font-size: 0.68rem;
  font-weight: 800;
  line-height: 1;
  text-transform: uppercase;
  transition:
    background-color 180ms ease,
    color 180ms ease;
}

.shop-header__locale-btn:hover,
.shop-header__locale-btn:focus-visible,
.shop-header__locale-btn--active {
  background: #ffffff;
  color: #0a0a0a;
  outline: none;
}

.shop-header__locale-short {
  display: none;
}

.shop-header__catalog,
.shop-header__popular-btn {
  display: inline-flex;
  min-width: 0;
  min-height: 2.5rem;
  align-items: center;
  gap: 0.55rem;
  border: 0;
  background: transparent;
  padding: 0 0.9rem;
  color: #0a0a0a;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
  transition: color 180ms ease;
}

.shop-header__catalog:hover,
.shop-header__catalog:focus-visible,
.shop-header__popular-btn:hover,
.shop-header__popular-btn:focus-visible,
.shop-header__popular-btn--active {
  color: #0a0a0a;
  outline: none;
}

.shop-header__popular {
  position: relative;
  min-width: 0;
  max-width: 100%;
  width: fit-content;
  flex-wrap: wrap;
  gap: 0.15rem;
  background: #ffffff;
}

.shop-header__popular-btn {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  min-height: 2.25rem;
  border-radius: 9999px;
  padding: 0 0.95rem;
  background: transparent;
  color: #0a0a0a;
  transition: color 180ms ease;
}

.shop-header__popular-btn:hover,
.shop-header__popular-btn:focus-visible,
.shop-header__popular-btn--active {
  color: #0a0a0a;
}

.shop-header__popular-btn:focus-visible {
  outline: 2px solid #0a0a0a;
  outline-offset: 3px;
}

.full-page-dim-background {
  position: fixed;
  inset: 0;
  z-index: 50;
  pointer-events: none;
  background: rgb(10 10 10 / 0.34);
  opacity: 0;
  -webkit-backdrop-filter: blur(0);
  backdrop-filter: blur(0);
  transition:
    opacity 220ms ease,
    backdrop-filter 220ms ease;
}

.full-page-dim-background.is-active {
  pointer-events: auto;
  opacity: 1;
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
}

.shop-header__category-list {
  position: absolute;
  top: 100%;
  left: var(--category-menu-left, 1.5rem);
  z-index: 82;
  width: var(--category-menu-width, min(80rem, calc(100vw - 3rem)));
  height: var(--category-menu-height, min(34rem, 72vh));
  overflow: visible;
  transition:
    left 300ms ease,
    width 300ms ease,
    height 300ms ease;
}

.shop-header__category-list::before,
.shop-header__category-list::after {
  --popup-corner-size: 2.5rem;

  content: '';
  position: absolute;
  top: -1px;
  z-index: 0;
  width: calc(var(--popup-corner-size) + 2px);
  height: calc(var(--popup-corner-size) + 2px);
  pointer-events: none;
}

.shop-header__category-list::before {
  left: calc(-1 * var(--popup-corner-size) + 1px);
  background: radial-gradient(
    circle at 0 0,
    transparent 0 calc(var(--popup-corner-size) - 1px),
    #ffffff var(--popup-corner-size)
  );
  transform: rotate(271deg);
  top: -2px;
}

.shop-header__category-list::after {
  right: calc(-1 * var(--popup-corner-size) + 1px);
  background: radial-gradient(
    circle at 100% 0,
    transparent 0 calc(var(--popup-corner-size) - 1px),
    #ffffff var(--popup-corner-size)
  );
  transform: rotate(88deg);
  top: -2px;
}

.simple-category-list {
  background: #ffffff;
}

.simple-category-list__container {
  position: relative;
  z-index: 1;
  display: flex;
  height: 100%;
  overflow: hidden;
  background: #ffffff;
}

.cl__list-wrapper {
  display: flex;
  height: 100%;
  flex: 0 0 18rem;
}

.cl__list {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 0.35rem;
  overflow: auto;
  padding: 0.75rem 0.4rem;
}

.cl__list_item-link {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.65rem 0.7rem;
  color: #5d5d5d;
  cursor: pointer;
  transition: color 180ms ease;
}

.cl__list_item-link_name-wrapper {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.55rem;
}

.cl__list_item-label {
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cl__list_item-link:hover,
.cl__list_item-link:focus-visible,
.cl__list_item-link--active {
  color: #0a0a0a;
  outline: none;
}

.cl__category_list {
  column-count: var(--category-columns-count);
  column-gap: 1rem;
  width: 100%;
  overflow: auto;
  padding: 1rem;
}

.cl__category_item-list {
  display: grid;
  break-inside: avoid;
  gap: 0.7rem;
  padding: 0.55rem;
}

.cl__category_item-list_item {
  color: #525252;
  font-size: 0.9rem;
}

.cl__category_item-list_item.is-group {
  color: #0a0a0a;
  font-weight: 800;
}

.cl__category_item-list_item a:hover,
.cl__category_item-list_item a:focus-visible {
  outline: none;
}

.cl__category_list--compact {
  column-count: 1;
  padding: 0.75rem;
}

.cl__compact-list {
  display: grid;
  gap: 0.35rem;
}

.cl__compact-link {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 0.75rem;
  color: #525252;
  font-size: 0.88rem;
  font-weight: 650;
  transition: color 180ms ease;
}

.cl__compact-link:hover,
.cl__compact-link:focus-visible {
  color: #0a0a0a;
  outline: none;
}

.shop-header__mobile {
  position: relative;
  z-index: 83;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem;
}

.shop-header__mobile-logo {
  justify-self: start;
  width: 7.5rem;
}

.shop-header__mobile-logo img {
  display: block;
  width: 100%;
  height: auto;
}

.shop-header__mobile-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.1rem;
}

@media (max-width: 767px) {
  .shop-header__category-list {
    left: 0;
    width: 100vw;
    height: min(70vh, 32rem);
    transform: none;
  }

  .shop-header__category-list::before,
  .shop-header__category-list::after {
    display: none;
  }

  .simple-category-list__container {
    display: grid;
    grid-template-columns: minmax(9rem, 42%) minmax(0, 1fr);
  }

  .cl__list-wrapper {
    min-width: 0;
    flex-basis: auto;
  }

  .cl__category_list {
    column-count: 1;
  }
}

@media (min-width: 768px) {
  .shop-header__desktop {
    display: block;
  }

  .shop-header__mobile {
    display: none;
  }
}
</style>
