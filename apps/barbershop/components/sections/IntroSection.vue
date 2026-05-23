<script setup lang="ts">
import introSectionPhotos from '~/assets/images/intro/intro-section-photos.webp'
import logoNameDark from '~/assets/images/main/sc-logo-name-dark.webp'

const { terms } = useTerms()

const introText = computed(() => {
  const text = terms.value.home.intro.text

  return Array.isArray(text) ? text : [text]
})
</script>

<template>
  <section data-header-theme="dark" class="section-y bg-neutral-950 text-white">
    <div class="site-container flex flex-col items-center gap-8 md:gap-12" data-reveal="soft">
      <img
        :src="logoNameDark"
        alt="Soul Cuts"
        class="m-auto h-auto w-56 sm:w-72 lg:w-80"
        width="320"
        height="120"
      >

      <div class="flex w-full flex-col gap-8 md:gap-12 lg:flex-row lg:items-stretch">
        <div class="order-last overflow-hidden rounded-lg lg:order-first lg:w-[38%]" data-reveal="image" data-reveal-delay="120">
          <img
            :src="introSectionPhotos"
            :alt="terms.home.intro.imageAlt"
            class="aspect-[4/5] h-full w-full object-contain"
            width="760"
            height="950"
            loading="lazy"
          >
        </div>

        <div class="flex w-full flex-col gap-8 md:gap-12 lg:flex-1" data-reveal="soft" data-reveal-delay="220">
          <div class="flex w-full flex-col">
            <SectionLabel>{{ terms.home.intro.label }}</SectionLabel>
            <p class="mt-4 max-w-5xl text-2xl font-semibold leading-tight text-white lg:mt-6 lg:text-3xl">
              {{ terms.home.intro.quote }}
            </p>
          </div>
          <div class="border-l border-white/15 pl-4 md:pl-6">
            <p class="text-sm font-semibold uppercase tracking-[0.2em] text-white">
              {{ terms.home.intro.author }}
            </p>
            <p
              v-for="paragraph in introText"
              :key="paragraph"
              class="mt-3 text-base leading-7 text-white/60 first:mt-0 md:mt-4 md:leading-8"
            >
              {{ paragraph }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
