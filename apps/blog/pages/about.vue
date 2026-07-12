<script setup lang="ts">
import communityImage from '~/assets/images/posts/barbering-museum-cover-1600.jpg'
import cultureAwardImage from '~/assets/images/about-community-award.webp'
import cultureSigningImage from '~/assets/images/about-community-signing.webp'

const { terms } = useBlogLocale()
const { trackBlogEvent } = useBlogAnalytics()
const runtimeConfig = useRuntimeConfig()

const about = computed(() => terms.value.about)
const siteUrl = computed(() => String(runtimeConfig.public.siteUrl).replace(/\/+$/, ''))
const pageUrl = computed(() => `${siteUrl.value}/about`)
const socialImageUrl = computed(() => new URL(communityImage, `${siteUrl.value}/`).toString())

const trackCta = (destination: 'posts' | 'booking') => {
  trackBlogEvent('navigation_click', {
    destination: destination === 'posts' ? 'about_stories' : 'about_booking',
    source: 'about_page',
  })
}

useSeoMeta({
  title: () => about.value.seoTitle,
  description: () => about.value.seoDescription,
  ogTitle: () => about.value.seoTitle,
  ogDescription: () => about.value.seoDescription,
  ogType: 'website',
  ogUrl: () => pageUrl.value,
  ogImage: () => socialImageUrl.value,
  twitterCard: 'summary_large_image',
})

useHead(() => ({
  link: [
    { rel: 'canonical', href: pageUrl.value },
    { rel: 'preload', as: 'image', href: communityImage, fetchpriority: 'high' },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'AboutPage',
        name: about.value.seoTitle,
        description: about.value.seoDescription,
        url: pageUrl.value,
        image: socialImageUrl.value,
        isPartOf: {
          '@type': 'WebSite',
          name: 'Soulcuts Journal',
          url: siteUrl.value,
        },
        about: {
          '@type': 'HairSalon',
          name: 'Soul Cuts',
          address: {
            '@type': 'PostalAddress',
            streetAddress: 'вулиця Канатна, 6',
            addressLocality: 'Одеса',
            addressCountry: 'UA',
          },
        },
      }),
    },
  ],
}))
</script>

