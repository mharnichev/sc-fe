type BackofficeTheme = 'dark' | 'light'

const themeStorageKey = 'soulcuts-backoffice-theme'

const applyBackofficeTheme = (theme: BackofficeTheme) => {
  if (!import.meta.client) return
  document.documentElement.dataset.backofficeTheme = theme
  document.documentElement.style.colorScheme = theme
}

export const useBackofficeTheme = () => {
  const theme = useState<BackofficeTheme>('backoffice-theme', () => 'dark')

  const setTheme = (nextTheme: BackofficeTheme) => {
    theme.value = nextTheme
    applyBackofficeTheme(nextTheme)
    if (import.meta.client) {
      window.localStorage.setItem(themeStorageKey, nextTheme)
    }
  }

  const toggleTheme = () => {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  if (import.meta.client) {
    onMounted(() => {
      const storedTheme = window.localStorage.getItem(themeStorageKey)
      setTheme(storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : theme.value)
    })

    watch(theme, applyBackofficeTheme, { immediate: true })
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
