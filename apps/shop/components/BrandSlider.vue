<script setup lang="ts">
import type { BrandDto } from '@shared-types'

const props = withDefaults(defineProps<{
  brands?: BrandDto[]
  pending?: boolean
}>(), {
  brands: () => [],
  pending: false,
})

const config = useRuntimeConfig()
const requestUrl = useRequestURL()
const { terms } = useShopLocale()
const viewport = ref<HTMLElement | null>(null)
const canScrollBack = ref(false)
const canScrollForward = ref(false)
let resizeObserver: ResizeObserver | undefined

const updateControls = () => {
  const element = viewport.value
  if (!element) return

  canScrollBack.value = element.scrollLeft > 2
  canScrollForward.value = element.scrollLeft + element.clientWidth < element.scrollWidth - 2
}

const scrollBrands = (direction: -1 | 1) => {
  const element = viewport.value
  if (!element) return

  element.scrollBy({
    left: direction * Math.max(260, element.clientWidth * 0.8),
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  })
}

const resolveLogoUrl = (value: string | null | undefined) => {
  const url = value?.trim()
  if (!url) return ''
  if (/^(?:https?:|data:|blob:)/i.test(url)) return url

  try {
    const apiOrigin = new URL(String(config.public.apiBase), requestUrl.origin).origin
    return new URL(url, apiOrigin).toString()
  }
  catch {
    return url
  }
}

const brandInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0])
    .join('')
    .toUpperCase()

onMounted(() => {
  resizeObserver = new ResizeObserver(updateControls)
  if (viewport.value) resizeObserver.observe(viewport.value)
  nextTick(updateControls)
})

watch(() => props.brands.length, () => nextTick(updateControls))

onBeforeUnmount(() => resizeObserver?.disconnect())
</script>

<template>
  <section v-if="pending || brands.length" class="brand-slider">
    <div class="brand-slider__heading">
      <div class="brand-slider__copy">
        <p class="brand-slider__eyebrow">{{ terms.home.brandsEyebrow }}</p>
        <h2>{{ terms.home.brandsTitle }}</h2>
        <p>{{ terms.home.brandsDescription }}</p>
      </div>

      <div class="brand-slider__controls">
        <button
          type="button"
          :aria-label="terms.home.previousBrands"
          :disabled="!canScrollBack"
          @click="scrollBrands(-1)"
        >
          <BaseIcon name="chevron-left" size="xxs" />
        </button>
        <button
          type="button"
          :aria-label="terms.home.nextBrands"
          :disabled="!canScrollForward"
          @click="scrollBrands(1)"
        >
          <BaseIcon name="chevron-right" size="xxs" />
        </button>
      </div>
    </div>

    <div
      ref="viewport"
      class="brand-slider__viewport"
      role="region"
      :aria-label="terms.home.brandsSliderLabel"
      tabindex="0"
      @scroll.passive="updateControls"
    >
      <ul class="brand-slider__track">
        <template v-if="pending">
          <li v-for="index in 5" :key="`brand-skeleton-${index}`" class="brand-slider__skeleton" aria-hidden="true">
            <span />
            <i />
            <i />
          </li>
        </template>
        <template v-else>
          <li v-for="brand in brands" :key="brand.id" class="brand-slider__item">
            <NuxtLink
              class="brand-slider__card"
              :to="{ path: '/catalog', query: { brand: brand.slug } }"
              :aria-label="terms.home.viewBrand(brand.name)"
            >
              <span class="brand-slider__logo">
                <img
                  v-if="resolveLogoUrl(brand.logo_url)"
                  :src="resolveLogoUrl(brand.logo_url)"
                  :alt="brand.name"
                  width="240"
                  height="120"
                  loading="lazy"
                >
                <span v-else aria-hidden="true">{{ brandInitials(brand.name) }}</span>
              </span>

              <span class="brand-slider__body">
                <strong>{{ brand.name }}</strong>
                <span v-if="brand.description">{{ brand.description }}</span>
                <span class="brand-slider__link">
                  {{ terms.home.viewBrand(brand.name) }}
                  <BaseIcon name="chevron-right" size="xxs" />
                </span>
              </span>
            </NuxtLink>
          </li>
        </template>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.brand-slider {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1.25rem;
}

.brand-slider__heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2rem;
}

.brand-slider__copy {
  min-width: 0;
}

.brand-slider__eyebrow {
  color: #d97706;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.3em;
  text-transform: uppercase;
}

.brand-slider__copy h2 {
  padding-top: 0.75rem;
  color: #1c1917;
  font-size: 1.875rem;
  font-weight: 600;
  line-height: 1.2;
}

