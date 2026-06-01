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

export const activeMasterServices = (services: ServiceDto[] | null | undefined) =>
  (services || []).filter(isPublicServiceActive)

const sortedUnique = (values: number[]) => [...new Set(values)].sort((first, second) => first - second)
