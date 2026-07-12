<script setup lang="ts">
import type { MasterDto } from '@shared-types'

const { terms } = useTerms()
const domain = useBarbershopDomain()
const assetUrl = useAssetUrl()
const { data: masters } = await useAsyncData('masters', domain.getMasters)

useSeo(
  () => terms.value.seo.mastersTitle,
  () => terms.value.seo.mastersDescription,
)

const masterName = (master: MasterDto) =>
  master.full_name_uk
  || [master.first_name_uk || master.full_name, master.last_name_uk || master.last_name].filter(Boolean).join(' ')
  || master.full_name
  || master.name
  || `Master #${master.id}`

const masterPhoto = (master: MasterDto) =>
  assetUrl(master.photo || master.photo_url) || 'https://placehold.co/1200x900'
</script>

<template>
  <div class="space-y-8">
    <div class="max-w-2xl space-y-3" data-reveal="soft">
      <p class="type-eyebrow type-eyebrow--wide text-sm text-amber-700">{{ terms.pages.masters.label }}</p>
      <h1 class="type-page-title text-5xl text-stone-900">{{ terms.pages.masters.title }}</h1>
      <p class="text-lg leading-8 text-stone-600">
        {{ terms.pages.masters.description }}
      </p>
    </div>
    <div class="grid gap-6 md:grid-cols-2">
      <article v-for="(master, index) in masters || []" :key="master.id" class="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm" data-reveal="soft" :data-reveal-delay="Math.min(index, 4) * 90">
        <img :src="masterPhoto(master)" :alt="masterName(master)" class="h-80 w-full object-cover">
        <div class="space-y-3 p-6">
          <p class="type-eyebrow type-eyebrow--wide text-xs text-amber-700">{{ master.title }}</p>
          <h2 class="type-card-title text-2xl text-stone-900">{{ masterName(master) }}</h2>
          <p class="text-sm leading-7 text-stone-600">{{ master.bio || master.description }}</p>
        </div>
      </article>
    </div>
  </div>
</template>
