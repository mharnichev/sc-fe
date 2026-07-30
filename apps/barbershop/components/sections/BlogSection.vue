<script setup lang="ts">
type AssetModule = { default: string }

const { terms } = useTerms()

const blogHref = '/blog/'
const featuredPostHref = '/blog/posts/barbering-in-the-museum'
const featuredPostCover = ref('')
const featuredPostCard = ref<HTMLElement | null>(null)
let coverObserver: IntersectionObserver | null = null

const loadFeaturedPostCover = async () => {
  if (featuredPostCover.value) return

  const image = await import('../../../blog/assets/images/posts/barbering-museum-cover-1600.jpg') as AssetModule
  featuredPostCover.value = image.default
}

onMounted(() => {
  const target = featuredPostCard.value

  if (!target || typeof window.IntersectionObserver !== 'function') {
    window.setTimeout(loadFeaturedPostCover, 2800)
    return
  }

  coverObserver = new IntersectionObserver((entries) => {
    if (!entries.some(entry => entry.isIntersecting)) return

    coverObserver?.disconnect()
    coverObserver = null
    loadFeaturedPostCover()
  }, {
    rootMargin: '240px 0px',
  })

  coverObserver.observe(target)
})

onBeforeUnmount(() => {
  coverObserver?.disconnect()
})
</script>

<template>
  <section id="blog" data-header-theme="dark" class="section-y-large overflow-hidden bg-neutral-950 text-white">
    <div class="site-container">
      <div class="grid gap-10 lg:grid-cols-[0.44fr_0.56fr] lg:items-stretch lg:gap-16 xl:gap-20">
        <div class="flex flex-col justify-between gap-10" data-reveal="soft">
          <div>
            <SectionLabel class="text-white/70">{{ terms.home.blog.label }}</SectionLabel>
            <h2 class="section-title-inverse mt-4 max-w-xl">
              {{ terms.home.blog.title }}
            </h2>
            <p class="mt-5 max-w-xl text-base leading-8 text-white/68 sm:text-lg">
              {{ terms.home.blog.description }}
            </p>
          </div>

          <div class="grid gap-4 border-y border-white/15 py-5 sm:grid-cols-3">
            <div v-for="item in terms.home.blog.points" :key="item.label">
              <p class="type-meta text-xs text-white/38">
                {{ item.label }}
              </p>
              <p class="mt-2 text-sm font-semibold leading-6 text-white/82">
                {{ item.text }}
              </p>
            </div>
          </div>

          <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
            <BaseButton :href="blogHref" variant="light">
              {{ terms.home.blog.primaryCta }}
            </BaseButton>
            <a
              :href="featuredPostHref"
              class="type-meta inline-flex w-fit text-sm text-white/72 transition hover:text-white"
            >
              <BaseHoverUnderlineText>{{ terms.home.blog.secondaryCta }}</BaseHoverUnderlineText>
            </a>
          </div>
        </div>

        <article ref="featuredPostCard" data-reveal="image" data-reveal-delay="120">
          <a :href="featuredPostHref" class="group block h-full">
            <div class="relative min-h-[22rem] overflow-hidden bg-neutral-900 sm:min-h-[30rem] lg:h-full lg:min-h-[38rem]">
              <img
                v-if="featuredPostCover"
                :src="featuredPostCover"
                :alt="terms.home.blog.featured.coverAlt"
                class="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]"
                width="1600"
                height="1060"
                loading="lazy"
                decoding="async"
              >
              <div class="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/18 to-transparent" />
              <div class="type-meta absolute left-4 top-4 border border-white/30 bg-neutral-950/72 px-3 py-2 text-[11px] text-white/82 backdrop-blur sm:left-6 sm:top-6">
                {{ terms.home.blog.featured.category }}
              </div>
              <div class="absolute inset-x-0 bottom-0 p-4 sm:p-6 lg:p-8">
                <div class="type-meta flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/52">
                  <time datetime="2026-03-16">{{ terms.home.blog.featured.date }}</time>
                  <span>{{ terms.home.blog.featured.readTime }}</span>
                </div>
                <h3 class="type-display mt-4 max-w-2xl text-2xl leading-[0.98] text-white sm:text-2xl md:text-4xl lg:text-5xl">
                  {{ terms.home.blog.featured.title }}
                </h3>
                <p class="mt-4 max-w-xl text-sm font-semibold leading-7 text-white/72 sm:text-base sm:leading-8">
                  {{ terms.home.blog.featured.excerpt }}
                </p>
              </div>
            </div>
          </a>
        </article>
      </div>
    </div>
  </section>
</template>
