<script setup lang="ts">
const currentYear = new Date().getFullYear()
const footerEmail = ref('')
const footerMessage = ref('')
const footerStatus = ref<'idle' | 'error' | 'success'>('idle')
const footerElement = ref<HTMLElement | null>(null)
const footerRevealOffset = ref(0)
const footerStyle = computed(() => ({
  transform: `translate3d(0, ${footerRevealOffset.value}px, 0)`,
}))

let revealFrame: number | null = null
const isValidFooterEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

const handleFooterSubscribe = () => {
  if (!isValidFooterEmail(footerEmail.value)) {
    footerStatus.value = 'error'
    footerMessage.value = 'Enter a valid email address.'
    return
  }

  footerStatus.value = 'success'
  footerMessage.value = 'Thanks. This is a placeholder subscription for now.'
  footerEmail.value = ''
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

  if (reduceMotion || footerHeight <= 0) {
    footerRevealOffset.value = 0
    return
  }

  const main = document.querySelector('main')
  const mainBottom = main?.getBoundingClientRect().bottom ?? window.innerHeight
  const viewportHeight = window.innerHeight || 1
  const revealRange = Math.min(footerHeight, viewportHeight)
  const revealDistance = Math.min(footerHeight * 0.35, viewportHeight * 0.24)
  const progress = Math.min(1, Math.max(0, (viewportHeight - mainBottom) / revealRange))

  footerRevealOffset.value = Number(((1 - progress) * revealDistance).toFixed(2))
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
    class="fixed inset-x-0 bottom-0 z-0 overflow-hidden border-t border-neutral-800 bg-black py-8 text-white will-change-transform md:py-12"
    :style="footerStyle"
  >
    <div class="site-container">
      <div class="grid gap-7 md:gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(20rem,0.65fr)] lg:items-end lg:gap-12">
        <div class="w-full space-y-3 md:space-y-5">
          <p class="text-xs font-bold uppercase tracking-[0.28em] text-red-400">Soulcuts Journal</p>
          <h2 class="max-w-3xl text-3xl font-black leading-tight text-white sm:text-4xl md:text-5xl">
            Independent notes from the Soulcuts team.
          </h2>
          <p class="max-w-2xl text-sm leading-7 text-white/60 md:text-base md:leading-8">
            A public journal for culture, music, city notes, and the stories around the studio.
          </p>
        </div>

        <form class="grid gap-3 sm:grid-cols-[1fr_auto]" novalidate @submit.prevent="handleFooterSubscribe">
          <label class="sr-only" for="footer-newsletter-email">Email address</label>
          <input
            id="footer-newsletter-email"
            v-model="footerEmail"
            class="min-h-12 w-full border border-white/15 bg-neutral-900 px-4 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-red-400"
            type="email"
            inputmode="email"
            autocomplete="email"
            placeholder="you@example.com"
            aria-describedby="footer-newsletter-message"
          >
          <button
            class="min-h-12 border border-red-500 bg-red-500 px-6 text-sm font-bold uppercase tracking-[0.16em] text-white transition hover:border-red-600 hover:bg-red-600"
            type="submit"
          >
            Subscribe
          </button>
          <p
            id="footer-newsletter-message"
            class="sm:col-span-2 text-sm"
            :class="footerStatus === 'error' ? 'text-red-300' : 'text-white/65'"
            aria-live="polite"
          >
            {{ footerMessage }}
          </p>
        </form>
      </div>

      <div class="mt-8 grid gap-7 border-t border-white/10 pt-8 md:mt-12 md:grid-cols-[1.2fr_0.8fr_0.8fr] md:gap-8">
        <div>
          <p class="text-sm font-black uppercase tracking-[0.28em]">Soulcuts</p>
          <p class="mt-4 max-w-sm text-sm leading-7 text-white/55">
            Browse stories, interviews, guides, and field notes from the studio.
          </p>
        </div>

        <div>
          <p class="text-xs font-bold uppercase tracking-[0.22em] text-white/45">Explore</p>
          <div class="mt-4 grid gap-2 text-sm text-white/70">
            <NuxtLink class="transition hover:text-white" to="/">
              Home
            </NuxtLink>
            <NuxtLink class="transition hover:text-white" to="/posts">
              All posts
            </NuxtLink>
            <a class="transition hover:text-white" href="#newsletter">
              Newsletter
            </a>
          </div>
        </div>

        <div>
          <p class="text-xs font-bold uppercase tracking-[0.22em] text-white/45">Visit</p>
          <div class="mt-4 space-y-2 text-sm text-white/70">
            <p>
              <a
                class="underline decoration-white/20 underline-offset-4 transition hover:text-white hover:decoration-white"
                href="https://maps.google.com/?q=Soulcuts"
                target="_blank"
                rel="noopener noreferrer"
              >
                Kyiv, Ukraine
              </a>
            </p>
            <p>
              <a class="transition hover:text-white" href="mailto:Soulcutsplace@gmail.com">
                Soulcutsplace@gmail.com
              </a>
            </p>
          </div>
        </div>
      </div>

      <div class="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
        <p>Copyright {{ currentYear }} Soulcuts Journal.</p>
        <p>Independent notes from the Soulcuts team.</p>
      </div>
    </div>
  </footer>
</template>
