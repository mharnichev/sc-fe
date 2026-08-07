<script setup lang="ts">
import { customerActivityTokenFromHash } from '~/utils/customerActivity'

const token = ref('')
const mounted = ref(false)

onMounted(() => {
  token.value = customerActivityTokenFromHash(window.location.hash)
  // The fragment was never sent to SSR; clear it before any further navigation.
  window.history.replaceState(window.history.state, '', '/booking/manage')
  mounted.value = true
})

useSeoMeta({ robots: 'noindex, nofollow, noarchive' })
useHead({
  title: 'Мої записи — Soul Cuts',
  meta: [{ name: 'referrer', content: 'no-referrer' }],
})
</script>

<template>
  <CustomerActivityModal v-if="mounted" :token="token" @closed="navigateTo('/')" />
</template>
