export type LocaleCode = 'uk' | 'en'

export interface BlogMenuLink {
  label: string
  href: string
  external?: boolean
  action?: 'subscribe'
}

export interface BlogAboutTerms {
  seoTitle: string
  seoDescription: string
  eyebrow: string
  title: string
  lede: string
  groupImageAlt: string
  identityEyebrow: string
  identityTitle: string
  identityParagraphs: string[]
  pillars: Array<{
    number: string
    title: string
    text: string
  }>
  cultureEyebrow: string
  cultureTitle: string
  cultureParagraphs: string[]
  cultureImageAlt: string
  cultureSecondaryImageAlt: string
  cultureQuote: string
  journalEyebrow: string
  journalTitle: string
  journalDescription: string
  journalPoints: string[]
  ctaEyebrow: string
  ctaTitle: string
  ctaDescription: string
  storiesCta: string
  bookingCta: string
}

export interface BlogContactTerms {
  seoTitle: string
  seoDescription: string
  eyebrow: string
  title: string
  description: string
  detailsTitle: string
  addressLabel: string
  address: string
  phoneLabel: string
  phone: string
  emailLabel: string
  email: string
  hoursLabel: string
  hours: Array<[string, string]>
  mapLabel: string
  formEyebrow: string
  formTitle: string
  formDescription: string
  fields: {
    name: string
    phone: string
    email: string
    message: string
  }
  placeholders: {
    name: string
    phone: string
    email: string
    message: string
  }
  note: string
  submit: string
  sending: string
  requiredMessage: string
  phoneInvalid: string
  successMessage: string
  errorMessage: string
}

export interface BlogTerms {
  subscribe: string
  menu: string
  close: string
  homeTitle: string
  homeDescription: string
  featuredPost: string
  latest: string
  newStories: string
  viewAllPosts: string
  readFeature: string
  readArticle: string
  archive: string
  allPosts: string
  postsDescription: string
  recommended: string
  home: string
  barbershopHome: string
  bookAppointment: string
  bookOnline: string
  postMenuBookingCta: string
  postMenuSubscribeText: string
  newsletter: string
  emailAddress: string
  emailPlaceholder: string
  enterValidEmail: string
  subscriptionSuccess: string
  subscriptionError: string
  subscribeModalTitle: string
  closeSubscribeModal: string
  noThanks: string
  noThanksCloseSubscribeModal: string
  subscribeAgreementPrefix: string
  subscribeAgreementTerms: string
  subscribeAgreementMiddle: string
  subscribeAgreementCollectionNotice: string
  subscribeAgreementAnd: string
  subscribeAgreementPrivacy: string
  footerEyebrow: string
  footerHeadline: string
  footerDescription: string
  footerBrandDescription: string
  footerExplore: string
  footerVisit: string
  footerLocation: string
  footerCopyrightPrefix: string
  footerTagline: string
  menuOpen: string
  postMenu: string
  soulCutsHome: string
  soulCutsLogoAlt: string
  shareStory: string
  shareTo: string
  shareEmail: string
  shareEmailBody: string
  copyLink: string
  copiedLink: string
  postBookingCtaTitle: string
  postBookingCtaText: string
  photoGallery: string
  previousPhoto: string
  nextPhoto: string
  unsubscribeTitle: string
  unsubscribeDescription: string
  unsubscribeButton: string
  unsubscribeSuccess: string
  unsubscribeError: string
  unsubscribeMissingIdentifier: string
  newsletterHeadline: string
  newsletterDescription: string
  about: BlogAboutTerms
  contacts: BlogContactTerms
  links: BlogMenuLink[]
}

export const localeOptions: Array<{ code: LocaleCode, label: string, shortLabel: string }> = [
  { code: 'uk', label: '🇺🇦 Укр', shortLabel: 'UA' },
  { code: 'en', label: '🇬🇧 Eng', shortLabel: 'EN' },
]

