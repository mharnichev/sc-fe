<script setup lang="ts">
import type { PublicMasterDto, PublicServiceCatalogItemDto } from '~/utils/seoRoutes'
import { activeMasterServices } from '~/composables/useActiveServiceCatalog'
import {
  indexablePublicMasters,
  indexableServiceCatalog,
  masterSeoPath,
  serviceSeoPath,
} from '~/utils/seoRoutes'

const { locale, terms } = useTerms()
const domain = useBarbershopDomain()
const localizedService = useLocalizedService()
const { masterFullName } = useMasterDisplay()
const assetUrl = useAssetUrl()

const [{ data: serviceCatalog }, { data: masters }] = await Promise.all([
  useAsyncData('odesa-service-catalog', domain.getServiceCatalog, {
    default: () => [],
  }),
  useAsyncData('odesa-public-masters', domain.getMasters, {
    default: () => [],
  }),
])

const contactAddress = computed(() =>
  terms.value.home.contact.address.replace(/^\s*📍\s*/, '').trim(),
)
const hoursSummary = computed(() =>
  terms.value.home.contact.hours
    .map(([day, time]) => `${day}: ${time}`)
    .join('; '),
)
const phoneHref = computed(() =>
  `tel:${terms.value.home.contact.phone.replace(/[^\d+]/g, '')}`,
)

const numericPrice = (value: string | number) => {
  const parsed = typeof value === 'number'
    ? value
    : Number.parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.'))

  return Number.isFinite(parsed) ? parsed : null
}

const servicePriceLabel = (service: PublicServiceCatalogItemDto) => {
  const prices = [...new Set(
    service.barber_services
      .map(item => numericPrice(item.price))
      .filter((price): price is number => price !== null),
  )].sort((first, second) => first - second)

  if (!prices.length) return localizedService.servicePrice(service.price)

  const minimum = prices[0]
  const maximum = prices[prices.length - 1]
  if (minimum === undefined || maximum === undefined) return ''

  if (minimum === maximum) return localizedService.servicePrice(minimum)

  return `${localizedService.servicePrice(minimum)} – ${localizedService.servicePrice(maximum)}`
}

const serviceDurationLabel = (service: PublicServiceCatalogItemDto) => {
  const durations = [...new Set(
    service.barber_services
      .map(item => Number(item.duration_minutes))
      .filter(duration => Number.isFinite(duration) && duration > 0),
  )].sort((first, second) => first - second)

  if (!durations.length) {
    return localizedService.serviceDuration(service.duration_minutes)
  }

  const minimum = durations[0]
  const maximum = durations[durations.length - 1]
  if (minimum === undefined || maximum === undefined) return ''

  if (minimum === maximum) return localizedService.serviceDuration(minimum)

  return locale.value === 'en'
    ? `${minimum}–${maximum} min`
    : `${minimum}–${maximum} хв`
}

const serviceCards = computed(() =>
  indexableServiceCatalog(serviceCatalog.value).map(service => ({
    id: service.catalog_id,
    name: localizedService.serviceName(service),
    description: localizedService.serviceDescription(service),
    duration: serviceDurationLabel(service),
    path: serviceSeoPath(service),
    price: servicePriceLabel(service),
  })),
)

const masterRole = (master: PublicMasterDto) =>
  locale.value === 'en'
    ? master.position_en || master.title_en || master.position_uk || ''
    : master.position_uk || master.title_uk || master.position_en || ''

const masterServices = (master: PublicMasterDto) =>
  [...new Set(
    activeMasterServices(master.services)
      .map(service => localizedService.serviceName(service))
      .filter(Boolean),
  )]

const masterCards = computed(() =>
  indexablePublicMasters(masters.value || []).map(master => ({
    id: master.id,
    image: assetUrl(master.avatar_url || master.photo_url),
    name: masterFullName(master),
    path: masterSeoPath(master),
    role: masterRole(master),
    services: masterServices(master),
  })),
)

