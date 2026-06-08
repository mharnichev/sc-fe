<script setup lang="ts">
import { getLocalizedPosts } from '~/data/posts'

const { locale, terms } = useBlogLocale()
const posts = computed(() => getLocalizedPosts(locale.value))

useSeoMeta({
  title: () => terms.value.allPosts,
  description: () => terms.value.postsDescription,
})
</script>

<template>
  <div>
    <section class="border-b border-neutral-800 bg-neutral-950 py-12 sm:py-16">
      <div class="site-container">
        <p class="eyebrow">{{ terms.archive }}</p>
        <h1 class="mt-4 text-5xl font-black leading-none text-white sm:text-7xl">
          {{ terms.allPosts }}
        </h1>
        <p class="mt-5 max-w-2xl text-base leading-8 text-neutral-400">
          {{ terms.postsDescription }}
        </p>
      </div>
    </section>

    <section class="section-y">
      <div class="site-container">
        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <PostCard v-for="post in posts" :key="post.slug" :post="post" />
        </div>
      </div>
    </section>
  </div>
</template>
