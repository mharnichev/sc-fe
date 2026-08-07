<script setup lang="ts">
import { customerActivityTokenFromHash } from '~/utils/customerActivity'

const token = ref('')
const mounted = ref(false)

onMounted(() => {
  token.value = customerActivityTokenFromHash(window.location.hash)
  // This is an alias page: no redirect can accidentally move the token to a query.
  window.history.replaceState(window.history.state, '', '/booking/cancel')
  mounted.value = true
})

useSeoMeta({ robots: 'noindex, nofollow, noarchive' })
useHead({
  title: 'Скасування запису — Soul Cuts',
  meta: [{ name: 'referrer', content: 'no-referrer' }],
})
</script>

<template>
  <CustomerActivityModal v-if="mounted" :token="token" cancel-mode @closed="navigateTo('/')" />
</template>
