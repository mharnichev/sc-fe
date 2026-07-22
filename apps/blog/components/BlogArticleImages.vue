<script setup lang="ts">
import type { BlogArticleImageLayout, BlogImageFit } from '~/data/posts'

interface ArticleImage {
  src: string
  alt: string
  caption?: string
  placement?: 'left' | 'right'
  width?: number
  height?: number
}

const props = withDefaults(defineProps<{
  images?: ArticleImage[]
  layout?: BlogArticleImageLayout
  imageFit?: BlogImageFit
}>(), {
  images: () => [],
  layout: 'floating',
  imageFit: 'cover',
})

const groupedGridClass = computed(() =>
  `article-grouped-images-grid--${Math.min(Math.max(props.images.length, 1), 4)}`,
)
</script>

<template>
  <div
    v-if="props.images.length && props.layout === 'grouped-gallery'"
    class="article-grouped-images"
    :class="`article-grouped-images--${props.imageFit}`"
  >
    <div
      v-reveal-list
      class="article-grouped-images-grid sc-reveal-list"
      :class="groupedGridClass"
    >
      <figure
        v-for="image in props.images"
        :key="image.src"
        class="article-grouped-image"
        data-sc-reveal-item
      >
        <div class="article-grouped-image-media">
          <img
            :src="image.src"
            :alt="image.alt"
            :width="image.width"
            :height="image.height"
            class="article-grouped-image-content"
            loading="lazy"
          >
        </div>
        <figcaption
          v-if="image.caption"
          class="mt-3 text-sm leading-6 text-neutral-500"
        >
          {{ image.caption }}
        </figcaption>
      </figure>
    </div>

    <ClientOnly>
      <div
        v-reveal-list
        class="article-grouped-images-carousel sc-reveal-list sm:hidden"
        data-sc-reveal-item
      >
        <LazyBlogPhotoCarousel
          :images="props.images"
          :image-fit="props.imageFit"
        />
      </div>
    </ClientOnly>
  </div>

  <template v-else>
    <figure
      v-for="image in props.images"
      :key="image.src"
      class="article-float-image my-16 sm:my-20"
      :class="image.placement === 'left' ? 'article-float-image--left' : 'article-float-image--right'"
    >
      <div class="overflow-hidden">
        <img
          :src="image.src"
          :alt="image.alt"
          class="aspect-[4/3] w-full object-cover"
          loading="lazy"
        >
      </div>
      <figcaption
        v-if="image.caption"
        class="mt-3 text-sm leading-6 text-neutral-500"
      >
        {{ image.caption }}
      </figcaption>
    </figure>
  </template>
</template>

<style scoped>
.article-grouped-images,
.article-float-image {
  clear: both;
}

.article-grouped-images-grid {
  display: none;
}

.article-grouped-images-carousel {
  margin-left: calc(50% - 50vw);
  width: 100vw;
}

.article-grouped-image-media {
  aspect-ratio: 4 / 3;
  overflow: hidden;
}

.article-grouped-image-content {
  display: block;
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.article-grouped-images--contain .article-grouped-image-media {
  background: rgb(0 0 0 / 18%);
}

.article-grouped-images--contain .article-grouped-image-content {
  object-fit: contain;
}

.article-float-image {
  width: 100%;
}

@media (min-width: 640px) {
  .article-grouped-images-grid {
    display: grid;
    gap: clamp(0.75rem, 1.5vw, 1.5rem);
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin: 5rem 50%;
    transform: translateX(-50%);
    width: min(calc(100vw - 3rem), 80rem);
  }

  .article-grouped-images-grid--1 {
    grid-template-columns: minmax(0, 36rem);
    justify-content: center;
  }

  .article-grouped-images--natural-capped .article-grouped-images-grid {
    align-items: center;
  }

  .article-grouped-images--natural-capped .article-grouped-image-media {
    align-items: center;
    aspect-ratio: auto;
    display: flex;
    justify-content: center;
    max-height: clamp(24rem, 70vh, 42rem);
    overflow: visible;
  }

  .article-grouped-images--natural-capped .article-grouped-image-content {
    height: auto;
    max-height: clamp(24rem, 70vh, 42rem);
    max-width: 100%;
    object-fit: contain;
    width: auto;
  }

  .article-float-image {
    margin-bottom: 5rem;
    margin-top: 5rem;
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
  .article-grouped-images-grid--3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .article-grouped-images-grid--4 {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

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

</style>
