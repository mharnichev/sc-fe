export type LocaleCode = 'uk' | 'en'

export interface BlogTerms {
  subscribe: string
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
}

export const localeOptions: Array<{ code: LocaleCode, label: string, shortLabel: string }> = [
  { code: 'uk', label: '🇺🇦 Укр', shortLabel: 'UA' },
  { code: 'en', label: '🇬🇧 Eng', shortLabel: 'EN' },
]

export const blogTerms = {
  uk: {
    subscribe: 'Підписка',
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
    footerHeadline: 'Незалежні нотатки від команди Soul Cuts.',
    footerDescription: 'Публічний журнал про барберинг, комʼюніті, міські події та історії навколо студії.',
    footerBrandDescription: 'Читайте репортажі, інтервʼю, гіди та нотатки від команди Soul Cuts.',
    footerExplore: 'Навігація',
    footerVisit: 'Контакти',
    footerLocation: 'Одеса, Україна',
    footerCopyrightPrefix: 'Авторські права',
    footerTagline: 'Незалежні нотатки від команди Soul Cuts.',
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
  },
  en: {
    subscribe: 'Subscribe',
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
    footerHeadline: 'Independent notes from the Soul Cuts team.',
    footerDescription: 'A public journal for barbering, community, city notes, and the stories around the studio.',
    footerBrandDescription: 'Browse reports, interviews, guides, and field notes from the Soul Cuts team.',
    footerExplore: 'Explore',
    footerVisit: 'Visit',
    footerLocation: 'Odesa, Ukraine',
    footerCopyrightPrefix: 'Copyright',
    footerTagline: 'Independent notes from the Soul Cuts team.',
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
  },
} satisfies Record<LocaleCode, BlogTerms>
