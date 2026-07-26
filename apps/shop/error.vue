<script setup lang="ts">
import FeedbackState from '~/components/ui/FeedbackState.vue'

const props = defineProps<{
  error: {
    statusCode?: number
  }
}>()

const { locale } = useShopLocale()
const isNotFound = computed(() => props.error.statusCode === 404)
const title = computed(() => {
  if (locale.value === 'en') return isNotFound.value ? 'This page wandered off' : 'Something went wrong'
  return isNotFound.value ? 'Ця сторінка кудись поділася' : 'Щось пішло не так'
})
const description = computed(() => {
  if (locale.value === 'en') return isNotFound.value ? 'Try the catalog or return to the home page.' : 'Please refresh the page or try again in a moment.'
  return isNotFound.value ? 'Спробуйте відкрити каталог або поверніться на головну.' : 'Оновіть сторінку або спробуйте ще раз за мить.'
})
</script>

<template>
  <main class="shop-error-page">
    <FeedbackState
      :kind="isNotFound ? 'empty' : 'error'"
      face="sad-droopy-face"
      :title="title"
      :description="description"
      :seed="error.statusCode"
    >
      <BaseButton type="button" @click="clearError({ redirect: '/' })">
        {{ locale === 'en' ? 'Home' : 'На головну' }}
      </BaseButton>
      <BaseButton to="/catalog" variant="outline-dark">
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
  background: #f3f4f7;
  padding: 1rem;
  color: #0a0a0a;
}

.shop-error-page :deep(.feedback-state) {
  --feedback-state-surface: #ffffff;
  max-width: 52rem;
  border: 1px solid rgb(10 10 10 / 0.1);
  background: #ffffff;
}

</style>
