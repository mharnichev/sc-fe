export type SeoBookingIntent = {
  serviceSlug?: string
  masterId?: number
  serviceId?: number
}

export type SeoBookingCatalogService = {
  slug: string
  catalogId: string
  barberServices: readonly { id: number, barberId: number }[]
}

export type SeoBookingMaster = {
  id: number
  activeServiceIds: readonly number[]
}

export type SeoBookingSelection = {
  catalogId?: string
  serviceId?: number
  masterId?: number
  step: 0 | 1 | 2
}

const validSlug = (value: unknown): value is string =>
  typeof value === 'string'
  && value.length <= 150
  && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)

const validMasterId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0

export const seoBookingPath = ({ serviceSlug, masterId, serviceId }: SeoBookingIntent = {}): string => {
  const params = new URLSearchParams()
  const slug = validSlug(serviceSlug) ? serviceSlug : undefined
  if (slug) params.set('service', slug)
  if (validMasterId(masterId)) params.set('master', String(masterId))
  if (!slug && validMasterId(masterId) && validMasterId(serviceId)) params.set('service_id', String(serviceId))
  const query = params.toString()
  return `/${query ? `?${query}` : ''}#booking`
}

export const parseSeoBookingQuery = (query: Record<string, unknown>): SeoBookingIntent | null => {
  const serviceSlug = validSlug(query.service) ? query.service : undefined
  const parseId = (value: unknown) => {
    const id = typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : undefined
    return validMasterId(id) ? id : undefined
  }
  const masterId = parseId(query.master)
  const serviceId = !serviceSlug && masterId ? parseId(query.service_id) : undefined

  return serviceSlug || masterId ? { serviceSlug, masterId, serviceId } : null
}

export const resolveSeoBookingSelection = (
  intent: SeoBookingIntent,
  catalog: readonly SeoBookingCatalogService[],
  masters: readonly SeoBookingMaster[],
): SeoBookingSelection => {
  const matchingServices = intent.serviceSlug
    ? catalog.filter(item => item.slug === intent.serviceSlug)
    : []
  const service = matchingServices.length === 1 ? matchingServices[0] : undefined
  const master = intent.masterId
    ? masters.find(item => item.id === intent.masterId)
    : undefined

  if (!service && !intent.serviceSlug && master && intent.serviceId) {
    if (master.activeServiceIds.includes(intent.serviceId)) {
      return { serviceId: intent.serviceId, masterId: master.id, step: 2 }
    }
    return { masterId: master.id, step: 0 }
  }

  if (service && master) {
    const activeIds = new Set(master.activeServiceIds)
    const matchingService = service.barberServices.find(item =>
      item.barberId === master.id && activeIds.has(item.id),
    )
    if (matchingService) {
      return { catalogId: service.catalogId, serviceId: matchingService.id, masterId: master.id, step: 2 }
    }
    return { masterId: master.id, step: 0 }
  }

  if (service) return { catalogId: service.catalogId, step: 1 }
  if (master) return { masterId: master.id, step: 0 }
  return { step: 0 }
}

export const shouldApplySeoBookingSelection = (state: {
  ready: boolean
  dataError: boolean
  applied: boolean
  manualSelection: boolean
  hasSelection: boolean
}) => state.ready && !state.dataError && !state.applied && !state.manualSelection && !state.hasSelection

export const isSeoBookingContext = (context: {
  path: string
  mode: 'section' | 'drawer'
  idPrefix: string
  hasRepeatBooking: boolean
  hasCampaignOffer: boolean
}) => context.path === '/'
  && context.mode === 'section'
  && context.idPrefix === 'booking'
  && !context.hasRepeatBooking
  && !context.hasCampaignOffer
