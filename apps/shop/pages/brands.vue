<script setup lang="ts">
import type { BrandDto } from '@shared-types'
import { isMonochromeBrandLogo, localBrandLogoUrl, resolveApiAssetUrl } from '@shared-utils'

const domain = useCatalogDomain()
const config = useRuntimeConfig()
const requestUrl = useRequestURL()
const { terms, locale } = useShopLocale()
const search = ref<string | number>('')
const debouncedSearch = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined
const applySearch = () => {
  clearTimeout(searchTimer)
  debouncedSearch.value = String(search.value).trim()
}
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(applySearch, 250)
})
onBeforeUnmount(() => clearTimeout(searchTimer))
const clearSearch = () => {
  search.value = ''
  applySearch()
}
const resultsContent = ref<HTMLElement | null>(null)
const resultsHeight = ref<number>()
let resultsObserver: ResizeObserver | undefined
onMounted(() => {
  const content = resultsContent.value
  if (!content) return
  resultsHeight.value = content.getBoundingClientRect().height
  resultsObserver = new ResizeObserver(() => {
    const height = content.getBoundingClientRect().height
    // Keep the previous height during the out-in transition's empty frame.
    if (height > 0) resultsHeight.value = height
  })
  resultsObserver.observe(content)
})
onBeforeUnmount(() => resultsObserver?.disconnect())
const failedLogos = ref(new Set<number>())
const { data: brands, pending, error, refresh } = await useAsyncData(
  'shop-brands-directory',
  () => domain.getBrands({ hasActiveProducts: true }),
)
const copy = computed(() => locale.value === 'uk' ? {
  description: 'Знайдіть свій бренд. Відкрийте догляд, який підходить саме вам.',
  alphabet: 'Бренди за алфавітом',
  noLogo: 'Логотип незабаром',
} : {
  description: 'Find your brand. Discover the care that works for you.',
  alphabet: 'Brands alphabetically',
  noLogo: 'Logo coming soon',
})
const allGroups = computed(() => {
  const sorted = (brands.value || [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, locale.value, { sensitivity: 'base', numeric: true }))
  const result = new Map<string, BrandDto[]>()
  for (const brand of sorted) {
    const first = Array.from(brand.name.trim())[0]?.toLocaleUpperCase() || '#'
    const letter = /\p{N}/u.test(first) ? '0–9' : first
    result.set(letter, [...(result.get(letter) || []), brand])
  }
  return Array.from(result, ([letter, items]) => ({ letter, items }))
})
const groups = computed(() => {
  const query = debouncedSearch.value.toLocaleLowerCase()
  return allGroups.value
    .map(group => ({ ...group, items: group.items.filter(brand => brand.name.toLocaleLowerCase().includes(query)) }))
    .filter(group => group.items.length)
})
const availableLetters = computed(() => new Set(groups.value.map(group => group.letter)))
const scrollToBrand = (letter: string) => {
  if (!availableLetters.value.has(letter)) return
  const target = document.getElementById(`brand-${letter}`)
  if (!target) return
  // Reserve the full header height, including when it reappears on upward scroll.
  const headerHeight = document.querySelector('.shop-header')?.getBoundingClientRect().height || 0
  const top = window.scrollY + target.getBoundingClientRect().top - headerHeight - 16
  window.scrollTo({
    top: Math.max(0, top),
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  })
}
const pinLeavingItem = (element: Element) => {
  if (!(element instanceof HTMLElement)) return
  element.style.width = `${element.offsetWidth}px`
  element.style.height = `${element.offsetHeight}px`
  element.style.left = `${element.offsetLeft}px`
  element.style.top = `${element.offsetTop}px`
}
const shopAsset = useShopAsset()
const logoUrl = (brand: BrandDto) =>
  resolveApiAssetUrl(brand.logo_url, String(config.public.apiBase), requestUrl.origin)
  || shopAsset(localBrandLogoUrl(brand.slug))
