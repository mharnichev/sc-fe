<script setup lang="ts">
const props = defineProps<{
  title: string
  isLight?: boolean
}>()

const route = useRoute()
const runtimeConfig = useRuntimeConfig()
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
    label: 'Email',
    shortLabel: '@',
    href: `mailto:?subject=${encodedTitle.value}&body=${encodeURIComponent(`Here is the link to the article: ${shareUrl.value}`)}`,
  },
])

const copyLink = async () => {
  if (!import.meta.client || !navigator.clipboard) {
    return
  }

  await navigator.clipboard.writeText(shareUrl.value)
  copied.value = true
  window.setTimeout(() => {
    copied.value = false
  }, 1800)
}
</script>

<template>
  <section
    class="social-sharing mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 sm:py-14"
    :class="isLight ? 'text-neutral-950' : 'text-white'"
    aria-label="Share this story"
  >
    <h5
      class="sharing-title text-xs font-black uppercase tracking-[0.24em]"
      :class="isLight ? 'text-neutral-600' : 'text-white/55'"
    >
      Share this story
    </h5>
    <div class="mt-5 flex items-center justify-center gap-3">
      <a
        v-for="link in shareLinks"
        :key="link.label"
        :href="link.href"
        :title="`Share to ${link.label}`"
        class="flex h-11 w-11 items-center justify-center rounded-full border text-sm font-black uppercase transition"
        :class="isLight ? 'border-neutral-950 text-neutral-950 hover:bg-neutral-950 hover:text-white' : 'border-white text-white hover:bg-white hover:text-neutral-950'"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span class="sr-only">{{ link.label }}</span>
        <span aria-hidden="true">{{ link.shortLabel }}</span>
      </a>
      <button
        type="button"
        class="flex h-11 min-w-11 items-center justify-center rounded-full border px-3 text-xs font-black uppercase transition"
        :class="isLight ? 'border-neutral-950 text-neutral-950 hover:bg-neutral-950 hover:text-white' : 'border-white text-white hover:bg-white hover:text-neutral-950'"
        @click="copyLink"
      >
        {{ copied ? 'Copied' : 'Link' }}
      </button>
    </div>
  </section>
</template>
