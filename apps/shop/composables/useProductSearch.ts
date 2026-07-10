import type { ProductSearchResponseDto } from '@shared-types'

const emptySearchResponse = (): ProductSearchResponseDto => ({
  suggestions: [],
  products: [],
  categories: [],
})

export const useProductSearch = (limit = 6) => {
  const route = useRoute()
  const domain = useCatalogDomain()
  const searchTerm = ref(
    Array.isArray(route.query.q)
      ? String(route.query.q[0] || '')
      : String(route.query.q || ''),
  )
  const suggestions = ref<ProductSearchResponseDto>(emptySearchResponse())
  const isSearchLoading = ref(false)
  let searchTimer: ReturnType<typeof setTimeout> | undefined
  let searchRequest = 0

  const normalizedSearchTerm = computed(() => searchTerm.value.trim())
  const hasSearchQuery = computed(() => normalizedSearchTerm.value.length >= 3)
  const hasSearchResults = computed(() =>
    suggestions.value.suggestions.length > 0
    || suggestions.value.products.length > 0
    || suggestions.value.categories.length > 0,
  )

  const clearSuggestions = () => {
    suggestions.value = emptySearchResponse()
  }

  const clearSearch = () => {
    searchRequest += 1
    searchTerm.value = ''
    isSearchLoading.value = false
    clearSuggestions()
  }

  watch(() => route.query.q, value => {
    searchTerm.value = Array.isArray(value) ? String(value[0] || '') : String(value || '')
  })

  watch(searchTerm, value => {
    if (searchTimer) clearTimeout(searchTimer)
    if (!import.meta.client) return

    const term = value.trim()
    const request = ++searchRequest
    if (term.length < 3) {
      isSearchLoading.value = false
      clearSuggestions()
      return
    }

    isSearchLoading.value = true
    searchTimer = setTimeout(async () => {
      try {
        const response = await domain.searchProducts(term, limit)
        if (request === searchRequest) suggestions.value = response
      }
      catch (error) {
        if (request === searchRequest) clearSuggestions()
        console.error(error)
      }
      finally {
        if (request === searchRequest) isSearchLoading.value = false
      }
    }, 300)
  }, { immediate: true })

  onScopeDispose(() => {
    searchRequest += 1
    if (searchTimer) clearTimeout(searchTimer)
  })

  return {
    searchTerm,
    suggestions,
    normalizedSearchTerm,
    hasSearchQuery,
    hasSearchResults,
    isSearchLoading,
    clearSearch,
    clearSuggestions,
  }
}
