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
      faqTitle: 'FAQ',
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
      faqTitle: 'FAQ',
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
          <p class="text-xs font-semibold uppercase tracking-[0.3em] text-amber-700">
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
            <section class="border-t border-stone-300 pt-5">
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
            <section class="border-t border-stone-300 pt-5">
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

    <section class="section-y-tight border-t border-stone-300">
      <div class="site-container max-w-4xl">
        <h2 class="text-3xl font-semibold text-stone-950">
          {{ page.faqTitle }}
        </h2>
        <div class="mt-6 divide-y divide-stone-300 border-y border-stone-300">
          <article v-for="item in page.faq" :key="item.question" class="py-5">
            <h3 class="text-lg font-semibold text-stone-950">
              {{ item.question }}
            </h3>
            <p class="mt-2 text-sm leading-7 text-stone-700">
              {{ item.answer }}
            </p>
          </article>
        </div>
      </div>
    </section>
  </div>
</template>
