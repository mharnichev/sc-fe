<script setup lang="ts">
const { terms } = useTerms()
</script>

<template>
  <section id="journal" class="section-y bg-neutral-950 text-white">
    <div class="site-container grid gap-8 lg:grid-cols-[0.38fr_0.62fr] lg:gap-12">
      <div data-reveal="soft">
        <SectionLabel>{{ terms.home.journal.label }}</SectionLabel>
        <h2 class="section-title-inverse mt-4">{{ terms.home.journal.title }}</h2>
      </div>
      <div class="grid gap-5 md:grid-cols-2">
        <article v-for="(item, index) in terms.home.journal.items" :key="item.title" class="border border-white/15 p-4 md:p-6" data-reveal="soft" :data-reveal-delay="Math.min(index, 3) * 80">
          <p class="text-xs font-semibold uppercase tracking-[0.22em] text-white/50">{{ item.date }} / {{ item.category }}</p>
          <h3 class="mt-5 text-2xl font-semibold leading-tight md:mt-8">{{ item.title }}</h3>
          <NuxtLink to="#" class="mt-6 inline-flex text-sm font-semibold uppercase tracking-[0.18em] text-white/75 md:mt-10">
            {{ terms.common.read }}
          </NuxtLink>
        </article>
      </div>
    </div>
  </section>
</template>
