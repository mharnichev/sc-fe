<script setup lang="ts">
import { reviewTokenFromHash } from '~/utils/reviews.js'

const { terms } = useTerms()
const reviewToken = ref('')

useSeo(
  () => terms.value.seo.mastersTitle,
  () => terms.value.seo.mastersDescription,
)

onMounted(async () => {
  await nextTick()

  const token = reviewTokenFromHash(window.location.hash)
  if (!token) return

  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${window.location.search}`,
  )
  reviewToken.value = token
})

const clearReviewToken = () => {
  reviewToken.value = ''
}

onBeforeUnmount(clearReviewToken)
</script>

<template>
  <div>
    <h1 class="sr-only">{{ terms.pages.masters.title }}</h1>
    <TeamSection booking-target="/#booking" show-all-active />
    <ClientOnly>
      <LazyReviewRequestModal
        v-if="reviewToken"
        :token="reviewToken"
        @closed="clearReviewToken"
      />
    </ClientOnly>
  </div>
</template>
