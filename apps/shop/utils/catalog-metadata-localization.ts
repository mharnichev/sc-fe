// Only known catalog metadata is translated; unknown or authored values remain intact.
export type CatalogCharacteristicKind = 'brand' | 'category' | 'code' | 'size' | 'color' | 'volume' | null
const aliases: Record<string, Exclude<CatalogCharacteristicKind, null>> = {
  brand: 'brand', бренд: 'brand', category: 'category', категорія: 'category', категория: 'category',
  sku: 'code', code: 'code', 'product code': 'code', артикул: 'code', 'код товару': 'code', 'код товара': 'code',
  size: 'size', sizes: 'size', rozmir: 'size', розмір: 'size', размер: 'size',
  color: 'color', colors: 'color', colour: 'color', colours: 'color', kolir: 'color', колір: 'color', цвет: 'color',
  volume: 'volume', "об'єм": 'volume', 'об’єм': 'volume', 'обʼєм': 'volume', объем: 'volume', обсяг: 'volume',
}
const labels = {
  en: { brand: 'Brand', category: 'Category', code: 'Product code', size: 'Size', color: 'Color', volume: 'Volume' },
  uk: { brand: 'Бренд', category: 'Категорія', code: 'Код товару', size: 'Розмір', color: 'Колір', volume: 'Об’єм' },
}
export const catalogCharacteristicKind = (key: string): CatalogCharacteristicKind => {
  const normalized = key.trim().toLocaleLowerCase()
  return Object.hasOwn(aliases, normalized) ? (aliases[normalized] || null) : null
}
export const localizedMetadataLabel = (slug: string, name: string, locale: string): string => {
  const kind = catalogCharacteristicKind(slug) || catalogCharacteristicKind(name)
  return kind ? labels[locale === 'en' ? 'en' : 'uk'][kind] : name
}

export const localizedPackageSize = (value: string, locale: string): string => value.replace(
  /(\d+(?:[.,]\d+)?)\s*(мл|ml|гр|г|g|кг|kg|л|l)(?=$|[\s)])/giu,
  (_match, amount: string, unit: string) => {
    const normalized = unit.toLowerCase()
    const en: Record<string, string> = { мл: 'ml', ml: 'ml', гр: 'g', г: 'g', g: 'g', кг: 'kg', kg: 'kg', л: 'l', l: 'l' }
    const uk: Record<string, string> = { ml: 'мл', g: 'г', kg: 'кг', l: 'л' }
    const target = en[normalized] || unit
    return `${amount} ${locale === 'en' ? target : uk[target] || target}`
  },
)

export const localizedVolumeLabel = (variant: { volume_ml?: number | null, volume_label: string }, locale: string): string =>
  Number.isFinite(variant.volume_ml) && Number(variant.volume_ml) > 0
    ? `${variant.volume_ml} ${locale === 'en' ? 'ml' : 'мл'}`
    : localizedPackageSize(variant.volume_label, locale)

export const localizedMetadataValue = (group: string, value: string, locale: string): string => {
  const kind = catalogCharacteristicKind(group)
  if (kind === 'size' || kind === 'volume') return localizedPackageSize(value, locale)
  if (kind !== 'color' || locale !== 'en') return value
  const colors: Record<string, { en: string, uk: string }> = {
    бежевий: { en: 'Beige', uk: 'Бежевий' }, beige: { en: 'Beige', uk: 'Бежевий' },
    черный: { en: 'Black', uk: 'Чорний' }, чорний: { en: 'Black', uk: 'Чорний' }, black: { en: 'Black', uk: 'Чорний' },
  }
  return colors[value.trim().toLocaleLowerCase()]?.[locale === 'en' ? 'en' : 'uk'] || value
}
