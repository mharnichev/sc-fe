export type BackofficeTheme = 'dark' | 'light'

export const backofficeThemeStorageKey = 'soulcuts-backoffice-theme'
let themeControllerInitialized = false

export const isBackofficeTheme = (value: unknown): value is BackofficeTheme =>
  value === 'light' || value === 'dark'

export const resolveBackofficeTheme = (): BackofficeTheme => {
  if (!import.meta.client) return 'dark'
  const storedTheme = window.localStorage.getItem(backofficeThemeStorageKey)
  return isBackofficeTheme(storedTheme) ? storedTheme : 'dark'
}

export const applyBackofficeTheme = (theme: BackofficeTheme) => {
  if (!import.meta.client) return
  document.documentElement.dataset.backofficeTheme = theme
  document.documentElement.style.colorScheme = theme
}

export const useBackofficeTheme = () => {
  const theme = useState<BackofficeTheme>('backoffice-theme', resolveBackofficeTheme)

  const setTheme = (nextTheme: BackofficeTheme) => {
    theme.value = nextTheme
    applyBackofficeTheme(nextTheme)
    if (import.meta.client) {
      window.localStorage.setItem(backofficeThemeStorageKey, nextTheme)
    }
  }

  const toggleTheme = () => {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  if (import.meta.client && !themeControllerInitialized) {
    themeControllerInitialized = true
    theme.value = resolveBackofficeTheme()
    applyBackofficeTheme(theme.value)
    watch(theme, applyBackofficeTheme, { immediate: true })

    window.addEventListener('storage', event => {
      if (event.key !== backofficeThemeStorageKey || !isBackofficeTheme(event.newValue)) return
      theme.value = event.newValue
    })
  }

  return {
    theme,
    isLightTheme: computed(() => theme.value === 'light'),
    themeLabel: computed(() => theme.value === 'light' ? 'Світла тема' : 'Темна тема'),
    themeToggleLabel: computed(() => theme.value === 'light' ? 'Увімкнути темну тему' : 'Увімкнути світлу тему'),
    setTheme,
    toggleTheme,
  }
}
