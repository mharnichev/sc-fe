<script setup lang="ts">
import { getPostBySlug, getRelatedPosts, loadBlogPostImage, localizePost, type BlogPostImageKey } from '~/data/posts'

type AssetModule = { default: string }

const { locale, terms } = useBlogLocale()
const { trackBlogEvent } = useBlogAnalytics()
const route = useRoute()
const slug = Array.isArray(route.params.slug) ? route.params.slug[0] : route.params.slug

if (typeof slug !== 'string' || !slug) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Post not found',
  })
}

const rawPost = getPostBySlug(slug)

if (!rawPost) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Post not found',
  })
}

const isUnlisted = rawPost.visibility === 'unlisted'

if (isUnlisted) {
  const robotsHeader = useResponseHeader('X-Robots-Tag')
  robotsHeader.value = 'noindex, nofollow, noarchive, nosnippet'
}

const post = computed(() => localizePost(rawPost, locale.value))
const relatedPosts = computed(() => getRelatedPosts(rawPost.slug, locale.value))
const postContent = ref<HTMLElement | null>(null)
const contentBackground = ref('')
const resolvedImageSources = ref<Partial<Record<BlogPostImageKey, string>>>({})
let mediaObserver: IntersectionObserver | null = null
let hasRequestedPostMedia = false

const articleImagesByParagraphIndex = computed(() => {
  const imagesByParagraph = new Map<number, Array<NonNullable<typeof post.value.articleImages>[number] & { placement: 'left' | 'right', src: string }>>()

  post.value.articleImages?.forEach((image, imageIndex) => {
    const src = resolvedImageSources.value[image.imageKey]
    if (!src) return

    const paragraphImages = imagesByParagraph.get(image.afterParagraphIndex) ?? []

    paragraphImages.push({
      ...image,
      src,
      placement: imageIndex % 2 === 0 ? 'right' : 'left',
    })
    imagesByParagraph.set(image.afterParagraphIndex, paragraphImages)
  })

  return imagesByParagraph
})

const resolvedGalleryImages = computed(() =>
  post.value.galleryImages?.flatMap((image) => {
    const src = resolvedImageSources.value[image.imageKey]
    return src ? [{ ...image, src }] : []
  }) ?? [],
)

const getArticleImagesAfter = (paragraphIndex: number) => articleImagesByParagraphIndex.value.get(paragraphIndex) ?? []
const contentBackgroundLoaders = [
  () => import('~/assets/images/background/bg-dark-1.png') as Promise<AssetModule>,
  () => import('~/assets/images/background/bg-dark-2.png') as Promise<AssetModule>,
]
const contentBackgroundIndex = [...rawPost.slug].reduce((sum, character) => sum + character.charCodeAt(0), 0) % contentBackgroundLoaders.length
const contentBackgroundStyle = computed(() =>
  contentBackground.value ? { backgroundImage: `url(${contentBackground.value})` } : undefined,
)

const loadPostMedia = async () => {
  if (hasRequestedPostMedia) return
  hasRequestedPostMedia = true

  const imageKeys = new Set<BlogPostImageKey>()
  post.value.articleImages?.forEach(image => imageKeys.add(image.imageKey))
  post.value.galleryImages?.forEach(image => imageKeys.add(image.imageKey))

  const [background, imageEntries] = await Promise.all([
    contentBackgroundLoaders[contentBackgroundIndex]?.(),
    Promise.all([...imageKeys].map(async key => [key, await loadBlogPostImage(key)] as const)),
  ])

  contentBackground.value = background?.default || ''
  resolvedImageSources.value = Object.fromEntries(imageEntries)
}

const observePostMedia = () => {
  const target = postContent.value

  if (!target || typeof window.IntersectionObserver !== 'function') {
    window.setTimeout(loadPostMedia, 3200)
    return
  }

  mediaObserver = new IntersectionObserver((entries) => {
    if (!entries.some(entry => entry.isIntersecting)) return

    mediaObserver?.disconnect()
    mediaObserver = null
    loadPostMedia()
  })

  mediaObserver.observe(target)
}

onMounted(() => {
  trackBlogEvent('post_view', {
    post_slug: rawPost.slug,
    post_title: post.value.title,
  })
  observePostMedia()
})

onBeforeUnmount(() => {
  mediaObserver?.disconnect()
})

const handlePostBookingClick = () => {
  trackBlogEvent('navigation_click', {
    destination: 'barbershop_booking',
    post_slug: rawPost.slug,
    source: 'post_share_cta',
  })
}

useSeoMeta({
  title: () => post.value.title,
  description: () => post.value.excerpt,
  robots: isUnlisted ? 'noindex, nofollow, noarchive, nosnippet' : 'index, follow',
  ogTitle: () => post.value.title,
  ogDescription: () => post.value.excerpt,
  ogImage: () => post.value.coverImage,
})

useHead(() => ({
  link: [
    {
      rel: 'preload',
      as: 'image',
      href: post.value.coverImageMobile,
      media: '(max-width: 767px)',
      fetchpriority: 'high',
    },
    {
      rel: 'preload',
      as: 'image',
      href: post.value.coverImage,
      media: '(min-width: 768px)',
      fetchpriority: 'high',
    },
  ],
}))
</script>

