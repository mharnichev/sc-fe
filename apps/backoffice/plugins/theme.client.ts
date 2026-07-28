import {
  applyBackofficeTheme,
  resolveBackofficeTheme,
  type BackofficeTheme,
} from '~/composables/useBackofficeTheme'

export default defineNuxtPlugin(() => {
  const theme = useState<BackofficeTheme>('backoffice-theme', resolveBackofficeTheme)
  theme.value = resolveBackofficeTheme()
  applyBackofficeTheme(theme.value)
})
