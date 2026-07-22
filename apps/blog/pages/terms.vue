<script setup lang="ts">
import termsMarkdown from '~/data/terms-and-conditions.md?raw'

const { locale } = useBlogLocale()

const pageText = computed(() => locale.value === 'en'
  ? {
      eyebrow: 'Legal',
      title: 'Terms of Use and Online Booking',
      description: 'Soul Cuts website, online booking, services, newsletter and personal data processing terms.',
    }
  : {
      eyebrow: 'Правова інформація',
      title: 'Умови користування та онлайн-запису',
      description: 'Умови використання сайту Soul Cuts, онлайн-запису, послуг, розсилки та обробки персональних даних.',
    },
)

const [ukrainianTerms = '', englishTerms = ''] = termsMarkdown.split(/\n---\n\s*(?=# Soul Cuts — Terms of Use)/)
const localizedTerms = computed(() => locale.value === 'en' ? englishTerms : ukrainianTerms)

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
}[character] || character))

const renderInline = (value: string) => escapeHtml(value)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')

const renderMarkdown = (markdown: string) => {
  const output: string[] = []
  const paragraph: string[] = []
  let listOpen = false

  const closeList = () => {
    if (!listOpen) return
    output.push('</ul>')
    listOpen = false
  }

  const flushParagraph = () => {
    if (!paragraph.length) return
    output.push(`<p>${renderInline(paragraph.join(' '))}</p>`)
    paragraph.length = 0
  }

  markdown.split('\n').forEach((line) => {
    const heading = line.match(/^(#{1,2})\s+(.+)$/)
    const listItem = line.match(/^-\s+(.+)$/)

    if (!line.trim()) {
      flushParagraph()
      closeList()
      return
    }

    if (heading) {
      flushParagraph()
      closeList()
      const level = heading[1].length
      output.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
      return
    }

    if (line === '---') {
      flushParagraph()
      closeList()
      output.push('<hr>')
      return
    }

    if (listItem) {
      flushParagraph()
      if (!listOpen) {
        output.push('<ul>')
        listOpen = true
      }
      output.push(`<li>${renderInline(listItem[1])}</li>`)
      return
    }

    if (line.startsWith('> ')) {
      flushParagraph()
      closeList()
      output.push(`<blockquote><p>${renderInline(line.slice(2))}</p></blockquote>`)
      return
    }

    paragraph.push(line.trim())
  })

  flushParagraph()
  closeList()
  return output.join('')
}

const renderedTerms = computed(() => renderMarkdown(localizedTerms.value))

const runtimeConfig = useRuntimeConfig()
const pageUrl = computed(() => `${String(runtimeConfig.public.siteUrl).replace(/\/+$/, '')}/terms`)

useSeoMeta({
  title: () => pageText.value.title,
  description: () => pageText.value.description,
  ogTitle: () => pageText.value.title,
  ogDescription: () => pageText.value.description,
  ogUrl: () => pageUrl.value,
})

useHead(() => ({
  link: [{ rel: 'canonical', href: pageUrl.value }],
}))
</script>

<template>
  <div>
    <section data-header-theme="dark" class="bg-neutral-950 pb-12 pt-28 text-white sm:pb-16 sm:pt-32">
      <div class="site-container">
        <p class="type-eyebrow type-eyebrow--wide text-sm text-white/50">{{ pageText.eyebrow }}</p>
        <h1 class="type-page-title mt-5 max-w-5xl text-4xl sm:text-6xl">{{ pageText.title }}</h1>
      </div>
    </section>

    <section data-header-theme="light" class="bg-neutral-950 py-12 text-white sm:py-20">
      <article class="legal-copy site-container" v-html="renderedTerms" />
    </section>
  </div>
</template>

<style scoped>
.legal-copy {
  max-width: 56rem;
}

.legal-copy :deep(h1) {
  margin-top: 0;
  scroll-margin-top: 7rem;
  padding-top: 0;
  font-size: clamp(2rem, 5vw, 3.75rem);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.035em;
}

.legal-copy :deep(h2) {
  margin-top: 3rem;
  font-size: clamp(1.35rem, 2.5vw, 1.8rem);
  font-weight: 700;
  line-height: 1.2;
}

.legal-copy :deep(p),
.legal-copy :deep(li) {
  color: rgb(163 163 163);
  font-size: 1rem;
  line-height: 1.85;
}

.legal-copy :deep(p) {
  margin-top: 1rem;
}

.legal-copy :deep(ul) {
  margin: 1rem 0 0 1.25rem;
  list-style: disc;
}

.legal-copy :deep(li + li) {
  margin-top: 0.4rem;
}

.legal-copy :deep(strong) {
  color: rgb(245 245 245);
  font-weight: 700;
}

.legal-copy :deep(a) {
  color: rgb(190 242 100);
  text-decoration: underline;
  text-underline-offset: 0.2em;
}

</style>
