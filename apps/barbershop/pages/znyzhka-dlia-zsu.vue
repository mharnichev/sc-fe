<script setup lang="ts">
const { locale, terms } = useTerms()
const openFaq = ref<Record<number, boolean>>({})
const address = computed(() => terms.value.home.contact.address.replace(/^\s*📍\s*/, '').trim())
const phoneHref = computed(() => `tel:${terms.value.home.contact.phone.replace(/[^\d+]/g, '')}`)
const page = computed(() => locale.value === 'en' ? {
  title: 'Discount for Ukrainian military in Odesa — Soul Cuts',
  description: 'Soul Cuts in Odesa offers Ukrainian military personnel a discount on all barbershop services. Haircuts, beard care and shaving. Find us and book online.',
  label: 'With gratitude to Ukraine’s defenders',
  heading: 'A discount on all services for Ukrainian military personnel in Odesa',
  intro: 'Thank you for defending Ukraine, for your service and for the chance to live and work in our city. At Soul Cuts, we offer Ukrainian military personnel a discount on all services as a small, practical way to say thank you.',
  book: 'Book an appointment', services: 'Services and prices',
  scopeTitle: 'Haircuts, beard care and shaving with a military discount',
  scope: 'The discount covers all Soul Cuts barbershop services in Odesa. Choose a haircut, beard trim, shave or a combination of services from our current catalogue.',
  conditions: 'Please check the current discount percentage and final price in the booking form or by phone before your visit. Confirmation of eligibility may be requested during your visit.',
  stepsTitle: 'How to book with the defender discount',
  steps: ['Open online booking and choose your services and barber.', 'Select “I am a defender of Ukraine” in the booking form.', 'Choose an available time, enter your contact details and check the final price before confirming.'],
  thanksTitle: 'You are welcome at Soul Cuts',
  thanks: 'Whether you are on leave, passing through Odesa or live nearby, we would be glad to see you. We value your time and want your visit to be a chance to take care of yourself.',
  locationTitle: 'Where to find us in Odesa', map: 'Get directions', contacts: 'All contacts', faqTitle: 'Questions about the military discount',
  faq: [
    { question: 'Does Soul Cuts offer a discount for Ukrainian military personnel?', answer: 'Yes. Ukrainian military personnel receive a discount on all services at Soul Cuts barbershop in Odesa.' },
    { question: 'Which services does the discount cover?', answer: 'All barbershop services, including haircuts, beard care, shaving and combinations from the current catalogue.' },
    { question: 'What is the discount percentage?', answer: 'Check the current percentage and final price in the booking form or contact the barbershop by phone before your visit.' },
    { question: 'How do I apply the discount when booking?', answer: 'Select “I am a defender of Ukraine” in the booking form and check the final price. Confirmation of eligibility may be requested during the visit.' },
    { question: 'Where is the barbershop?', answer: `Soul Cuts is in Odesa at ${address.value}. Use the map link on this page for directions.` },
  ],
} : {
  title: 'Знижка для ЗСУ в Одесі — всі послуги барбершопу Soul Cuts',
  description: 'Знижка для військових ЗСУ на всі послуги Soul Cuts в Одесі: чоловічі стрижки, догляд за бородою та гоління. Дякуємо за захист України. Адреса й онлайн-запис.',
  label: 'З вдячністю захисникам України',
  heading: 'Знижка для ЗСУ на всі послуги барбершопу в Одесі',
  intro: 'Дякуємо вам за захист України, за вашу службу та за можливість жити й працювати у своєму місті. У Soul Cuts ми надаємо військовослужбовцям ЗСУ знижку на всі послуги — це наш невеликий, але щирий спосіб подякувати за вашу працю.',
  book: 'Записатися зі знижкою', services: 'Послуги та ціни',
  scopeTitle: 'Стрижки, борода та гоління зі знижкою для військових',
  scope: 'Знижка поширюється на всі послуги барбершопу Soul Cuts в Одесі. Обирайте чоловічу стрижку, оформлення бороди, гоління або комплекс послуг з актуального каталогу.',
  conditions: 'Актуальний розмір знижки та підсумкову вартість уточнюйте у формі запису або телефоном перед візитом. Підтвердження права на знижку може знадобитися під час візиту.',
  stepsTitle: 'Як записатися зі знижкою для захисників',
  steps: ['Відкрийте онлайн-запис, оберіть потрібні послуги та барбера.', 'У формі запису позначте «Я захисник України».', 'Оберіть вільний час, залиште контактні дані та перевірте підсумкову вартість перед підтвердженням.'],
  thanksTitle: 'Вам завжди раді у Soul Cuts',
  thanks: 'Якщо ви у відпустці, проїздом в Одесі чи живете поруч — будемо раді бачити вас. Ми цінуємо ваш час і хочемо, щоб візит став нагодою подбати про себе та трохи перепочити.',
  locationTitle: 'Де нас знайти в Одесі', map: 'Прокласти маршрут', contacts: 'Усі контакти', faqTitle: 'Питання про знижку для ЗСУ',
  faq: [
    { question: 'Чи є у Soul Cuts знижка для військових ЗСУ?', answer: 'Так. Військовослужбовцям ЗСУ надаємо знижку на всі послуги барбершопу Soul Cuts в Одесі.' },
    { question: 'На які послуги діє знижка для військових?', answer: 'На всі послуги барбершопу: чоловічі стрижки, догляд за бородою, гоління та комплекси з актуального каталогу.' },
    { question: 'Який розмір знижки для ЗСУ?', answer: 'Актуальний відсоток знижки та підсумкову вартість уточнюйте у формі запису або телефоном перед візитом.' },
    { question: 'Як отримати знижку під час запису?', answer: 'У формі запису позначте «Я захисник України» та перевірте підсумкову вартість. Підтвердження права на знижку може знадобитися під час візиту.' },
    { question: 'Де знаходиться барбершоп?', answer: `Soul Cuts знаходиться в Одесі за адресою ${address.value}. Для маршруту скористайтеся посиланням на карту на цій сторінці.` },
  ],
})

