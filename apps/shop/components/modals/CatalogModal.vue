<script setup lang="ts">
import type { BrandDto, CategoryTreeNodeDto } from '@shared-types'
import { isMonochromeBrandLogo, localBrandLogoUrl, resolveApiAssetUrl } from '@shared-utils'
import { categoryDestination } from '~/utils/category-routing'

type CatalogNavLink = {
  slug?: string
  uk: string
  en: string
  to: string
  kind?: 'brands'
  category?: CategoryTreeNodeDto | null
}

const props = defineProps<{
  modelValue: boolean
  initialCategories?: CategoryTreeNodeDto[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const modal = useModalStore()
const domain = useCatalogDomain()
const { locale, terms } = useShopLocale()
const config = useRuntimeConfig()
const requestUrl = useRequestURL()
const { data: cachedCategories } = useNuxtData<CategoryTreeNodeDto[]>('shop-header-category-tree')
const isShow = ref(false)
const categories = ref<CategoryTreeNodeDto[]>(props.initialCategories || cachedCategories.value || [])
const brands = ref<BrandDto[]>([])
const activePath = ref<CategoryTreeNodeDto[]>([])
const direction = ref<'forward' | 'back'>('forward')
const showBrands = ref(false)
const brandsLoading = ref(false)
const brandsLoaded = ref(false)
const brandsFailed = ref(false)
const brandSearchInput = ref('')
const brandSearchQuery = ref('')
const brandPlaceholder = ref('')
const brandPlaceholderSampleIndex = ref(0)
const brandPlaceholderCharIndex = ref(0)
const isDeletingBrandPlaceholder = ref(false)
let brandPlaceholderTimer: ReturnType<typeof setTimeout> | undefined
let brandSearchDebounceTimer: ReturnType<typeof setTimeout> | undefined
const brandSearchContainer = ref<HTMLElement | null>(null)
const panelElement = ref<HTMLElement | null>(null)
const brandsTrigger = ref<HTMLButtonElement[]>([])
const focusBrandsTriggerOnEnter = ref(false)
const TYPE_MS = 95
const ERASE_MS = 45
const PAUSE_MS = 1200
const BRAND_SEARCH_DEBOUNCE_MS = 250
const categoryLinks: CatalogNavLink[] = [
  { slug: 'kosmetika-dlia-borodi', uk: 'ДЛЯ БОРОДИ', en: 'FOR BEARD', to: '/kosmetika/kosmetika-dlia-borodi' },
  { slug: 'kosmetika-dlia-volossia', uk: 'ДЛЯ ВОЛОССЯ', en: 'FOR HAIR', to: '/kosmetika/kosmetika-dlia-volossia' },
  { slug: 'kosmetika-dlia-golinnia', uk: 'ДЛЯ ГОЛІННЯ', en: 'FOR SHAVING', to: '/kosmetika/kosmetika-dlia-golinnia' },
  { slug: 'kosmetika-dlia-tila', uk: 'ДЛЯ ТІЛА', en: 'FOR BODY', to: '/kosmetika/kosmetika-dlia-tila' },
  { slug: 'profesiini-grebeni-ta-shchitki', uk: 'ГРЕБЕНІ ТА ЩІТКИ', en: 'COMBS AND BRUSHES', to: '/profesiini-grebeni-ta-shchitki/goods/' },
  { uk: 'БРЕНДИ', en: 'BRANDS', to: '', kind: 'brands' },
]

const findCategory = (nodes: CategoryTreeNodeDto[], slug?: string): CategoryTreeNodeDto | null => {
  if (!slug) return null
  for (const category of nodes) {
    if (category.slug === slug) return category
    const child = findCategory(category.children, slug)
    if (child) return child
  }
  return null
}

const activeCategory = computed(() => showBrands.value ? null : activePath.value.at(-1) || null)
const visibleCategories = computed(() => activeCategory.value?.children || [])
const panelKey = computed(() => showBrands.value ? 'brands' : activePath.value.map(category => category.id).join('-') || 'root')
const transitionName = computed(() => `catalog-sidebar-${direction.value}`)
const levelTitle = computed(() => showBrands.value ? terms.value.catalog.allBrands : activeCategory.value?.name || terms.value.header.popularNavigation)
const navigationLinks = computed(() => categoryLinks.map(link => ({
  ...link,
  category: findCategory(categories.value, 'slug' in link ? link.slug : undefined),
})))
const loading = ref(false)
const brandSamples = computed(() => brands.value.slice(0, 5).map(brand => brand.name))
const animatedBrandPlaceholder = computed(() =>
  brandSearchInput.value
    ? terms.value.catalog.brandSearchPlaceholder
    : brandPlaceholder.value || terms.value.catalog.brandSearchPlaceholder,
)
const visibleBrands = computed(() => {
  const query = brandSearchQuery.value.trim().toLocaleLowerCase(locale.value === 'uk' ? 'uk-UA' : 'en')
  return brands.value
    .filter((brand) => {
      if (query && !brand.name.toLocaleLowerCase(locale.value === 'uk' ? 'uk-UA' : 'en').includes(query)) return false
      return Boolean(brandLogoUrl(brand))
    })
    .sort((left, right) => left.name.localeCompare(right.name, locale.value === 'uk' ? 'uk-UA' : 'en'))
})

watch(brandSearchInput, (value) => {
  if (brandSearchDebounceTimer) clearTimeout(brandSearchDebounceTimer)
  brandSearchDebounceTimer = setTimeout(() => {
    brandSearchQuery.value = value
    brandSearchDebounceTimer = undefined
  }, BRAND_SEARCH_DEBOUNCE_MS)
})

watch(() => props.initialCategories, (value) => {
  if (value?.length) categories.value = value
}, { immediate: true })

watch(cachedCategories, (value) => {
  if (value?.length) categories.value = value
}, { immediate: true })

const loadCategories = async () => {
  if (categories.value.length || loading.value) return
  loading.value = true
  try {
    categories.value = await domain.getCategoryTree()
  }
  catch {
    // Keep the header categories available as direct links when the tree cannot load.
  }
  finally {
    loading.value = false
  }
}

const shopAsset = useShopAsset()
const brandLogoUrl = (brand: BrandDto) =>
  resolveApiAssetUrl(brand.logo_url, String(config.public.apiBase), requestUrl.origin)
  || shopAsset(localBrandLogoUrl(brand.slug))

const brandLogoMaskStyle = (brand: BrandDto) => ({
  '--brand-logo-url': `url(${JSON.stringify(brandLogoUrl(brand))})`,
})

const loadBrands = async (retry = false) => {
  if (brandsLoaded.value || brandsLoading.value) return
  if (brandsFailed.value && !retry) return
  brandsLoading.value = true
  brandsFailed.value = false
  try {
    brands.value = await domain.getBrands({ hasActiveProducts: true })
    brandsLoaded.value = true
  }
  catch {
    brandsFailed.value = true
  }
  finally {
    brandsLoading.value = false
    if (showBrands.value) startBrandPlaceholderTyping()
  }
}

const stopBrandPlaceholderTyping = (reset = false) => {
  if (brandPlaceholderTimer) {
    clearTimeout(brandPlaceholderTimer)
    brandPlaceholderTimer = undefined
  }
  if (!reset) return
  brandPlaceholder.value = ''
  brandPlaceholderSampleIndex.value = 0
  brandPlaceholderCharIndex.value = 0
  isDeletingBrandPlaceholder.value = false
}

const tickBrandPlaceholder = () => {
  if (!showBrands.value || brandSearchInput.value) return
  const samples = brandSamples.value
  const sample = samples[brandPlaceholderSampleIndex.value]
  if (!sample) return

  if (!isDeletingBrandPlaceholder.value && brandPlaceholderCharIndex.value < sample.length) {
    brandPlaceholderCharIndex.value += 1
    brandPlaceholder.value = sample.slice(0, brandPlaceholderCharIndex.value)
    brandPlaceholderTimer = setTimeout(tickBrandPlaceholder, TYPE_MS)
    return
  }

  if (!isDeletingBrandPlaceholder.value) {
    brandPlaceholderTimer = setTimeout(() => {
      isDeletingBrandPlaceholder.value = true
      tickBrandPlaceholder()
    }, PAUSE_MS)
    return
  }

  if (brandPlaceholderCharIndex.value > 0) {
    brandPlaceholderCharIndex.value -= 1
    brandPlaceholder.value = sample.slice(0, brandPlaceholderCharIndex.value)
    brandPlaceholderTimer = setTimeout(tickBrandPlaceholder, ERASE_MS)
    return
  }

  isDeletingBrandPlaceholder.value = false
  brandPlaceholderSampleIndex.value = (brandPlaceholderSampleIndex.value + 1) % samples.length
  brandPlaceholderTimer = setTimeout(tickBrandPlaceholder, TYPE_MS)
}

const startBrandPlaceholderTyping = () => {
  stopBrandPlaceholderTyping()
  if (
    !showBrands.value
    || brandSearchInput.value
    || (import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  ) return
  brandPlaceholderTimer = setTimeout(tickBrandPlaceholder, TYPE_MS)
}

const openBrands = () => {
  direction.value = 'forward'
  showBrands.value = true
  void loadBrands()
  startBrandPlaceholderTyping()
}

const leaveBrands = () => {
  showBrands.value = false
  if (brandSearchDebounceTimer) {
    clearTimeout(brandSearchDebounceTimer)
    brandSearchDebounceTimer = undefined
  }
  brandSearchInput.value = ''
  brandSearchQuery.value = ''
  stopBrandPlaceholderTyping(true)
  direction.value = 'back'
  focusBrandsTriggerOnEnter.value = true
}

const focusEnteredPanel = () => {
  if (showBrands.value) {
    brandSearchContainer.value?.querySelector('input')?.focus()
    return
  }
  if (focusBrandsTriggerOnEnter.value) {
    focusBrandsTriggerOnEnter.value = false
    brandsTrigger.value[0]?.focus()
    return
  }
  panelElement.value?.querySelector<HTMLElement>('.catalog-sidebar__item')?.focus()
}

const blurBrandSearch = () => {
  startBrandPlaceholderTyping()
}

onBeforeUnmount(() => {
  if (brandSearchDebounceTimer) clearTimeout(brandSearchDebounceTimer)
  stopBrandPlaceholderTyping()
})

watch(() => props.modelValue, (value) => {
  isShow.value = value
  if (value) {
    activePath.value = []
    showBrands.value = false
    direction.value = 'forward'
    void loadCategories()
  }
  else {
    showBrands.value = false
    if (brandSearchDebounceTimer) {
      clearTimeout(brandSearchDebounceTimer)
      brandSearchDebounceTimer = undefined
    }
    brandSearchInput.value = ''
    brandSearchQuery.value = ''
    stopBrandPlaceholderTyping(true)
  }
}, { immediate: true })

const hideCatalogModal = () => {
  emit('update:modelValue', false)
  isShow.value = false
  modal.hideModal()
}

const goTo = async (to: string | ReturnType<typeof categoryDestination>) => {
  hideCatalogModal()
  await navigateTo(to)
}

const openCategory = async (category: CategoryTreeNodeDto, fallbackPath?: string) => {
  if (category.children.length) {
    direction.value = 'forward'
    activePath.value = [...activePath.value, category]
    return
  }
  await goTo(fallbackPath || categoryDestination(categories.value, category))
}

const openRootCategory = async (link: (typeof categoryLinks)[number] & { category: CategoryTreeNodeDto | null }) => {
  if (link.kind === 'brands') {
    await openBrands()
    return
  }
  if (!link.category) {
    await goTo(link.to)
    return
  }
  await openCategory(link.category, link.to)
}

const goBack = () => {
  if (showBrands.value) {
    void leaveBrands()
    return
  }
  direction.value = 'back'
  activePath.value = activePath.value.slice(0, -1)
}

</script>

<template>
  <BaseModal
    v-model="isShow"
    root-class="catalog-sidebar-modal"
    :show-header="false"
    full-height
    type="bottom"
    @close="hideCatalogModal"
  >
    <section class="catalog-sidebar">
      <header class="catalog-sidebar__header">
        <p>{{ terms.catalog.sidebarTitle }}</p>
        <BaseButton
          class="catalog-sidebar__close"
          type="button"
          variant="outline-dark"
          size="sm"
          shape="circle"
          :aria-label="terms.catalog.closeCatalog"
          @click="hideCatalogModal"
        >
          <BaseIcon name="close" size="xxs" />
        </BaseButton>
      </header>

      <div v-if="loading && !categories.length" class="catalog-sidebar__state">
        {{ terms.catalog.loadingCategories }}
      </div>
      <div v-else class="catalog-sidebar__viewport">
        <Transition :name="transitionName" mode="out-in" @after-enter="focusEnteredPanel">
          <section ref="panelElement" :key="panelKey" class="catalog-sidebar__panel">
            <button
              v-if="activeCategory || showBrands"
              class="catalog-sidebar__back"
              type="button"
              @click="goBack"
            >
              <BaseIcon name="chevron-left" size="xxs" />
              <span>{{ showBrands ? terms.home.brandsEyebrow : activeCategory?.name }}</span>
            </button>

            <div
              v-if="showBrands"
              ref="brandSearchContainer"
              class="catalog-sidebar__brand-search"
              @focusout="blurBrandSearch"
            >
              <BaseInput
                v-model="brandSearchInput"
                type="search"
                :label="terms.catalog.brandSearchPlaceholder"
                :placeholder="animatedBrandPlaceholder"
                autocomplete="off"
              />
              <BaseIcon
                class="catalog-sidebar__brand-search-icon"
                name="search"
                size="xs"
                aria-hidden="true"
              />
            </div>

            <div v-if="showBrands && brandsLoading" class="catalog-sidebar__state">
              {{ terms.common.loading }}
            </div>
            <div v-else-if="showBrands && brandsFailed" class="catalog-sidebar__state">
              <p>{{ terms.catalog.brandsUnavailable }}</p>
              <BaseButton type="button" variant="text" @click="loadBrands(true)">
                {{ terms.common.retry }}
              </BaseButton>
            </div>
            <div v-else-if="showBrands" class="catalog-sidebar__brand-results" :aria-label="levelTitle">
              <Transition name="catalog-sidebar__brand-results" mode="out-in">
                <TransitionGroup
                  v-if="visibleBrands.length"
                  :key="`brand-grid-${brandSearchQuery}`"
                  tag="ul"
                  name="catalog-sidebar__brand-item"
                  class="catalog-sidebar__list catalog-sidebar__list--brands"
                >
                  <li v-for="brand in visibleBrands" :key="brand.id" class="catalog-sidebar__brand-item">
                    <NuxtLink
                      class="catalog-sidebar__brand-link"
                      :to="{ path: '/catalog', query: { brand: brand.slug } }"
                      :aria-label="terms.home.viewBrand(brand.name)"
                      @click="hideCatalogModal"
                    >
                      <span
                        v-if="isMonochromeBrandLogo(brand.slug)"
                        class="catalog-sidebar__brand-logo-mask"
                        :style="brandLogoMaskStyle(brand)"
                        role="img"
                        :aria-label="brand.name"
                      />
                      <img
                        v-else
                        :src="brandLogoUrl(brand)"
                        :alt="brand.name"
                        width="240"
                        height="120"
                        loading="lazy"
                      >
                    </NuxtLink>
                  </li>
                </TransitionGroup>
                <div v-else key="brand-empty" class="catalog-sidebar__state catalog-sidebar__brand-empty" role="status">
                  <img
                    class="catalog-sidebar__brand-empty-face"
                    src="~/assets/images/feedback/sad-droopy-face.svg"
                    alt=""
                    aria-hidden="true"
                  >
                  <span>{{ terms.catalog.noBrandsFound }}</span>
                </div>
              </Transition>
            </div>

            <nav v-else class="catalog-sidebar__navigation" :aria-label="levelTitle">
              <ul :class="['catalog-sidebar__list', { 'catalog-sidebar__list--brands': showBrands }]">
                <template v-if="!activeCategory && !showBrands">
                  <li v-for="link in navigationLinks" :key="link.to">
                    <button
                      v-if="link.kind === 'brands'"
                      ref="brandsTrigger"
                      class="catalog-sidebar__item"
                      type="button"
                      @click="openRootCategory(link)"
                    >
                      <span>{{ link[locale] }}</span>
                      <BaseIcon class="catalog-sidebar__chevron" name="chevron-right" size="xxs" />
                    </button>
                    <button
                      v-else-if="link.category?.children.length"
                      class="catalog-sidebar__item"
                      type="button"
                      @click="openRootCategory(link)"
                    >
                      <span>{{ link[locale] }}</span>
                      <BaseIcon class="catalog-sidebar__chevron" name="chevron-right" size="xxs" />
                    </button>
                    <NuxtLink
                      v-else
                      class="catalog-sidebar__item"
                      :to="link.to"
                      @click="hideCatalogModal"
                    >
                      <span>{{ link[locale] }}</span>
                    </NuxtLink>
                  </li>
                </template>

                <template v-else-if="activeCategory">
                  <li v-for="category in visibleCategories" :key="category.id">
                  <button
                    v-if="category.children.length"
                    class="catalog-sidebar__item"
                    type="button"
                    @click="openCategory(category)"
                  >
                    <span>{{ category.name }}</span>
                    <BaseIcon class="catalog-sidebar__chevron" name="chevron-right" size="xxs" />
                  </button>
                  <NuxtLink
                    v-else
                    class="catalog-sidebar__item"
                    :to="categoryDestination(categories, category)"
                    @click="hideCatalogModal"
                  >
                    <span>{{ category.name }}</span>
                  </NuxtLink>
                  </li>
                </template>

              </ul>
            </nav>
          </section>
        </Transition>
      </div>
    </section>
  </BaseModal>
</template>

<style scoped>
.catalog-sidebar {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
  color: #0a0a0a;
}

.catalog-sidebar__header {
  position: relative;
  z-index: 3;
  display: flex;
  min-height: 4rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
}

.catalog-sidebar__header p {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.catalog-sidebar__close {
  flex: 0 0 auto;
}

.catalog-sidebar__state {
  display: grid;
  flex: 1 1 auto;
  place-items: center;
  padding: 2rem 1.25rem;
  color: rgb(82 82 82);
  text-align: center;
}

.catalog-sidebar__viewport {
  position: relative;
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;
}

.catalog-sidebar__panel {
  position: absolute;
  inset: 0;
  display: flex;
  min-height: 0;
  flex-direction: column;
  background: #ffffff;
}

.catalog-sidebar__back {
  display: flex;
  width: 100%;
  min-height: 3.2rem;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.75rem;
  border: 0;
  background: #ffffff;
  padding: 0 1rem;
  color: #0a0a0a;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-align: left;
  text-transform: uppercase;
}

.catalog-sidebar__brand-search {
  position: relative;
  flex: 0 0 auto;
  padding: 0.5rem 1rem 0.75rem;
}

.catalog-sidebar__brand-search :deep(.base-field__label) {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  clip-path: inset(50%);
}

.catalog-sidebar__brand-search :deep(.base-control) {
  border-color: transparent;
  padding-right: 3rem;
}

.catalog-sidebar__brand-search :deep(.base-control:focus),
.catalog-sidebar__brand-search :deep(.base-control:focus-visible) {
  border-color: transparent;
}

.catalog-sidebar__brand-search :deep(.base-control:focus-visible) {
  outline: 2px solid rgb(10 10 10 / 0.35);
  outline-offset: 2px;
}

.catalog-sidebar__brand-search-icon {
  position: absolute;
  top: 50%;
  right: 1.875rem;
  z-index: 1;
  color: #0a0a0a;
  pointer-events: none;
  transform: translateY(-50%);
}

.catalog-sidebar__navigation {
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0.5rem 0 2rem;
  -webkit-overflow-scrolling: touch;
}

.catalog-sidebar__brand-results {
  position: relative;
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0.5rem 0 2rem;
  -webkit-overflow-scrolling: touch;
}

.catalog-sidebar__brand-empty {
  gap: 0.75rem;
}

.catalog-sidebar__brand-empty-face {
  width: 4.25rem;
  height: 4.25rem;
}

.catalog-sidebar__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.catalog-sidebar__list--brands {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.625rem;
  padding: 0 1rem 1.5rem;
}

.catalog-sidebar__brand-item {
  min-width: 0;
  transition: opacity 360ms ease, transform 360ms ease;
}

.catalog-sidebar__brand-item-enter-from,
.catalog-sidebar__brand-item-leave-to {
  opacity: 0;
  transform: translateY(0.5rem);
}

.catalog-sidebar__brand-item-leave-active {
  position: absolute;
}

.catalog-sidebar__brand-item-move {
  transition: transform 360ms ease;
}

.catalog-sidebar__brand-results-enter-active,
.catalog-sidebar__brand-results-leave-active {
  transition: opacity 360ms ease, transform 360ms ease;
}

.catalog-sidebar__brand-results-enter-from,
.catalog-sidebar__brand-results-leave-to {
  opacity: 0;
  transform: translateY(0.375rem);
}

.catalog-sidebar__brand-link {
  display: flex;
  min-height: 5.5rem;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 0;
  background: transparent;
  padding: 0.75rem;
}

.catalog-sidebar__brand-link:focus-visible {
  border-radius: 0.25rem;
  outline: 2px solid #0a0a0a;
  outline-offset: 2px;
}

.catalog-sidebar__brand-link img,
.catalog-sidebar__brand-logo-mask {
  display: block;
  width: 100%;
  max-height: 3.5rem;
}

.catalog-sidebar__brand-link img {
  object-fit: contain;
}

.catalog-sidebar__brand-logo-mask {
  height: 3.5rem;
  background-color: currentColor;
  -webkit-mask-image: var(--brand-logo-url);
  -webkit-mask-position: center;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-size: contain;
  mask-image: var(--brand-logo-url);
  mask-position: center;
  mask-repeat: no-repeat;
  mask-size: contain;
}

.catalog-sidebar__item {
  display: flex;
  width: 100%;
  min-height: 2.875rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 0;
  background: transparent;
  padding: 0.45rem 1rem;
  color: #0a0a0a;
  cursor: pointer;
  font-size: clamp(1.05rem, 4.5vw, 1.75rem);
  font-weight: 800;
  letter-spacing: -0.035em;
  line-height: 1;
  text-align: left;
  text-decoration: none;
}

.catalog-sidebar__item:hover,
.catalog-sidebar__item:focus-visible,
.catalog-sidebar__back:hover,
.catalog-sidebar__back:focus-visible {
  background: #f5f5f4;
  outline: none;
}

.catalog-sidebar__chevron {
  width: 1.5rem;
  height: 1.5rem;
  flex: 0 0 auto;
}

.catalog-sidebar-forward-enter-active,
.catalog-sidebar-forward-leave-active,
.catalog-sidebar-back-enter-active,
.catalog-sidebar-back-leave-active {
  transition: transform 260ms cubic-bezier(0.3, 1, 0.3, 1);
}

.catalog-sidebar-forward-enter-from,
.catalog-sidebar-back-leave-to {
  transform: translateX(100%);
}

.catalog-sidebar-forward-leave-to,
.catalog-sidebar-back-enter-from {
  transform: translateX(-100%);
}

@media (min-width: 768px) {
  .catalog-sidebar__header,
  .catalog-sidebar__back,
  .catalog-sidebar__item,
  .catalog-sidebar__brand-search {
    padding-right: 1.5rem;
    padding-left: 1.5rem;
  }

  .catalog-sidebar__item {
    min-height: 3.5rem;
    font-size: clamp(1.5rem, 3vw, 3rem);
  }

  .catalog-sidebar__list--brands {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (prefers-reduced-motion: reduce) {
  .catalog-sidebar-forward-enter-active,
  .catalog-sidebar-forward-leave-active,
  .catalog-sidebar-back-enter-active,
  .catalog-sidebar-back-leave-active {
    transition: none;
  }

  .catalog-sidebar__brand-item,
  .catalog-sidebar__brand-item-move,
  .catalog-sidebar__brand-results-enter-active,
  .catalog-sidebar__brand-results-leave-active {
    transition: none;
  }
}

</style>