const markLogoFailed = (id: number) => {
  failedLogos.value = new Set(failedLogos.value).add(id)
}

useSeo(() => terms.value.catalog.allBrands, () => copy.value.description)
</script>

<template>
  <section class="brands-page">
    <header class="brands-page__heading">
      <h1 class="type-title-strong">{{ terms.catalog.allBrands }}</h1>
    </header>

    <div class="brands-page__tools">
      <nav v-if="!error && allGroups.length" class="brands-page__alphabet" :aria-label="copy.alphabet">
        <a
          v-for="group in allGroups"
          :key="group.letter"
          :href="availableLetters.has(group.letter) ? `#brand-${group.letter}` : undefined"
          :aria-disabled="!availableLetters.has(group.letter) || undefined"
          :tabindex="availableLetters.has(group.letter) ? undefined : -1"
          @click.prevent="scrollToBrand(group.letter)"
        >{{ group.letter }}</a>
      </nav>
      <form class="brands-page__search" role="search" @submit.prevent="applySearch">
      <BaseInput
        v-model="search"
        type="search"
        :label="terms.catalog.brandSearchPlaceholder"
        :placeholder="terms.catalog.brandSearchPlaceholder"
      >
        <template #trailing>
          <BaseButton type="submit" variant="borderless" class="brands-page__search-button" :aria-label="terms.common.search">
            <BaseIcon name="search" size="xxs" />
          </BaseButton>
        </template>
      </BaseInput>
      </form>
    </div>

    <div class="brands-page__results" :style="{ height: resultsHeight === undefined ? undefined : `${resultsHeight}px` }">
    <div ref="resultsContent" class="brands-page__results-content">
    <BaseTransition>
    <div v-if="pending" key="loading" class="brands-page__loading" role="status" :aria-label="terms.common.loading">
      <BaseSkeleton v-for="index in 6" :key="index" height="10rem" />
    </div>
    <div v-else-if="error" key="error" class="brands-page__state" role="alert">
      <p>{{ terms.catalog.brandsUnavailable }}</p>
      <BaseButton variant="outline-dark" @click="refresh()">{{ terms.common.retry }}</BaseButton>
    </div>
    <FeedbackState v-else-if="!groups.length" key="empty" kind="search" :title="terms.catalog.noBrandsFound">
      <BaseButton v-if="debouncedSearch" variant="outline-dark" @click="clearSearch">{{ terms.common.clear }}</BaseButton>
    </FeedbackState>
    <TransitionGroup v-else key="results" tag="div" name="brand-filter" class="brands-page__groups" @before-leave="pinLeavingItem">
      <section v-for="group in groups" :id="`brand-${group.letter}`" :key="group.letter" class="brands-page__group" :aria-labelledby="`brand-heading-${group.letter}`">
        <h2 :id="`brand-heading-${group.letter}`">{{ group.letter }}</h2>
        <TransitionGroup tag="ul" name="brand-filter" class="brands-page__grid" @before-leave="pinLeavingItem">
          <li v-for="brand in group.items" :key="brand.id">
            <NuxtLink class="brands-page__card" :to="{ path: '/catalog', query: { brand: brand.slug } }">
              <h3>{{ brand.name }}</h3>
              <span class="brands-page__logo">
                <span v-if="logoUrl(brand) && isMonochromeBrandLogo(brand.slug)" class="brands-page__logo-mask" :style="{ '--brand-logo-url': `url(${JSON.stringify(logoUrl(brand))})` }" aria-hidden="true" />
                <img v-else-if="logoUrl(brand) && !failedLogos.has(brand.id)" :src="logoUrl(brand)" alt="" width="220" height="88" loading="lazy" @error="markLogoFailed(brand.id)">
                <span v-else class="brands-page__no-logo">{{ copy.noLogo }}</span>
              </span>
            </NuxtLink>
          </li>
        </TransitionGroup>
      </section>
    </TransitionGroup>
    </BaseTransition>
    </div>
    </div>
  </section>