export const blogTerms = {
  uk: {
    subscribe: 'Підписка',
    menu: 'Меню',
    close: 'Закрити',
    homeTitle: 'Головна',
    homeDescription: 'Soulcuts Journal - публічний блог про барберинг, комʼюніті та культуру навколо Soul Cuts.',
    featuredPost: 'Головний матеріал',
    latest: 'Останнє',
    newStories: 'Нові матеріали',
    viewAllPosts: 'Усі пости',
    readFeature: 'Читати',
    readArticle: 'Читати статтю',
    archive: 'Архів',
    allPosts: 'Усі пости',
    postsDescription: 'Читайте реальні матеріали Soul Cuts про барберинг, комʼюніті та події навколо нашої культури.',
    recommended: 'Recommended',
    home: 'Головна',
    barbershopHome: 'До Барбершопу',
    bookAppointment: 'Записатися',
    bookOnline: 'Записатися онлайн',
    postMenuBookingCta: 'ЗАРІС? ЗАПИСАТИСЯ ДО МАЙСТРА',
    postMenuSubscribeText: 'Хочеш такі історії без пошуку? Кидаємо найцікавіше на пошту.',
    newsletter: 'Розсилка',
    emailAddress: 'Email адреса',
    emailPlaceholder: 'you@example.com',
    enterValidEmail: 'Введіть коректну email адресу.',
    subscriptionSuccess: 'Дякуємо. Ви підписані на оновлення Soulcuts Journal.',
    subscriptionError: 'Не вдалося оформити підписку. Спробуйте ще раз.',
    subscribeModalTitle: 'Підписка',
    closeSubscribeModal: 'Закрити модальне вікно підписки',
    noThanks: 'Ні, дякую',
    noThanksCloseSubscribeModal: 'Ні, дякую, закрити модальне вікно підписки',
    subscribeAgreementPrefix: 'Підписуючись, ви погоджуєтесь з',
    subscribeAgreementTerms: 'Умовами використання Substack',
    subscribeAgreementMiddle: 'і підтверджуєте',
    subscribeAgreementCollectionNotice: 'Повідомлення про збір інформації',
    subscribeAgreementAnd: 'та',
    subscribeAgreementPrivacy: 'Політику конфіденційності',
    footerEyebrow: 'Soulcuts Journal',
    footerHeadline: 'Незалежні нотатки від команди Soul Cuts',
    footerDescription: 'Публічний журнал про барберинг, комʼюніті, міські події та історії навколо студії.',
    footerBrandDescription: 'Читайте репортажі, інтервʼю, гіди та нотатки від команди Soul Cuts.',
    footerExplore: 'Навігація',
    footerVisit: 'Контакти',
    footerLocation: 'Одеса, Україна',
    footerCopyrightPrefix: 'Авторські права',
    footerTagline: 'Незалежні нотатки від команди Soul Cuts',
    menuOpen: 'Відкрити меню поста',
    postMenu: 'Меню поста',
    soulCutsHome: 'Soul Cuts головна',
    soulCutsLogoAlt: 'Soul Cuts',
    shareStory: 'Поділитися матеріалом',
    shareTo: 'Поділитися в',
    shareEmail: 'Email',
    shareEmailBody: 'Посилання на статтю:',
    copyLink: 'Посилання',
    copiedLink: 'Скопійовано',
    postBookingCtaTitle: 'Сподобався матеріал?',
    postBookingCtaText: 'Залітайте до нас у крісло: підберемо стрижку, бороду або гоління під ваш ритм, волосся і настрій.',
    photoGallery: 'Фотогалерея',
    previousPhoto: 'Попереднє фото',
    nextPhoto: 'Наступне фото',
    unsubscribeTitle: 'Відписатися від розсилки',
    unsubscribeDescription: 'Підтвердіть відписку від оновлень Soulcuts Journal.',
    unsubscribeButton: 'Відписатися',
    unsubscribeSuccess: 'Ви відписані від розсилки.',
    unsubscribeError: 'Не вдалося відписатися. Перевірте посилання або спробуйте ще раз.',
    unsubscribeMissingIdentifier: 'Потрібен token із листа або email адреса.',
    newsletterHeadline: 'Отримуйте наступну історію на пошту.',
    newsletterDescription: 'Проста форма підписки для першої версії. Інтеграцію з провайдером можна додати пізніше.',
    about: {
      seoTitle: 'Про нас',
      seoDescription: 'Soul Cuts — барбершоп в Одесі, незалежний журнал і спільнота навколо сучасної української барберської культури.',
      eyebrow: 'Про нас',
      title: 'Ми стрижемо. Знімаємо. Збираємо людей.',
      lede: 'Soul Cuts — барбершоп на Канатній, 6 в Одесі. Але крісло для нас — лише початок розмови про ремесло, стиль, місто й людей, які рухають українську барберську культуру вперед.',
      groupImageAlt: 'Учасники зустрічі української барберської спільноти в Одесі',
      identityEyebrow: 'Soul Cuts — це',
      identityTitle: 'Місце, де ремесло стає приводом бути разом.',
      identityParagraphs: [
        'Щодня ми працюємо з формою, деталлю та характером: стрижемо, оформлюємо бороди, робимо fade і класичне гоління. Для нас хороший результат не маскує людину, а точніше проявляє її.',
        'Поза студією ми продовжуємо ту саму роботу іншими засобами — знайомимо майстрів, документуємо події, обмінюємося досвідом і створюємо простір для чесної професійної розмови.',
      ],
      pillars: [
        {
          number: '01',
          title: 'Ремесло',
          text: 'Точна робота руками, увага до деталей і сервіс, до якого хочеться повертатися.',
        },
        {
          number: '02',
          title: 'Спільнота',
          text: 'Зустрічі, майстер-класи та «Ідем на Букви» - середовище, де барбери навчаються один від одного.',
        },
        {
          number: '03',
          title: 'Журнал',
          text: 'Репортажі, інтервʼю та нотатки про людей і події, які формують культуру навколо нас.',
        },
      ],
      cultureEyebrow: 'Своя сцена',
      cultureTitle: 'Барберинг стає культурою, коли ним діляться.',
      cultureParagraphs: [
        'Ми бачимо простір Soul Cuts частиною українського комʼюніті «Ідем на Букви» - професійну спільноту й медійний проєкт, у якому майстри можуть говорити своїм голосом, показувати процес свого росту та передавати досвід далі.',
        'Нас цікавлять не лише техніка майстра та тренди. Нас цікавлять в першу чергу люди: їхній шлях, сумніви, знахідки та власний погляд на професію.',
      ],
      cultureImageAlt: 'Учасники професійної барберської події під час нагородження',
      cultureSecondaryImageAlt: 'Гості барберської події підписують памʼятні матеріали',
      cultureQuote: 'Нам важливо не лише, як виглядає стрижка, а й що відбувається навколо крісла.',
      journalEyebrow: 'Soulcuts Journal',
      journalTitle: 'Цей журнал — наш відкритий архів.',
      journalDescription: 'Тут ми збираємо те, що не вміщується у короткий допис: живі розмови, репортажі з подій, спостереження за змінами в індустрії та історії людей. Пишемо українською та англійською, щоб локальний досвід був видимим ширше.',
      journalPoints: [
        'Документуємо українську барбер спільноту',
        'Показуємо роботу без зайвого глянцю.',
        'Залишаємо місце для різних голосів і поглядів.',
      ],
      ctaEyebrow: 'Продовжимо розмову',
      ctaTitle: 'ЧИТАЙТЕ ІСТОРІЇ. АБО ЗАХОДЬТЕ НА СТРИЖКУ ДО ПРОСТОРУ.',
      ctaDescription: 'Знайомство із Soul Cuts може початися зі статті, події чи стрижки. Обирайте свій маршрут — далі побачимося.',
      storiesCta: 'Читати матеріали',
      bookingCta: 'Записатися',
    },
    contacts: {
      seoTitle: 'Контакти',
      seoDescription: 'Адреса, телефон, email, графік роботи та форма звʼязку Soul Cuts в Одесі.',
      eyebrow: 'Контакти',
      title: 'Напишіть або завітайте до Soul Cuts.',
      description: 'Усі способи звʼязатися з командою — в одному місці. Для питань, партнерств і будь-яких пропозицій скористайтеся формою нижче.',
      detailsTitle: 'Барбершоп Soul Cuts, Одеса',
      addressLabel: 'Адреса',
      address: 'вулиця Канатна, 6, Одеса',
      phoneLabel: 'Телефон',
      phone: '+380636995730',
      emailLabel: 'Email',
      email: 'Soulcutsplace@gmail.com',
      hoursLabel: 'Графік',
      hours: [
        ['Вт-Нд', '09:00 - 20:00'],
        ['Понеділок', 'Зачинено'],
      ],
      mapLabel: 'Відкрити на мапі',
      formEyebrow: 'Зворотний звʼязок',
      formTitle: 'Є питання або пропозиція?',
      formDescription: 'Залиште повідомлення — воно потрапить до тієї самої команди, незалежно від того, з якого сайту ви пишете.',
      fields: {
        name: 'Імʼя',
        phone: 'Телефон (необовʼязково)',
        email: 'Email',
        message: 'Повідомлення',
      },
      placeholders: {
        name: 'Ваше імʼя',
        phone: '+380',
        email: 'name@example.com',
        message: 'Розкажіть, чим можемо допомогти',
      },
      note: 'Імʼя, email і повідомлення обовʼязкові.',
      submit: 'Надіслати',
      sending: 'Надсилаємо...',
      requiredMessage: 'Заповніть імʼя, email і повідомлення.',
      phoneInvalid: 'Введіть номер у форматі +380 XX XXX XX XX.',
      successMessage: 'Дякуємо. Повідомлення надіслано команді Soul Cuts.',
      errorMessage: 'Не вдалося надіслати повідомлення. Спробуйте ще раз.',
    },
    links: [
      { label: 'На головну', href: '/' },
      { label: 'Усі пости', href: '/posts' },
      { label: 'Барбершоп', href: '/', external: true },
      { label: 'Про нас', href: '/about' },
      { label: 'Контакти', href: '/contacts' },
      { label: 'Підписка', href: '#subscribe', action: 'subscribe' },
    ],
  },
  en: {
    subscribe: 'Subscribe',
    menu: 'Menu',
    close: 'Close',
    homeTitle: 'Home',
    homeDescription: 'Soulcuts Journal is a public blog about barbering, community, and the culture around Soul Cuts.',
    featuredPost: 'Featured Post',
    latest: 'Latest',
    newStories: 'New stories',
    viewAllPosts: 'View all posts',
    readFeature: 'Read feature',
    readArticle: 'Read article',
    archive: 'Archive',
    allPosts: 'All posts',
    postsDescription: 'Read real Soul Cuts stories about barbering, community, and the events around our culture.',
    recommended: 'Recommended',
    home: 'Home',
    barbershopHome: 'To Barbershop',
    bookAppointment: 'Book',
    bookOnline: 'Book online',
    postMenuBookingCta: 'GROWN OUT? BOOK A BARBER',
    postMenuSubscribeText: 'Want these stories without hunting for them? We will drop the good stuff in your inbox.',
    newsletter: 'Newsletter',
    emailAddress: 'Email address',
    emailPlaceholder: 'you@example.com',
    enterValidEmail: 'Enter a valid email address.',
    subscriptionSuccess: 'Thanks. You are subscribed to Soulcuts Journal updates.',
    subscriptionError: 'Unable to subscribe right now. Please try again.',
    subscribeModalTitle: 'Subscribe',
    closeSubscribeModal: 'Close subscribe modal',
    noThanks: 'No thanks',
    noThanksCloseSubscribeModal: 'No thanks, close subscribe modal',
    subscribeAgreementPrefix: 'By subscribing, you agree Substack\'s',
    subscribeAgreementTerms: 'Terms of Use',
    subscribeAgreementMiddle: 'and acknowledge its',
    subscribeAgreementCollectionNotice: 'Information Collection Notice',
    subscribeAgreementAnd: 'and',
    subscribeAgreementPrivacy: 'Privacy Policy',
    footerEyebrow: 'Soulcuts Journal',
    footerHeadline: 'Independent notes from the Soul Cuts team',
    footerDescription: 'A public journal for barbering, community, city notes, and the stories around the studio.',
    footerBrandDescription: 'Browse reports, interviews, guides, and field notes from the Soul Cuts team.',
    footerExplore: 'Explore',
    footerVisit: 'Visit',
    footerLocation: 'Odesa, Ukraine',
    footerCopyrightPrefix: 'Copyright',
    footerTagline: 'Independent notes from the Soul Cuts team',
    menuOpen: 'Open post menu',
    postMenu: 'Post menu',
    soulCutsHome: 'Soul Cuts home',
    soulCutsLogoAlt: 'Soul Cuts',
    shareStory: 'Share this story',
    shareTo: 'Share to',
    shareEmail: 'Email',
    shareEmailBody: 'Here is the link to the article:',
    copyLink: 'Link',
    copiedLink: 'Copied',
    postBookingCtaTitle: 'Enjoyed the story?',
    postBookingCtaText: 'Drop into the chair: we will shape the haircut, beard or shave around your rhythm, hair and mood.',
    photoGallery: 'Photo gallery',
    previousPhoto: 'Previous photo',
    nextPhoto: 'Next photo',
    unsubscribeTitle: 'Unsubscribe from the newsletter',
    unsubscribeDescription: 'Confirm that you want to unsubscribe from Soulcuts Journal updates.',
    unsubscribeButton: 'Unsubscribe',
    unsubscribeSuccess: 'You have been unsubscribed from the newsletter.',
    unsubscribeError: 'Unable to unsubscribe. Check the link or try again.',
    unsubscribeMissingIdentifier: 'A token from the email or an email address is required.',
    newsletterHeadline: 'Get the next story in your inbox.',
    newsletterDescription: 'A simple subscription block for the first version. Provider integration can be added later.',
    about: {
      seoTitle: 'About us',
      seoDescription: 'Soul Cuts is an Odesa barbershop, independent journal, and community built around contemporary Ukrainian barbering culture.',
      eyebrow: 'About us',
      title: 'We cut. We document. We bring people together.',
      lede: 'Soul Cuts is a barbershop at 6 Kanatna Street in Odesa. But the chair is only the beginning of a conversation about craft, style, the city, and the people moving Ukrainian barbering culture forward.',
      groupImageAlt: 'Members of the Ukrainian barbering community gathered in Odesa',
      identityEyebrow: 'Soul Cuts is',
      identityTitle: 'A place where craft becomes a reason to come together.',
      identityParagraphs: [
        'Every day we work with shape, detail, and character: haircuts, beard grooming, fades, and classic shaves. A good result should not disguise a person. It should bring them into sharper focus.',
        'Outside the studio, we continue the same work through other formats — introducing barbers, documenting events, sharing experience, and making room for honest professional conversation.',
      ],
      pillars: [
        {
          number: '01',
          title: 'Craft',
          text: 'Precise hands, close attention to detail, and a service worth returning to.',
        },
        {
          number: '02',
          title: 'Community',
          text: 'Meetups, masterclasses, and Idem na Bukvy - an environment where barbers learn from one another.',
        },
        {
          number: '03',
          title: 'Journal',
          text: 'Reports, interviews, and field notes about the people and events shaping the culture around us.',
        },
      ],
      cultureEyebrow: 'Our own scene',
      cultureTitle: 'Barbering becomes culture when it is shared.',
      cultureParagraphs: [
        'We see the Soul Cuts space as part of the Ukrainian Idem na Bukvy community - a professional community and media project where barbers can speak in their own voices, show their growth process, and pass experience forward.',
        'We are interested not only in a barberʼs technique and trends. First and foremost, we are interested in people: their journey, doubts, discoveries, and their own view of the profession.',
      ],
      cultureImageAlt: 'Participants at a professional barbering event during an award presentation',
      cultureSecondaryImageAlt: 'Guests at a barbering event signing commemorative materials',
      cultureQuote: 'What matters to us is not only how a haircut looks, but also what happens around the chair.',
      journalEyebrow: 'Soulcuts Journal',
      journalTitle: 'This journal is our open archive.',
      journalDescription: 'Here we collect what cannot fit into a short post: living conversations, event reports, observations on changes in the industry, and peopleʼs stories. We publish in Ukrainian and English so local experience can travel further.',
      journalPoints: [
        'Documenting the Ukrainian barber community',
        'Showing the work without unnecessary gloss.',
        'Making room for different voices and perspectives.',
      ],
      ctaEyebrow: 'Continue the conversation',
      ctaTitle: 'READ THE STORIES. OR COME TO THE SPACE FOR A HAIRCUT.',
      ctaDescription: 'Your introduction to Soul Cuts can begin with an article, an event, or a haircut. Choose your route — we will see you there.',
      storiesCta: 'Read the journal',
      bookingCta: 'Book a visit',
    },
    contacts: {
      seoTitle: 'Contact',
      seoDescription: 'Soul Cuts address, phone, email, opening hours, and contact form in Odesa.',
      eyebrow: 'Contact',
      title: 'Write to us or visit Soul Cuts.',
      description: 'Every way to reach the team is collected here. Use the form below for questions, partnerships, or any other proposal.',
      detailsTitle: 'Soul Cuts Barbershop, Odesa',
      addressLabel: 'Address',
      address: '6 Kanatna Street, Odesa',
      phoneLabel: 'Phone',
      phone: '+380636995730',
      emailLabel: 'Email',
      email: 'Soulcutsplace@gmail.com',
      hoursLabel: 'Hours',
      hours: [
        ['Tue-Sun', '09:00 - 20:00'],
        ['Monday', 'Closed'],
      ],
      mapLabel: 'Open in maps',
      formEyebrow: 'Get in touch',
      formTitle: 'Have a question or proposal?',
      formDescription: 'Leave a message and it will reach the same team, no matter which Soul Cuts site you use.',
      fields: {
        name: 'Name',
        phone: 'Phone (optional)',
        email: 'Email',
        message: 'Message',
      },
      placeholders: {
        name: 'Your name',
        phone: '+380',
        email: 'name@example.com',
        message: 'Tell us how we can help',
      },
      note: 'Name, email, and message are required.',
      submit: 'Send message',
      sending: 'Sending...',
      requiredMessage: 'Enter your name, email, and message.',
      phoneInvalid: 'Enter the phone number as +380 XX XXX XX XX.',
      successMessage: 'Thank you. Your message has been sent to the Soul Cuts team.',
      errorMessage: 'Unable to send your message. Please try again.',
    },
    links: [
      { label: 'Home', href: '/' },
      { label: 'All Posts', href: '/posts' },
      { label: 'Barbershop', href: '/', external: true },
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contacts' },
      { label: 'Subscribe', href: '#subscribe', action: 'subscribe' },
    ],
  },
} satisfies Record<LocaleCode, BlogTerms>
