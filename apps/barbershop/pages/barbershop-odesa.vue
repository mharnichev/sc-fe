<script setup lang="ts">
const { locale } = useTerms()

const page = computed(() => locale.value === 'en'
  ? {
      title: 'Barbershop in Odesa',
      description: 'Soul Cuts is a barbershop in Odesa at Kanatna St, 6 with men\'s haircuts, fade, beard shaping, shaving and online booking.',
      eyebrow: 'Soul Cuts / Odesa',
      heading: 'Soul Cuts Barbershop in Odesa',
      intro: 'Soul Cuts is a men\'s barbershop in central Odesa for clean haircuts, fade work, beard shaping, shavette shaving and practical grooming care.',
      details: [
        'The studio is located at Kanatna St, 6, close to the central part of Odesa. You can book online, choose a barber, select a service and reserve a convenient time.',
        'If you search for barbershop Odesa, barbershop Odessa, barber shop Odesa or men\'s haircut Odesa, this page collects the main details: services, address, schedule and booking flow.',
      ],
      servicesTitle: 'Barbershop services',
      services: [
        'Men\'s haircut and consultation',
        'Fade, short clipper cut and shape refresh',
        'Beard trim, beard shape and contours',
        'Traditional shavette shaving with hot towels',
        'Haircut and beard packages',
      ],
      locationTitle: 'Location and booking',
      locationText: 'Address: Kanatna St, 6, Odesa. Opening hours: Tuesday to Sunday, 09:00-20:00. Monday is closed.',
      servicesCta: 'View services',
      bookingCta: 'Book online',
      faqLabel: 'FAQ',
      faqTitle: 'Questions about Soul Cuts in Odesa',
      faqDescription: 'Location, online booking and available grooming services.',
      faq: [
        {
          question: 'Where is Soul Cuts barbershop in Odesa?',
          answer: 'Soul Cuts is at Kanatna St, 6, Odesa, in a convenient central-city location.',
        },
        {
          question: 'Can I book a men\'s haircut online?',
          answer: 'Yes. Use the online booking section to choose a service, barber, date and time.',
        },
        {
          question: 'Do you provide beard and shaving services?',
          answer: 'Yes. Soul Cuts offers beard shaping, contour work and traditional shavette shaving with hot towels.',
        },
      ],
    }
  : {
      title: 'Барбершоп в Одесі',
      description: 'Soul Cuts - барбершоп в Одесі на Канатній, 6: чоловічі стрижки, fade, борода, гоління шаветкою та онлайн-запис.',
      eyebrow: 'Soul Cuts / Одеса',
      heading: 'Soul Cuts - барбершоп в Одесі',
      intro: 'Soul Cuts - чоловічий барбершоп у центрі Одеси для акуратних стрижок, fade, оформлення бороди, гоління шаветкою та практичного догляду.',
      details: [
        'Студія знаходиться за адресою: вулиця Канатна, 6, Одеса. На сайті можна записатися онлайн, обрати барбера, послугу та зручний час.',
        'Якщо ви шукаєте barbershop Odesa, barbershop Odessa, барбершоп Одеса, барбершоп Одесса або чоловіча стрижка Одеса, тут зібрані головні деталі: послуги, адреса, графік і запис.',
      ],
      servicesTitle: 'Послуги барбершопу',
      services: [
        'Чоловіча стрижка та консультація',
        'Fade, коротка машинна стрижка та оновлення форми',
        'Оформлення бороди, контури та тримінг',
        'Традиційне гоління шаветкою з гарячими рушниками',
        'Комплекси: стрижка та борода',
      ],
      locationTitle: 'Адреса та запис',
      locationText: 'Адреса: вулиця Канатна, 6, Одеса. Графік: з вівторка по неділю, 09:00-20:00. Понеділок - вихідний.',
      servicesCta: 'Переглянути послуги',
      bookingCta: 'Записатися онлайн',
      faqLabel: 'FAQ',
      faqTitle: 'Питання про Soul Cuts в Одесі',
      faqDescription: 'Локація, онлайн-запис і доступні послуги барбершопу.',
      faq: [
        {
          question: 'Де знаходиться барбершоп Soul Cuts в Одесі?',
          answer: 'Soul Cuts знаходиться за адресою: вулиця Канатна, 6, Одеса, у зручній локації центральної частини міста.',
        },
        {
          question: 'Чи можна записатися на чоловічу стрижку онлайн?',
          answer: 'Так. У блоці онлайн-запису можна обрати послугу, барбера, дату та зручний час.',
        },
        {
          question: 'Чи є послуги бороди та гоління?',
          answer: 'Так. У Soul Cuts доступні оформлення бороди, контури та традиційне гоління шаветкою з гарячими рушниками.',
        },
      ],
    })

