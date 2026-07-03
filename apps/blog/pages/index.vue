<script setup lang="ts">
import { formatPostDate, formatReadMinutes, getFeaturedPost, getLatestPosts } from '~/data/posts'

const { locale, terms } = useBlogLocale()
const { trackBlogEvent } = useBlogAnalytics()
const featuredPost = computed(() => getFeaturedPost(locale.value))
const homepagePosts = computed(() => getLatestPosts(locale.value).slice(0, 6))

const handleFeaturedPostClick = (source: string) => {
  trackBlogEvent('post_click', {
    post_slug: featuredPost.value.slug,
    source,
  })
}

useSeoMeta({
  title: () => terms.value.homeTitle,
  description: () => terms.value.homeDescription,
})

useHead(() => ({
  link: [
    {
      rel: 'preload',
      as: 'image',
      href: featuredPost.value.coverImageMobile,
      media: '(max-width: 767px)',
      fetchpriority: 'high',
    },
    {
      rel: 'preload',
      as: 'image',
      href: featuredPost.value.coverImage,
      media: '(min-width: 768px)',
      fetchpriority: 'high',
    },
  ],
}))
</script>

<template>
  <div>
    <section class="bg-neutral-950">
      <div class="site-container grid gap-8 py-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch lg:py-10">
        <NuxtLink
          class="group min-h-[24rem] overflow-hidden bg-neutral-900 lg:min-h-[36rem]"
          :to="`/posts/${featuredPost.slug}`"
          @click="handleFeaturedPostClick('featured_cover')"
        >
          <picture class="block h-full w-full">
            <source :srcset="featuredPost.coverImageMobile" media="(max-width: 767px)" type="image/jpeg">
            <img
              :src="featuredPost.coverImage"
              :alt="featuredPost.coverImageAlt"
              class="h-full w-full object-cover"
              width="1600"
              height="1060"
              loading="eager"
              fetchpriority="high"
              decoding="async"
            >
          </picture>
        </NuxtLink>

        <div class="flex flex-col justify-between border-neutral-700 py-6 lg:py-8">
          <div>
            <p class="eyebrow">{{ terms.featuredPost }}</p>
            <h1 class="mt-5 text-4xl font-black leading-[0.98] text-white sm:text-5xl lg:text-6xl">
              {{ featuredPost.title }}
            </h1>
            <p class="mt-6 max-w-xl text-base leading-8 text-neutral-300 sm:text-lg">
              {{ featuredPost.excerpt }}
            </p>
          </div>

          <div class="mt-8">
            <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">
              <span class="text-white/65">{{ featuredPost.category }}</span>
              <time :datetime="featuredPost.publishedAt">{{ formatPostDate(featuredPost.publishedAt, locale) }}</time>
              <span>{{ formatReadMinutes(featuredPost.readMinutes, locale) }}</span>
            </div>
            <BaseButton
              :to="`/posts/${featuredPost.slug}`"
              class="mt-6"
              variant="light"
              @click="handleFeaturedPostClick('featured_cta')"
            >
              {{ terms.readFeature }}
            </BaseButton>
          </div>
        </div>
      </div>
    </section>

    <section v-if="homepagePosts.length" class="section-y">
      <div class="site-container">
        <div class="flex flex-col gap-4 border-b border-neutral-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="eyebrow">{{ terms.latest }}</p>
            <h2 class="section-heading mt-3">{{ terms.newStories }}</h2>
          </div>
          <NuxtLink class="text-sm font-bold uppercase tracking-[0.16em] text-white underline decoration-neutral-700 underline-offset-4 transition hover:decoration-white" to="/posts">
            {{ terms.viewAllPosts }}
          </NuxtLink>
        </div>

        <div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <PostCard v-for="post in homepagePosts" :key="post.slug" :post="post" compact />
        </div>
      </div>
    </section>
  </div>
</template>
