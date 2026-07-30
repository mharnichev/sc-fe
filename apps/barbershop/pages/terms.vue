<script setup lang="ts">
import termsMarkdown from '~/data/terms-and-conditions.md?raw'

const { locale } = useTerms()

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

const localizedTermsMarkdown = computed(() => {
  const [ukrainianTerms, englishTerms] = termsMarkdown.split(/\r?\n---\r?\n/)
  const localizedTerms = locale.value === 'en'
    ? (englishTerms || ukrainianTerms)
    : ukrainianTerms

  return localizedTerms
    .trim()
    .replace(/^#\s+.+(?:\r?\n)+/, '')
})

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

const renderedTerms = computed(() => renderMarkdown(localizedTermsMarkdown.value))

useSeo(
  () => pageText.value.title,
  () => pageText.value.description,
)
</script>

<template>
  <div>
    <section data-header-theme="dark" class="bg-neutral-950 pb-12 pt-28 text-white sm:pb-16 sm:pt-32">
      <div class="site-container">
        <p class="type-eyebrow type-eyebrow--wide text-sm text-white/50">{{ pageText.eyebrow }}</p>
        <h1 class="type-page-title mt-5 max-w-5xl text-4xl sm:text-6xl">{{ pageText.title }}</h1>
      </div>
    </section>

    <section data-header-theme="light" class="bg-stone-100 py-12 text-neutral-950 sm:py-20">
      <article class="legal-copy site-container" v-html="renderedTerms" />
    </section>
  </div>
</template>

<style scoped>
.legal-copy {
  max-width: 56rem;
}

.legal-copy :deep(h2) {
  margin-top: 3rem;
  scroll-margin-top: 7rem;
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.2;
}

.legal-copy :deep(h2:first-child) {
  margin-top: 0;
}

.legal-copy :deep(p),
.legal-copy :deep(li) {
  color: rgb(82 82 82);
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
  color: rgb(23 23 23);
  font-weight: 700;
}

.legal-copy :deep(a) {
  color: rgb(161 98 7);
  background-image: linear-gradient(currentColor, currentColor);
  background-position: right bottom;
  background-repeat: no-repeat;
  background-size: 0 1px;
  text-decoration: none;
  transition: background-size 432ms cubic-bezier(0.3, 1, 0.3, 1);
}

.legal-copy :deep(a:hover),
.legal-copy :deep(a:focus-visible) {
  background-position: left bottom;
  background-size: 100% 1px;
}

@media (min-width: 640px) {
  .legal-copy :deep(h2) {
    font-size: 1.8rem;
  }
}

</style>
