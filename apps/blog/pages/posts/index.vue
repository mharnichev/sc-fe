<script setup lang="ts">
import { sortedPosts } from '~/data/posts'

useSeoMeta({
  title: 'Posts',
  description: 'Browse every public Soulcuts Journal post.',
})
</script>

<template>
  <div>
    <section class="border-b border-neutral-800 bg-neutral-950 py-12 sm:py-16">
      <div class="site-container">
        <p class="eyebrow">Archive</p>
        <h1 class="mt-4 text-5xl font-black leading-none text-white sm:text-7xl">
          All posts
        </h1>
        <p class="mt-5 max-w-2xl text-base leading-8 text-neutral-400">
          Browse the first sample collection of public articles. These posts use local mock data and can be replaced by CMS content later.
        </p>
      </div>
    </section>

    <section class="section-y">
      <div class="site-container">
        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <PostCard v-for="post in sortedPosts" :key="post.slug" :post="post" />
        </div>
      </div>
    </section>
  </div>
</template>
