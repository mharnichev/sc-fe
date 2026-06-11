const themeStorageKey = 'soulcuts-backoffice-theme'

export default defineNuxtPlugin(() => {
  const storedTheme = window.localStorage.getItem(themeStorageKey)
  const theme = storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : 'dark'

  document.documentElement.dataset.backofficeTheme = theme
  document.documentElement.style.colorScheme = theme
})
