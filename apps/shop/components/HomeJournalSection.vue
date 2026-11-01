<script setup lang="ts">
import bukvyCover from '~/assets/images/journal/idem-na-bukvy.webp'
import museumCover from '~/assets/images/journal/barbering-museum.webp'
import journalBackground from '~/assets/images/journal/bg-dark-1.png'

const { locale } = useShopLocale()
const storyUrl = (slug: string) => `/blog/posts/${slug}/`

// App-local previews of the two published Soulcuts Journal stories.
const stories = [
  {
    slug: 'history-of-idem-na-bukvy',
    image: bukvyCover,
    imageHeight: 450,
    date: '2026-07-14',
    minutes: 11,
    uk: {
      title: 'З чого починалася історія проєкту «Ідем на Букви»?',
      description: 'Від локальної ідеї до подкастів, плівкових репортажів і зустрічей про українську барберську культуру.',
    },
    en: {
      title: 'How Did the Story of Idem na Bukvy Begin?',
      description: 'From a local idea to podcasts, film-photo reports and gatherings around Ukrainian barbering culture.',
    },
  },
  {
    slug: 'barbering-in-the-museum',
    image: museumCover,
    imageHeight: 530,
    date: '2026-03-16',
    minutes: 7,
    uk: {
      title: 'Барберінг у музеї: перший репортаж Soul Cuts',
      description: 'Барберське комʼюніті в Одеському музеї західного та східного мистецтва. Люди, атмосфера й те, що нас обʼєднує.',
    },
    en: {
      title: 'Barbering in a Museum: The First Soul Cuts Report',
      description: 'The barbering community at the Odesa Museum of Western and Eastern Art. The people, the atmosphere and what brings us together.',
    },
  },
]

const copy = computed(() => locale.value === 'en' ? {
  eyebrow: 'Soulcuts Journal',
  title: 'Our world. Our culture.',
  description: 'The people, places and conversations that shape Soulcuts. Step into our world through stories about barbering, community and the culture we share.',
  read: 'Read the story',
  minutes: 'min read',
} : {
  eyebrow: 'Журнал Soulcuts',
  title: 'Наш світ. Наша культура.',
  description: 'Люди, місця й розмови, з яких складається Soulcuts. Знайомимо ближче з нашим світом через історії про барберінг, спільноту та культуру, яку творимо разом.',
  read: 'Читати історію',
  minutes: 'хв читання',
})

const formatDate = (date: string) => new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'uk-UA', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${date}T00:00:00Z`))
</script>

<template>
  <div class="home-journal" :style="{ backgroundImage: `url(${journalBackground})` }">
    <AppSection class="site-container home-journal__content" :eyebrow="copy.eyebrow" :title="copy.title" :description="copy.description" scribble-title>
      <div class="home-journal__grid">
        <article v-for="(story, index) in stories" :key="story.slug" class="home-journal__story">
            <a class="home-journal__link home-journal__media" :href="storyUrl(story.slug)">
              <img
              class="home-journal__image"
              :src="story.image"
              :alt="story[locale === 'en' ? 'en' : 'uk'].title"
              width="800"
              :height="story.imageHeight"
              loading="lazy"
              decoding="async"
              >
            </a>
            <div class="home-journal__meta">
              <time :datetime="story.date">{{ formatDate(story.date) }}</time>
              <span>{{ story.minutes }} {{ copy.minutes }}</span>
            </div>
            <h3 class="home-journal__title">
              <a class="home-journal__link" :href="storyUrl(story.slug)">
                <BaseHoverUnderlineText>{{ story[locale === 'en' ? 'en' : 'uk'].title }}</BaseHoverUnderlineText>
              </a>
            </h3>
            <p class="home-journal__description">{{ story[locale === 'en' ? 'en' : 'uk'].description }}</p>
            <div class="home-journal__bottom">
              <BaseButton class="home-journal__read" variant="text" :href="storyUrl(story.slug)">
                <BaseHoverUnderlineText>{{ copy.read }}</BaseHoverUnderlineText>
                <BaseIcon name="product-buy-arrow" size="xxs" />
              </BaseButton>
              <span class="home-journal__number" aria-hidden="true">0{{ index + 1 }}</span>
            </div>
        </article>
      </div>
    </AppSection>
  </div>
</template>

<style scoped>
.home-journal {
  background-color: #0a0a0a;
  background-repeat: repeat;
  color: #f9f8f3;
}

.home-journal__content {
  padding-block: clamp(1.25rem, 4vw, 3rem);
}

.home-journal :deep(.section-title),
.home-journal :deep(.type-eyebrow) {
  color: #f9f8f3;
}

.home-journal :deep(.space-y-2 > p) {
  color: #c4c0b8;
}

.home-journal__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.5rem;
  padding-top: 1rem;
}

.home-journal__story {
  min-width: 0;
  display: flex;
  height: 100%;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem 0;
}

.home-journal__link {
  display: block;
  color: #f9f8f3;
  text-decoration: none;
}

.home-journal__link:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 4px;
}

.home-journal__media {
  overflow: hidden;
  aspect-ratio: 16 / 10;
}

.home-journal__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 500ms ease;
}

@media (hover: hover) and (pointer: fine) {
  .home-journal__media:hover .home-journal__image {
    transform: scale(1.05);
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-journal__image { transition: none; }
  .home-journal__media:hover .home-journal__image { transform: none; }
}

.home-journal__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
  color: #a8a29e;
  font-size: 0.75rem;
}

.home-journal__title {
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.home-journal__description {
  max-width: 36rem;
  color: #c4c0b8;
  font-size: 0.875rem;
  line-height: 1.75;
}

.home-journal__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: auto;
  padding-top: 1rem;
}

.home-journal__read {
  --sc-button-text: #f9f8f3;
  --sc-button-hover-text: #f9f8f3;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  text-decoration: none;
}

.home-journal__number {
  color: #a8a29e;
  font-size: 0.75rem;
}

@media (max-width: 639px) {
  .home-journal__title {
    font-size: 1.25rem;
  }

  .home-journal__grid {
    grid-template-columns: none;
    grid-auto-flow: column;
    grid-auto-columns: 88%;
    gap: 1rem;
    overflow-x: auto;
    overscroll-behavior-inline: contain;
    scroll-snap-type: x mandatory;
    scrollbar-width: thin;
    scrollbar-color: #737373 transparent;
  }

  .home-journal__story {
    scroll-snap-align: start;
  }

  .home-journal__story {
    padding-inline: 0;
  }
}

</style>
