<script setup lang="ts">
import introSectionPhotos from '~/assets/images/intro/intro-section-photos.webp'
import logoNameDark from '~/assets/images/main/sc-logo-name-dark.webp'

const { terms } = useTerms()

const isIntroExpanded = ref(false)

const introText = computed(() => {
  const text = terms.value.home.intro.text

  return Array.isArray(text) ? text : [text]
})

const hasIntroAccordion = computed(() => introText.value.length > 2)
</script>

<template>
  <section id="approach" data-header-theme="dark" class="section-y bg-neutral-950 text-white">
    <div class="site-container flex flex-col items-center gap-8 md:gap-12" data-reveal="soft">
      <img
        :src="logoNameDark"
        alt="Soul Cuts"
        class="m-auto h-auto w-56 sm:w-72 lg:w-80"
        width="320"
        height="120"
      >

      <div class="flex w-full flex-col gap-8 min-[560px]:flex-row min-[560px]:items-stretch md:gap-12">
        <div class="order-last mx-auto w-full max-w-md overflow-hidden rounded-lg min-[560px]:sticky min-[560px]:top-24 min-[560px]:order-first min-[560px]:mx-0 min-[560px]:w-[38%] min-[560px]:max-w-none min-[560px]:self-start" data-reveal="image" data-reveal-delay="120">
          <img
            :src="introSectionPhotos"
            :alt="terms.home.intro.imageAlt"
            class="aspect-[4/5] h-full w-full object-contain"
            width="760"
            height="950"
            loading="lazy"
          >
        </div>

        <div class="flex w-full flex-col gap-8 min-[560px]:flex-1 md:gap-12" data-reveal="soft" data-reveal-delay="220">
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
            <div class="relative">
              <div
                id="intro-philosophy-text"
                class="overflow-hidden transition-[max-height] duration-500 ease-in-out xl:max-h-none xl:overflow-visible"
                :class="hasIntroAccordion && !isIntroExpanded ? 'max-h-40' : 'max-h-[72rem]'"
              >
                <p
                  v-for="paragraph in introText"
                  :key="paragraph"
                  class="mt-3 text-base leading-7 text-white/60 first:mt-0 md:mt-4 md:leading-8"
                >
                  {{ paragraph }}
                </p>
              </div>
              <div
                v-if="hasIntroAccordion && !isIntroExpanded"
                class="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-neutral-950 to-transparent xl:hidden"
              />
            </div>
            <button
              v-if="hasIntroAccordion"
              type="button"
              class="mt-4 inline-flex items-center gap-2 border-b border-white/40 pb-1 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:border-white xl:hidden"
              :aria-expanded="isIntroExpanded"
              aria-controls="intro-philosophy-text"
              @click="isIntroExpanded = !isIntroExpanded"
            >
              {{ isIntroExpanded ? terms.home.intro.readLess : terms.home.intro.readAll }}
              <span class="intro-accordion-arrow h-2 w-2 border-b border-r border-current" :class="{ 'is-open': isIntroExpanded }" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.intro-accordion-arrow {
  transform: translateY(-2px) rotate(45deg);
  transition: transform 220ms ease;
}

.intro-accordion-arrow.is-open {
  transform: translateY(2px) rotate(225deg);
}
</style>
