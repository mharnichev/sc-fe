import type { LocaleCode } from './locale'
import coverImage from '../assets/images/posts/barbering-museum-cover-1600.jpg'
import coverImageMobile from '../assets/images/posts/barbering-museum-cover-mobile.jpg'
import idemNaBukvyCoverImage from '../assets/images/posts/idem-na-bukvy-cover.webp'
import idemNaBukvyCoverImageMobile from '../assets/images/posts/idem-na-bukvy-cover-mobile.webp'

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
  idemImg0077: () => import('../assets/images/posts/idem-na-bukvy-img_0077.webp') as Promise<AssetModule>,
  idemImg0086: () => import('../assets/images/posts/idem-na-bukvy-img_0086.webp') as Promise<AssetModule>,
  idemImg0096: () => import('../assets/images/posts/idem-na-bukvy-img_0096.webp') as Promise<AssetModule>,
  idemImg0098: () => import('../assets/images/posts/idem-na-bukvy-img_0098.webp') as Promise<AssetModule>,
  idemImg0104: () => import('../assets/images/posts/idem-na-bukvy-img_0104.webp') as Promise<AssetModule>,
  idemImg0526: () => import('../assets/images/posts/idem-na-bukvy-img_0526.webp') as Promise<AssetModule>,
  idemImg0528: () => import('../assets/images/posts/idem-na-bukvy-img_0528.webp') as Promise<AssetModule>,
  idemImg0534: () => import('../assets/images/posts/idem-na-bukvy-img_0534.webp') as Promise<AssetModule>,
  idemImg0538: () => import('../assets/images/posts/idem-na-bukvy-img_0538.webp') as Promise<AssetModule>,
  idemImg0540: () => import('../assets/images/posts/idem-na-bukvy-img_0540.webp') as Promise<AssetModule>,
  idemImg0541: () => import('../assets/images/posts/idem-na-bukvy-img_0541.webp') as Promise<AssetModule>,
  idemImg0542: () => import('../assets/images/posts/idem-na-bukvy-img_0542.webp') as Promise<AssetModule>,
  idemImg0543: () => import('../assets/images/posts/idem-na-bukvy-img_0543.webp') as Promise<AssetModule>,
  idemImg0544: () => import('../assets/images/posts/idem-na-bukvy-img_0544.webp') as Promise<AssetModule>,
  idemImg0583: () => import('../assets/images/posts/idem-na-bukvy-img_0583.webp') as Promise<AssetModule>,
  idemImg0585: () => import('../assets/images/posts/idem-na-bukvy-img_0585.webp') as Promise<AssetModule>,
  idemImg0586: () => import('../assets/images/posts/idem-na-bukvy-img_0586.webp') as Promise<AssetModule>,
  idemImg0587: () => import('../assets/images/posts/idem-na-bukvy-img_0587.webp') as Promise<AssetModule>,
  idemImg0588: () => import('../assets/images/posts/idem-na-bukvy-img_0588.webp') as Promise<AssetModule>,
  idemImg0589: () => import('../assets/images/posts/idem-na-bukvy-img_0589.webp') as Promise<AssetModule>,
  idemImg0590: () => import('../assets/images/posts/idem-na-bukvy-img_0590.webp') as Promise<AssetModule>,
  idemImg0591: () => import('../assets/images/posts/idem-na-bukvy-img_0591.webp') as Promise<AssetModule>,
  idemImg0592: () => import('../assets/images/posts/idem-na-bukvy-img_0592.webp') as Promise<AssetModule>,
  idemImg0593: () => import('../assets/images/posts/idem-na-bukvy-img_0593.webp') as Promise<AssetModule>,
  idemImg0597: () => import('../assets/images/posts/idem-na-bukvy-img_0597.webp') as Promise<AssetModule>,
  idemImg4404: () => import('../assets/images/posts/idem-na-bukvy-img_4404.webp') as Promise<AssetModule>,
  idemImg4405: () => import('../assets/images/posts/idem-na-bukvy-img_4405.webp') as Promise<AssetModule>,
  idemImg4408: () => import('../assets/images/posts/idem-na-bukvy-img_4408.webp') as Promise<AssetModule>,
  idemImg4414: () => import('../assets/images/posts/idem-na-bukvy-img_4414.webp') as Promise<AssetModule>,
  idemImg4415: () => import('../assets/images/posts/idem-na-bukvy-img_4415.webp') as Promise<AssetModule>,
  idemImg4417: () => import('../assets/images/posts/idem-na-bukvy-img_4417.webp') as Promise<AssetModule>,
  idemImg4418: () => import('../assets/images/posts/idem-na-bukvy-img_4418.webp') as Promise<AssetModule>,
  idemImg4421: () => import('../assets/images/posts/idem-na-bukvy-img_4421.webp') as Promise<AssetModule>,
  idemImg6486: () => import('../assets/images/posts/idem-na-bukvy-img_6486.webp') as Promise<AssetModule>,
  idemImg6491: () => import('../assets/images/posts/idem-na-bukvy-img_6491.webp') as Promise<AssetModule>,
  idemImg6521: () => import('../assets/images/posts/idem-na-bukvy-img_6521.webp') as Promise<AssetModule>,
  idemImg6522: () => import('../assets/images/posts/idem-na-bukvy-img_6522.webp') as Promise<AssetModule>,
  idemImg6527: () => import('../assets/images/posts/idem-na-bukvy-img_6527.webp') as Promise<AssetModule>,
  idemImg6533: () => import('../assets/images/posts/idem-na-bukvy-img_6533.webp') as Promise<AssetModule>,
  idemImg7081: () => import('../assets/images/posts/idem-na-bukvy-img_7081.webp') as Promise<AssetModule>,
  idemImg7329: () => import('../assets/images/posts/idem-na-bukvy-img_7329.webp') as Promise<AssetModule>,
  idemImg7330: () => import('../assets/images/posts/idem-na-bukvy-img_7330.webp') as Promise<AssetModule>,
  idemImg7333: () => import('../assets/images/posts/idem-na-bukvy-img_7333.webp') as Promise<AssetModule>,
  idemImg7339: () => import('../assets/images/posts/idem-na-bukvy-img_7339.webp') as Promise<AssetModule>,
  idemImg7344: () => import('../assets/images/posts/idem-na-bukvy-img_7344.webp') as Promise<AssetModule>,
  idemImg7682: () => import('../assets/images/posts/idem-na-bukvy-img_7682.webp') as Promise<AssetModule>,
  idemImg7684: () => import('../assets/images/posts/idem-na-bukvy-img_7684.webp') as Promise<AssetModule>,
  idemImg7688: () => import('../assets/images/posts/idem-na-bukvy-img_7688.webp') as Promise<AssetModule>,
  idemImg7691: () => import('../assets/images/posts/idem-na-bukvy-img_7691.webp') as Promise<AssetModule>,
  idemImg7692: () => import('../assets/images/posts/idem-na-bukvy-img_7692.webp') as Promise<AssetModule>,
  idemImg7695: () => import('../assets/images/posts/idem-na-bukvy-img_7695.webp') as Promise<AssetModule>,
  idemImg9148: () => import('../assets/images/posts/idem-na-bukvy-img_9148.webp') as Promise<AssetModule>,
  idemImg9666: () => import('../assets/images/posts/idem-na-bukvy-img_9666.webp') as Promise<AssetModule>,
  idemImg9695: () => import('../assets/images/posts/idem-na-bukvy-img_9695.webp') as Promise<AssetModule>,
  idemImg9800: () => import('../assets/images/posts/idem-na-bukvy-img_9800.webp') as Promise<AssetModule>,
  idemImg9886: () => import('../assets/images/posts/idem-na-bukvy-img_9886.webp') as Promise<AssetModule>,
} as const

