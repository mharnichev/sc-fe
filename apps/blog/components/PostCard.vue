<script setup lang="ts">
import type { LocalizedBlogPost } from '~/data/posts'
import { formatPostDate } from '~/data/posts'

const { locale, terms } = useBlogLocale()

defineProps<{
  post: LocalizedBlogPost
  compact?: boolean
  recommended?: boolean
}>()
</script>

<template>
  <article class="group h-full" :class="recommended ? 'bg-transparent' : 'bg-neutral-900'">
    <NuxtLink
      class="grid h-full transition"
      :class="recommended ? 'border-0' : 'border border-neutral-800 hover:border-white/45'"
      :to="`/posts/${post.slug}`"
    >
      <div
        class="aspect-[4/3] overflow-hidden"
        :class="recommended ? 'w-full rounded-lg bg-transparent' : 'bg-neutral-800'"
      >
        <img
          :src="post.coverImage"
          :alt="post.coverImageAlt"
          class="h-full w-full object-cover filter transition-[filter] duration-1000 ease-in-out"
          loading="lazy"
        >
      </div>
      <div class="flex h-full flex-col" :class="recommended ? 'pt-5' : 'p-5'">
        <div v-if="!recommended" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">
          <span class="text-white/50">{{ post.category }}</span>
          <time :datetime="post.publishedAt">{{ formatPostDate(post.publishedAt, locale) }}</time>
        </div>
        <h2 class="font-black leading-tight text-white" :class="[compact ? 'text-xl' : 'text-2xl', recommended ? '' : 'mt-3']">
          {{ post.title }}
        </h2>
        <p class="mt-3 line-clamp-3 text-sm leading-7 text-neutral-400">
          {{ post.excerpt }}
        </p>
        <time v-if="recommended" class="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-neutral-500" :datetime="post.publishedAt">
          {{ formatPostDate(post.publishedAt, locale) }}
        </time>
        <p v-else class="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-white/70">
          {{ terms.readArticle }}
        </p>
      </div>
    </NuxtLink>
  </article>
</template>