const faqRoot = ref<HTMLElement | null>(null)
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

useSeo(
  () => page.value.title,
  () => page.value.description,
  { path: '/barbershop-odesa' },
)

useFaqStructuredData(() =>
  page.value.faq.map(item => ({
    question: item.question,
    answer: item.answer,
  })),
)
</script>

<template>
  <div class="bg-stone-100">
    <section class="section-y">
      <div class="site-container grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div class="space-y-5" data-reveal="soft">
          <p class="type-eyebrow type-eyebrow--wide text-xs text-amber-700">
            {{ page.eyebrow }}
          </p>
          <h1 class="max-w-3xl text-4xl font-semibold leading-tight text-stone-950 md:text-6xl">
            {{ page.heading }}
          </h1>
          <p class="max-w-2xl text-lg leading-8 text-stone-700">
            {{ page.intro }}
          </p>
          <div class="flex flex-col gap-3 sm:flex-row">
            <BaseButton to="/#booking">{{ page.bookingCta }}</BaseButton>
            <BaseButton to="/services" variant="light">
              {{ page.servicesCta }}
            </BaseButton>
          </div>
        </div>

        <div class="space-y-5 text-base leading-8 text-stone-700" data-reveal="soft" data-reveal-delay="140">
          <p v-for="paragraph in page.details" :key="paragraph">
            {{ paragraph }}
          </p>
          <div class="grid gap-5 md:grid-cols-2">
            <section class="pt-5">
              <h2 class="text-2xl font-semibold text-stone-950">
                {{ page.servicesTitle }}
              </h2>
              <ul class="mt-4 space-y-3 text-sm leading-7">
                <li v-for="service in page.services" :key="service" class="flex gap-3">
                  <span class="mt-3 h-1.5 w-1.5 flex-none rounded-full bg-amber-700" aria-hidden="true" />
                  <span>{{ service }}</span>
                </li>
              </ul>
            </section>
            <section class="pt-5">
              <h2 class="text-2xl font-semibold text-stone-950">
                {{ page.locationTitle }}
              </h2>
              <p class="mt-4 text-sm leading-7">
                {{ page.locationText }}
              </p>
            </section>
          </div>
        </div>
      </div>
    </section>

    <section id="faq" ref="faqRoot" data-header-theme="light" class="section-y-tight bg-stone-100">
      <div class="site-container flex flex-col gap-8 pt-10 md:gap-12 md:pt-24">
        <div data-reveal="soft">
          <SectionLabel>{{ page.faqLabel }}</SectionLabel>
          <h2 class="section-title mt-4 md:text-4xl">{{ page.faqTitle }}</h2>
          <p class="mt-4 max-w-2xl text-sm leading-6 text-neutral-600 md:text-base md:leading-7">
            {{ page.faqDescription }}
          </p>
        </div>
        <div class="faq-accordions" data-reveal="soft" data-reveal-delay="140">
          <details v-for="item in page.faq" :key="item.question" class="faq-accordion" aria-expanded="false">
            <summary class="faq-accordion__summary items-start" @click="onAccordionSummaryClick">
              <span class="block text-lg font-semibold text-neutral-950 md:text-xl">
                {{ item.question }}
              </span>
              <svg class="faq-accordion__icon mt-1" viewBox="0 0 14 14" stroke="currentColor" fill="none" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M7 1V13M13 7H1" />
              </svg>
            </summary>
            <div class="faq-accordion__content">
              <div class="faq-accordion__answer text-sm leading-7 text-neutral-600 md:text-base md:leading-8">
                <p>{{ item.answer }}</p>
              </div>
            </div>
          </details>
        </div>
      </div>
    </section>
  </div>
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
  outline: 2px solid rgb(161 98 7);
  outline-offset: 3px;
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