export type BlogPostImageKey = keyof typeof blogPostImageLoaders

export const loadBlogPostImage = async (key: BlogPostImageKey) => {
  const image = await blogPostImageLoaders[key]()
  return image.default
}

interface BlogGalleryImage {
  imageKey: BlogPostImageKey
  alt: LocalizedText
  width?: number
  height?: number
}

interface BlogArticleImage {
  afterParagraphIndex: number
  imageKey: BlogPostImageKey
  alt: LocalizedText
  caption?: LocalizedText
  width?: number
  height?: number
}

export type BlogContentBlock = string | {
  type: 'heading'
  text: string
} | {
  type: 'quote'
  text: string
  attribution?: string
} | {
  type: 'list'
  items: string[]
}

export type BlogArticleImageLayout = 'floating' | 'grouped-gallery'
export type BlogImageFit = 'cover' | 'natural-capped' | 'contain'
export type BlogPostVisibility = 'public' | 'unlisted'

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
  visibility?: BlogPostVisibility
  articleImageLayout?: BlogArticleImageLayout
  imageFit?: BlogImageFit
  articleImages?: BlogArticleImage[]
  galleryImages?: BlogGalleryImage[]
  content: Record<LocaleCode, BlogContentBlock[]>
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
  visibility?: BlogPostVisibility
  articleImageLayout?: BlogArticleImageLayout
  imageFit?: BlogImageFit
  articleImages?: Array<{
    afterParagraphIndex: number
    imageKey: BlogPostImageKey
    src?: string
    alt: string
    caption?: string
    width?: number
    height?: number
  }>
  galleryImages?: Array<{
    imageKey: BlogPostImageKey
    src?: string
    alt: string
    width?: number
    height?: number
  }>
  content: BlogContentBlock[]
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

