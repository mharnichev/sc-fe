<script setup lang="ts">
import type { CategoryTreeNodeDto } from '@shared-types'

const POPULAR_CATEGORY_LIMIT = 4
const POPULAR_CATEGORY_SLUG_GROUPS = [
  ['kosmetika-dlia-borodi', 'kosmetika-nabori-boroda'],
  ['kosmetika-dlia-volossia', 'kosmetika-ukladochni', 'kosmetika-nabori-volossia'],
  ['kosmetika-dlia-golinnia', 'kosmetika-do-golinnia', 'kosmetika-pislia-golinnia', 'kosmetika-nabori-golinnia'],
  ['kosmetika-dlia-tila', 'kosmetika-dlia-tila-dlia-oblichchia', 'kosmetika-dogliad-za-rukami'],
]
const EXCLUDED_POPULAR_CATEGORY_SLUG_PREFIXES = ['brendi']
const cart = useCartStore()
const favorites = useFavoritesStore()
const auth = useCustomerAuthStore()
const modal = useModalStore()
const domain = useCatalogDomain()
const route = useRoute()
const { terms } = useShopLocale()

const ALWAYS_SHOW_TOP = 120
const SCROLL_DELTA = 6
const DARK_LUMINANCE_THRESHOLD = 140

type SurfaceTheme = 'dark' | 'light'

const bottomBarElement = ref<HTMLElement | null>(null)
const isPartiallyHidden = ref(false)
const isOnDarkSurface = ref(false)
const isTopRoute = computed(() => route.path === '/top')
const lastYPosition = ref(0)
const categoryTree = ref<CategoryTreeNodeDto[]>([])
let toneFrame: number | undefined
let categoryLoadPromise: Promise<void> | undefined

interface CategoryCandidate {
  category: CategoryTreeNodeDto
  text: string
}

const accountInitials = computed(() => {
  if (!auth.isAuthenticated) return ''
  return auth.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('')
})

const normalizeCategoryText = (value: string) => value.toLocaleLowerCase()
const categorySearchText = (category: CategoryTreeNodeDto) =>
  normalizeCategoryText(`${category.name} ${category.slug} ${category.description || ''}`)
const categoryCandidates = computed(() => {
  const candidates: CategoryCandidate[] = []

  const visit = (nodes: CategoryTreeNodeDto[]) => {
    nodes.forEach(category => {
      candidates.push({
        category,
        text: categorySearchText(category),
      })

      if (category.children.length) visit(category.children)
    })
  }

  visit(categoryTree.value)

  return candidates
})
const isPopularCategoryExcluded = (category: CategoryTreeNodeDto) =>
  EXCLUDED_POPULAR_CATEGORY_SLUG_PREFIXES.some(prefix => category.slug === prefix || category.slug.startsWith(`${prefix}-`))
const selectableCategoryCandidates = computed(() =>
  categoryCandidates.value.filter(candidate => !isPopularCategoryExcluded(candidate.category)),
)
const popularCategoryKeywords = computed(() => {
  const [beard, hair, shaving, care] = terms.value.header.popularGroups

  return [
    [beard, 'бород', 'beard'],
    [hair, 'волос', 'hair', 'помад', 'pomade', 'стайл', 'styling'],
    [shaving, 'голін', 'брит', 'shav', 'razor'],
    [care, 'догляд', 'шкір', 'тіла', 'облич', 'care', 'skin', 'body', 'face'],
  ]
})
const popularCategoryTargets = computed(() => {
  const picked: CategoryCandidate[] = []
  const usedSlugs = new Set<string>()

  const addCandidate = (candidate?: CategoryCandidate) => {
    if (!candidate || usedSlugs.has(candidate.category.slug) || picked.length >= POPULAR_CATEGORY_LIMIT) return

    usedSlugs.add(candidate.category.slug)
    picked.push(candidate)
  }

  for (const slugs of POPULAR_CATEGORY_SLUG_GROUPS) {
    addCandidate(selectableCategoryCandidates.value.find(candidate => slugs.includes(candidate.category.slug)))
  }

  for (const keywords of popularCategoryKeywords.value) {
    addCandidate(selectableCategoryCandidates.value.find(candidate =>
      keywords.some(keyword => keyword && candidate.text.includes(normalizeCategoryText(keyword))),
    ))
  }

  categoryTree.value.forEach(category => {
    addCandidate(selectableCategoryCandidates.value.find(candidate => candidate.category.id === category.id))
  })
  selectableCategoryCandidates.value.forEach(addCandidate)

  return picked
})
const activeRouteCategorySlug = computed(() =>
  Array.isArray(route.query.category) ? String(route.query.category[0] || '') : String(route.query.category || ''),
)
const isCategoryActive = (category: CategoryTreeNodeDto) => activeRouteCategorySlug.value === category.slug
const categoryLink = (category: CategoryTreeNodeDto) => ({
  path: '/catalog',
  query: { category: category.slug },
})

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

const openCatalog = () => modal.openModal(
  'CatalogModal',
  categoryTree.value.length ? { initialCategories: categoryTree.value } : {},
)
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
  void loadCategories()
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
    <div
      class="base-bottom-bar__categories"
      :aria-label="terms.header.popularNavigation"
    >
      <NuxtLink
        to="/top"
        :class="['base-bottom-bar__category', { 'base-bottom-bar__category--active': isTopRoute }]"
        :aria-current="isTopRoute ? 'page' : undefined"
      >
        <BaseHoverUnderlineText>{{ terms.home.popularEyebrow }}</BaseHoverUnderlineText>
      </NuxtLink>
      <NuxtLink
        v-for="target in popularCategoryTargets"
        :key="target.category.id"
        :to="categoryLink(target.category)"
        :class="['base-bottom-bar__category', { 'base-bottom-bar__category--active': isCategoryActive(target.category) }]"
        :aria-current="isCategoryActive(target.category) ? 'page' : undefined"
      >
        <BaseHoverUnderlineText>{{ target.category.name }}</BaseHoverUnderlineText>
      </NuxtLink>
    </div>

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

.base-bottom-bar__categories {
  position: absolute;
  right: 0;
  bottom: calc(100% + 6px);
  left: 0;
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 2px 0;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.base-bottom-bar__categories::-webkit-scrollbar {
  display: none;
}

.base-bottom-bar__category {
  display: inline-flex;
  max-width: 42vw;
  min-height: 32px;
  flex: 0 0 auto;
  align-items: center;
  border: 1px solid rgb(10 10 10 / 0.14);
  background: rgb(255 255 255 / 0.92);
  color: #0a0a0a;
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1;
  padding: 0 0.72rem;
  text-decoration: none;
}

.base-bottom-bar__category:hover,
.base-bottom-bar__category:focus-visible {
  border-color: #0a0a0a;
  color: #0a0a0a;
  outline: none;
}

.base-bottom-bar__category--active {
  border-color: #0a0a0a;
  background: #0a0a0a;
  color: #ffffff;
}

.base-bottom-bar__category {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
