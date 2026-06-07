<script setup lang="ts">
import type { BlogPost } from '~/data/posts'
import { formatPostDate } from '~/data/posts'

defineProps<{
  post: BlogPost
  compact?: boolean
}>()
</script>

<template>
  <article class="group h-full bg-neutral-900">
    <NuxtLink class="grid h-full border border-neutral-800 transition hover:border-red-500" :to="`/posts/${post.slug}`">
      <div class="aspect-[4/3] overflow-hidden bg-neutral-800">
        <img
          :src="post.coverImage"
          :alt="post.coverImageAlt"
          class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
        >
      </div>
      <div class="flex h-full flex-col p-5">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">
          <span class="text-red-400">{{ post.category }}</span>
          <time :datetime="post.publishedAt">{{ formatPostDate(post.publishedAt) }}</time>
        </div>
        <h2 class="mt-3 font-black leading-tight text-white" :class="compact ? 'text-xl' : 'text-2xl'">
          {{ post.title }}
        </h2>
        <p class="mt-3 line-clamp-3 text-sm leading-7 text-neutral-400">
          {{ post.excerpt }}
        </p>
        <p class="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-red-300">
          Read article
        </p>
      </div>
    </NuxtLink>
  </article>
</template>
