import type { ProductSearchResponseDto } from '@shared-types'

const emptySearchResponse = (): ProductSearchResponseDto => ({
  suggestions: [],
  products: [],
  categories: [],
})

export const useProductSearch = (limit = 6) => {
  const route = useRoute()
  const domain = useCatalogDomain()
  const searchCache = useState<Record<string, ProductSearchResponseDto>>('shop-product-search-cache', () => ({}))
  const lastSearchTerm = useState<string>('shop-last-product-search-term', () => '')
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
  const searchCacheKey = (term: string) => `${limit}:${term.toLocaleLowerCase()}`
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

  const restorePreviousSearch = () => {
    const term = normalizedSearchTerm.value.length >= 3
      ? normalizedSearchTerm.value
      : lastSearchTerm.value
    if (!term) return

    searchTerm.value = term
    const cachedResponse = searchCache.value[searchCacheKey(term)]
    if (cachedResponse) {
      suggestions.value = cachedResponse
      isSearchLoading.value = false
    }
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

    const cacheKey = searchCacheKey(term)
    const cachedResponse = searchCache.value[cacheKey]
    if (cachedResponse) {
      suggestions.value = cachedResponse
      lastSearchTerm.value = term
      isSearchLoading.value = false
      return
    }

    isSearchLoading.value = true
    searchTimer = setTimeout(async () => {
      try {
        const response = await domain.searchProducts(term, limit)
        if (request === searchRequest) {
          suggestions.value = response
          searchCache.value[cacheKey] = response
          lastSearchTerm.value = term
        }
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
    restorePreviousSearch,
    clearSearch,
    clearSuggestions,
  }
}
