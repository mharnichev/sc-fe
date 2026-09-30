<script setup lang="ts">
const props = withDefaults(defineProps<{
  description: string
  theme?: 'light' | 'dark'
}>(), {
  theme: 'light',
})

const { locale } = useTerms()
const open = ref(false)
const expandLabel = computed(() => locale.value === 'en' ? 'Read full description' : 'Читати повністю')
const summaryClass = computed(() => props.theme === 'dark'
  ? 'w-full items-start gap-2 text-left text-white/60 focus-visible:ring-2 focus-visible:ring-white/70'
  : 'w-full items-start gap-2 text-left text-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-950/40')
const contentClass = computed(() => props.theme === 'dark'
  ? 'pt-2 text-xs leading-5 text-white/70'
  : 'pt-2 text-xs leading-5 text-neutral-600')
</script>

<template>
  <div v-if="description" class="service-description">
    <p class="service-description__desktop" :class="theme === 'dark' ? 'text-white/55' : 'text-neutral-600'">
      {{ description }}
    </p>
    <BaseAccordion
      v-model="open"
      class="service-description__mobile"
      :summary-class="summaryClass"
      :content-class="contentClass"
    >
      <template #summary="{ open: isOpen }">
        <span class="block min-w-0">
          <span v-if="!isOpen" class="service-description__preview">{{ description }}</span>
          <span v-if="!isOpen" class="service-description__action">{{ expandLabel }}</span>
        </span>
      </template>
      <p>{{ description }}</p>
    </BaseAccordion>
  </div>
</template>

<style scoped>
.service-description__desktop {
  font-size: 0.875rem;
  line-height: 1.75rem;
}

.service-description__mobile {
  display: none;
}

.service-description__preview {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  font-size: 0.75rem;
  line-height: 1.25rem;
}

.service-description__action {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

@media (max-width: 639px) {
  .service-description__desktop {
    display: none;
  }

  .service-description__mobile {
    display: block;
  }
}
</style>
