<script setup lang="ts">
const { locale } = useTerms()

useHead({
  htmlAttrs: {
    lang: () => locale.value,
  },
})

useLocalBusinessStructuredData()
</script>

<template>
  <div class="min-h-screen bg-stone-100 text-neutral-950">
    <Header />
    <main>
      <slot />
    </main>
    <Footer />
    <ClientOnly>
      <CookieConsentBanner />
    </ClientOnly>
  </div>
</template>