<template>
  <div>
    <section data-header-theme="dark" class="overflow-hidden bg-neutral-950 pb-8 pt-28 text-white sm:pb-12 sm:pt-32 lg:pb-16">
      <div class="site-container">
        <div class="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] lg:items-end lg:gap-12">
          <div>
            <p class="eyebrow">{{ about.eyebrow }}</p>
            <h1 class="blog-display-title mt-5 max-w-5xl">
              {{ about.title }}
            </h1>
          </div>
          <p class="blog-body-copy max-w-xl border-l border-white/20 pl-5 text-white/65 lg:mb-2">
            {{ about.lede }}
          </p>
        </div>

        <figure class="mt-10 overflow-hidden bg-neutral-900 sm:mt-14 lg:mt-16">
          <img
            :src="communityImage"
            :alt="about.groupImageAlt"
            class="aspect-[16/11] w-full object-cover grayscale-[0.12] sm:aspect-[16/9]"
            width="1600"
            height="1067"
            loading="eager"
            fetchpriority="high"
            decoding="async"
          >
        </figure>
      </div>
    </section>

    <section data-header-theme="light" class="bg-stone-100 py-14 text-neutral-950 sm:py-20 lg:py-28">
      <div class="site-container">
        <div class="grid gap-8 lg:grid-cols-[0.55fr_1.45fr] lg:gap-16">
          <p class="type-eyebrow text-xs text-neutral-500">{{ about.identityEyebrow }}</p>
          <div>
            <h2 class="blog-section-title max-w-5xl">
              {{ about.identityTitle }}
            </h2>
            <div class="mt-8 grid gap-6 border-t border-neutral-300 pt-8 md:grid-cols-2 md:gap-10">
              <p v-for="paragraph in about.identityParagraphs" :key="paragraph" class="blog-body-copy text-neutral-600">
                {{ paragraph }}
              </p>
            </div>
          </div>
        </div>

        <ol class="mt-14 grid border-y border-neutral-300 md:grid-cols-3 lg:mt-20">
          <li
            v-for="(pillar, index) in about.pillars"
            :key="pillar.number"
            class="py-7 md:px-7 md:py-9"
            :class="index > 0 ? 'border-t border-neutral-300 md:border-l md:border-t-0' : ''"
          >
            <p class="text-xs font-semibold tracking-[0.2em] text-neutral-400">{{ pillar.number }}</p>
            <h3 class="mt-5 text-xl font-semibold uppercase">{{ pillar.title }}</h3>
            <p class="blog-body-copy mt-3 text-neutral-600">{{ pillar.text }}</p>
          </li>
        </ol>
      </div>
    </section>

    <section data-header-theme="dark" class="bg-neutral-950 py-14 text-white sm:py-20 lg:py-28">
      <div class="site-container grid gap-10 lg:grid-cols-[minmax(18rem,0.78fr)_minmax(0,1.22fr)] lg:items-center lg:gap-16">
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <figure class="overflow-hidden bg-neutral-900">
            <img
              :src="cultureAwardImage"
              :alt="about.cultureImageAlt"
              class="aspect-[4/5] w-full object-cover"
              width="1400"
              height="2112"
              loading="lazy"
              decoding="async"
            >
          </figure>
          <figure class="overflow-hidden bg-neutral-900 lg:ml-auto lg:w-[78%]">
            <img
              :src="cultureSigningImage"
              :alt="about.cultureSecondaryImageAlt"
              class="aspect-[4/5] w-full object-cover"
              width="1400"
              height="1867"
              loading="lazy"
              decoding="async"
            >
          </figure>
        </div>

        <div>
          <p class="eyebrow">{{ about.cultureEyebrow }}</p>
          <h2 class="blog-section-title mt-5 max-w-4xl text-white">
            {{ about.cultureTitle }}
          </h2>
          <div class="mt-8 grid gap-6 border-t border-white/15 pt-8 md:grid-cols-2 md:gap-8">
            <p v-for="paragraph in about.cultureParagraphs" :key="paragraph" class="blog-body-copy text-white/60">
              {{ paragraph }}
            </p>
          </div>
          <blockquote class="mt-10 border-l-2 border-lime-300 pl-6 text-lg font-medium leading-8 text-white sm:text-xl">
            {{ about.cultureQuote }}
          </blockquote>
        </div>
      </div>
    </section>

    <section data-header-theme="dark" class="bg-black py-14 text-white sm:py-20 lg:py-24">
      <div class="site-container grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] lg:gap-16">
        <div>
          <p class="type-eyebrow text-xs text-white/50">{{ about.journalEyebrow }}</p>
          <h2 class="blog-section-title mt-5 max-w-5xl text-white">
            {{ about.journalTitle }}
          </h2>
          <p class="blog-body-copy mt-7 max-w-3xl text-white/70">
            {{ about.journalDescription }}
          </p>
        </div>
        <ul class="border-t border-white/25 lg:mt-10">
          <li
            v-for="(point, index) in about.journalPoints"
            :key="point"
            class="grid grid-cols-[2.25rem_1fr] gap-3 border-b border-white/25 py-5 text-sm font-semibold uppercase leading-6"
          >
            <span class="text-white/40">0{{ index + 1 }}</span>
            <span>{{ point }}</span>
          </li>
        </ul>
      </div>
    </section>

    <section data-header-theme="dark" class="bg-neutral-950 py-14 text-white sm:py-20 lg:py-28">
      <div class="site-container">
        <p class="eyebrow">{{ about.ctaEyebrow }}</p>
        <div class="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)] lg:items-end lg:gap-16">
          <h2 class="blog-section-title max-w-5xl text-white">
            {{ about.ctaTitle }}
          </h2>
          <div>
            <p class="blog-body-copy text-white/60">{{ about.ctaDescription }}</p>
            <div class="mt-7 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <BaseButton to="/posts" variant="light" @click="trackCta('posts')">
                {{ about.storiesCta }}
              </BaseButton>
              <BaseButton href="/#booking-stepper" variant="outline-light" @click="trackCta('booking')">
                {{ about.bookingCta }}
              </BaseButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