.brand-slider__copy > p:last-child {
  max-width: 42rem;
  padding-top: 0.5rem;
  color: #57534e;
  font-size: 0.875rem;
  line-height: 1.75rem;
}

.brand-slider__controls {
  display: flex;
  flex: 0 0 auto;
  gap: 0.5rem;
}

.brand-slider__controls button {
  display: inline-flex;
  width: 2.75rem;
  height: 2.75rem;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(10 10 10 / 0.18);
  border-radius: 9999px;
  background: #ffffff;
  color: #0a0a0a;
  transition: border-color 180ms ease, background-color 180ms ease, color 180ms ease, opacity 180ms ease;
}

.brand-slider__controls button:not(:disabled):hover,
.brand-slider__controls button:not(:disabled):focus-visible {
  border-color: #0a0a0a;
  background: #0a0a0a;
  color: #ffffff;
}

.brand-slider__controls button:disabled {
  cursor: default;
  opacity: 0.28;
}

.brand-slider__viewport {
  min-width: 0;
  overflow-x: auto;
  padding: 0.25rem 0 0.75rem;
  overscroll-behavior-inline: contain;
  scroll-behavior: smooth;
  scroll-snap-type: inline mandatory;
  scrollbar-color: #a3a3a3 transparent;
  scrollbar-width: thin;
}

.brand-slider__viewport:focus-visible {
  outline: 2px solid #0a0a0a;
  outline-offset: 0.25rem;
}

.brand-slider__track {
  display: grid;
  grid-auto-columns: minmax(17rem, 82vw);
  grid-auto-flow: column;
  gap: 0.75rem;
}

.brand-slider__item {
  display: flex;
  min-width: 0;
  scroll-snap-align: start;
}

.brand-slider__card {
  display: grid;
  width: 100%;
  min-height: 17rem;
  grid-template-rows: 8.75rem 1fr;
  overflow: hidden;
  border: 1px solid rgb(10 10 10 / 0.1);
  border-radius: 0.75rem;
  background: #ffffff;
  color: inherit;
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.brand-slider__card:hover,
.brand-slider__card:focus-visible {
  border-color: rgb(10 10 10 / 0.24);
  box-shadow: 0 1rem 1.5rem rgb(108 116 167 / 0.14);
  transform: translateY(-0.125rem);
}

.brand-slider__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid rgb(10 10 10 / 0.08);
  background: #f5f5f4;
  padding: 1.5rem;
}

.brand-slider__logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.brand-slider__logo > span {
  color: #292524;
  font-size: 2.25rem;
  font-weight: 800;
  letter-spacing: -0.06em;
}

.brand-slider__body {
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding: 1rem;
}

.brand-slider__body > strong {
  color: #1c1917;
  font-size: 1rem;
  font-weight: 700;
}

.brand-slider__body > span:not(.brand-slider__link) {
  display: -webkit-box;
  overflow: hidden;
  padding-top: 0.35rem;
  color: #57534e;
  font-size: 0.8125rem;
  line-height: 1.25rem;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.brand-slider__link {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.75rem;
  color: #0a0a0a;
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1.1rem;
  text-transform: uppercase;
}

.brand-slider__skeleton {
  display: grid;
  min-height: 17rem;
  grid-template-rows: 8.75rem auto auto;
  gap: 0.75rem;
  border: 1px solid rgb(10 10 10 / 0.08);
  border-radius: 0.75rem;
  padding: 1rem;
  scroll-snap-align: start;
}

.brand-slider__skeleton span,
.brand-slider__skeleton i {
  border-radius: 0.375rem;
  background: linear-gradient(90deg, #f5f5f4 25%, #e7e5e4 50%, #f5f5f4 75%);
  background-size: 200% 100%;
  animation: brand-slider-pulse 1.4s infinite linear;
}

.brand-slider__skeleton i {
  width: 72%;
  height: 0.875rem;
}

.brand-slider__skeleton i:last-child {
  width: 92%;
}

@media (min-width: 640px) {
  .brand-slider__track {
    grid-auto-columns: minmax(18rem, calc((100% - 0.75rem) / 2));
  }
}

@media (min-width: 1024px) {
  .brand-slider__track {
    grid-auto-columns: minmax(17rem, calc((100% - 2.25rem) / 4));
  }
}

@media (prefers-reduced-motion: reduce) {
  .brand-slider__viewport {
    scroll-behavior: auto;
  }

  .brand-slider__card,
  .brand-slider__controls button,
  .brand-slider__skeleton span,
  .brand-slider__skeleton i {
    animation: none;
    transition: none;
  }
}

@keyframes brand-slider-pulse {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}
</style>
