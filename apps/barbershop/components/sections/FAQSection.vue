<script setup lang="ts">
const { terms } = useTerms()

type FaqQuestion = {
  question: string
  answer: readonly string[]
  list?: readonly { label: string, text: string }[]
  note?: string
  relatedArticles?: readonly { title: string, href: string }[]
}

type FaqSection = {
  title: string
  subtitle: string
  questions: readonly FaqQuestion[]
}

const faqItems = computed(() => terms.value.home.faq.items as readonly FaqSection[])
const faqRoot = ref<HTMLElement | null>(null)

const faqStructuredItems = computed(() =>
  faqItems.value.flatMap(section =>
    section.questions.map(question => ({
      question: question.question,
      answer: [
        ...question.answer,
        ...(question.list || []).map(entry => `${entry.label} ${entry.text}`),
        question.note || '',
      ].filter(Boolean).join('\n'),
    })),
  ),
)

useFaqStructuredData(faqStructuredItems)

const activeAnimations = new WeakMap<HTMLElement, number>()
const accordionTiming = {
  heightDuration: 420,
  contentDuration: 260,
  heightEasing: 'cubic-bezier(0.3, 1, 0.3, 1)',
  contentEasing: 'cubic-bezier(0.3, 1, 0.3, 1)',
}

onMounted(() => {
  faqRoot.value?.querySelectorAll('details').forEach(details => {
    details.setAttribute('aria-expanded', details.hasAttribute('open') ? 'true' : 'false')
  })
})

function setAccordionState(details: HTMLDetailsElement, isOpen: boolean) {
  details.open = isOpen
  details.setAttribute('aria-expanded', isOpen ? 'true' : 'false')
}

function clearAccordionAnimations(details: HTMLElement) {
  const activeAnimation = activeAnimations.get(details)

  if (activeAnimation) {
    window.clearTimeout(activeAnimation)
  }
  activeAnimations.delete(details)
}

function resetAccordionStyles(details: HTMLElement, content: HTMLElement) {
  details.style.height = ''
  details.style.overflow = ''
  details.style.transition = ''
  details.style.willChange = ''
  content.style.opacity = ''
  content.style.transform = ''
  content.style.transition = ''
  content.style.willChange = ''
}

function animateAccordion(details: HTMLDetailsElement, summary: HTMLElement, content: HTMLElement, shouldOpen: boolean) {
  clearAccordionAnimations(details)

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setAccordionState(details, shouldOpen)
    return
  }

  const startHeight = details.getBoundingClientRect().height

  details.style.overflow = 'hidden'
  details.style.height = `${startHeight}px`
  details.style.willChange = 'height'
  details.style.transition = 'none'
  content.style.transition = 'none'
  content.style.willChange = 'opacity, transform'

  if (shouldOpen) {
    setAccordionState(details, true)
    content.style.opacity = '0'
    content.style.transform = 'translateY(12px)'
  }
  else {
    details.setAttribute('aria-expanded', 'false')
  }

  let endHeight = summary.getBoundingClientRect().height

  if (shouldOpen) {
    details.style.height = 'auto'
    endHeight = details.getBoundingClientRect().height
    details.style.height = `${startHeight}px`
  }

  details.getBoundingClientRect()

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      details.style.transition = `height ${accordionTiming.heightDuration}ms ${accordionTiming.heightEasing}`
      content.style.transition = `opacity ${accordionTiming.contentDuration}ms ${accordionTiming.contentEasing} 80ms, transform ${accordionTiming.contentDuration}ms ${accordionTiming.contentEasing} 80ms`
      details.style.height = `${endHeight}px`
      content.style.opacity = shouldOpen ? '1' : '0'
      content.style.transform = shouldOpen ? 'translateY(0)' : 'translateY(8px)'
    })
  })

  const cleanupTimer = window.setTimeout(() => {
    if (!shouldOpen) {
      details.open = false
    }

    resetAccordionStyles(details, content)
    activeAnimations.delete(details)
  }, accordionTiming.heightDuration + 140)

  activeAnimations.set(details, cleanupTimer)
}

function onAccordionSummaryClick(event: MouseEvent) {
  event.preventDefault()

  const summary = event.currentTarget as HTMLElement
  const details = summary.closest('details')
  const content = summary.nextElementSibling

  if (!(details instanceof HTMLDetailsElement) || !(content instanceof HTMLElement)) {
    return
  }

  animateAccordion(details, summary, content, !details.open)
}
</script>