const idemNaBukvyContentUk: BlogContentBlock[] = [
  'Барбершоп - це ніколи не було просто про «підстригтися». Це про приналежність до спільноти, характер, стиль життя, правильну музику та розмови, які зазвичай залишаються всередині майстерні - між майстром і клієнтом. Але що буде, якщо винести ці розмови назовні? Що, як показати виворіт індустрії, її характер, проблеми та справжніх лідерів думок?',
  'Три роки тому народився проєкт «Ідем на Букви». Він починався з простої місії: заповнити вакуум в україномовному медіапросторі. Сьогодні цей проєкт стає невідʼємною частиною всесвіту Soul Cuts, перетворюючи наш сайт на повноцінне бренд-медіа для тих, хто живе цією культурою.',
  'Ось детальний шлях нашої еволюції за останні три роки - від першої локальної ідеї до головного медіарушія барберингу.',
  { type: 'heading', text: 'Етап 1: початок та еволюція формату' },
  'Все починалося з ідеї почути думки майстрів індустрії. Це був 2023 рік. Індустрія та комʼюніті були сильними й прагнули розвитку, тож зʼявилася ідея обʼєднати всі ці голоси на одній платформі. Згодом, окрім подкастів, ми почали транслювати блоги з івентів і масштабних заходів українського барберингу, записувати інтервʼю з топами нашої індустрії та діалоги з майстрами з інших країн - головними спікерами на сцені.',
  'Нашим фірмовим почерком стала плівкова фотографія. Чому саме плівка? Тому що вона не вміє брехати. Вона передає справжні емоції, текстуру волосся, блиск інструментів, втому і водночас кайф в очах майстра після важкої зміни. Плівка фіксувала історію нашої сфери в її найчистішому вигляді.',
  'Паралельно проєкт знову змінювався: ми з командою почали створювати власні івенти та організовувати майстеркласи з особистою айдентикою. На цьому етапі захотілося дати майстрам наступного покоління ті деталі, яких не вистачало нам під час навчання та професійного росту.',
  { type: 'heading', text: 'Етап 2: голос індустрії та міст між поколіннями' },
  'Цей проєкт я створив, щоб обʼєднати на одній платформі думки майстрів барберингу, які розвивалися самі й розвивали культуру впродовж останніх десяти років. Моя ціль - максимально розкрити особистість гостя подкасту та простежити, як змінювалася наша індустрія через призму окремого майстра.',
  'Усі ці знання та досвід будуть корисними для молодих майстрів, які тільки починають свій шлях. Вони зможуть надихнутися і, найголовніше, не повторювати наших помилок: від самого початку будувати себе не лише як професіонала своєї справи, а і як особистість із правильно вибудуваним позиціонуванням окремого бренду.',
  { type: 'heading', text: 'Етап 3: анатомія одеського двіжу, управлінські помилки та батли' },
  'Медіа має жити в офлайні. Проєкт став організатором великих подій в Одесі та зйомок влогів. Ми залучаємо майстрів, піднімаємо планку і розвиваємо спільноту.',
  'За лаштунками двіжух ми фіксуємо реальні проблеми, хайпові конфлікти - як Primero і Леон - та живі думки майстрів.',
  {
    type: 'quote',
    text: 'Коли ти розумієш, що хочеш нових відчуттів та досвіду - тобі треба «вижимати» із себе і знову набирати, як губка, чогось нового. Я досі памʼятаю, як колись Вася Писаренко проходив по всіх барбершопах Одеси і збирав нас вручну, додаючи у групу у Viber…',
    attribution: 'Олександр Ковальчук, 9 років у професії',
  },
  'Ми тримаємо руку на пульсі одеських витоків, де культуру рухали перші «динозаври» індустрії - Вася, Ваня Лютий, Ваня Білець та інші. Багато хто розʼїхався, але наше завдання - знову збирати всіх разом на великих заходах, бо саме з Одеси все колись починалося.',
  {
    type: 'quote',
    text: 'Коли я був молодим і застав рух барберингу в барбершопі «Преображенський», я завжди знаходив сильніших майстрів, у яких було що перейняти. Я йшов із таких івентів натхненним, отримував багато мотивації та відчуття приземлення - що мені ще є куди рости.',
    attribution: 'Віталій HEAD HUNTER, засновник франшизи Menʼs Club',
  },
  {
    type: 'quote',
    text: 'Ви повинні бути впевнені в тому, що робите, і тоді ви полюбите цю професію. Бо коли ти чогось не знаєш, ти боїшся - і цей страх змушує робити дурниці. Технічність вирішує все. Ти робиш дію один раз і більше не повертаєшся на попередній етап, бо наступний уже не підлаштується, якщо комбінація технік була обрана неправильно.',
    attribution: 'Андрій Драгомирецький, понад 10 років у професії',
  },
  {
    type: 'quote',
    text: 'Коли ти сидиш в одному барбершопі і нікуди не вилазиш, ти ніби забуваєш, що існує величезна індустрія поза твоїм робочим місцем. Такі івенти допомагають усвідомити, що є купа інших майстрів зі своїм індивідуальним стилем. Удосконаленню немає меж.',
    attribution: 'Іван Білець, майстер із понад 20-річним стажем',
  },
  { type: 'heading', text: 'Етап 4: перезавантаження форматів навчання та бізнес' },
  'Ми ламаємо стереотипи організації подій. Показник цього - унікальний майстерклас Володимира Мєдвєдєва (Hairkillah) в Одесі. Ми вперше відмовилися від класичних навчальних залів і організували майстерклас у стінах університету. Формат аудиторії - амфітеатр.',
  'Такі посадкові місця вплинули на якість засвоєння матеріалу. З будь-якого ракурсу було добре видно, як саме майстер працює з волоссям. Завдяки партам для кожного майстра було зручно конспектувати теорію та робити схеми стрижок.',
  'Упродовж усього майстеркласу нас бадьорила кава від бренду FOUNDATION. Від душі дякуємо їм за підтримку заходу. Такі ж слова подяки летять смачним супчикам закладу «СУПСТАНЦІЯ»: дуже смачно поїли й із новими силами продовжили навчання.',
  'Така підтримка від закладів Одеси дає чітке розуміння, що ми робимо все правильно і рухаємося в правильному напрямку.',
  { type: 'heading', text: 'Етап 5: більше ніж ремесло. Барберинг як дзеркало особистості та міст у майбутнє' },
  'За три роки зйомок, подкастів, організації івентів та щоденної роботи за кріслом ми зробили для себе висновок: найважливіше в нашій сфері - знайти відчуття внутрішнього себе в професії.',
  'Спочатку ти приходиш сюди, щоб просто вивчити базову навичку - стригти. Але з часом розумієш, що барберинг взагалі не лише про стрижки. Це унікальний простір, де ти знаходиш свою велику спільноту людей.',
  'І барбери, які стають клієнтами нашого проєкту, і люди, які приходять до нас стригтися, обирають свого майстра не просто за якісний фейд. Вони обирають людину.',
  { type: 'heading', text: 'Обʼєднання проєктів «Ідем на Букви» та Soul Cuts' },
  'Сьогодні проєкт «Ідем на Букви» та барбершоп Soul Cuts обʼєднуються в одному просторі. Ми однаково віримо в безкомпромісну якість, повагу до витоків, відточену техніку та унікальність кожної особистості.',
  'У цьому блозі, на сайті Soul Cuts, ми будемо регулярно ділитися з вами:',
  {
    type: 'list',
    items: [
      'ексклюзивними бекстейджами з подкастів та свіжими випусками;',
      'плівковими репортажами з головних перукарських подій країни;',
      'анонсами нестандартних майстеркласів для тих, хто хоче будувати свій бренд;',
      'корисними матеріалами про стиль, чоловічий догляд та культуру українського барберингу.',
    ],
  },
  'Ми продовжуємо свою роботу: знімаємо всі події на плівку, вириваємо майстрів із вакууму рутини та качаємо індустрію.',
  'Так, тут створюється історія. І тут немає стелі, якщо ти будуєш себе як особистість.',
  { type: 'heading', text: 'Локальний шифр: чому саме «Ідем на Букви»?' },
  'Багатьох інтригує наша назва. Насправді це частина мого коріння. Я родом із Новодністровська Чернівецької області - маленького міста на десять тисяч людей. На самому вʼїзді туди стоять великі бетонні літери «НОВОДНІСТРОВСЬК». Кожен, хто виріс там, знає: ці букви - культове місце. Усе дитинство ми з пацанами ходили туди лазити, зависати та просто проводити час. Фраза «Ідем на букви» була нашим кодом для збору. З іншої сторони фраза "Ідем на Букви" буквально запрошує кожного гостя нашого проекту "на букви", тобто на розмову. На будь-яку тему, головне, щоб ця розмова якнайширше змогла розкрити особистість гостя для глядача наших випусків.',
  'Але якщо копнути набагато глибше - навіщо взагалі було створювати цей проєкт? Сьогодні я можу відверто зізнатися: це мій внутрішній компенсаторний механізм. Це історія, яка тягнеться з дитинства, де якісь речі та внутрішні потреби я тоді для себе не перекрив. Моє бажання постійно щось розповідати, контактувати з людьми, організовувати масштабні двіжі, збирати всіх у себе вдома - усе це нашарувалося звідти.',
]

