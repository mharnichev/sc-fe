import type { LocaleCode } from './locale'
import coverImage from '../assets/images/posts/barbering-museum-cover-1600.jpg'
import coverImageMobile from '../assets/images/posts/barbering-museum-cover-mobile.jpg'

type LocalizedText = Record<LocaleCode, string>
type AssetModule = { default: string }

const blogPostImageLoaders = {
  audience: () => import('../assets/images/posts/barbering-museum-audience.webp') as Promise<AssetModule>,
  cuttingDetail: () => import('../assets/images/posts/barbering-museum-cutting-detail.webp') as Promise<AssetModule>,
  entrance: () => import('../assets/images/posts/barbering-museum-entrance.webp') as Promise<AssetModule>,
  gallery9053: () => import('../assets/images/posts/barbering-museum-gallery-9053.webp') as Promise<AssetModule>,
  gallery9058: () => import('../assets/images/posts/barbering-museum-gallery-9058.webp') as Promise<AssetModule>,
  gallery9064: () => import('../assets/images/posts/barbering-museum-gallery-9064.webp') as Promise<AssetModule>,
  gallery8920: () => import('../assets/images/posts/barbering-museum-gallery-8920.webp') as Promise<AssetModule>,
  gallery9149: () => import('../assets/images/posts/barbering-museum-gallery-9149.webp') as Promise<AssetModule>,
  gallery9153: () => import('../assets/images/posts/barbering-museum-gallery-9153.webp') as Promise<AssetModule>,
  highFive: () => import('../assets/images/posts/barbering-museum-high-five.webp') as Promise<AssetModule>,
  beforeMasterclassOne: () => import('../assets/images/posts/barbering-museum-before-masterclass-01.webp') as Promise<AssetModule>,
  beforeMasterclassTwo: () => import('../assets/images/posts/barbering-museum-before-masterclass-02.webp') as Promise<AssetModule>,
  masterclass: () => import('../assets/images/posts/barbering-museum-masterclass.webp') as Promise<AssetModule>,
  portrait: () => import('../assets/images/posts/barbering-museum-portrait.webp') as Promise<AssetModule>,
} as const

export type BlogPostImageKey = keyof typeof blogPostImageLoaders

export const loadBlogPostImage = async (key: BlogPostImageKey) => {
  const image = await blogPostImageLoaders[key]()
  return image.default
}

interface BlogGalleryImage {
  imageKey: BlogPostImageKey
  alt: LocalizedText
}

interface BlogArticleImage {
  afterParagraphIndex: number
  imageKey: BlogPostImageKey
  alt: LocalizedText
  caption?: LocalizedText
}

export interface BlogPost {
  slug: string
  title: LocalizedText
  excerpt: LocalizedText
  publishedAt: string
  category: LocalizedText
  author: LocalizedText
  readMinutes: number
  coverImage: string
  coverImageMobile: string
  coverImageAlt: LocalizedText
  featured?: boolean
  articleImages?: BlogArticleImage[]
  galleryImages?: BlogGalleryImage[]
  content: Record<LocaleCode, string[]>
}

export interface LocalizedBlogPost {
  slug: string
  title: string
  excerpt: string
  publishedAt: string
  category: string
  author: string
  readMinutes: number
  coverImage: string
  coverImageMobile: string
  coverImageAlt: string
  featured?: boolean
  articleImages?: Array<{
    afterParagraphIndex: number
    imageKey: BlogPostImageKey
    src?: string
    alt: string
    caption?: string
  }>
  galleryImages?: Array<{
    imageKey: BlogPostImageKey
    src?: string
    alt: string
  }>
  content: string[]
}

