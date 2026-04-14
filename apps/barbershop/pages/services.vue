<script setup lang="ts">
import { AppSection } from '@shared-ui'

const domain = useBarbershopDomain()
const { data: services } = await useAsyncData('services', domain.getServices)

useSeo('Services', 'Haircuts, beard work, shaves and premium grooming services.')
</script>

<template>
  <AppSection eyebrow="Menu" title="Service lineup" description="Straightforward pricing, premium finishing, and enough detail to make return visits easy to plan.">
    <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <article v-for="service in services || []" :key="service.id" class="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-stone-200">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h3 class="text-2xl font-semibold text-stone-900">{{ service.name }}</h3>
            <p class="mt-2 text-sm leading-7 text-stone-600">{{ service.description }}</p>
          </div>
          <span class="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-amber-700">
            {{ service.duration_minutes }}m
          </span>
        </div>
        <p class="mt-6 text-3xl font-semibold text-stone-900">${{ service.price }}</p>
      </article>
    </div>
  </AppSection>
</template>