const idemNaBukvyContentEn: BlogContentBlock[] = [
  'A barbershop has never been just a place to get a haircut. It is about belonging to a community, character, lifestyle, the right music, and conversations that usually stay inside the shop between barber and client. But what happens when those conversations move outside? What if we show the industry from the inside - its character, its problems, and its real opinion leaders?',
  'Three years ago, Idem na Bukvy was born. It began with a simple mission: to fill a gap in Ukrainian-language media. Today, the project is becoming an integral part of the Soul Cuts universe, turning our website into a full brand publication for everyone who lives this culture.',
  'This is the detailed story of our evolution over the past three years - from one local idea to a driving media force in barbering.',
  { type: 'heading', text: 'Stage 1: the beginning and evolution of the format' },
  'It started with a desire to hear what the industryʼs barbers were thinking. It was 2023. The industry and its community were strong and eager to grow, so we wanted to bring those voices together on one platform. Beyond podcasts, the project soon expanded into event vlogs, reports from major Ukrainian barbering gatherings, interviews with the leading names in our industry, and conversations with international barbers who appeared as headline speakers.',
  'Film photography became our signature. Why film? Because it cannot lie. It captures real emotion, the texture of hair, the shine of tools, the fatigue and the spark in a barberʼs eyes after a hard shift. Film preserved the history of our field in its purest form.',
  'The project kept evolving. Our team began creating original events and masterclasses with their own identity. We wanted to give the next generation of barbers the details we had been missing during our own training and professional growth.',
  { type: 'heading', text: 'Stage 2: the industryʼs voice and a bridge between generations' },
  'I created this project to bring together the perspectives of barbers who have spent the past decade developing themselves and the culture around them. My goal is to reveal the podcast guest as fully as possible and trace how our industry has changed through the experience of one person.',
  'That knowledge and experience can help young barbers at the beginning of their journey. It can inspire them and, most importantly, help them avoid our mistakes: to build themselves from day one not only as skilled professionals, but as people with clear positioning and a distinct personal brand.',
  { type: 'heading', text: 'Stage 3: inside Odesaʼs movement, management mistakes, and battles' },
  'Media has to live offline. The project began organizing large events in Odesa and filming vlogs. We bring barbers together, raise the bar, and develop the community.',
  'Behind the scenes, we document real problems, much-discussed conflicts - such as Primero and Leon - and the honest thoughts of working barbers.',
  {
    type: 'quote',
    text: 'When you realize you want new feelings and experience, you have to squeeze yourself out and then absorb something new again, like a sponge. I still remember Vasya Pysarenko walking around every barbershop in Odesa, gathering us one by one and adding everyone to a Viber group…',
    attribution: 'Oleksandr Kovalchuk, 9 years in the profession',
  },
  'We stay connected to Odesaʼs roots, where the culture was moved forward by the industryʼs first “dinosaurs” - Vasya, Vania Liutyi, Vania Bilets, and others. Many have moved away, but our job is to bring everyone together again at large events, because this is where it all began.',
  {
    type: 'quote',
    text: 'When I was young and saw the barbering movement at Preobrazhensky barbershop, I always looked for stronger barbers I could learn from. I left those events inspired, highly motivated, and grounded by the feeling that I still had room to grow.',
    attribution: 'Vitalii HEAD HUNTER, founder of the Menʼs Club franchise',
  },
  {
    type: 'quote',
    text: 'You have to be confident in what you do, and then you will love this profession. When you do not know something, you become afraid, and that fear makes you do foolish things. Technique decides everything. You perform an action once and do not return to the previous stage, because the next one will not adapt if the combination of techniques was chosen incorrectly.',
    attribution: 'Andrii Drahomyretskyi, more than 10 years in the profession',
  },
  {
    type: 'quote',
    text: 'When you stay inside one barbershop and never go anywhere, you almost forget that an enormous industry exists beyond your workplace. Events like these remind you that there are many other barbers, each with an individual style. There is no limit to improvement.',
    attribution: 'Ivan Bilets, a barber with more than 20 years of experience',
  },
  { type: 'heading', text: 'Stage 4: rethinking education formats and business' },
  'We break the stereotypes around event organization. One example was Volodymyr Medvedievʼs unique Hairkillah masterclass in Odesa. For the first time, we rejected the classic training-room format and held the class inside a university lecture hall arranged as an amphitheatre.',
  'The seating changed how well the material could be understood. Everyone could clearly see the barber working from any angle, while individual desks made it comfortable to take notes on the theory and draw haircut diagrams.',
  'Coffee from FOUNDATION kept us energized throughout the masterclass, and we thank them wholeheartedly for supporting the event. We are equally grateful to SUPSTANTSIIA for the delicious soup that helped us return to the training with new energy.',
  'Support from Odesa businesses gives us a clear sense that we are doing the right thing and moving in the right direction.',
  { type: 'heading', text: 'Stage 5: more than a craft. Barbering as a reflection of identity and a bridge to the future' },
  'After three years of filming, podcasts, events, and daily work behind the chair, we reached one conclusion: the most important thing in our field is to find a sense of your inner self within the profession.',
  'At first, you come here simply to learn a foundational skill - cutting hair. Over time, you understand that barbering is not only about haircuts at all. It is a unique space where you find a large community of people.',
  'Both the barbers who become clients of our project and the people who come to us for a haircut choose their barber for more than a clean fade. They choose the person.',
  { type: 'heading', text: 'Idem na Bukvy and Soul Cuts come together' },
  'Today, Idem na Bukvy and the Soul Cuts barbershop are coming together in one space. We share the same belief in uncompromising quality, respect for our roots, refined technique, and the uniqueness of every individual.',
  'Here on the Soul Cuts blog, we will regularly share:',
  {
    type: 'list',
    items: [
      'exclusive podcast backstage stories and new episodes;',
      'film-photo reports from the countryʼs most important hair and barbering events;',
      'announcements for unconventional masterclasses aimed at people building their own brands;',
      'useful stories about style, menʼs grooming, and Ukrainian barbering culture.',
    ],
  },
  'We keep doing the work: shooting every event on film, pulling barbers out of the vacuum of routine, and pushing the industry forward.',
  'This is where history is being made. And there is no ceiling when you build yourself as a person.',
  { type: 'heading', text: 'The local code: why “Idem na Bukvy”?' },
  'Our name intrigues many people, but it comes directly from my roots. I am from Novodnistrovsk in Chernivtsi region, a small town of ten thousand people. Large concrete letters spelling “NOVODNISTROVSK” stand at its entrance. Everyone who grew up there knows those letters as a cult local landmark. Throughout childhood, my friends and I went there to climb, hang out, and spend time together. The phrase “letʼs go to the letters” was our code for meeting up.',
  'But if we go much deeper, why did this project need to exist at all? Today I can admit honestly that it is my internal compensatory mechanism. The story reaches back into childhood, to needs I could not meet at the time. My constant desire to tell stories, connect with people, organize large gatherings, and invite everyone into my home - all of it grew from there.',
]

