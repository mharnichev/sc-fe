<script setup lang="ts">
import { featuredPost, formatPostDate, latestPosts } from '~/data/posts'

const homepagePosts = latestPosts.slice(0, 6)

useSeoMeta({
  title: 'Home',
  description: 'Soulcuts Journal is a public magazine-style blog for culture, music, cities, and creative process.',
})
</script>

<template>
  <div>
    <section class="border-b border-neutral-800 bg-neutral-950">
      <div class="site-container grid gap-8 py-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch lg:py-10">
        <NuxtLink class="group min-h-[24rem] overflow-hidden bg-neutral-900 lg:min-h-[36rem]" :to="`/posts/${featuredPost.slug}`">
          <img
            :src="featuredPost.coverImage"
            :alt="featuredPost.coverImageAlt"
            class="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          >
        </NuxtLink>

        <div class="flex flex-col justify-between border-y border-neutral-700 py-6 lg:py-8">
          <div>
            <p class="eyebrow">Featured Post</p>
            <h1 class="mt-5 text-4xl font-black leading-[0.98] text-white sm:text-6xl lg:text-7xl">
              {{ featuredPost.title }}
            </h1>
            <p class="mt-6 max-w-xl text-base leading-8 text-neutral-300 sm:text-lg">
              {{ featuredPost.excerpt }}
            </p>
          </div>

          <div class="mt-8">
            <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">
              <span class="text-red-400">{{ featuredPost.category }}</span>
              <time :datetime="featuredPost.publishedAt">{{ formatPostDate(featuredPost.publishedAt) }}</time>
              <span>{{ featuredPost.readMinutes }} min read</span>
            </div>
            <NuxtLink
              :to="`/posts/${featuredPost.slug}`"
              class="mt-6 inline-flex min-h-12 items-center justify-center bg-red-500 px-6 text-sm font-bold uppercase tracking-[0.16em] text-white transition hover:bg-red-600"
            >
              Read feature
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <section class="section-y">
      <div class="site-container">
        <div class="flex flex-col gap-4 border-b border-neutral-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="eyebrow">Latest</p>
            <h2 class="section-heading mt-3">New stories</h2>
          </div>
          <NuxtLink class="text-sm font-bold uppercase tracking-[0.16em] text-white underline decoration-neutral-700 underline-offset-4 transition hover:decoration-red-400" to="/posts">
            View all posts
          </NuxtLink>
        </div>

        <div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <PostCard v-for="post in homepagePosts" :key="post.slug" :post="post" compact />
        </div>
      </div>
    </section>
  </div>
</template>