const page = computed(() => locale.value === 'en'
  ? {
      title: 'Soul Cuts Barbershop in Odesa',
      description: `Visit Soul Cuts in Odesa at ${contactAddress.value}. Compare haircuts, beard services and barbers, check opening hours, and choose an appointment online.`,
      eyebrow: 'Soul Cuts / Odesa',
      heading: 'Soul Cuts Barbershop in Odesa',
      intro: 'Planning a haircut, beard trim or shave? Compare services and barbers, check the price and appointment length, then choose a time that works for you.',
      bookingCta: 'Book online',
      servicesCta: 'View all services',
      locationLabel: 'Visit Soul Cuts',
      locationTitle: 'Address, hours and contacts',
      locationIntro: 'Use the map link for directions and check the hours below before setting out. You can call the studio if you have a question about your visit.',
      bookingTitle: 'Choose your appointment',
      bookingIntro: 'Select the service you need, then a barber, date and available time. You can also use Soulcuts Bot in Telegram to manage a booking.',
      contactsCta: 'Open contacts',
      servicesLabel: 'Find your service',
      servicesTitle: 'Hair, beard and shave services',
      servicesIntro: 'Use the description to choose what fits your plans. Open a service to compare its barbers, prices and appointment lengths before booking.',
      serviceLink: 'Compare barbers and book',
      servicesEmpty: 'Services are temporarily unavailable here. Open the full services page to try again.',
      teamLabel: 'Meet the team',
      teamTitle: 'Soul Cuts barbers',
      teamIntro: 'See each barber’s available services and choose who you would like to book with.',
      masterLink: 'View profile',
      mastersCta: 'Meet the full team',
      mastersEmpty: 'Barber profiles are temporarily unavailable here. Open the team page to try again.',
      journalLabel: 'Soulcuts Journal',
      journalIntro: 'Read the Soul Cuts story about a barbering community gathering at the Odesa Museum of Western and Eastern Art.',
      faqLabel: 'FAQ',
      faqTitle: 'Practical details before your visit',
      faqDescription: 'The address, opening hours and ways to make an appointment.',
      faq: [
        {
          question: 'Where is Soul Cuts in Odesa?',
          answer: `Soul Cuts is located at ${contactAddress.value}.`,
        },
        {
          question: 'What are the opening hours?',
          answer: hoursSummary.value,
        },
        {
          question: 'How can I book an appointment?',
          answer: 'Use the online booking section to choose a service, barber, date and available time, or open Soulcuts Bot in Telegram.',
        },
      ],
    }
  : {
      title: 'Soul Cuts — барбершоп в Одесі',
      description: `Soul Cuts в Одесі за адресою ${contactAddress.value}. Порівняйте стрижки, послуги для бороди й барберів, перевірте графік та оберіть час онлайн.`,
      eyebrow: 'Soul Cuts / Одеса',
      heading: 'Soul Cuts — барбершоп в Одесі',
      intro: 'Плануєте стрижку, догляд за бородою чи гоління? Порівняйте послуги та барберів, дізнайтеся вартість і тривалість, а потім оберіть зручний час.',
      bookingCta: 'Записатися онлайн',
      servicesCta: 'Усі послуги',
      locationLabel: 'Візит до Soul Cuts',
      locationTitle: 'Адреса, графік і контакти',
      locationIntro: 'Скористайтеся посиланням на карту для маршруту й перевірте графік нижче перед виходом. Якщо маєте питання щодо візиту, зателефонуйте до студії.',
      bookingTitle: 'Оберіть свій візит',
      bookingIntro: 'Оберіть потрібну послугу, барбера, дату й доступний час. Керувати записом також можна через Soulcuts Bot у Telegram.',
      contactsCta: 'Відкрити контакти',
      servicesLabel: 'Оберіть послугу',
      servicesTitle: 'Стрижки, борода та гоління',
      servicesIntro: 'Опис допоможе обрати послугу під ваш запит. На її сторінці можна порівняти барберів, вартість і тривалість перед записом.',
      serviceLink: 'Порівняти барберів і записатися',
      servicesEmpty: 'Послуги тимчасово недоступні тут. Відкрийте сторінку всіх послуг, щоб спробувати ще раз.',
      teamLabel: 'Знайомство з командою',
      teamTitle: 'Барбери Soul Cuts',
      teamIntro: 'Перегляньте доступні послуги кожного барбера й оберіть, до кого хочете записатися.',
      masterLink: 'Переглянути профіль',
      mastersCta: 'Уся команда',
      mastersEmpty: 'Профілі барберів тимчасово недоступні тут. Відкрийте сторінку команди, щоб спробувати ще раз.',
      journalLabel: 'Soulcuts Journal',
      journalIntro: 'Читайте історію Soul Cuts про зустріч барберської спільноти в Одеському музеї західного та східного мистецтва.',
      faqLabel: 'FAQ',
      faqTitle: 'Практичні деталі перед візитом',
      faqDescription: 'Адреса, графік роботи й способи записатися.',
      faq: [
        {
          question: 'Де знаходиться Soul Cuts в Одесі?',
          answer: `Soul Cuts знаходиться за адресою ${contactAddress.value}.`,
        },
        {
          question: 'Який графік роботи Soul Cuts?',
          answer: hoursSummary.value,
        },
        {
          question: 'Як записатися до Soul Cuts?',
          answer: 'Скористайтеся блоком онлайн-запису, щоб обрати послугу, барбера, дату й доступний час, або відкрийте Soulcuts Bot у Telegram.',
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
    <section data-header-theme="light" class="section-y pt-24 sm:pt-28 md:pt-32">
      <div class="site-container">
        <div class="max-w-4xl space-y-5" data-reveal="soft">
          <p class="type-eyebrow type-eyebrow--wide text-xs text-amber-700">
            {{ page.eyebrow }}
          </p>
          <h1 class="text-4xl font-semibold leading-tight text-stone-950 md:text-6xl">
            {{ page.heading }}
          </h1>
          <p class="max-w-3xl text-sm leading-6 text-stone-700 md:text-lg md:leading-8">
            {{ page.intro }}
          </p>
          <div class="flex flex-col gap-3 sm:flex-row">
            <BaseButton to="/#booking">{{ page.bookingCta }}</BaseButton>
            <BaseButton to="/services" variant="light">
              {{ page.servicesCta }}
            </BaseButton>
          </div>
        </div>
      </div>
    </section>

    <section data-header-theme="light" class="section-y-tight bg-white">
      <div class="site-container grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div data-reveal="soft">
          <SectionLabel>{{ page.locationLabel }}</SectionLabel>
          <h2 class="section-title mt-4 md:text-4xl">{{ page.locationTitle }}</h2>
          <p class="mt-5 max-w-xl text-sm leading-6 text-neutral-600 md:text-base md:leading-8">
            {{ page.locationIntro }}
          </p>

          <dl class="mt-8 space-y-5 text-sm leading-7 text-neutral-700">
            <div>
              <dt class="type-eyebrow text-xs text-neutral-500">{{ terms.pages.contacts.addressLabel }}</dt>
              <dd class="mt-1">
                <a
                  :href="terms.home.contact.mapUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-semibold text-neutral-950"
                >
                  <BaseHoverUnderlineText>{{ terms.home.contact.address }}</BaseHoverUnderlineText>
                </a>
              </dd>
            </div>
            <div>
              <dt class="type-eyebrow text-xs text-neutral-500">{{ terms.pages.contacts.phoneLabel }}</dt>
              <dd class="mt-1">
                <a :href="phoneHref" class="font-semibold text-neutral-950">
                  <BaseHoverUnderlineText>{{ terms.home.contact.phone }}</BaseHoverUnderlineText>
                </a>
              </dd>
            </div>
            <div>
              <dt class="type-eyebrow text-xs text-neutral-500">{{ terms.pages.contacts.hoursLabel }}</dt>
              <dd class="mt-2">
                <div
                  v-for="[day, time] in terms.home.contact.hours"
                  :key="day"
                  class="flex max-w-sm justify-between gap-6 border-b border-neutral-200 py-2 first:pt-0"
                >
                  <span>{{ day }}</span>
                  <span class="font-semibold text-neutral-950">{{ time }}</span>
                </div>
              </dd>
            </div>
          </dl>
        </div>

        <div class="space-y-5" data-reveal="soft" data-reveal-delay="120">
          <div>
            <SectionLabel>{{ terms.common.book }}</SectionLabel>
            <h2 class="mt-4 text-3xl font-semibold text-neutral-950">{{ page.bookingTitle }}</h2>
            <p class="mt-4 max-w-2xl text-sm leading-6 text-neutral-600 md:text-base md:leading-8">
              {{ page.bookingIntro }}
            </p>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <article class="bg-stone-100 p-5">
              <h3 class="text-xl font-semibold text-neutral-950">{{ terms.common.bookAppointment }}</h3>
              <p class="mt-3 text-sm leading-7 text-neutral-600">
                {{ terms.home.booking.selectServiceAndMaster }}
              </p>
              <BaseButton class="mt-5" to="/#booking">{{ page.bookingCta }}</BaseButton>
            </article>

            <article class="bg-neutral-950 p-5 text-white">
              <p class="type-eyebrow text-xs text-white/55">{{ terms.home.bot.badge }}</p>
              <h3 class="mt-2 text-xl font-semibold">{{ terms.home.bot.title }}</h3>
              <p class="mt-3 text-sm leading-7 text-white/68">
                {{ terms.home.bot.description }}
              </p>
              <BaseButton
                class="mt-5"
                href="https://t.me/SoulcutsBot"
                target="_blank"
                rel="noopener noreferrer"
                variant="light"
              >
                {{ terms.home.bot.cta }}
              </BaseButton>
            </article>
          </div>

          <BaseButton to="/contacts" variant="light">{{ page.contactsCta }}</BaseButton>
        </div>
      </div>
    </section>

    <section data-header-theme="light" class="section-y bg-stone-100">
      <div class="site-container">
        <div class="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div class="max-w-3xl" data-reveal="soft">
            <SectionLabel>{{ page.servicesLabel }}</SectionLabel>
            <h2 class="section-title mt-4 md:text-4xl">{{ page.servicesTitle }}</h2>
            <p class="mt-5 text-sm leading-6 text-neutral-600 md:text-base md:leading-8">
              {{ page.servicesIntro }}
            </p>
          </div>
          <BaseButton to="/services" variant="light">{{ page.servicesCta }}</BaseButton>
        </div>

        <div v-if="serviceCards.length" class="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article
            v-for="(service, index) in serviceCards"
            :key="service.id"
            class="flex h-full flex-col bg-white p-5"
            data-reveal="soft"
            :data-reveal-delay="Math.min(index, 5) * 60"
          >
            <NuxtLink :to="service.path" class="group">
              <h3 class="text-xl font-semibold text-neutral-950 transition group-hover:text-neutral-600">
                {{ service.name }}
              </h3>
            </NuxtLink>
            <p class="mt-3 flex-1 text-sm leading-7 text-neutral-600">
              {{ service.description }}
            </p>
            <p class="mt-5 flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold text-neutral-950">
              <span v-if="service.price">{{ service.price }}</span>
              <span v-if="service.price && service.duration" aria-hidden="true">/</span>
              <span v-if="service.duration">{{ service.duration }}</span>
            </p>
            <NuxtLink
              :to="service.path"
              class="type-eyebrow mt-5 w-fit text-xs text-neutral-700 transition hover:text-neutral-950"
            >
              <BaseHoverUnderlineText>{{ page.serviceLink }}</BaseHoverUnderlineText>
            </NuxtLink>
          </article>
        </div>

        <p v-else class="mt-10 max-w-2xl bg-white p-5 text-sm leading-7 text-neutral-600">
          {{ page.servicesEmpty }}
          <NuxtLink to="/services" class="font-semibold text-neutral-950">
            <BaseHoverUnderlineText>{{ page.servicesCta }}</BaseHoverUnderlineText>
          </NuxtLink>
        </p>
      </div>
    </section>

    <section data-header-theme="dark" class="section-y bg-neutral-950 text-white">
      <div class="site-container">
        <div class="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div class="max-w-3xl" data-reveal="soft">
            <SectionLabel class="text-white/65">{{ page.teamLabel }}</SectionLabel>
            <h2 class="section-title-inverse mt-4 md:text-4xl">{{ page.teamTitle }}</h2>
            <p class="mt-5 text-sm leading-6 text-white/65 md:text-base md:leading-8">
              {{ page.teamIntro }}
            </p>
          </div>
          <BaseButton to="/masters" variant="light">{{ page.mastersCta }}</BaseButton>
        </div>

        <div v-if="masterCards.length" class="mt-10 grid gap-5 md:grid-cols-2">
          <article
            v-for="(master, index) in masterCards"
            :key="master.id"
            class="grid gap-5 border border-white/15 p-5 sm:grid-cols-[8rem_1fr]"
            data-reveal="soft"
            :data-reveal-delay="Math.min(index, 3) * 80"
          >
            <NuxtLink :to="master.path" class="block overflow-hidden bg-white/5">
              <img
                :src="master.image"
                :alt="master.name"
                width="320"
                height="320"
                class="aspect-square h-full w-full object-cover object-top transition duration-500 hover:scale-[1.025]"
                loading="lazy"
              >
            </NuxtLink>
            <div class="min-w-0">
              <p v-if="master.role" class="type-eyebrow text-xs text-white/45">{{ master.role }}</p>
              <NuxtLink :to="master.path" class="group">
                <h3 class="mt-2 text-2xl font-semibold text-white transition group-hover:text-white/65">
                  {{ master.name }}
                </h3>
              </NuxtLink>
              <ul v-if="master.services.length" class="mt-4 flex flex-wrap gap-2">
                <li
                  v-for="service in master.services"
                  :key="service"
                  class="border border-white/15 px-2 py-1 text-xs leading-5 text-white/60"
                >
                  {{ service }}
                </li>
              </ul>
              <NuxtLink
                :to="master.path"
                class="type-eyebrow mt-5 inline-flex text-xs text-white/75 transition hover:text-white"
              >
                <BaseHoverUnderlineText>{{ page.masterLink }}</BaseHoverUnderlineText>
              </NuxtLink>
            </div>
          </article>
        </div>

        <p v-else class="mt-10 max-w-2xl border border-white/15 p-5 text-sm leading-7 text-white/65">
          {{ page.mastersEmpty }}
          <NuxtLink to="/masters" class="font-semibold text-white">
            <BaseHoverUnderlineText>{{ page.mastersCta }}</BaseHoverUnderlineText>
          </NuxtLink>
        </p>
      </div>
    </section>

    <section data-header-theme="light" class="section-y-tight bg-white">
      <div class="site-container">
        <article class="grid gap-8 bg-stone-100 p-6 md:grid-cols-[0.42fr_0.58fr] md:items-end md:p-10" data-reveal="soft">
          <div>
            <SectionLabel>{{ page.journalLabel }}</SectionLabel>
            <h2 class="mt-4 text-3xl font-semibold leading-tight text-neutral-950 md:text-4xl">
              {{ terms.home.blog.featured.title }}
            </h2>
          </div>
          <div>
            <p class="text-sm leading-6 text-neutral-600 md:text-base md:leading-8">
              {{ page.journalIntro }}
            </p>
            <p class="mt-3 text-sm leading-7 text-neutral-500">
              {{ terms.home.blog.featured.excerpt }}
            </p>
            <BaseButton
              class="mt-6"
              href="/blog/posts/barbering-in-the-museum"
              variant="light"
            >
              {{ terms.home.blog.secondaryCta }}
            </BaseButton>
          </div>
        </article>
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
