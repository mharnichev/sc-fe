<script setup lang="ts">
const domain = useBarbershopDomain()
const { data: masters } = await useAsyncData('masters', domain.getMasters)

useSeo('Masters', 'Meet the master barbers behind Atelier Barber.')
</script>

<template>
  <div class="space-y-8">
    <div class="max-w-2xl space-y-3">
      <p class="text-sm uppercase tracking-[0.3em] text-amber-700">Team</p>
      <h1 class="text-5xl font-semibold text-stone-900">Masters</h1>
      <p class="text-lg leading-8 text-stone-600">
        The shop is intentionally compact. Every barber carries a clear specialty, but every appointment is held to the same standard.
      </p>
    </div>
    <div class="grid gap-6 md:grid-cols-2">
      <article v-for="master in masters || []" :key="master.id" class="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
        <img :src="master.photo || 'https://placehold.co/1200x900'" :alt="master.name" class="h-80 w-full object-cover">
        <div class="space-y-3 p-6">
          <p class="text-xs uppercase tracking-[0.3em] text-amber-700">{{ master.title }}</p>
          <h2 class="text-2xl font-semibold text-stone-900">{{ master.name }}</h2>
          <p class="text-sm leading-7 text-stone-600">{{ master.bio || master.description }}</p>
        </div>
      </article>
    </div>
  </div>
</template>
