export const useStatisticsFormatting = () => {
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
    statisticsErrorMessage,
  }
}
