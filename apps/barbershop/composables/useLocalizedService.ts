interface LocalizedServiceText {
  name?: string | null
  title_uk?: string | null
  title_en?: string | null
  description?: string | null
  description_uk?: string | null
  description_en?: string | null
}

export const useLocalizedService = () => {
  const { locale } = useTerms()

  const serviceName = (service?: LocalizedServiceText | null) => {
    if (!service) return ''
    return locale.value === 'en'
      ? service.title_en || service.name || service.title_uk || ''
      : service.title_uk || service.name || service.title_en || ''
  }

  const serviceDescription = (service?: LocalizedServiceText | null) => {
    if (!service) return ''
    return locale.value === 'en'
      ? service.description_en || service.description || service.description_uk || ''
      : service.description_uk || service.description || service.description_en || ''
  }

  const serviceDuration = (minutes?: number | null) => {
    if (!minutes) return ''
    return locale.value === 'en' ? `${minutes} min` : `${minutes} хв`
  }

  const servicePrice = (price?: string | number | null, options: { from?: boolean } = {}) => {
    if (price === null || price === undefined || price === '') return ''
    const value = `₴ ${price}`
    if (!options.from) return value
    return locale.value === 'en' ? `from ${value}` : `від ${value}`
  }

  return {
    serviceDescription,
    serviceDuration,
    serviceName,
    servicePrice,
  }
}
