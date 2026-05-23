<script setup lang="ts">
const { terms } = useTerms()

type FaqQuestion = {
  question: string
  answer: readonly string[]
  list?: readonly { label: string, text: string }[]
  note?: string
}

type FaqSection = {
  title: string
  subtitle: string
  questions: readonly FaqQuestion[]
}

const faqItems = computed(() => terms.value.home.faq.items as readonly FaqSection[])
</script>

<template>
  <section id="faq" data-header-theme="light" class="section-y-tight bg-stone-100">
    <div class="site-container grid gap-8 border-t border-neutral-300 pt-10 md:gap-12 md:pt-24 lg:grid-cols-[0.35fr_0.65fr]">
      <div data-reveal="soft">
        <SectionLabel>{{ terms.home.faq.label }}</SectionLabel>
        <h2 class="section-title mt-4 md:text-5xl">{{ terms.home.faq.title }}</h2>
      </div>
      <div class="divide-y divide-neutral-300" data-reveal="soft" data-reveal-delay="140">
        <details v-for="section in faqItems" :key="section.title" class="group py-4 md:py-6">
          <summary class="flex cursor-pointer list-none items-start justify-between gap-4 md:gap-6">
            <span>
              <span class="block text-lg font-semibold text-neutral-950 md:text-xl">{{ section.title }}</span>
              <span class="mt-1 block text-sm leading-6 text-neutral-500">{{ section.subtitle }}</span>
            </span>
            <span class="text-2xl leading-none transition group-open:rotate-45">+</span>
          </summary>
          <div class="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out group-open:grid-rows-[1fr]">
            <div class="overflow-hidden">
              <div class="mt-4 space-y-3 md:mt-6">
                <details
                  v-for="question in section.questions"
                  :key="question.question"
                  class="group/question border-t border-neutral-300 pt-3 first:border-t-0 first:pt-0 md:pt-4"
                >
                  <summary class="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-neutral-900">
                    {{ question.question }}
                    <span class="text-xl leading-none text-neutral-500 transition group-open/question:rotate-45">+</span>
                  </summary>
                  <div class="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out group-open/question:grid-rows-[1fr]">
                    <div class="overflow-hidden">
                      <div class="mt-3 max-w-2xl space-y-3 text-sm leading-7 text-neutral-600 md:text-base md:leading-8">
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
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </details>
      </div>
    </div>
  </section>
</template>