</template>

<style scoped>
.brands-page { padding: 2rem 0 3rem; }
.brands-page__results { overflow: clip; transition: height 350ms cubic-bezier(0.22, 1, 0.36, 1); }
.brands-page__results-content { display: flow-root; }
.brands-page__heading { max-width: 45rem; }
.brands-page__heading h1 { margin: 0; font-size: clamp(2.5rem, 6vw, 4.5rem); line-height: 1.05; }
.brands-page__tools { display: flex; align-items: end; justify-content: space-between; gap: 1.5rem; margin: 1.5rem 0; }
.brands-page__alphabet { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.brands-page__alphabet a { display: grid; place-items: center; min-width: 2.75rem; min-height: 2.75rem; border-bottom: 1px solid #d6d3d1; font-weight: 800; transition: opacity 250ms ease, color 180ms ease, background-color 180ms ease; }
.brands-page__alphabet a[aria-disabled="true"] { opacity: 0.3; cursor: default; }
.brands-page__alphabet a:not([aria-disabled="true"]):hover { background: #0a0a0a; color: white; }
.brands-page__search { width: 100%; max-width: 22rem; margin-left: auto; }
.brands-page__search :deep(.base-field__label) {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.brands-page__search-button { width: 2.9rem; min-height: 100%; padding: 0; }
.brands-page__groups { position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 2rem; align-items: start; }
.brands-page__group { min-width: 0; display: grid; grid-template-columns: 1.75rem minmax(0, 1fr); gap: 0.75rem; padding: 1rem 0; scroll-margin-top: calc(var(--shop-header-offset, 9rem) + 1rem); }
.brands-page__group h2 { font-size: 1.5rem; font-weight: 800; line-height: 1; }
.brands-page__grid, .brands-page__loading { position: relative; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
.brand-filter-move,
.brand-filter-enter-active,
.brand-filter-leave-active { transition: opacity 250ms ease, transform 300ms ease; }
.brand-filter-enter-from,
.brand-filter-leave-to { opacity: 0; transform: translateY(0.5rem); }
.brand-filter-leave-active { position: absolute; pointer-events: none; }
.brands-page__card { display: flex; height: 100%; flex-direction: column; gap: 0.75rem; padding: 0.25rem; }
.brands-page__card h3 { font-weight: 700; overflow-wrap: anywhere; }
.brands-page__logo { display: grid; place-items: center; min-height: 3.5rem; margin-top: auto; }
.brands-page__logo img, .brands-page__logo-mask { width: 100%; max-width: 10rem; height: 3.5rem; object-fit: contain; }
.brands-page__logo-mask { display: block; background: #0a0a0a; mask: var(--brand-logo-url) center / contain no-repeat; -webkit-mask: var(--brand-logo-url) center / contain no-repeat; }
.brands-page__no-logo { color: #78716c; font-size: 0.75rem; }
.brands-page__state { display: grid; justify-items: start; gap: 1rem; padding: 3rem 0; color: #57534e; }
.brands-page a:focus-visible { outline: 2px solid #0a0a0a; outline-offset: 4px; }
@media (max-width: 1023px) { .brands-page__groups { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 1.5rem; } }
@media (max-width: 767px) {
  .brands-page { padding-top: 2rem; }
  .brands-page__tools { flex-direction: column-reverse; align-items: stretch; gap: 1.5rem; }
  .brands-page__search { max-width: none; }
  .brands-page__groups { grid-template-columns: minmax(0, 1fr); }
  .brands-page__grid, .brands-page__loading { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
}
</style>

<style scoped>
@media (prefers-reduced-motion: reduce) {
  .app-fade-slide-enter-active, .app-fade-slide-leave-active,
  .brand-filter-move, .brand-filter-enter-active, .brand-filter-leave-active,
  .brands-page__alphabet a, .brands-page__results { transition: none; }
}
</style>
