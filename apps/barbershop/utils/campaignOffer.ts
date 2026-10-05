export const CAMPAIGN_OFFER_SESSION_KEY = 'sc_campaign_offer'

export interface SavedCampaignOffer {
  token: string
  eventId: string
}

export const isCampaignOfferToken = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)

export const newCampaignOfferEventId = (): string => {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID()
  if (typeof cryptoApi?.getRandomValues === 'function') {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  }
  return `offer-${Date.now()}-${Math.random().toString(36).slice(2).padEnd(16, '0')}`
}

export const readCampaignOffer = (storage: Storage): SavedCampaignOffer | null => {
  try {
    const saved = JSON.parse(storage.getItem(CAMPAIGN_OFFER_SESSION_KEY) || 'null')
    return isCampaignOfferToken(saved?.token) && typeof saved?.eventId === 'string'
      && /^[A-Za-z0-9._:-]{16,128}$/.test(saved.eventId)
      ? saved : null
  }
  catch { return null }
}

export const saveCampaignOffer = (storage: Storage, token: string): SavedCampaignOffer => {
  const previous = readCampaignOffer(storage)
  const saved = previous?.token === token ? previous : { token, eventId: newCampaignOfferEventId() }
  storage.setItem(CAMPAIGN_OFFER_SESSION_KEY, JSON.stringify(saved))
  return saved
}

export const clearCampaignOffer = (storage: Storage) => storage.removeItem(CAMPAIGN_OFFER_SESSION_KEY)

export const campaignOfferApplies = (context: { master_id: number, service_ids: number[] }, masterId: number | null, serviceIds: number[]) =>
  masterId === context.master_id && serviceIds.length > 0
  && serviceIds.every(id => context.service_ids.includes(id))
