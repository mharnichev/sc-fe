<script setup lang="ts">
import FeedbackState from '~/components/ui/FeedbackState.vue'
import { getLocalizedPosts } from '~/data/posts'

const { locale, terms } = useBlogLocale()
const posts = computed(() => getLocalizedPosts(locale.value))
const emptyPostsTitle = computed(() => locale.value === 'uk' ? 'Поки без нових історій' : 'No new stories yet')
const emptyPostsDescription = computed(() => locale.value === 'uk'
  ? 'Ми вже готуємо наступний матеріал. Загляньте трохи пізніше.'
  : 'We are already preparing the next story. Check back soon.')

useSeoMeta({
  title: () => terms.value.allPosts,
  description: () => terms.value.postsDescription,
})
</script>

<template>
  <div>
    <section class="border-b border-neutral-800 bg-neutral-950 py-12 sm:py-16">
      <div class="site-container">
        <p class="type-meta text-xs text-white/50">{{ terms.archive }}</p>
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
        <div v-if="posts.length" class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <PostCard v-for="post in posts" :key="post.slug" :post="post" />
        </div>
        <FeedbackState
          v-else
          class="border border-neutral-800 bg-neutral-950 text-white"
          kind="empty"
          face="sad-droopy-face"
          :title="emptyPostsTitle"
          :description="emptyPostsDescription"
          style="--feedback-state-surface: #0a0a0a"
        />
      </div>
    </section>
  </div>
</template>