const idemNaBukvyGalleryImage = (
  imageKey: BlogPostImageKey,
  width: number,
  height: number,
  uk: string,
  en: string,
): BlogGalleryImage => ({ imageKey, width, height, alt: { uk, en } })

const idemNaBukvyGalleryImages: BlogGalleryImage[] = [
  idemNaBukvyGalleryImage('idemImg0526', 1080, 608, 'Обкладинка одного з перших випусків «Ідем на Букви»', 'Cover artwork for an early Idem na Bukvy episode'),
  idemNaBukvyGalleryImage('idemImg0528', 1350, 1800, 'Гості подкасту за столом у студії', 'Podcast guests at the studio table'),
  idemNaBukvyGalleryImage('idemImg0534', 1280, 720, 'Запис подкасту «Ідем на Букви» у студії', 'Recording an Idem na Bukvy podcast episode in the studio'),
  idemNaBukvyGalleryImage('idemImg0538', 750, 1334, 'Спікер «Ідем на Букви» під час професійної події', 'An Idem na Bukvy speaker during an industry event'),
  idemNaBukvyGalleryImage('idemImg0540', 832, 1800, 'Гості одного з перших випусків проєкту', 'Guests of an early Idem na Bukvy episode'),
  idemNaBukvyGalleryImage('idemImg0541', 750, 1334, 'Учасники зустрічі «Ідем на Букви»', 'Participants at an Idem na Bukvy gathering'),
  idemNaBukvyGalleryImage('idemImg0542', 768, 960, 'Учасники міжнародної барберської події', 'Participants at an international barbering event'),
  idemNaBukvyGalleryImage('idemImg0543', 1800, 1013, 'Обкладинка випуску «Ідем на Букви» з командою MAZA', 'Idem na Bukvy episode cover featuring the MAZA team'),
  idemNaBukvyGalleryImage('idemImg6521', 1350, 1800, 'Креативна стрижка під час професійного показу', 'A creative haircut during a professional demonstration'),
  idemNaBukvyGalleryImage('idemImg6522', 1350, 1800, 'Робота з яскравим фарбуванням на барберській події', 'Work on a vivid color treatment at a barbering event'),
  idemNaBukvyGalleryImage('idemImg7329', 1350, 1800, 'Барберські інструменти у робочому кейсі', 'Barbering tools arranged in a work case'),
  idemNaBukvyGalleryImage('idemImg7682', 1350, 1800, 'Плівковий портрет учасника події', 'A film portrait of an event participant'),
  idemNaBukvyGalleryImage('idemImg7684', 1350, 1800, 'Барбер працює з клієнтом під час події', 'A barber works with a client during an event'),
  idemNaBukvyGalleryImage('idemImg7688', 1350, 1800, 'Майстер укладає волосся клієнта', 'A barber styles a clientʼs hair'),
  idemNaBukvyGalleryImage('idemImg7691', 1350, 1800, 'Підготовка інструментів перед роботою', 'Preparing tools before a haircut'),
  idemNaBukvyGalleryImage('idemImg7692', 1350, 1800, 'Інструменти барбера крупним планом', 'A close-up of barbering tools'),
  idemNaBukvyGalleryImage('idemImg7695', 1350, 1800, 'Стрижка під час професійної зустрічі', 'A haircut during an industry gathering'),
  idemNaBukvyGalleryImage('idemImg0588', 1115, 632, 'Афіша фестивалю барберської культури', 'A poster for a barbering culture festival'),
  idemNaBukvyGalleryImage('idemImg0589', 1800, 1013, 'Обкладинка інтервʼю з Богданом Часником', 'Cover artwork for the interview with Bohdan Chasnyk'),
  idemNaBukvyGalleryImage('idemImg0590', 1800, 1013, 'Обкладинка інтервʼю з Andrea Magri', 'Cover artwork for the interview with Andrea Magri'),
  idemNaBukvyGalleryImage('idemImg0591', 1800, 1013, 'Обкладинка випуску про конфлікт навколо Primero', 'Episode cover about the conflict involving Primero'),
  idemNaBukvyGalleryImage('idemImg0592', 1800, 1013, 'Обкладинка подкасту про розмови поза кріслом', 'Podcast cover about conversations beyond the barber chair'),
  idemNaBukvyGalleryImage('idemImg0593', 1800, 1013, 'Обкладинка виїзного випуску «Барбер Хата»', 'Cover artwork for the Barber Khata field episode'),
  idemNaBukvyGalleryImage('idemImg0597', 1429, 1800, 'Портрет героя проєкту «Ідем на Букви»', 'Portrait of an Idem na Bukvy guest'),
  idemNaBukvyGalleryImage('idemImg0077', 1350, 1800, 'Спікер розмовляє з учасниками барберської події', 'A speaker talks with barbering event participants'),
  idemNaBukvyGalleryImage('idemImg0086', 1350, 1800, 'Барбер працює з моделлю біля входу до барбершопу', 'A barber works with a model outside a barbershop'),
  idemNaBukvyGalleryImage('idemImg0104', 1350, 1800, 'Виступ перед барберським комʼюніті', 'A talk for the barbering community'),
  idemNaBukvyGalleryImage('idemImg4404', 1800, 1193, 'Майстерклас у великій університетській аудиторії', 'A masterclass in a university lecture hall'),
  idemNaBukvyGalleryImage('idemImg4405', 1440, 1800, 'Учасники майстеркласу в університеті', 'Participants at the university masterclass'),
  idemNaBukvyGalleryImage('idemImg4414', 1440, 1800, 'Майстер конспектує теорію під час навчання', 'A barber takes notes during the class'),
  idemNaBukvyGalleryImage('idemImg4415', 1440, 1800, 'Аудиторія барберського майстеркласу', 'The audience at a barbering masterclass'),
  idemNaBukvyGalleryImage('idemImg4417', 1440, 1800, 'Практична демонстрація стрижки в аудиторії', 'A practical haircut demonstration in the lecture hall'),
  idemNaBukvyGalleryImage('idemImg4421', 1800, 1193, 'Спільне фото учасників великого майстеркласу', 'A group portrait after a large masterclass'),
  idemNaBukvyGalleryImage('idemImg0096', 1350, 1800, 'Гості барберської події в Одесі', 'Guests at a barbering event in Odesa'),
  idemNaBukvyGalleryImage('idemImg0098', 1350, 1800, 'Учасники події спілкуються біля локації', 'Event participants talk outside the venue'),
  idemNaBukvyGalleryImage('idemImg4408', 1800, 1193, 'Розмова учасників події просто неба', 'Event participants talking outdoors'),
  idemNaBukvyGalleryImage('idemImg4418', 1440, 1800, 'Портрет молодого учасника майстеркласу', 'Portrait of a young masterclass participant'),
  idemNaBukvyGalleryImage('idemImg6486', 1350, 1800, 'Виступ на сцені барберської події', 'A presentation on a barbering event stage'),
  idemNaBukvyGalleryImage('idemImg6491', 1349, 1800, 'Команда учасників із сертифікатами', 'A team of participants holding certificates'),
  idemNaBukvyGalleryImage('idemImg6533', 1350, 1800, 'Двоє майстрів спілкуються під час події', 'Two barbers talk during an event'),
  idemNaBukvyGalleryImage('idemImg6527', 1350, 1800, 'Барбер працює з клієнтом серед гостей події', 'A barber works with a client among event guests'),
  idemNaBukvyGalleryImage('idemImg7081', 1350, 1800, 'Учасники «Ідем на Букви» біля входу до локації', 'Idem na Bukvy participants near the venue entrance'),
  idemNaBukvyGalleryImage('idemImg7330', 1350, 1800, 'Стрижка в атмосфері вечірньої події', 'A haircut during an evening event'),
  idemNaBukvyGalleryImage('idemImg7333', 1349, 1800, 'Плівковий портрет учасника проєкту', 'A film portrait of a project participant'),
  idemNaBukvyGalleryImage('idemImg7339', 1350, 1800, 'Барбер завершує стрижку клієнта', 'A barber finishes a clientʼs haircut'),
  idemNaBukvyGalleryImage('idemImg7344', 1350, 1800, 'Команда «Ідем на Букви» за лаштунками', 'The Idem na Bukvy team behind the scenes'),
  idemNaBukvyGalleryImage('idemImg9148', 1193, 1800, 'Барбер працює з клієнтом у кріслі', 'A barber works with a client in the chair'),
  idemNaBukvyGalleryImage('idemImg9666', 1350, 1800, 'Майстер працює з довгим волоссям моделі', 'A barber works with a modelʼs long hair'),
  idemNaBukvyGalleryImage('idemImg9695', 1350, 1800, 'Учасники професійної зустрічі', 'Participants at an industry gathering'),
  idemNaBukvyGalleryImage('idemImg9800', 1350, 1800, 'Креативна робота з татуюванням на потилиці', 'Creative work featuring a tattoo on the back of the head'),
  idemNaBukvyGalleryImage('idemImg9886', 1800, 1194, 'Плівковий портрет учасника «Ідем на Букви» у барбершопі', 'A film portrait of an Idem na Bukvy participant in a barbershop'),
  idemNaBukvyGalleryImage('idemImg0544', 715, 475, 'Бетонні літери «Новодністровськ» при вʼїзді до міста', 'The concrete Novodnistrovsk letters at the entrance to the town'),
  idemNaBukvyGalleryImage('idemImg0583', 940, 788, 'Вітальна листівка з панорамою Новодністровська', 'A greeting card featuring a panorama of Novodnistrovsk'),
  idemNaBukvyGalleryImage('idemImg0585', 1280, 960, 'Панорама Новодністровська', 'A panoramic view of Novodnistrovsk'),
  idemNaBukvyGalleryImage('idemImg0586', 1800, 1200, 'Краєвид Дністровської гідроелектростанції', 'A view of the Dniester hydroelectric station'),
  idemNaBukvyGalleryImage('idemImg0587', 1800, 1011, 'Дністровська гідроелектростанція з висоти', 'The Dniester hydroelectric station from above'),
]

