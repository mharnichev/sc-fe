<script setup lang="ts">
const faqs = [
  { q: 'Do you accept walk-ins?', a: 'Yes, but booking ahead is the only reliable way to secure your preferred master and time.' },
  { q: 'Can I reschedule?', a: 'Appointments can be rescheduled up to 12 hours in advance.' },
  { q: 'Do you stock the products used in service?', a: 'Yes. The shop storefront carries the same beard, styling and skincare essentials used by the team.' },
]

useSeo('Blog & FAQ', 'Answers about Atelier Barber services, appointments and grooming routine.')
</script>

<template>
  <div class="space-y-12">
    <section class="max-w-3xl space-y-4">
      <p class="text-sm uppercase tracking-[0.35em] text-amber-700">Editorial</p>
      <h1 class="text-5xl font-semibold text-stone-900">Blog & FAQ</h1>
      <p class="text-lg leading-8 text-stone-600">
        Most clients do not need more products. They need the right sequence, the right cut cycle, and practical care between visits.
      </p>
    </section>
    <section class="grid gap-6 lg:grid-cols-2">
      <article class="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
        <p class="text-xs uppercase tracking-[0.3em] text-amber-700">Journal</p>
        <h2 class="mt-3 text-2xl font-semibold text-stone-900">How often should you cut textured hair?</h2>
        <p class="mt-4 text-sm leading-7 text-stone-600">
          Every 3 to 5 weeks tends to keep structure intact without forcing unnecessary shortness. Texture needs rhythm more than constant correction.
        </p>
      </article>
      <div class="space-y-4 rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
        <h2 class="text-2xl font-semibold text-stone-900">FAQ</h2>
        <article v-for="faq in faqs" :key="faq.q" class="rounded-2xl bg-stone-50 p-4">
          <h3 class="font-semibold text-stone-900">{{ faq.q }}</h3>
          <p class="mt-2 text-sm leading-7 text-stone-600">{{ faq.a }}</p>
        </article>
      </div>
    </section>
  </div>
</template>