const eventContentUk = [
  'Привіт, народ! Оскільки ми вирішили вести свій блог і ділитися тим, як проходять наші двіжухи, ловіть перший репортаж.',
  'Хто стежить за нашим ютуб-каналом «Ідем на Букви», знає: ми топимо за те, щоб український барберінг розвивався, а майстри спілкувалися між собою без конкуренції та заздрощів. Ми всі робимо одну справу. І от нещодавно ми вирішили зібрати нашу закриту тусовку в дуже незвичному місці - в Одеському художньому музеї східного та західного мистецтва в центрі міста.',
  'Цього разу з майстеркласом до Одеси 16 березня 2026 року приїхав досить відомий майстер у наших колах - Володимир Мєдвєдєв (@hairkillah_), представник бренду та барбершопу Maza в Києві.',
  'Приїхали, зайшли в музей. Навколо ліпнина, картини, старовинні зали. Хтось міг би подумати: «Ого, ну й нагнали пафосу». Але для нас це був цікавий досвід - змішати нашу вуличну барбер-культуру з класичною історією. Коли увімкнули атмосферне світло, виглядало це максимально затишно й по-своєму.',
  'Організувати технічно складний перформанс у діючому музеї - це виклик. Потрібно зберегти автентичність локації й водночас розгорнути технологічну сцену. Коли монтаж завершився, стало зрозуміло: класичний бекграунд музею лише підкреслив футуристичність і чистоту ліній сучасної стрижки.',
  'Майстер Володимир створював форми, які диктують тренди українського ринку. Це не було демонстрацією «шаблонних стрижок». Це був детальний розбір архітектури волосся, анатомічних особливостей моделей та психології сприйняття образу.',
  'Навіщо ми це робимо? Для майстрів: ми робимо ці івенти, щоб усі могли видихнути від щоденної рутини у своєму робочому просторі. Прийти, обійнятися, потеревенити про спільні болі - страх батлів, вигорання, професійні сумніви - дізнатися щось нове й зарядитися енергією.',
  'Тут немає «зірок» - ми всі на одному рівні, просто ділимося досвідом. Хочемо відмітити, що відвідування подібних заходів - це не завжди про отримання конкретного скіллу в моменті. Це можливість надихнутися, подивитися на свою професію з іншого ракурсу, познайомитися з представниками комʼюніті для подальшої співпраці, обмінятися досвідом користування інструментами й підібрати для себе максимально зручний комплект.',
  'Для наших клієнтів: нам приємно, коли ви бачите, що барбери з Soul Cuts не просто механічно махають машинкою. Ми живемо цією справою, постійно варимося в цій тусовці й розвиваємося. Тому, коли ви приходите до нас на стрижку, ви можете бути впевнені: вам зроблять круто, бо ми приділяємо увагу кожній деталі.',
  '«Плівкові фото сильно полюбились мені. Ваші емоції на кадрах так яскраво виражені. Вважаю це цінним в рамках нашої індустрії і культурного відображення діяльності всередині барберінгу» - Гліб Аноцький, засновник проєкту про барберів «Ідем на Букви», майстер та власник барбершопу Soul Cuts в Одесі.',
  'Головна думка, яку ми завжди повторюємо на «Ідем на Букви»: талант - це круто, але якщо ти не пашеш кожен день у кріслі й не поважаєш свою роботу, нічого не буде.',
  'Ось так пройшов наш перший івент у блозі. Попереду ще багато міст і нових зустрічей. Підписуйтесь на наш ютуб «Ідем на Букви», приходьте на стрижки в барбершоп Soul Cuts і давайте рухати цю культуру разом. Без пафосу, суто на повазі.',
  'До зустрічі в кріслі або на наступній тусовці!',
]

const eventContentEn = [
  'Hey everyone. Since we decided to start our own blog and share how our events actually happen, here is the first report.',
  'If you follow our YouTube channel Idem na Bukvy, you already know what we stand for: Ukrainian barbering should grow, and barbers should talk to each other without competition, jealousy, or ego. We are all doing the same work. Recently, we decided to bring our closed community together in a very unusual place: the Odesa Museum of Western and Eastern Art in the city center.',
  'This time, on March 16, 2026, Volodymyr Medvediev (@hairkillah_) came to Odesa with a masterclass. He is a well-known barber in our circle and represents the Maza brand and barbershop in Kyiv.',
  'We arrived and walked into the museum. Stucco, paintings, old halls everywhere. Someone could have thought, “Wow, they really went for the fancy setup.” For us, it was an interesting experiment: mixing our street-level barber culture with classical history. When the atmospheric lighting came on, the space felt warm, intimate, and completely its own.',
  'Organizing a technically complex performance inside an active museum is a challenge. You have to preserve the authenticity of the location while building a modern technical stage inside it. Once the setup was finished, it became clear: the classical museum background only emphasized the futuristic precision and clean lines of modern haircutting.',
  'Volodymyr created shapes that influence the direction of the Ukrainian market. This was not a demonstration of “template haircuts.” It was a detailed breakdown of hair architecture, the anatomical specifics of the models, and the psychology of how an image is perceived.',
  'Why do we do this? For barbers: we create these events so all of us can exhale after the daily routine of our own workspaces. To come together, hug, talk through shared struggles - fear of battles, burnout, professional doubts - learn something new, and recharge.',
  'There are no “stars” here. We are all on the same level, simply sharing experience. We also want to point out that attending events like this is not always about getting one specific skill right away. It is a chance to get inspired, to look at your profession from another angle, to meet people from the community for future collaborations, to exchange real experience with tools, and to find the setup that works best for you.',
  'For our clients: we are happy when you see that Soul Cuts barbers are not just mechanically moving a clipper. We live this craft, stay inside the community, and keep developing. So when you come to us for a haircut, you can be sure we will do it properly, because every detail matters to us.',
  '“I have really fallen in love with film photos. Your emotions in these frames are so vivid. I consider this valuable for our industry and for the cultural reflection of what happens inside barbering,” says Hlib Anotskyi, founder of the barber project Idem na Bukvy, barber, and owner of Soul Cuts barbershop in Odesa.',
  'The main idea we always repeat on Idem na Bukvy is simple: talent is great, but if you do not work hard every day behind the chair and respect your craft, nothing will happen.',
  'That is how our first event report in the blog went. Ahead of us are many more cities and new meetings. Subscribe to our YouTube channel Idem na Bukvy, come get a haircut at Soul Cuts, and let’s move this culture forward together. No ego, just respect.',
  'See you in the chair or at the next gathering.',
]