const idemNaBukvyArticleImage = (afterParagraphIndex: number, imageKey: BlogPostImageKey): BlogArticleImage => {
  const galleryImage = idemNaBukvyGalleryImages.find(image => image.imageKey === imageKey)

  if (!galleryImage) {
    throw new Error(`Missing Idem na Bukvy gallery image: ${imageKey}`)
  }

  return { ...galleryImage, afterParagraphIndex }
}

const idemNaBukvyArticleImagesAfter = (
  afterParagraphIndex: number,
  imageKeys: BlogPostImageKey[],
) => imageKeys.map(imageKey => idemNaBukvyArticleImage(afterParagraphIndex, imageKey))

export const posts: BlogPost[] = [
  {
    slug: 'history-of-idem-na-bukvy',
    title: {
      uk: 'З чого починалася історія проєкту «Ідем на Букви»?',
      en: 'How Did the Story of Idem na Bukvy Begin?',
    },
    excerpt: {
      uk: 'Три роки подкастів, плівкових репортажів та івентів - шлях від локальної ідеї до медіа про українську барберську культуру.',
      en: 'Three years of podcasts, film-photo reports, and events - the journey from a local idea to a publication about Ukrainian barbering culture.',
    },
    publishedAt: '2026-07-14',
    category: {
      uk: 'Культура',
      en: 'Culture',
    },
    author: {
      uk: 'Гліб Аноцький',
      en: 'Hlib Anotskyi',
    },
    readMinutes: 11,
    coverImage: idemNaBukvyCoverImage,
    coverImageMobile: idemNaBukvyCoverImageMobile,
    coverImageAlt: {
      uk: 'Колаж із плівкових кадрів з історії проєкту «Ідем на Букви»',
      en: 'A collage of film photographs from the history of Idem na Bukvy',
    },
    featured: true,
    articleImageLayout: 'grouped-gallery',
    imageFit: 'natural-capped',
    articleImages: [
      ...idemNaBukvyArticleImagesAfter(0, ['idemImg0526', 'idemImg0528', 'idemImg0534']),
      ...idemNaBukvyArticleImagesAfter(2, ['idemImg0538', 'idemImg0540', 'idemImg0541', 'idemImg0542']),
      ...idemNaBukvyArticleImagesAfter(4, ['idemImg7329', 'idemImg7691', 'idemImg7692']),
      ...idemNaBukvyArticleImagesAfter(6, ['idemImg4408', 'idemImg4417', 'idemImg7682', 'idemImg7684', 'idemImg6521', 'idemImg6522']),
      ...idemNaBukvyArticleImagesAfter(9, ['idemImg0588', 'idemImg0589', 'idemImg0590', 'idemImg0591', 'idemImg0592', 'idemImg0593']),
      ...idemNaBukvyArticleImagesAfter(17, ['idemImg9886', 'idemImg0597', 'idemImg9148', 'idemImg7081']),
      ...idemNaBukvyArticleImagesAfter(22, ['idemImg4404', 'idemImg4418', 'idemImg4405', 'idemImg4414', 'idemImg4415', 'idemImg4417', 'idemImg4421']),
      ...idemNaBukvyArticleImagesAfter(26, ['idemImg0096', 'idemImg0098', 'idemImg0086', 'idemImg6527', 'idemImg9800', 'idemImg7688', 'idemImg7695']),
      ...idemNaBukvyArticleImagesAfter(32, ['idemImg0104', 'idemImg6491', 'idemImg6486', 'idemImg9695', 'idemImg9666', 'idemImg0077', 'idemImg7339', 'idemImg7330', 'idemImg7333', 'idemImg7344']),
      ...idemNaBukvyArticleImagesAfter(35, ['idemImg0544', 'idemImg0583', 'idemImg0585', 'idemImg0586', 'idemImg0587']),
    ],
    galleryImages: idemNaBukvyGalleryImages,
    content: {
      uk: idemNaBukvyContentUk,
      en: idemNaBukvyContentEn,
    },
  },
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
    articleImageLayout: 'floating',
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

const publicPosts = sortedPosts.filter(post => post.visibility !== 'unlisted')

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

export const getLocalizedPosts = (locale: LocaleCode) => publicPosts.map(post => localizePost(post, locale))

const getPrimaryPost = () => {
  const post = publicPosts.find(candidate => candidate.featured) ?? publicPosts[0]

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

  return publicPosts
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
  const relatedByCategory = publicPosts.filter(post => post.slug !== slug && post.category.en === currentPost?.category.en)
  const fallback = publicPosts.filter(post => post.slug !== slug && post.category.en !== currentPost?.category.en)

  return [...relatedByCategory, ...fallback].slice(0, limit).map(post => localizePost(post, locale))
}
