import type { MasterDto, ServiceCatalogItemDto, ServiceDto } from '@shared-types'
import { activeBaseCatalogItems, activeMasterServices } from '~/composables/useActiveServiceCatalog'

type SluggedEntity = {
  slug?: string | null
}

export type PublicServiceDto = ServiceDto & {
  base_service_id?: number | null
  barber_id?: number
  created_at?: string
  source_type?: 'base' | 'custom'
  updated_at?: string
}

export type PublicServiceCatalogItemDto = ServiceCatalogItemDto & SluggedEntity

export type PublicMasterDto = MasterDto & SluggedEntity & {
  created_at?: string
  updated_at?: string
  services?: PublicServiceDto[]
}

const transliteration: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'h',
  ґ: 'g',
  д: 'd',
  е: 'e',
  є: 'ye',
  ж: 'zh',
  з: 'z',
  и: 'y',
  і: 'i',
  ї: 'yi',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ь: '',
  ю: 'yu',
  я: 'ya',
  ё: 'yo',
  ы: 'y',
  э: 'e',
  ъ: '',
}

const cleanText = (value?: string | null) => value?.trim() || ''

export const seoSlugPart = (value: string) =>
  [...value.normalize('NFKD').toLowerCase()]
    .map(character => transliteration[character] ?? character)
    .join('')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const stableApiSlug = (value?: string | null) => {
  const slug = seoSlugPart(cleanText(value))
  return slug || ''
}

const positiveId = (value?: number | null) =>
  typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : null

export const serviceStableId = (service: ServiceCatalogItemDto) =>
  positiveId(service.base_service_id)

export const serviceSeoSlug = (service: PublicServiceCatalogItemDto) => {
  const apiSlug = stableApiSlug(service.slug)
  if (apiSlug) return apiSlug

  const id = serviceStableId(service)
  if (!id) return ''

  const name = seoSlugPart(
    cleanText(service.title_en)
    || cleanText(service.title_uk)
    || cleanText(service.name)
    || 'service',
  ) || 'service'

  return `${name}-${id}`
}

export const serviceSeoPath = (service: PublicServiceCatalogItemDto) => {
  const slug = serviceSeoSlug(service)
  return slug ? `/services/${slug}` : ''
}

const masterSlugName = (master: MasterDto) =>
  cleanText(master.full_name_en)
  || cleanText(master.first_name_en)
  || cleanText(master.full_name_uk)
  || cleanText(master.full_name)
  || cleanText(master.first_name_uk)
  || cleanText(master.name)

export const masterProfileName = (master: MasterDto) =>
  cleanText(master.full_name_uk)
  || cleanText(master.full_name)
  || cleanText(master.full_name_en)
  || cleanText(master.first_name_uk)
  || cleanText(master.first_name_en)
  || cleanText(master.name)

export const masterSeoSlug = (master: PublicMasterDto) => {
  const apiSlug = stableApiSlug(master.slug)
  if (apiSlug) return apiSlug

  const id = positiveId(master.id)
  if (!id) return ''

  const name = seoSlugPart(masterSlugName(master)) || 'barber'
  return `${name}-${id}`
}

export const masterSeoPath = (master: PublicMasterDto) => {
  const slug = masterSeoSlug(master)
  return slug ? `/masters/${slug}` : ''
}

export const isPublicMasterActive = (master: MasterDto) =>
  master.is_active ?? master.status?.toLowerCase() !== 'inactive'

export const isPublicMasterVisible = (master: MasterDto) =>
  master.showOnMasterBlock ?? master.show_on_master_block ?? true

const hasMasterPhoto = (master: MasterDto) => {
  const value = master.photo || master.photo_url || master.avatar || master.avatar_url
  if (typeof value === 'string') return Boolean(value.trim())
  return Boolean(value?.file_url)
}

const normalizedProfileName = (master: MasterDto) =>
  masterProfileName(master)
    .normalize('NFKC')
    .toLocaleLowerCase('uk-UA')
    .replace(/\s+/g, ' ')

const isCompletePublicMaster = (master: PublicMasterDto) =>
  isPublicMasterActive(master)
  && isPublicMasterVisible(master)
  && Boolean(normalizedProfileName(master))
  && hasMasterPhoto(master)
  && activeMasterServices(master.services).length > 0
  && Boolean(masterSeoPath(master))

export const indexablePublicMasters = <T extends PublicMasterDto>(masters: readonly T[]) => {
  const candidates = masters.filter(isCompletePublicMaster)
  const nameCounts = new Map<string, number>()
  const pathCounts = new Map<string, number>()

  for (const master of candidates) {
    const name = normalizedProfileName(master)
    const path = masterSeoPath(master)
    nameCounts.set(name, (nameCounts.get(name) || 0) + 1)
    pathCounts.set(path, (pathCounts.get(path) || 0) + 1)
  }

  return candidates.filter(master =>
    nameCounts.get(normalizedProfileName(master)) === 1
    && pathCounts.get(masterSeoPath(master)) === 1,
  )
}

const hasApprovedServiceContent = (service: ServiceCatalogItemDto) =>
  Boolean(
    cleanText(service.title_uk)
    || cleanText(service.title_en)
    || cleanText(service.name),
  )
  && Boolean(
    cleanText(service.description_uk)
    || cleanText(service.description_en)
    || cleanText(service.description),
  )

const normalizedServiceName = (service: ServiceCatalogItemDto) =>
  (
    cleanText(service.title_uk)
    || cleanText(service.name)
    || cleanText(service.title_en)
  )
    .normalize('NFKC')
    .toLocaleLowerCase('uk-UA')
    .replace(/\s+/g, ' ')

export const indexableServiceCatalog = (
  services: readonly PublicServiceCatalogItemDto[] | null | undefined,
) => {
  const candidates = activeBaseCatalogItems([...(services || [])]) as PublicServiceCatalogItemDto[]
  const idCounts = new Map<number, number>()
  const nameCounts = new Map<string, number>()
  const pathCounts = new Map<string, number>()

  for (const service of candidates) {
    const id = serviceStableId(service)
    const name = normalizedServiceName(service)
    const path = serviceSeoPath(service)

    if (id) idCounts.set(id, (idCounts.get(id) || 0) + 1)
    if (name) nameCounts.set(name, (nameCounts.get(name) || 0) + 1)
    if (path) pathCounts.set(path, (pathCounts.get(path) || 0) + 1)
  }

  return candidates.filter((service) => {
    const id = serviceStableId(service)
    const name = normalizedServiceName(service)
    const path = serviceSeoPath(service)

    return Boolean(
      id
      && name
      && path
      && hasApprovedServiceContent(service)
      && service.barber_services.length
      && idCounts.get(id) === 1
      && nameCounts.get(name) === 1
      && pathCounts.get(path) === 1,
    )
  })
}

export const latestIsoTimestamp = (values: readonly (string | null | undefined)[]) => {
  const timestamps = values.flatMap((value) => {
    if (!value) return []
    const timestamp = Date.parse(value)
    return Number.isFinite(timestamp) ? [timestamp] : []
  })

  if (!timestamps.length) return undefined
  return new Date(Math.max(...timestamps)).toISOString()
}