export const posts: BlogPost[] = [
  {
    slug: 'barbering-in-the-museum',
    title: {
      uk: 'Барберінг у музеї: перший репортаж Soul Cuts',
      en: 'Barbering in a Museum: The First Soul Cuts Report',
    },
    excerpt: {
      uk: 'Як ми зібрали барберське комʼюніті в Одеському музеї західного та східного мистецтва і навіщо нам такі зустрічі.',
      en: 'How we brought the barbering community into the Odesa Museum of Western and Eastern Art, and why these gatherings matter.',
    },
    publishedAt: '2026-03-16',
    category: {
      uk: 'Комʼюніті',
      en: 'Community',
    },
    author: {
      uk: 'Soul Cuts',
      en: 'Soul Cuts',
    },
    readMinutes: 7,
    coverImage,
    coverImageMobile,
    coverImageAlt: {
      uk: 'Учасники барберської події Soul Cuts в музеї',
      en: 'Soul Cuts barbering event participants in the museum',
    },
    featured: true,
    articleImages: [
      {
        afterParagraphIndex: 1,
        imageKey: 'entrance',
        alt: {
          uk: 'Учасники барберської події збираються біля входу до музею',
          en: 'Participants of the barbering event gather near the museum entrance',
        },
      },
      {
        afterParagraphIndex: 3,
        imageKey: 'beforeMasterclassOne',
        alt: {
          uk: 'Учасник барберської події в музейній залі перед майстеркласом',
          en: 'A participant of the barbering event inside the museum hall before the masterclass',
        },
      },
      {
        afterParagraphIndex: 3,
        imageKey: 'beforeMasterclassTwo',
        alt: {
          uk: 'Гості барберської події спілкуються в музейній залі перед майстеркласом',
          en: 'Guests of the barbering event talk inside the museum hall before the masterclass',
        },
      },
      {
        afterParagraphIndex: 3,
        imageKey: 'masterclass',
        alt: {
          uk: 'Володимир Мєдвєдєв показує техніку стрижки під час майстеркласу',
          en: 'Volodymyr Medvediev demonstrates a haircut technique during the masterclass',
        },
      },
      {
        afterParagraphIndex: 4,
        imageKey: 'audience',
        alt: {
          uk: 'Майстерклас проходить у музейній залі серед учасників комʼюніті',
          en: 'The masterclass takes place in the museum hall among community members',
        },
      },
      {
        afterParagraphIndex: 6,
        imageKey: 'cuttingDetail',
        alt: {
          uk: 'Деталь роботи Володимира Мєдвєдєва з ножицями під час показу',
          en: 'A close view of Volodymyr Medvediev working with scissors during the demonstration',
        },
      },
    ],
    galleryImages: [
      {
        imageKey: 'entrance',
        alt: {
          uk: 'Учасники барберської події збираються біля входу до музею',
          en: 'Participants of the barbering event gather near the museum entrance',
        },
      },
      {
        imageKey: 'beforeMasterclassOne',
        alt: {
          uk: 'Учасник барберської події в музейній залі перед майстеркласом',
          en: 'A participant of the barbering event inside the museum hall before the masterclass',
        },
      },
      {
        imageKey: 'beforeMasterclassTwo',
        alt: {
          uk: 'Гості барберської події спілкуються в музейній залі перед майстеркласом',
          en: 'Guests of the barbering event talk inside the museum hall before the masterclass',
        },
      },
      {
        imageKey: 'masterclass',
        alt: {
          uk: 'Володимир Мєдвєдєв показує техніку стрижки під час майстеркласу',
          en: 'Volodymyr Medvediev demonstrates a haircut technique during the masterclass',
        },
      },
      {
        imageKey: 'audience',
        alt: {
          uk: 'Майстерклас у музейній залі серед учасників комʼюніті',
          en: 'The masterclass inside the museum hall among community members',
        },
      },
      {
        imageKey: 'cuttingDetail',
        alt: {
          uk: 'Деталь роботи Володимира Мєдвєдєва з ножицями під час показу',
          en: 'A close view of Volodymyr Medvediev working with scissors during the demonstration',
        },
      },
      {
        imageKey: 'highFive',
        alt: {
          uk: 'Момент підтримки після барберського майстеркласу в музеї',
          en: 'A supportive moment after the barbering masterclass in the museum',
        },
      },
      {
        imageKey: 'portrait',
        alt: {
          uk: 'Портрет учасників події Soul Cuts у музейній залі',
          en: 'A portrait of Soul Cuts event participants inside the museum hall',
        },
      },
      {
        imageKey: 'gallery9053',
        alt: {
          uk: 'Портрет учасника події в музейній залі',
          en: 'A portrait of an event participant inside the museum hall',
        },
      },
      {
        imageKey: 'gallery9058',
        alt: {
          uk: 'Володимир Мєдвєдєв працює під час майстеркласу',
          en: 'Volodymyr Medvediev works during the masterclass',
        },
      },
      {
        imageKey: 'gallery9149',
        alt: {
          uk: 'Учасник отримує сертифікат після майстеркласу',
          en: 'A participant receives a certificate after the masterclass',
        },
      },
      {
        imageKey: 'gallery8920',
        alt: {
          uk: 'Груповий портрет гостей події Soul Cuts',
          en: 'A group portrait of Soul Cuts event guests',
        },
      },
      {
        imageKey: 'gallery9153',
        alt: {
          uk: 'Гості спілкуються після події в музейній залі',
          en: 'Guests talk after the event inside the museum hall',
        },
      },
      {
        imageKey: 'gallery9064',
        alt: {
          uk: 'Учасники спостерігають за демонстрацією стрижки',
          en: 'Participants watch the haircut demonstration',
        },
      },
    ],
    content: {
      uk: eventContentUk,
      en: eventContentEn,
    },
  },
]

