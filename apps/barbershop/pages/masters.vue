<script setup lang="ts">
import type { MasterDto } from '@shared-types'

const { terms, locale } = useTerms()
const domain = useBarbershopDomain()
const assetUrl = useAssetUrl()
const { masterName } = useMasterDisplay()
const { data: masters, pending, error } = await useAsyncData('masters', domain.getMasters, {
  default: () => [],
})

const visibleMasters = computed(() =>
  (masters.value || []).filter(master => master.is_active ?? master.status !== 'inactive'),
)

useSeo(
  () => terms.value.seo.mastersTitle,
  () => terms.value.seo.mastersDescription,
)

const masterPhoto = (master: MasterDto) =>
  assetUrl(master.photo || master.photo_url) || 'https://placehold.co/1200x900'

const masterRole = (master: MasterDto) => locale.value === 'en'
  ? master.position_en || master.title_en || master.title || master.position_uk
  : master.position_uk || master.title_uk || master.title || master.position_en

const masterDescription = (master: MasterDto) => locale.value === 'en'
  ? master.bio_en || master.description_en || master.bio || master.description || master.bio_uk || master.description_uk
  : master.bio_uk || master.description_uk || master.bio || master.description || master.bio_en || master.description_en
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
      <article v-for="(master, index) in visibleMasters" :key="master.id" class="overflow-hidden rounded-[2rem] bg-white shadow-sm" data-reveal="soft" :data-reveal-delay="Math.min(index, 4) * 90">
        <img :src="masterPhoto(master)" :alt="masterName(master)" class="h-80 w-full object-cover">
        <div class="space-y-3 p-6">
          <p v-if="masterRole(master)" class="type-eyebrow type-eyebrow--wide text-xs text-amber-700">{{ masterRole(master) }}</p>
          <h2 class="type-card-title text-2xl text-stone-900">{{ masterName(master) }}</h2>
          <p v-if="masterDescription(master)" class="text-sm leading-7 text-stone-600">{{ masterDescription(master) }}</p>
          <MasterRatingBlock
            :master-id="master.id"
            :review-limit="2"
            show-reviews
            class="border-t border-stone-200 pt-4"
          />
        </div>
      </article>
    </div>
    <FeedbackState
      v-if="pending || error || !visibleMasters.length"
      compact
      :kind="error ? 'error' : 'empty'"
      :title="pending ? terms.home.team.loading : terms.home.team.empty"
      style="--feedback-state-surface: #f5f5f4"
    />
  </div>
</template>
