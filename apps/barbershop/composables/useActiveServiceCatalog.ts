import type { ServiceCatalogBarberServiceDto, ServiceCatalogItemDto, ServiceDto } from '@shared-types'

type ServiceActivity = {
  is_active?: boolean | null
  status?: string | null
}

type ServiceCatalogItemWithActivity = ServiceCatalogItemDto & ServiceActivity
type ServiceCatalogBarberServiceWithActivity = ServiceCatalogBarberServiceDto & ServiceActivity

const inactiveStatuses = new Set(['inactive', 'неактивний'])

export const isPublicServiceActive = (service: ServiceActivity) => {
  if (service.is_active !== undefined && service.is_active !== null) {
    return service.is_active
  }

  return !service.status || !inactiveStatuses.has(service.status.toLowerCase())
}

export const activeCatalogItem = (service: ServiceCatalogItemDto): ServiceCatalogItemDto | null => {
  const item = service as ServiceCatalogItemWithActivity

  if (!isPublicServiceActive(item)) return null

  const barberServices = item.barber_services.filter(service =>
    isPublicServiceActive(service as ServiceCatalogBarberServiceWithActivity),
  )

  if (!barberServices.length) return null

  return {
    ...item,
    barber_ids: sortedUnique(barberServices.map(service => service.barber_id)),
    barber_service_ids: barberServices.map(service => service.id),
    barber_services: barberServices,
  }
}

export const activeCatalogItems = (services: ServiceCatalogItemDto[] | null | undefined) =>
  (services || []).flatMap((service) => {
    const activeItem = activeCatalogItem(service)
    return activeItem ? [activeItem] : []
  })

const servicePriceValue = (service: ServiceCatalogItemDto) => {
  const value = typeof service.price === 'number'
    ? service.price
    : Number.parseFloat(String(service.price).replace(/[^\d.,]/g, '').replace(',', '.'))

  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER
}

const preferredCatalogItem = (first: ServiceCatalogItemDto, second: ServiceCatalogItemDto) => {
  const priceDifference = servicePriceValue(first) - servicePriceValue(second)
  if (priceDifference !== 0) return priceDifference <= 0 ? first : second

  const durationDifference = Number(first.duration_minutes || 0) - Number(second.duration_minutes || 0)
  return durationDifference <= 0 ? first : second
}

const mergeBarberServices = (first: ServiceCatalogBarberServiceDto[], second: ServiceCatalogBarberServiceDto[]) =>
  [...new Map([...first, ...second].map(service => [service.id, service])).values()]
    .sort((firstService, secondService) => firstService.id - secondService.id)

const baseCatalogKey = (service: ServiceCatalogItemDto) =>
  `base:${service.base_service_id}:${service.is_army_client ? 'army' : 'regular'}`

const mergeBaseCatalogItems = (first: ServiceCatalogItemDto, second: ServiceCatalogItemDto): ServiceCatalogItemDto => {
  const primary = preferredCatalogItem(first, second)
  const barberServices = mergeBarberServices(first.barber_services, second.barber_services)

  return {
    ...primary,
    catalog_id: baseCatalogKey(primary),
    barber_ids: sortedUnique(barberServices.map(service => service.barber_id)),
    barber_service_ids: barberServices.map(service => service.id),
    barber_services: barberServices,
  }
}

export const activeBaseCatalogItems = (services: ServiceCatalogItemDto[] | null | undefined) =>
  [...activeCatalogItems(services).reduce((items, service) => {
    if (service.source_type !== 'base' || service.base_service_id === null) return items

    const key = baseCatalogKey(service)
    const existing = items.get(key)
    items.set(key, existing ? mergeBaseCatalogItems(existing, service) : {
      ...service,
      catalog_id: key,
    })

    return items
  }, new Map<string, ServiceCatalogItemDto>()).values()]

export const activeMasterServices = (services: ServiceDto[] | null | undefined) =>
  (services || []).filter(isPublicServiceActive)

const sortedUnique = (values: number[]) => [...new Set(values)].sort((first, second) => first - second)
