export type PublicBookingPromotion = {
  id: number
  code: string | null
  name_uk: string
  name_en: string
  description_uk: string | null
  description_en: string | null
  discount_percent: number
  application_mode: 'automatic' | 'code'
  eligibility_type: 'first_visit' | 'all_customers' | 'inactive_customers' | 'military_customers'
  eligibility_scope: 'barbershop' | null
  requires_code: boolean
  conditional: boolean
  starts_at: string | null
  ends_at: string | null
  applies_to_all_masters: boolean
  master_ids: number[]
  applies_to_all_services: boolean
  base_service_ids: number[]
}

type PromotionScope = Pick<PublicBookingPromotion,
  'eligibility_type' | 'application_mode' | 'applies_to_all_masters' | 'master_ids' | 'applies_to_all_services' | 'base_service_ids'
>

const positiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0

export const isFirstVisitOffer = (offer: Pick<PromotionScope, 'eligibility_type' | 'application_mode'> | null | undefined) =>
  offer?.eligibility_type === 'first_visit' && offer.application_mode === 'automatic'

export const offerAppliesToMaster = (offer: Pick<PromotionScope, 'applies_to_all_masters' | 'master_ids'> | null | undefined, masterId: number | null | undefined) => {
  if (!offer) return false
  if (offer.applies_to_all_masters) return true
  return positiveInteger(masterId) && offer.master_ids.includes(masterId)
}

export const offerAppliesToService = (offer: Pick<PromotionScope, 'applies_to_all_services' | 'base_service_ids'> | null | undefined, baseServiceId: number | null | undefined) => {
  if (!offer) return false
  if (offer.applies_to_all_services) return true
  return positiveInteger(baseServiceId) && offer.base_service_ids.includes(baseServiceId)
}

/** A master badge is valid only when the offer reaches at least one of their services. */
export const offerAppliesToMasterServices = (
  offer: PromotionScope | null | undefined,
  masterId: number | null | undefined,
  baseServiceIds: readonly (number | null | undefined)[],
) =>
  offerAppliesToMaster(offer, masterId)
  && (offer?.applies_to_all_services || baseServiceIds.some(serviceId => offerAppliesToService(offer, serviceId)))

export const firstVisitOffers = (offers: readonly PublicBookingPromotion[]) =>
  offers.filter(isFirstVisitOffer)