export const sortedPosts = [...posts].sort((first, second) =>
  new Date(second.publishedAt).getTime() - new Date(first.publishedAt).getTime(),
)

export const localizePost = (post: BlogPost, locale: LocaleCode): LocalizedBlogPost => ({
  ...post,
  title: post.title[locale] || post.title.en,
  excerpt: post.excerpt[locale] || post.excerpt.en,
  category: post.category[locale] || post.category.en,
  author: post.author[locale] || post.author.en,
  coverImageAlt: post.coverImageAlt[locale] || post.coverImageAlt.en,
  articleImages: post.articleImages?.map(image => ({
    ...image,
    alt: image.alt[locale] || image.alt.en,
    caption: image.caption ? image.caption[locale] || image.caption.en : undefined,
  })),
  galleryImages: post.galleryImages?.map(image => ({
    ...image,
    alt: image.alt[locale] || image.alt.en,
  })),
  content: post.content[locale] || post.content.en,
})

export const getLocalizedPosts = (locale: LocaleCode) => sortedPosts.map(post => localizePost(post, locale))

const getPrimaryPost = () => {
  const post = posts.find(candidate => candidate.featured) ?? sortedPosts[0]

  if (!post) {
    throw new Error('Blog posts are not configured')
  }

  return post
}

export const getFeaturedPost = (locale: LocaleCode) => {
  const featuredPost = getPrimaryPost()

  return localizePost(featuredPost, locale)
}

export const getLatestPosts = (locale: LocaleCode) => {
  const featuredPost = getPrimaryPost()

  return sortedPosts
    .filter(post => post.slug !== featuredPost.slug)
    .map(post => localizePost(post, locale))
}

export const formatReadMinutes = (minutes: number, locale: LocaleCode) =>
  locale === 'uk' ? `${minutes} хв читання` : `${minutes} min read`

export const formatPostDate = (date: string, locale: LocaleCode = 'en') =>
  new Intl.DateTimeFormat(locale === 'uk' ? 'uk-UA' : 'en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))

export const getPostBySlug = (slug: string) => posts.find(post => post.slug === slug)

export const getRelatedPosts = (slug: string, locale: LocaleCode, limit = 3) => {
  const currentPost = getPostBySlug(slug)
  const relatedByCategory = sortedPosts.filter(post => post.slug !== slug && post.category.en === currentPost?.category.en)
  const fallback = sortedPosts.filter(post => post.slug !== slug && post.category.en !== currentPost?.category.en)

  return [...relatedByCategory, ...fallback].slice(0, limit).map(post => localizePost(post, locale))
}
