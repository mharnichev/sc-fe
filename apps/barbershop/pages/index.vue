<script setup lang="ts">
import { AppSection } from '@shared-ui'

const domain = useBarbershopDomain()
const [{ data: services }, { data: masters }] = await Promise.all([
  useAsyncData('services-home', domain.getServices),
  useAsyncData('masters-home', domain.getMasters),
])

useSeo('Atelier Barber', 'Modern barbershop with elevated service, master barbers and online booking.')
</script>

<template>
  <div class="space-y-16">
    <section class="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
      <div class="space-y-6">
        <p class="text-sm font-semibold uppercase tracking-[0.35em] text-amber-700">
          Chicago Studio
        </p>
        <h1 class="max-w-3xl text-5xl font-semibold leading-tight text-stone-900 md:text-6xl">
          Clean cuts, sharp beards and a storefront built around men’s care.
        </h1>
        <p class="max-w-2xl text-lg leading-8 text-stone-600">
          Atelier Barber combines classic service, modern grooming, and a tightly curated product selection for men who want the routine to be simple and consistent.
        </p>
        <div class="flex flex-wrap gap-4">
          <NuxtLink to="/contacts" class="rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-white">
            Book a chair
          </NuxtLink>
          <NuxtLink to="/services" class="rounded-full border border-stone-300 px-6 py-3 text-sm font-medium text-stone-700">
            Explore services
          </NuxtLink>
        </div>
      </div>
      <img src="https://images.unsplash.com/photo-1622287162716-f311baa1a2b8?auto=format&fit=crop&w=1200&q=80" alt="Barbershop interior" class="h-[32rem] w-full rounded-[2.5rem] object-cover shadow-2xl">
    </section>

    <AppSection eyebrow="Services" title="Built for regulars, tailored for first visits" description="Haircuts, beard work and classic wet shave service with enough detail to feel premium and enough discipline to stay consistent.">
      <div class="grid gap-5 md:grid-cols-3">
        <article v-for="service in services || []" :key="service.id" class="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <h3 class="text-xl font-semibold text-stone-900">{{ service.name }}</h3>
          <p class="mt-2 text-sm leading-7 text-stone-600">{{ service.description }}</p>
          <div class="mt-5 flex items-center justify-between text-sm text-stone-500">
            <span>{{ service.duration_minutes }} min</span>
            <span class="font-semibold text-stone-900">${{ service.price }}</span>
          </div>
        </article>
      </div>
    </AppSection>

    <AppSection eyebrow="Masters" title="Barbers with strong point of view" description="Each master has a specialty, but the baseline is the same: clean consultation, precise finishing, and product recommendations that are actually useful.">
      <div class="grid gap-6 md:grid-cols-2">
        <article v-for="master in masters || []" :key="master.id" class="grid gap-5 rounded-[2rem] border border-stone-200 bg-white p-5 shadow-sm md:grid-cols-[180px_1fr]">
          <img :src="master.photo || 'https://placehold.co/800x800'" :alt="master.name" class="h-52 w-full rounded-[1.5rem] object-cover">
          <div>
            <p class="text-xs uppercase tracking-[0.3em] text-amber-700">{{ master.title }}</p>
            <h3 class="mt-2 text-2xl font-semibold text-stone-900">{{ master.name }}</h3>
            <p class="mt-3 text-sm leading-7 text-stone-600">{{ master.bio || master.description }}</p>
          </div>
        </article>
      </div>
    </AppSection>
  </div>
</template>
