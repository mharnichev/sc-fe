<script setup lang="ts">
import type { BrandDto } from '@shared-types'
import { initials, isMonochromeBrandLogo, localBrandLogoUrl } from '@shared-utils'

const { terms } = useTerms()
const domain = useBarbershopDomain()
const assetUrl = useAssetUrl()
const { data: brands, pending } = await useAsyncData('barbershop-product-brands', domain.getBrands, {
  default: () => [],
})

const brandLogoUrl = (brand: BrandDto) =>
  assetUrl(brand.logo_url) || localBrandLogoUrl(brand.slug)

const brandLogoMaskStyle = (brand: BrandDto) => ({
  '--brand-logo-url': `url(${JSON.stringify(brandLogoUrl(brand))})`,
})
</script>

<template>
  <section v-if="pending || brands.length" id="brands" class="section-y overflow-hidden bg-stone-100">
    <div class="site-container">
      <div class="grid gap-5 border-b border-neutral-950/15 pb-8 md:grid-cols-[0.36fr_0.64fr] md:items-end md:gap-12">
        <div data-reveal="soft">
          <SectionLabel>{{ terms.home.brands.label }}</SectionLabel>
          <h2 class="type-display mt-4 text-4xl leading-none tracking-[-0.04em] text-neutral-950 md:text-6xl">
            {{ terms.home.brands.title }}
          </h2>
        </div>
        <p class="max-w-2xl text-base leading-7 text-neutral-600 md:justify-self-end md:text-lg md:leading-8" data-reveal="soft" data-reveal-delay="100">
          {{ terms.home.brands.description }}
        </p>
      </div>

      <div
        class="brands-section__viewport mt-8 overflow-x-auto pb-3"
        role="region"
        :aria-label="terms.home.brands.listLabel"
        tabindex="0"
      >
        <ul class="brands-section__track" :aria-busy="pending">
          <template v-if="pending">
            <li v-for="index in 6" :key="`brand-loading-${index}`" class="brands-section__card brands-section__card--loading" aria-hidden="true" />
          </template>
          <template v-else>
            <li v-for="brand in brands" :key="brand.id" class="brands-section__card">
              <span class="brands-section__logo">
                <span
                  v-if="brandLogoUrl(brand) && isMonochromeBrandLogo(brand.slug)"
                  class="brands-section__mask"
                  :style="brandLogoMaskStyle(brand)"
                  role="img"
                  :aria-label="brand.name"
                />
                <img
                  v-else-if="brandLogoUrl(brand)"
                  :src="brandLogoUrl(brand)"
                  :alt="brand.name"
                  width="220"
                  height="110"
                  loading="lazy"
                  decoding="async"
                >
                <span v-else class="brands-section__initials" aria-hidden="true">{{ initials(brand.name) }}</span>
              </span>
              <strong>{{ brand.name }}</strong>
            </li>
          </template>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.brands-section__viewport {
  overscroll-behavior-inline: contain;
  scroll-snap-type: inline mandatory;
  scrollbar-color: rgb(10 10 10 / 0.38) transparent;
  scrollbar-width: thin;
}

.brands-section__viewport:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 0.35rem;
}

.brands-section__track {
  display: grid;
  grid-auto-columns: minmax(13rem, 72vw);
  grid-auto-flow: column;
  gap: 0.75rem;
}

.brands-section__card {
  display: grid;
  min-height: 11rem;
  grid-template-rows: 7.75rem auto;
  border: 1px solid rgb(10 10 10 / 0.14);
  background: rgb(255 255 255 / 0.58);
  color: #0a0a0a;
  scroll-snap-align: start;
}

.brands-section__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid rgb(10 10 10 / 0.1);
  padding: 1.25rem;
}

.brands-section__logo img,
.brands-section__mask {
  width: 100%;
  height: 100%;
}

.brands-section__logo img {
  object-fit: contain;
}

.brands-section__mask {
  display: block;
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

.brands-section__initials {
  font-size: 2rem;
  font-weight: 900;
  letter-spacing: -0.06em;
}

.brands-section__card > strong {
  align-self: center;
  padding: 0.9rem 1rem;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-align: center;
  text-transform: uppercase;
}

.brands-section__card--loading {
  background: linear-gradient(90deg, rgb(255 255 255 / 0.4) 25%, rgb(231 229 228 / 0.9) 50%, rgb(255 255 255 / 0.4) 75%);
  background-size: 200% 100%;
  animation: brands-loading 1.4s linear infinite;
}

@media (min-width: 640px) {
  .brands-section__track {
    grid-auto-columns: minmax(14rem, calc((100% - 1.5rem) / 3));
  }
}

@media (min-width: 1024px) {
  .brands-section__track {
    grid-auto-columns: minmax(14rem, calc((100% - 3rem) / 5));
  }
}

@media (prefers-reduced-motion: reduce) {
  .brands-section__card--loading {
    animation: none;
  }
}

@keyframes brands-loading {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}
</style>