<template>
  <article class="bg-neutral-950">
    <header class="relative min-h-[calc(100svh+8rem)] sm:min-h-[calc(100svh+10rem)]">
        <div class="sticky top-0 h-[100svh] overflow-hidden bg-neutral-950">
          <picture class="absolute inset-0 h-full w-full">
            <source :srcset="post.coverImage" media="(min-width: 768px)">
            <img
              :src="post.coverImageMobile"
              :alt="post.coverImageAlt"
              class="h-full w-full object-cover"
              width="680"
              height="1060"
              loading="eager"
              fetchpriority="high"
            decoding="async"
          >
        </picture>
        <div class="absolute inset-0 bg-black/45" aria-hidden="true" />

        <div class="relative z-10 flex h-full w-full flex-col items-start justify-end px-4 pb-12 pt-24 text-left sm:px-6 sm:pb-16 lg:px-8">
          <h1 class="blog-feature-title w-full max-w-none break-words text-white">
            {{ post.title }}
          </h1>
        </div>
      </div>
    </header>

    <div
      ref="postContent"
      class="post-content-reveal relative z-10 -mt-10 bg-repeat text-neutral-100 shadow-none sm:-mt-12"
      :style="contentBackgroundStyle"
    >
      <div class="site-container py-12 sm:py-16">
        <div class="mx-auto max-w-3xl">
          <p class="text-xl font-medium leading-9 text-neutral-200">
            {{ post.excerpt }}
          </p>
          <div class="mt-8 space-y-7 text-lg leading-9 text-neutral-300">
            <template v-for="(contentBlock, paragraphIndex) in post.content" :key="paragraphIndex">
              <p v-if="typeof contentBlock === 'string'">
                {{ contentBlock }}
              </p>
              <h2
                v-else-if="contentBlock.type === 'heading'"
                class="clear-both pt-8 text-3xl font-black leading-tight text-white sm:pt-12 sm:text-4xl"
              >
                {{ contentBlock.text }}
              </h2>
              <blockquote
                v-else-if="contentBlock.type === 'quote'"
                class="clear-both border-l-2 border-white/35 py-2 pl-6 text-xl font-medium italic leading-9 text-neutral-100 sm:pl-8 sm:text-2xl sm:leading-10"
              >
                <p>{{ contentBlock.text }}</p>
                <footer
                  v-if="contentBlock.attribution"
                  class="mt-4 text-sm font-semibold not-italic leading-6 text-neutral-400"
                >
                  — {{ contentBlock.attribution }}
                </footer>
              </blockquote>
              <ul
                v-else
                class="clear-both list-disc space-y-3 pl-6 marker:text-white/45"
              >
                <li v-for="item in contentBlock.items" :key="item">
                  {{ item }}
                </li>
              </ul>
              <BlogArticleImages
                :images="getArticleImagesAfter(paragraphIndex)"
                :layout="post.articleImageLayout"
                :image-fit="post.imageFit"
              />
            </template>
          </div>
        </div>
      </div>
      <BlogSocialSharing :title="post.title" />
      <section class="site-container pb-4 sm:pb-8">
        <div class="mx-auto max-w-3xl py-8 text-center sm:py-10">
          <h2 class="text-2xl font-black leading-tight text-white sm:text-3xl">
            {{ terms.postBookingCtaTitle }}
          </h2>
          <p class="mx-auto mt-4 max-w-2xl text-base leading-8 text-white/65">
            {{ terms.postBookingCtaText }}
          </p>
          <BaseButton
            href="/#booking-stepper"
            class="mt-6 w-full sm:w-auto"
            variant="light"
            effect="waves"
            @click="handlePostBookingClick"
          >
            {{ terms.bookAppointment }}
          </BaseButton>
        </div>
      </section>
      <ClientOnly v-if="resolvedGalleryImages.length">
        <LazyBlogPhotoCarousel
          :images="resolvedGalleryImages"
          :image-fit="post.imageFit"
        />
      </ClientOnly>
    </div>
  </article>

  <section v-if="relatedPosts.length" class="section-y bg-neutral-950">
    <div class="site-container">
      <div class="text-center">
        <h2 class="text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">{{ terms.recommended }}</h2>
      </div>

      <div class="recommended-posts-list mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="relatedPost in relatedPosts"
          :key="relatedPost.slug"
          class="recommended-post-card mx-auto w-full max-w-[18.75rem]"
        >
          <PostCard
            :post="relatedPost"
            compact
            recommended
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.post-content-reveal {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  box-shadow: none;
  transform: translateY(0);
}

.recommended-post-card :deep(img) {
  filter: grayscale(0);
}

.recommended-posts-list:hover .recommended-post-card :deep(img) {
  filter: grayscale(1);
}

.recommended-posts-list:hover .recommended-post-card:hover :deep(img) {
  filter: grayscale(0);
}

@supports (animation-timeline: view()) {
  .post-content-reveal {
    animation: post-content-rise linear both;
    animation-timeline: view();
    animation-range: entry 0% entry 70%;
  }
}

@keyframes post-content-rise {
  from {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    opacity: 0.88;
    transform: translateY(2.5rem);
  }

  to {
    border-top-left-radius: 2rem;
    border-top-right-radius: 2rem;
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .post-content-reveal {
    animation: none;
  }
}
</style>
