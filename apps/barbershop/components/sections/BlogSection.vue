<script setup lang="ts">
type AssetModule = { default: string }

const { terms } = useTerms()

const blogHref = '/blog/'
const leadPostHref = '/blog/posts/history-of-idem-na-bukvy'
const secondaryPostHref = '/blog/posts/barbering-in-the-museum'
const leadPostCover = ref('')
const leadPostCoverMobile = ref('')
const secondaryPostCover = ref('')
const postGrid = ref<HTMLElement | null>(null)
let coverObserver: IntersectionObserver | null = null

const loadPostCovers = async () => {
  if (leadPostCover.value) return

  const [leadImage, leadMobileImage, secondaryImage] = await Promise.all([
    import('~/assets/images/main/idem-na-bukvy-blog-cover.webp') as Promise<AssetModule>,
    import('~/assets/images/main/idem-na-bukvy-blog-cover-mobile.webp') as Promise<AssetModule>,
    import('../../../blog/assets/images/posts/barbering-museum-cover-1600.jpg') as Promise<AssetModule>,
  ])

  leadPostCover.value = leadImage.default
  leadPostCoverMobile.value = leadMobileImage.default
  secondaryPostCover.value = secondaryImage.default
}

onMounted(() => {
  const target = postGrid.value

  if (!target || typeof window.IntersectionObserver !== 'function') {
    window.setTimeout(loadPostCovers, 2800)
    return
  }

  coverObserver = new IntersectionObserver((entries) => {
    if (!entries.some(entry => entry.isIntersecting)) return

    coverObserver?.disconnect()
    coverObserver = null
    loadPostCovers()
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
      <div class="mb-8 flex flex-col gap-5 md:mb-10 md:flex-row md:items-end md:justify-between" data-reveal="soft">
        <div>
          <SectionLabel class="text-white/60">{{ terms.home.blog.label }}</SectionLabel>
          <h2 class="section-title-inverse mt-4 max-w-3xl">
            {{ terms.home.blog.title }}
          </h2>
          <p class="mt-4 max-w-xl text-sm leading-7 text-white/58 sm:text-base">
            {{ terms.home.blog.description }}
          </p>
        </div>

        <a :href="blogHref" class="type-meta inline-flex w-fit pb-1 text-sm text-white/76 transition hover:text-white">
          <BaseHoverUnderlineText>{{ terms.home.blog.primaryCta }}</BaseHoverUnderlineText>
        </a>
      </div>

      <div ref="postGrid" class="grid gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(17rem,0.7fr)] lg:items-stretch">
        <article data-reveal="image" data-reveal-delay="80">
          <a :href="leadPostHref" class="group block h-full">
            <div class="relative min-h-[28rem] overflow-hidden bg-neutral-900 sm:min-h-[36rem] lg:h-full lg:min-h-[42rem]">
              <picture v-if="leadPostCover" class="absolute inset-0 h-full w-full">
                <source
                  v-if="leadPostCoverMobile"
                  :srcset="leadPostCoverMobile"
                  media="(max-width: 767px)"
                >
                <img
                  :src="leadPostCover"
                  :alt="terms.home.blog.lead.coverAlt"
                  class="h-full w-full object-cover transition duration-700 group-hover:scale-[1.02]"
                  width="1920"
                  height="1080"
                  loading="lazy"
                  decoding="async"
                >
              </picture>
              <div class="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/5 to-transparent" />
              <p class="type-meta absolute left-5 top-20 bg-neutral-950/70 px-3 py-2 text-[11px] text-white/78 backdrop-blur sm:left-7 sm:top-7">
                {{ terms.home.blog.lead.category }}
              </p>
              <div class="absolute inset-x-0 bottom-0 p-5 sm:p-7 lg:p-9">
                <div class="type-meta flex items-center gap-4 text-xs text-white/52">
                  <time datetime="2026-07-14">{{ terms.home.blog.lead.date }}</time>
                  <span>{{ terms.home.blog.lead.readTime }}</span>
                </div>
                <h3 class="type-display mt-4 max-w-4xl text-3xl leading-[0.98] text-white sm:text-5xl lg:text-6xl">
                  {{ terms.home.blog.lead.title }}
                </h3>
              </div>
            </div>
          </a>
        </article>

        <article class="bg-white/[0.055]" data-reveal="soft" data-reveal-delay="160">
          <a :href="secondaryPostHref" class="group grid h-full sm:grid-cols-[0.46fr_0.54fr] lg:grid-cols-1 lg:grid-rows-[minmax(17rem,1fr)_auto]">
            <div class="relative min-h-56 overflow-hidden bg-neutral-900 sm:min-h-64 lg:min-h-0">
              <img
                v-if="secondaryPostCover"
                :src="secondaryPostCover"
                :alt="terms.home.blog.featured.coverAlt"
                class="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]"
                width="1600"
                height="1060"
                loading="lazy"
                decoding="async"
              >
            </div>
            <div class="flex flex-col justify-end p-5 pr-24 sm:p-6 lg:p-7">
              <p class="type-meta text-[11px] text-white/48">
                {{ terms.home.blog.featured.category }}
              </p>
              <h3 class="type-card-title mt-4 text-2xl leading-tight text-white lg:text-3xl">
                {{ terms.home.blog.featured.title }}
              </h3>
              <time class="type-meta mt-5 text-xs text-white/42" datetime="2026-03-16">
                {{ terms.home.blog.featured.date }}
              </time>
            </div>
          </a>
        </article>
      </div>
    </div>
  </section>
</template>
