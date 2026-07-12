<script setup lang="ts">
import FeedbackState from '~/components/ui/FeedbackState.vue'

const props = defineProps<{
  error: {
    statusCode?: number
  }
}>()

const { locale } = useBlogLocale()
const isNotFound = computed(() => props.error.statusCode === 404)
const title = computed(() => locale.value === 'uk'
  ? (isNotFound.value ? 'Цю історію не знайдено' : 'Журнал тимчасово загубив сторінку')
  : (isNotFound.value ? 'This story was not found' : 'The journal lost this page for a moment'))
const description = computed(() => locale.value === 'uk'
  ? (isNotFound.value ? 'Можливо, посилання змінилося. Усі матеріали чекають в архіві.' : 'Спробуйте оновити сторінку або повернутися трохи пізніше.')
  : (isNotFound.value ? 'The link may have changed. You can find every story in the archive.' : 'Refresh the page or come back a little later.'))
</script>

<template>
  <main class="blog-error-page">
    <FeedbackState
      :kind="isNotFound ? 'empty' : 'error'"
      face="sad-droopy-face"
      :title="title"
      :description="description"
      :seed="error.statusCode"
    >
      <button type="button" class="blog-error-page__button" @click="clearError({ redirect: '/' })">
        {{ locale === 'uk' ? 'На головну' : 'Home' }}
      </button>
      <NuxtLink class="blog-error-page__link" to="/posts">
        {{ locale === 'uk' ? 'Усі пости' : 'All posts' }}
      </NuxtLink>
    </FeedbackState>
  </main>
</template>

<style scoped>
.blog-error-page {
  display: grid;
  min-height: 100svh;
  place-items: center;
  background: #0a0a0a;
  padding: 1rem;
  color: #ffffff;
}

.blog-error-page :deep(.feedback-state) {
  --feedback-state-surface: #0a0a0a;
  max-width: 52rem;
}

.blog-error-page__button,
.blog-error-page__link {
  min-height: 2.75rem;
  border: 1px solid #ffffff;
  padding: 0.75rem 1rem;
  color: #ffffff;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-decoration: none;
  text-transform: uppercase;
}

.blog-error-page__button {
  background: #ffffff;
  color: #0a0a0a;
  cursor: pointer;
}
</style>
