<script setup lang="ts">
import FeedbackState from '~/components/ui/FeedbackState.vue'

const props = defineProps<{
  error: {
    statusCode?: number
  }
}>()

const { locale } = useShopLocale()
const shopAsset = useShopAsset()
const isNotFound = computed(() => props.error.statusCode === 404)
const title = computed(() => {
  if (locale.value === 'en') return isNotFound.value ? 'This page wandered off' : 'Something went wrong'
  return isNotFound.value ? 'Ця сторінка кудись поділася' : 'Щось пішло не так'
})
const description = computed(() => {
  if (locale.value === 'en') return isNotFound.value ? 'Try the catalog or return to the home page.' : 'Please refresh the page or try again in a moment.'
  return isNotFound.value ? 'Спробуйте відкрити каталог або поверніться на головну.' : 'Оновіть сторінку або спробуйте ще раз за мить.'
})

useHead({
  title: () => `${props.error.statusCode || 500} — ${title.value}`,
  htmlAttrs: { lang: () => locale.value },
})
</script>

<template>
  <main class="shop-error-page">
    <FeedbackState
      title-tag="h1"
      :kind="isNotFound ? 'empty' : 'error'"
      face="sad-droopy-face"
      :title="title"
      :description="description"
      :seed="error.statusCode"
    >
      <template v-if="isNotFound" #illustration>
        <div class="shop-error-page__artwork">
          <span class="shop-error-page__code">404</span>
          <img
            :src="shopAsset('/illustrations/retro-cartoon-404.png')"
            alt=""
            width="768"
            height="768"
            decoding="async"
          >
        </div>
      </template>
      <BaseButton type="button" @click="clearError({ redirect: '/' })">
        {{ locale === 'en' ? 'Home' : 'На головну' }}
      </BaseButton>
      <BaseButton type="button" variant="outline-dark" @click="clearError({ redirect: '/catalog' })">
        {{ locale === 'en' ? 'Catalog' : 'Каталог' }}
      </BaseButton>
    </FeedbackState>
  </main>
</template>

<style scoped>
.shop-error-page {
  display: grid;
  min-height: 100svh;
  place-items: center;
  background: #ffffff;
  padding: 1rem;
  color: #0a0a0a;
}
.shop-error-page :deep(.feedback-state) {
  --feedback-state-surface: #ffffff;
  max-width: 52rem;
  border: 0;
  background: #ffffff;
  padding: clamp(1rem, 3vw, 2rem);
}
.shop-error-page__artwork {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  gap: clamp(0.5rem, 2vw, 1.5rem);
}
.shop-error-page__code {
  font-size: clamp(4.5rem, 16vw, 10rem);
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1;
}
.shop-error-page__artwork img {
  display: block;
  width: min(18rem, 40vw);
  height: auto;
  object-fit: contain;
}
</style>