useSeo(() => page.value.title, () => page.value.description, { path: '/znyzhka-dlia-zsu' })
useFaqStructuredData(() => page.value.faq)
</script>

<template>
  <div>
    <section data-header-theme="light" class="section-y pt-24 sm:pt-28 md:pt-32">
      <div class="site-container">
        <div class="max-w-4xl space-y-6">
          <SectionLabel>{{ page.label }}</SectionLabel>
          <h1 class="type-page-title text-4xl leading-tight md:text-6xl">{{ page.heading }}</h1>
          <p class="max-w-3xl text-base leading-8 text-neutral-700">{{ page.intro }}</p>
          <div class="flex flex-col gap-3 sm:flex-row">
            <BaseButton to="/#booking">{{ page.book }}</BaseButton>
            <BaseButton to="/services" variant="light">{{ page.services }}</BaseButton>
          </div>
        </div>
      </div>
    </section>
    <section data-header-theme="light" class="section-y bg-white">
      <div class="site-container grid gap-12 lg:grid-cols-2">
        <div class="space-y-5">
          <h2 class="section-title md:text-4xl">{{ page.scopeTitle }}</h2>
          <p class="leading-8 text-neutral-700">{{ page.scope }}</p>
          <p class="border-l-2 border-amber-700 pl-5 text-sm leading-7 text-neutral-600">{{ page.conditions }}</p>
          <LocaleLink to="/services" class="inline-block"><BaseHoverUnderlineText>{{ page.services }}</BaseHoverUnderlineText></LocaleLink>
        </div>
        <div>
          <h2 class="section-title md:text-4xl">{{ page.stepsTitle }}</h2>
          <ol class="mt-6 list-decimal space-y-4 pl-6 leading-8 text-neutral-700">
            <li v-for="step in page.steps" :key="step">{{ step }}</li>
          </ol>
        </div>
      </div>
    </section>
    <section data-header-theme="dark" class="section-y bg-neutral-950 text-white">
      <div class="site-container grid gap-12 lg:grid-cols-2">
        <div class="space-y-5">
          <h2 class="section-title-inverse md:text-4xl">{{ page.thanksTitle }}</h2>
          <p class="leading-8 text-white/75">{{ page.thanks }}</p>
          <BaseButton to="/#booking" variant="light">{{ page.book }}</BaseButton>
        </div>
        <div class="space-y-5">
          <h2 class="text-2xl font-semibold">{{ page.locationTitle }}</h2>
          <p>{{ address }}</p>
          <a :href="phoneHref" class="inline-block"><BaseHoverUnderlineText>{{ terms.home.contact.phone }}</BaseHoverUnderlineText></a>
          <dl class="space-y-2 text-sm text-white/75">
            <div v-for="[day, time] in terms.home.contact.hours" :key="day" class="flex max-w-sm justify-between gap-4"><dt>{{ day }}</dt><dd>{{ time }}</dd></div>
          </dl>
          <div class="flex flex-wrap gap-5">
            <a :href="terms.home.contact.mapUrl" target="_blank" rel="noopener noreferrer"><BaseHoverUnderlineText>{{ page.map }}</BaseHoverUnderlineText></a>
            <LocaleLink to="/contacts"><BaseHoverUnderlineText>{{ page.contacts }}</BaseHoverUnderlineText></LocaleLink>
          </div>
        </div>
      </div>
    </section>
    <section data-header-theme="light" class="section-y">
      <div class="site-container max-w-4xl">
        <h2 class="section-title mb-8 md:text-4xl">{{ page.faqTitle }}</h2>
        <BaseAccordion
          v-for="(item, index) in page.faq"
          :key="item.question"
          v-model="openFaq[index]"
          class="border-b border-neutral-300"
          summary-class="items-center gap-4 py-5 text-lg font-semibold focus-visible:ring-2 focus-visible:ring-neutral-950/40"
          content-class="pb-5 leading-8 text-neutral-700"
        >
          <template #summary>{{ item.question }}</template>
          <p>{{ item.answer }}</p>
        </BaseAccordion>
      </div>
    </section>
  </div>
</template>
