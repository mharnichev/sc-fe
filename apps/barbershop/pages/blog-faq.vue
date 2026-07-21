<script setup lang="ts">
const { terms } = useTerms()

useSeo(
  () => terms.value.seo.blogFaqTitle,
  () => terms.value.seo.blogFaqDescription,
)
</script>

<template>
  <div class="space-y-12">
    <section class="max-w-3xl space-y-4" data-reveal="soft">
      <p class="type-eyebrow type-eyebrow--wide text-sm text-amber-700">{{ terms.pages.blogFaq.label }}</p>
      <h1 class="type-page-title text-5xl text-stone-900">{{ terms.pages.blogFaq.title }}</h1>
      <p class="text-lg leading-8 text-stone-600">
        {{ terms.pages.blogFaq.description }}
      </p>
    </section>
    <section class="grid gap-6 lg:grid-cols-2">
      <article class="rounded-[2rem] bg-white p-6 shadow-sm" data-reveal="soft">
        <p class="type-eyebrow type-eyebrow--wide text-xs text-amber-700">{{ terms.pages.blogFaq.journalLabel }}</p>
        <h2 class="type-card-title mt-3 text-2xl text-stone-900">{{ terms.pages.blogFaq.articleTitle }}</h2>
        <p class="mt-4 text-sm leading-7 text-stone-600">
          {{ terms.pages.blogFaq.articleText }}
        </p>
      </article>
      <div class="space-y-4 rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm" data-reveal="soft" data-reveal-delay="120">
        <h2 class="type-card-title text-2xl text-stone-900">{{ terms.pages.blogFaq.faqTitle }}</h2>
        <article v-for="faq in terms.pages.blogFaq.faqs" :key="faq.q" class="rounded-2xl bg-stone-50 p-4">
          <h3 class="type-page-title text-stone-900">{{ faq.q }}</h3>
          <p class="mt-2 text-sm leading-7 text-stone-600">{{ faq.a }}</p>
        </article>
      </div>
    </section>
  </div>
</template>
