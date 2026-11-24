<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

defineProps<{ standalone?: boolean }>()

const { terms } = useTerms()
const copy = computed(() => terms.value.home.recruitment)
const contact = computed(() => terms.value.home.contact)
const applicationOpen = ref(false)

const section = ref<HTMLElement | null>(null)
const source = ref<string>()
const autoplay = ref(false)
let observer: IntersectionObserver | undefined
let mobile: MediaQueryList | undefined

const selectSource = () => {
  const size = mobile?.matches ? 'mobile' : 'desktop-light'
  source.value = `/videos/soulcuts-recruitment-${size}.webm`
}

const prepareVideo = () => {
  observer?.disconnect()
  autoplay.value = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  mobile = window.matchMedia('(max-width: 767px)')
  selectSource()
  mobile.addEventListener('change', selectSource)
}

onMounted(() => {
  if (!section.value || !('IntersectionObserver' in window)) {
    prepareVideo()
    return
  }

  observer = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting)) prepareVideo()
  }, { rootMargin: '240px 0px' })
  observer.observe(section.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  mobile?.removeEventListener('change', selectSource)
})
</script>

<template>
  <section
    id="join-the-team"
    ref="section"
    aria-labelledby="recruitment-title"
    data-header-theme="dark"
    :class="{ 'recruitment-section': !standalone }"
    class="relative isolate flex min-h-[26rem] scroll-mt-24 items-end overflow-hidden bg-neutral-950 text-white md:min-h-[clamp(32rem,48vw,46rem)]"
  >
    <video
      :src="source"
      poster="/videos/soulcuts-recruitment-poster.webp"
      :autoplay="autoplay"
      muted
      loop
      playsinline
      preload="none"
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
    />
    <div aria-hidden="true" class="pointer-events-none absolute inset-0 bg-neutral-950/25" />
    <div aria-hidden="true" class="pointer-events-none absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/35 to-transparent" />

    <div class="site-container relative flex w-full flex-col items-start gap-5 pb-10 pt-36 md:gap-7 md:pb-16">
      <div class="max-w-3xl">
        <component :is="standalone ? 'h1' : 'h2'" id="recruitment-title" class="section-title-inverse">
          {{ standalone ? copy.pageTitle : copy.title }}
        </component>
        <p class="mt-4 max-w-xl text-sm leading-7 text-white/58 sm:text-base">
          {{ copy.subtitle }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-x-6 gap-y-4">
        <BaseButton variant="outline-light" aria-haspopup="dialog" @click="applicationOpen = true">
          {{ copy.cta }}
        </BaseButton>
        <LocaleLink v-if="!standalone" to="/careers" class="text-sm font-semibold">
          <BaseHoverUnderlineText>{{ copy.detailsLink }}</BaseHoverUnderlineText>
        </LocaleLink>
      </div>
    </div>

    <BaseModal
      v-model="applicationOpen"
      type="right"
      :dialog-label="terms.home.feedback.label"
      :close-label="terms.common.close"
    >
      <template #header>
        <h2 class="text-xl font-semibold uppercase">{{ terms.home.feedback.label }}</h2>
      </template>

      <div class="grid gap-6 px-4 pb-8 pt-5 sm:px-6">
        <p class="max-w-xl text-sm leading-6 text-neutral-700">{{ copy.contactIntro }}</p>
        <div class="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
          <a :href="`tel:${contact.phone}`" class="underline underline-offset-4">{{ contact.phone }}</a>
          <a
            :href="`mailto:${contact.email}?subject=${encodeURIComponent(copy.emailSubject)}`"
            class="break-all underline underline-offset-4"
          >{{ contact.email }}</a>
        </div>
        <FeedbackForm :mail-subject="copy.emailSubject" />
      </div>
    </BaseModal>
  </section>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  @supports (animation-timeline: view()) {
    .recruitment-section {
      animation: recruitment-round-top 1ms cubic-bezier(0.55, 0.05, 0.8, 0.55) both;
      animation-timeline: view();
      animation-range: entry 0% entry 60%;
    }
  }
}

@keyframes recruitment-round-top {
  from {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }

  to {
    border-top-left-radius: clamp(32px, 5vw, 72px);
    border-top-right-radius: clamp(32px, 5vw, 72px);
  }
}
</style>
