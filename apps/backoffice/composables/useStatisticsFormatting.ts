export const useStatisticsFormatting = () => {
  const barberName = (barber?: { id?: number, full_name?: string | null, full_name_uk?: string | null, first_name_uk?: string | null, last_name_uk?: string | null } | null) => {
    if (!barber) return ''
    const localizedName = `${barber.first_name_uk || ''} ${barber.last_name_uk || ''}`.trim()
    return barber.full_name_uk || localizedName || barber.full_name || (barber.id ? `Майстер #${barber.id}` : '')
  }

  const statisticsErrorMessage = (error: unknown, fallback: string) => {
    const status = typeof error === 'object' && error && 'response' in error
      ? (error as { response?: { status?: number } }).response?.status
      : typeof error === 'object' && error && 'status' in error
        ? (error as { status?: number }).status
        : undefined

    if (status === 403) return 'У вас немає прав для перегляду цієї статистики.'
    if (status === 404) return 'API статистики не знайдено. Перезапустіть backend або оновіть його до версії з monthly statistics endpoints.'

    if (typeof error === 'object' && error && 'data' in error) {
      const data = (error as { data?: { detail?: unknown } }).data
      if (data?.detail && String(data.detail) !== 'Not Found') return String(data.detail)
    }

    return fallback
  }

  return {
    barberName,
    statisticsErrorMessage,
  }
}
