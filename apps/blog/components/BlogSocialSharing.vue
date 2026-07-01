<script setup lang="ts">
const props = defineProps<{
  title: string
  isLight?: boolean
}>()

const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const { terms } = useBlogLocale()
const { trackBlogEvent } = useBlogAnalytics()
const copied = ref(false)

const shareUrl = computed(() => new URL(route.path, runtimeConfig.public.siteUrl).toString())
const encodedShareUrl = computed(() => encodeURIComponent(shareUrl.value))
const encodedTitle = computed(() => encodeURIComponent(props.title))

const shareLinks = computed(() => [
  {
    label: 'Facebook',
    shortLabel: 'F',
    href: `https://www.facebook.com/sharer.php?u=${encodedShareUrl.value}`,
  },
  {
    label: 'X',
    shortLabel: 'X',
    href: `https://twitter.com/intent/tweet?text=${encodedTitle.value}&url=${encodedShareUrl.value}`,
  },
  {
    label: terms.value.shareEmail,
    shortLabel: '@',
    href: `mailto:?subject=${encodedTitle.value}&body=${encodeURIComponent(`${terms.value.shareEmailBody} ${shareUrl.value}`)}`,
  },
])

const copyLink = async () => {
  if (!import.meta.client || !navigator.clipboard) {
    return
  }

  await navigator.clipboard.writeText(shareUrl.value)
  trackBlogEvent('share_click', {
    method: 'copy_link',
    title: props.title,
  })
  copied.value = true
  window.setTimeout(() => {
    copied.value = false
  }, 1800)
}

const handleShareClick = (method: string) => {
  trackBlogEvent('share_click', {
    method,
    title: props.title,
  })
}
</script>

<template>
  <section
    class="social-sharing mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 sm:py-14"
    :class="isLight ? 'text-neutral-950' : 'text-white'"
    :aria-label="terms.shareStory"
  >
    <h5
      class="sharing-title text-xs font-black uppercase tracking-[0.24em]"
      :class="isLight ? 'text-neutral-600' : 'text-white/55'"
    >
      {{ terms.shareStory }}
    </h5>
    <div class="mt-5 flex items-center justify-center gap-3">
      <BaseButton
        v-for="link in shareLinks"
        :key="link.label"
        :href="link.href"
        :title="`${terms.shareTo} ${link.label}`"
        :variant="isLight ? 'outline-dark' : 'outline-light'"
        shape="circle"
        target="_blank"
        rel="noopener noreferrer"
        @click="handleShareClick(link.label)"
      >
        <span class="sr-only">{{ link.label }}</span>
        <span aria-hidden="true">{{ link.shortLabel }}</span>
      </BaseButton>
      <BaseButton
        type="button"
        :variant="isLight ? 'outline-dark' : 'outline-light'"
        shape="circle"
        :aria-label="copied ? terms.copiedLink : terms.copyLink"
        :title="copied ? terms.copiedLink : terms.copyLink"
        @click="copyLink"
      >
        <span class="sr-only">{{ copied ? terms.copiedLink : terms.copyLink }}</span>
        <svg
          v-if="copied"
          class="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M20 6 9 17l-5-5"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <svg
          v-else
          class="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 4.93"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M14 11a5 5 0 0 0-7.07 0L4.81 13.12a5 5 0 0 0 7.07 7.07L13 19.07"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </BaseButton>
    </div>
  </section>
</template>
