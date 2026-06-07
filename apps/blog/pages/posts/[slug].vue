<script setup lang="ts">
import { getPostBySlug, getRelatedPosts } from '~/data/posts'
import bgDark1 from '~/assets/images/background/bg-dark-1.png'
import bgDark2 from '~/assets/images/background/bg-dark-2.png'

const route = useRoute()
const slug = Array.isArray(route.params.slug) ? route.params.slug[0] : route.params.slug
const post = getPostBySlug(slug)

if (!post) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Post not found',
  })
}

const relatedPosts = getRelatedPosts(post.slug)
const articleImagesByParagraphIndex = new Map(
  post.articleImages?.map((image, imageIndex) => [
    image.afterParagraphIndex,
    {
      ...image,
      placement: imageIndex % 2 === 0 ? 'right' : 'left',
    },
  ]) ?? [],
)

const getArticleImageAfter = (paragraphIndex: number) => articleImagesByParagraphIndex.get(paragraphIndex)
const contentBackgrounds = [
  bgDark1,
  bgDark2,
]
const contentBackgroundIndex = [...post.slug].reduce((sum, character) => sum + character.charCodeAt(0), 0) % contentBackgrounds.length
const contentBackground = contentBackgrounds[contentBackgroundIndex]

useSeoMeta({
  title: post.title,
  description: post.excerpt,
  ogTitle: post.title,
  ogDescription: post.excerpt,
  ogImage: post.coverImage,
})
</script>

<template>
  <article class="bg-neutral-950">
    <header class="relative min-h-[calc(100svh+8rem)] sm:min-h-[calc(100svh+10rem)]">
      <div class="sticky top-0 h-[100svh] overflow-hidden bg-neutral-950">
        <img :src="post.coverImage" :alt="post.coverImageAlt" class="absolute inset-0 h-full w-full object-cover">
        <div class="absolute inset-0 bg-black/45" aria-hidden="true" />

        <div class="relative z-10 flex h-full w-full flex-col items-start justify-end px-4 pb-12 pt-24 text-left sm:px-6 sm:pb-16 lg:px-8">
          <h1 class="w-full max-w-none break-words text-5xl font-black uppercase leading-[0.9] text-white sm:text-7xl lg:text-8xl">
            {{ post.title }}
          </h1>
        </div>
      </div>
    </header>

    <div
      class="post-content-reveal relative z-10 -mt-10 bg-repeat text-neutral-100 shadow-none sm:-mt-12"
      :style="{ backgroundImage: `url(${contentBackground})` }"
    >
      <div class="site-container py-12 sm:py-16">
        <div class="mx-auto max-w-3xl">
          <p class="text-xl font-medium leading-9 text-neutral-200">
            {{ post.excerpt }}
          </p>
          <div class="mt-8 space-y-7 text-lg leading-9 text-neutral-300">
            <template v-for="(paragraph, paragraphIndex) in post.content" :key="paragraph">
              <p>
                {{ paragraph }}
              </p>
              <figure
                v-if="getArticleImageAfter(paragraphIndex)"
                class="article-float-image my-10 overflow-hidden sm:my-2"
                :class="getArticleImageAfter(paragraphIndex)?.placement === 'left' ? 'article-float-image--left' : 'article-float-image--right'"
              >
                <img
                  :src="getArticleImageAfter(paragraphIndex)?.src"
                  :alt="getArticleImageAfter(paragraphIndex)?.alt"
                  class="aspect-[4/3] w-full object-cover"
                  loading="lazy"
                >
                <figcaption
                  v-if="getArticleImageAfter(paragraphIndex)?.caption"
                  class="mt-3 text-sm leading-6 text-neutral-500"
                >
                  {{ getArticleImageAfter(paragraphIndex)?.caption }}
                </figcaption>
              </figure>
            </template>
          </div>
        </div>
      </div>
      <BlogSocialSharing :title="post.title" />
    </div>
  </article>

  <section class="section-y bg-neutral-950">
    <div class="site-container">
      <div class="text-center">
        <h2 class="section-heading">Recommended</h2>
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

.article-float-image {
  width: 100%;
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

@media (min-width: 640px) {
  .article-float-image {
    margin-bottom: 1.5rem;
    width: min(58%, 30rem);
  }

  .article-float-image--right {
    float: right;
    margin-left: 2rem;
  }

  .article-float-image--left {
    float: left;
    margin-right: 2rem;
  }
}

@media (min-width: 1024px) {
  .article-float-image {
    width: min(70%, 34rem);
  }

  .article-float-image--right {
    margin-right: clamp(-8rem, -10vw, -5rem);
  }

  .article-float-image--left {
    margin-left: clamp(-8rem, -10vw, -5rem);
  }
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
