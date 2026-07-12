<script setup lang="ts">
const { terms } = useBlogLocale()
const currentYear = new Date().getFullYear()
const footerEmail = ref('')
const { openSubscribeModal } = useSubscribeModal()
const { trackBlogEvent } = useBlogAnalytics()
const shouldShowFooterEmail = ref(false)
const contactEmail = 'Soulcutsplace@gmail.com'

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

onMounted(() => {
  shouldShowFooterEmail.value = true
})
</script>

<template>
  <footer class="overflow-hidden bg-black py-8 text-white md:py-12">
    <div class="site-container">
      <div class="grid gap-7 md:gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(20rem,0.65fr)] lg:items-end lg:gap-12">
        <div class="w-full space-y-3 md:space-y-5">
          <p class="type-eyebrow text-xs text-white/50">{{ terms.footerEyebrow }}</p>
          <h2 class="blog-feature-title max-w-3xl text-white">
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
          <p class="type-eyebrow text-sm">Soulcuts</p>
          <p class="mt-4 max-w-sm text-sm leading-7 text-white/55">
            {{ terms.footerBrandDescription }}
          </p>
        </div>

        <div>
          <p class="type-eyebrow text-xs text-white/45">{{ terms.footerExplore }}</p>
          <div class="mt-4 grid gap-2 text-sm text-white/70">
            <NuxtLink class="transition hover:text-white" to="/" @click="handleFooterNavigationClick('blog_home')">
              {{ terms.home }}
            </NuxtLink>
            <NuxtLink class="transition hover:text-white" to="/posts" @click="handleFooterNavigationClick('all_posts')">
              {{ terms.allPosts }}
            </NuxtLink>
            <NuxtLink class="transition hover:text-white" to="/about" @click="handleFooterNavigationClick('about')">
              {{ terms.about.eyebrow }}
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
          <p class="type-eyebrow text-xs text-white/45">{{ terms.footerVisit }}</p>
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
