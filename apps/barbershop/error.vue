<script setup lang="ts">
import FeedbackState from '~/components/ui/FeedbackState.vue'

const props = defineProps<{
  error: {
    statusCode?: number
  }
}>()

const { locale } = useTerms()
const isNotFound = computed(() => props.error.statusCode === 404)
const title = computed(() => locale.value === 'uk'
  ? (isNotFound.value ? 'Такої сторінки немає' : 'Щось пішло не так')
  : (isNotFound.value ? 'This page does not exist' : 'Something went wrong'))
const description = computed(() => locale.value === 'uk'
  ? (isNotFound.value ? 'Поверніться на головну або перейдіть до запису.' : 'Спробуйте оновити сторінку. Якщо не допоможе — поверніться трохи пізніше.')
  : (isNotFound.value ? 'Return home or continue to booking.' : 'Refresh the page. If that does not help, come back a little later.'))
</script>

<template>
  <main class="barbershop-error-page">
    <FeedbackState
      :kind="isNotFound ? 'empty' : 'error'"
      face="sad-droopy-face"
      :title="title"
      :description="description"
      :seed="error.statusCode"
    >
      <button type="button" class="barbershop-error-page__button" @click="clearError({ redirect: '/' })">
        {{ locale === 'uk' ? 'На головну' : 'Home' }}
      </button>
      <NuxtLink class="barbershop-error-page__link" to="/#booking">
        {{ locale === 'uk' ? 'Записатися' : 'Book now' }}
      </NuxtLink>
    </FeedbackState>
  </main>
</template>

<style scoped>
.barbershop-error-page {
  display: grid;
  min-height: 100svh;
  place-items: center;
  background: #f5f5f4;
  padding: 1rem;
  color: #0a0a0a;
}

.barbershop-error-page :deep(.feedback-state) {
  --feedback-state-surface: #ffffff;
  max-width: 52rem;
  background: #ffffff;
}

.barbershop-error-page__button,
.barbershop-error-page__link {
  min-height: 2.75rem;
  border: 1px solid #0a0a0a;
  padding: 0.75rem 1rem;
  color: #0a0a0a;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-decoration: none;
  text-transform: uppercase;
}

.barbershop-error-page__button {
  background: #0a0a0a;
  color: #ffffff;
  cursor: pointer;
}
</style>
