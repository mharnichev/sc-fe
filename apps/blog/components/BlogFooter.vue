<script setup lang="ts">
const { terms } = useBlogLocale()
const currentYear = new Date().getFullYear()
const footerEmail = ref('')
const { openSubscribeModal } = useSubscribeModal()
const { trackBlogEvent } = useBlogAnalytics()
const footerElement = ref<HTMLElement | null>(null)
const footerRevealOffset = ref<number | null>(null)
const shouldRevealFooter = ref(false)
const shouldShowFooterEmail = ref(false)
const contactEmail = 'Soulcutsplace@gmail.com'
const initialFooterRevealOffset = 'var(--blog-footer-height, 620px)'
const footerStyle = computed(() => ({
  transform: footerRevealOffset.value === null
    ? `translate3d(0, ${initialFooterRevealOffset}, 0)`
    : `translate3d(0, ${footerRevealOffset.value}px, 0)`,
  visibility: shouldRevealFooter.value ? 'visible' as const : 'hidden' as const,
}))

let revealFrame: number | null = null

const handleFooterSubscribe = () => {
  openSubscribeModal(footerEmail.value, 'footer')
  footerEmail.value = ''
}

const handleFooterNavigationClick = (destination: string) => {
  trackBlogEvent('navigation_click', {
    destination,
    source: 'footer',
  })
}

const handleFooterContactClick = (linkType: string) => {
  trackBlogEvent('contact_click', {
    link_type: linkType,
    source: 'footer',
  })
}

const openFooterEmail = () => {
  handleFooterContactClick('email')

  if (!import.meta.client) return

  window.location.href = `mailto:${contactEmail}`
}

const syncFooterHeight = () => {
  if (!import.meta.client) return 0

  const footerHeight = Math.ceil(footerElement.value?.offsetHeight ?? 0)

  if (footerHeight > 0) {
    document.documentElement.style.setProperty('--blog-footer-height', `${footerHeight}px`)
  }

  return footerHeight
}

const updateFooterReveal = () => {
  if (!import.meta.client) return

  revealFrame = null

  const footerHeight = syncFooterHeight()
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (footerHeight <= 0) {
    footerRevealOffset.value = 0
    return
  }

  const main = document.querySelector('main')
  const mainBottom = main?.getBoundingClientRect().bottom ?? window.innerHeight
  const viewportHeight = window.innerHeight || 1
  const revealRange = Math.min(footerHeight, viewportHeight)
  const revealDistance = footerHeight
  const progress = Math.min(1, Math.max(0, (viewportHeight - mainBottom) / revealRange))
  shouldRevealFooter.value = progress > 0

  footerRevealOffset.value = reduceMotion
    ? progress >= 1 ? 0 : revealDistance
    : Number(((1 - progress) * revealDistance).toFixed(2))
}

const requestFooterRevealUpdate = () => {
  if (!import.meta.client || revealFrame !== null) {
    return
  }

  revealFrame = window.requestAnimationFrame(updateFooterReveal)
}

onMounted(() => {
  if (!import.meta.client) return

  window.addEventListener('scroll', requestFooterRevealUpdate, { passive: true })
  window.addEventListener('resize', requestFooterRevealUpdate)
  shouldShowFooterEmail.value = true
  requestFooterRevealUpdate()
})

onBeforeUnmount(() => {
  if (!import.meta.client) return

  window.removeEventListener('scroll', requestFooterRevealUpdate)
  window.removeEventListener('resize', requestFooterRevealUpdate)

  if (revealFrame !== null) {
    window.cancelAnimationFrame(revealFrame)
  }
})
</script>

<template>
  <footer
    ref="footerElement"
    class="fixed inset-x-0 bottom-0 z-0 overflow-hidden bg-black py-8 text-white will-change-transform md:py-12"
    :style="footerStyle"
  >
    <div class="site-container">
      <div class="grid gap-7 md:gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(20rem,0.65fr)] lg:items-end lg:gap-12">
        <div class="w-full space-y-3 md:space-y-5">
          <p class="text-xs font-bold uppercase tracking-[0.28em] text-white/50">{{ terms.footerEyebrow }}</p>
          <h2 class="max-w-3xl text-3xl font-black leading-tight text-white sm:text-4xl uppercase">
            {{ terms.footerHeadline }}
          </h2>
          <p class="max-w-2xl text-sm leading-7 text-white/60 md:text-base md:leading-8">
            {{ terms.footerDescription }}
          </p>
        </div>

        <form class="grid gap-3 sm:grid-cols-[1fr_auto]" novalidate @submit.prevent="handleFooterSubscribe">
          <label class="sr-only" for="footer-newsletter-email">{{ terms.emailAddress }}</label>
          <input
            id="footer-newsletter-email"
            v-model="footerEmail"
            class="glass-control glass-control--dark min-h-12 w-full px-4 text-sm text-white outline-none placeholder:text-neutral-500"
            type="email"
            inputmode="email"
            autocomplete="email"
            :placeholder="terms.emailPlaceholder"
          >
          <BaseButton
            variant="light"
            type="submit"
          >
            {{ terms.subscribe }}
          </BaseButton>
        </form>
      </div>

      <div class="mt-8 grid gap-7 border-t border-white/10 pt-8 md:mt-12 md:grid-cols-[1.2fr_0.8fr_0.8fr] md:gap-8">
        <div>
          <p class="text-sm font-black uppercase tracking-[0.28em]">Soulcuts</p>
          <p class="mt-4 max-w-sm text-sm leading-7 text-white/55">
            {{ terms.footerBrandDescription }}
          </p>
        </div>

        <div>
          <p class="text-xs font-bold uppercase tracking-[0.22em] text-white/45">{{ terms.footerExplore }}</p>
          <div class="mt-4 grid gap-2 text-sm text-white/70">
            <NuxtLink class="transition hover:text-white" to="/" @click="handleFooterNavigationClick('blog_home')">
              {{ terms.home }}
            </NuxtLink>
            <NuxtLink class="transition hover:text-white" to="/posts" @click="handleFooterNavigationClick('all_posts')">
              {{ terms.allPosts }}
            </NuxtLink>
            <a class="transition hover:text-white" href="/#booking-stepper" @click="handleFooterNavigationClick('barbershop_booking')">
              {{ terms.bookOnline }}
            </a>
            <button class="text-left transition hover:text-white" type="button" @click="openSubscribeModal('', 'footer_nav')">
              {{ terms.newsletter }}
            </button>
          </div>
        </div>

        <div>
          <p class="text-xs font-bold uppercase tracking-[0.22em] text-white/45">{{ terms.footerVisit }}</p>
          <div class="mt-4 space-y-2 text-sm text-white/70">
            <p>
              <a
                class="underline decoration-white/20 underline-offset-4 transition hover:text-white hover:decoration-white"
                href="https://maps.google.com/?q=Soulcuts"
                target="_blank"
                rel="noopener noreferrer"
                @click="handleFooterContactClick('map')"
              >
                {{ terms.footerLocation }}
              </a>
            </p>
            <p>
              <button type="button" class="transition hover:text-white" @click="openFooterEmail">
                {{ shouldShowFooterEmail ? contactEmail : terms.emailAddress }}
              </button>
            </p>
          </div>
        </div>
      </div>

      <div class="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
        <p>{{ terms.footerCopyrightPrefix }} {{ currentYear }} Soulcuts Journal.</p>
        <p>{{ terms.footerTagline }}</p>
      </div>
    </div>
  </footer>
</template>
