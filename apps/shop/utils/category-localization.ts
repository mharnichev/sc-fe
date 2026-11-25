export interface LocalizedCategory {
  name: string
  name_en?: string | null
}

export const localizedCategoryName = (category: LocalizedCategory, locale: string): string =>
  locale === 'en' && category.name_en?.trim() ? category.name_en : category.name

// Fallbacks for public catalog categories whose API descriptions are empty.
const categoryIntros = new Map([
  ['kosmetika-dlia-volossia-shampun', {
    uk: 'Шампуні для щоденного миття й догляду за сухим волоссям. Обирайте за типом волосся.',
    en: 'Browse shampoos for everyday washing and dry hair, and choose one for your hair type.',
  }],
  ['profesiini-grebeni-ta-shchitki', {
    uk: 'Гребені та щітки для розчісування, проділу й укладання волосся.',
    en: 'Find combs and brushes for detangling, parting and styling your hair.',
  }],
  ['kosmetika-dlia-tila-gigiena', {
    uk: 'Засоби для очищення тіла й щоденної гігієни. Обирайте зручний формат для душу.',
    en: 'Browse body cleansers and everyday hygiene products for your shower routine.',
  }],
  ['kosmetika-ukladochni-pomada', {
    uk: 'Порівняйте помади для волосся за силою фіксації й фінішем, щоб підібрати засіб для своєї укладки.',
    en: 'Compare hair pomades by hold and finish to find one for the style you want.',
  }],
  ['kosmetika-dlia-volossia-konditsioneri', {
    uk: 'Кондиціонери для догляду після миття. Підберіть засіб для свого типу волосся.',
    en: 'Find a conditioner for your hair type to use after shampooing.',
  }],
  ['kosmetika-dlia-borodi-oliia', {
    uk: 'Олії для щоденного догляду за бородою. Порівняйте аромати й об’єми перед вибором.',
    en: 'Browse beard oils for daily care and compare scents and bottle sizes.',
  }],
])

export const localizedCategoryDescription = (
  category: { slug?: string, description?: string | null, description_en?: string | null },
  locale: string,
): string => {
  const language = locale === 'en' ? 'en' : 'uk'
  const description = language === 'en' ? category.description_en?.trim() : undefined
  return description || category.description?.trim() || categoryIntros.get(category.slug ?? '')?.[language] || ''
}