<template>
  <section id="faq" ref="faqRoot" data-header-theme="light" class="section-y-tight bg-stone-100">
    <div class="site-container flex flex-col gap-8 pt-10 md:gap-12 md:pt-24">
      <div data-reveal="soft">
        <SectionLabel>{{ terms.home.faq.label }}</SectionLabel>
        <h2 class="section-title mt-4 md:text-4xl">{{ terms.home.faq.title }}</h2>
        <p class="mt-4 max-w-2xl text-sm leading-6 text-neutral-600 md:text-base md:leading-7">
          {{ terms.home.faq.description }}
        </p>
      </div>
      <div class="faq-accordions" data-reveal="soft" data-reveal-delay="140">
        <details v-for="section in faqItems" :key="section.title" class="faq-accordion" aria-expanded="false">
          <summary class="faq-accordion__summary items-start" @click="onAccordionSummaryClick">
            <span>
              <span class="block text-lg font-semibold text-neutral-950 md:text-xl">{{ section.title }}</span>
              <span class="mt-1 block text-sm leading-6 text-neutral-500">{{ section.subtitle }}</span>
            </span>
            <svg class="faq-accordion__icon mt-1" viewBox="0 0 14 14" stroke="currentColor" fill="none" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M7 1V13M13 7H1" />
            </svg>
          </summary>
          <div class="faq-accordion__content">
            <div class="space-y-0">
              <details
                v-for="question in section.questions"
                :key="question.question"
                class="faq-accordion faq-accordion--nested"
                aria-expanded="false"
              >
                <summary class="faq-accordion__summary text-base font-semibold text-neutral-900" @click="onAccordionSummaryClick">
                  <span>
                    {{ question.question }}
                  </span>
                  <svg class="faq-accordion__icon faq-accordion__icon--nested" viewBox="0 0 14 14" stroke="currentColor" fill="none" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M7 1V13M13 7H1" />
                  </svg>
                </summary>
                <div class="faq-accordion__content faq-accordion__content--nested">
                  <div class="faq-accordion__answer space-y-3 text-sm leading-7 text-neutral-600 md:text-base md:leading-8">
                    <p v-for="paragraph in question.answer" :key="paragraph">
                      {{ paragraph }}
                    </p>
                    <ul v-if="question.list" class="space-y-2">
                      <li v-for="entry in question.list" :key="entry.label" class="pl-4">
                        <span class="font-semibold text-neutral-900">{{ entry.label }}</span>
                        {{ entry.text }}
                      </li>
                    </ul>
                    <p v-if="question.note" class="text-neutral-500">
                      {{ question.note }}
                    </p>
                    <div v-if="question.relatedArticles?.length" class="pt-4">
                      <p class="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                        {{ terms.home.faq.relatedArticlesTitle }}
                      </p>
                      <div class="mt-3 flex flex-col gap-2">
                        <a
                          v-for="article in question.relatedArticles"
                          :key="article.href"
                          :href="article.href"
                          class="w-fit pb-1 text-sm font-semibold text-neutral-950 transition hover:text-neutral-600"
                        >
                          {{ article.title }}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </details>
      </div>
    </div>
  </section>
</template>

<style scoped>
.faq-accordions {
  display: grid;
  gap: 0.85rem;
}

.faq-accordion {
  box-sizing: border-box;
  border: 0;
}

.faq-accordions > .faq-accordion {
  background: rgb(23 23 23 / 0.025);
}

.faq-accordions > .faq-accordion:nth-child(2n) {
  background: rgb(23 23 23 / 0.04);
}

.faq-accordions > .faq-accordion:nth-child(3n) {
  background: rgb(23 23 23 / 0.032);
}

.faq-accordion__summary {
  display: flex;
  cursor: pointer;
  list-style: none;
  justify-content: space-between;
  gap: 1rem;
  padding-inline: 1rem;
  padding-block: 1.75rem;
}

.faq-accordion__summary::-webkit-details-marker {
  display: none;
}

.faq-accordion__summary:focus {
  outline: none;
}

.faq-accordion__summary:focus-visible {
  outline: none;
}

.faq-accordion__icon {
  width: 0.875rem;
  height: 0.875rem;
  flex: 0 0 auto;
  transform: scaleY(-1) rotate(0deg);
  transition: transform 500ms cubic-bezier(0.3, 1, 0.3, 1);
}

.faq-accordion[aria-expanded='true'] > .faq-accordion__summary > .faq-accordion__icon {
  transform: scaleY(-1) rotate(45deg);
}

.faq-accordion__content {
  margin-block-start: -0.625rem;
  padding-inline: 1rem;
  padding-block-end: 2rem;
}

.faq-accordion--nested:first-child {
  border-block-start: 0;
}

.faq-accordion--nested {
  background: transparent;
}

.faq-accordion--nested .faq-accordion__summary {
  align-items: center;
  padding-block: 1.25rem;
}

.faq-accordion__icon--nested {
  width: 0.75rem;
  height: 0.75rem;
  color: rgb(115 115 115);
}

.faq-accordion__content--nested {
  margin-block-start: -0.25rem;
  padding-block-end: 1.5rem;
}

.faq-accordion__answer {
  background: rgb(23 23 23 / 0.06);
  padding: 1rem;
}

@media (min-width: 768px) {
  .faq-accordion__summary {
    gap: 1.5rem;
    padding-inline: 1.25rem;
    padding-block: 2rem;
  }

  .faq-accordion__content {
    padding-inline: 1.25rem;
  }

  .faq-accordion--nested .faq-accordion__summary {
    padding-block: 1.5rem;
  }

  .faq-accordion__answer {
    padding: 1.25rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .faq-accordion__icon {
    transition: none;
  }
}
</style>
