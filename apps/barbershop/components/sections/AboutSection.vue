<script setup lang="ts">
const { terms } = useTerms()
</script>

<template>
  <section id="studio" class="section-y bg-stone-100">
    <div class="site-container grid gap-12 lg:grid-cols-[0.58fr_0.42fr] lg:items-center">
      <div data-reveal="soft">
        <SectionLabel>{{ terms.home.about.label }}</SectionLabel>
        <h2 class="section-title mt-4">
          {{ terms.home.about.title }}
        </h2>
        <div class="mt-8 grid gap-6 text-base leading-8 text-neutral-600 md:grid-cols-2">
          <p>
            {{ terms.home.about.firstText }}
          </p>
          <p>
            {{ terms.home.about.secondText }}
          </p>
        </div>
      </div>
      <div class="grid gap-5" data-reveal="soft" data-reveal-delay="140">
        <MediaPanel src="https://images.unsplash.com/photo-1512690459411-b9245aed614b?auto=format&fit=crop&w=1200&q=80" :alt="terms.home.about.imageAlt" />
        <div class="grid grid-cols-2 gap-5">
          <div class="border border-neutral-300 p-6">
            <p class="text-4xl font-semibold text-neutral-950">5</p>
            <p class="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{{ terms.home.about.bookingSteps }}</p>
          </div>
          <div class="border border-neutral-300 p-6">
            <p class="text-4xl font-semibold text-neutral-950">3</p>
            <p class="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{{ terms.home.about.contentRhythms }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
