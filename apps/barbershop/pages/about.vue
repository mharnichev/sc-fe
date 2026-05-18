<script setup lang="ts">
const { terms } = useTerms()

useSeo(
  () => terms.value.seo.aboutTitle,
  () => terms.value.seo.aboutDescription,
)
</script>

<template>
  <div class="grid gap-8 lg:grid-cols-2 lg:items-center">
    <div class="space-y-5" data-reveal="soft">
      <p class="text-sm uppercase tracking-[0.35em] text-amber-700">{{ terms.pages.about.label }}</p>
      <h1 class="text-5xl font-semibold text-stone-900">{{ terms.pages.about.title }}</h1>
      <p class="text-lg leading-8 text-stone-600">
        {{ terms.pages.about.firstText }}
      </p>
      <p class="text-base leading-8 text-stone-600">
        {{ terms.pages.about.secondText }}
      </p>
    </div>
    <img src="https://images.unsplash.com/photo-1503951458645-643d53bfd90f?auto=format&fit=crop&w=1200&q=80" :alt="terms.pages.about.imageAlt" class="h-[34rem] rounded-[2.5rem] object-cover shadow-xl" data-reveal="image" data-reveal-delay="140">
  </div>
</template>
