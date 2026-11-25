<script setup lang="ts">
const { terms } = useTerms()
</script>

<template>
  <section id="feedback" data-header-theme="light" class="section-y-tight bg-stone-100">
    <div class="site-container flex flex-col gap-8 md:gap-12">
      <div data-reveal="soft">
        <SectionLabel>{{ terms.home.feedback.label }}</SectionLabel>
        <h2 class="section-title mt-1 uppercase md:text-4xl text-2xl font-semibold leading-tight tracking-normal text-neutral-950">{{ terms.home.feedback.title }}</h2>
        <p class="section-description mt-5 max-w-md text-sm leading-6 text-neutral-600 md:text-base md:leading-8">
          {{ terms.home.feedback.description }}
        </p>
      </div>

      <FeedbackForm class="border-neutral-300 p-4 md:p-8" data-reveal="soft" data-reveal-delay="140" />
    </div>
  </section>
</template>
