<script setup lang="ts">
import type { CategoryTreeNodeDto } from '@shared-types'

const TYPE_MS = 95
const ERASE_MS = 45
const PAUSE_MS = 1200

const props = withDefaults(defineProps<{
  categoryTree?: CategoryTreeNodeDto[]
  variant?: 'desktop' | 'modal'
  autofocus?: boolean
}>(), {
  categoryTree: () => [],
  variant: 'desktop',
  autofocus: false,
})

const emit = defineEmits<{
  'active-change': [value: boolean]
  close: []
}>()

const { locale, terms } = useShopLocale()
const {
  searchTerm,
  suggestions,
  normalizedSearchTerm,
  hasSearchQuery,
  isSearchLoading,
  clearSuggestions,
} = useProductSearch(6)

const searchInput = ref<HTMLInputElement | null>(null)
const isSearchFocus = ref(props.variant === 'modal')
const searchPlaceholderText = ref('')
const isDeletingPlaceholder = ref(false)
const activePlaceholderSampleIndex = ref(0)
const activePlaceholderCharIndex = ref(0)
let placeholderTimer: ReturnType<typeof setTimeout> | undefined
let closeTimer: ReturnType<typeof setTimeout> | undefined

const searchSamples = computed(() => terms.value.header.searchSamples)
const animatedSearchPlaceholder = computed(() => {
  if (isSearchFocus.value || searchTerm.value) return terms.value.header.searchPlaceholder
  return searchPlaceholderText.value || terms.value.header.searchPlaceholder
})
const isSearchResultVisible = computed(() =>
  hasSearchQuery.value && (props.variant === 'modal' || isSearchFocus.value),
)

const prefersReducedMotion = () => {
  if (!import.meta.client) return true
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false
}

const stopSearchPlaceholderTyping = (reset = false) => {
  if (placeholderTimer) {
    clearTimeout(placeholderTimer)
    placeholderTimer = undefined
  }
  if (!reset) return

  searchPlaceholderText.value = ''
  isDeletingPlaceholder.value = false
  activePlaceholderCharIndex.value = 0
}

const tickSearchPlaceholder = () => {
  if (!import.meta.client || props.variant === 'modal' || isSearchFocus.value || searchTerm.value || prefersReducedMotion()) return

  const samples = searchSamples.value
  const sample = samples[activePlaceholderSampleIndex.value] || terms.value.header.searchPlaceholder

  if (!isDeletingPlaceholder.value) {
    if (activePlaceholderCharIndex.value < sample.length) {
      activePlaceholderCharIndex.value += 1
      searchPlaceholderText.value = sample.slice(0, activePlaceholderCharIndex.value)
      placeholderTimer = setTimeout(tickSearchPlaceholder, TYPE_MS)
      return
    }

    placeholderTimer = setTimeout(() => {
      isDeletingPlaceholder.value = true
      tickSearchPlaceholder()
    }, PAUSE_MS)
    return
  }

  if (activePlaceholderCharIndex.value > 0) {
    activePlaceholderCharIndex.value -= 1
    searchPlaceholderText.value = sample.slice(0, activePlaceholderCharIndex.value)
    placeholderTimer = setTimeout(tickSearchPlaceholder, ERASE_MS)
    return
  }

  isDeletingPlaceholder.value = false
  activePlaceholderSampleIndex.value = (activePlaceholderSampleIndex.value + 1) % Math.max(samples.length, 1)
  placeholderTimer = setTimeout(tickSearchPlaceholder, TYPE_MS)
}

const startSearchPlaceholderTyping = () => {
  stopSearchPlaceholderTyping()
  if (!import.meta.client || props.variant === 'modal' || isSearchFocus.value || searchTerm.value || prefersReducedMotion()) return
  placeholderTimer = setTimeout(tickSearchPlaceholder, TYPE_MS)
}

const focusSearch = () => {
  if (closeTimer) clearTimeout(closeTimer)
  stopSearchPlaceholderTyping()
  isSearchFocus.value = true
  emit('active-change', true)
}

const closeSearch = () => {
  if (closeTimer) clearTimeout(closeTimer)
  isSearchFocus.value = false
  searchInput.value?.blur()
  emit('active-change', false)
  if (!searchTerm.value) startSearchPlaceholderTyping()
}

const closeSearchSoon = () => {
  if (props.variant === 'modal') return
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = setTimeout(closeSearch, 160)
}

const submitSearch = async (value = searchTerm.value) => {
  const q = value.trim()
  clearSuggestions()
  closeSearch()
  emit('close')
  await navigateTo({ path: '/catalog', query: q ? { q } : undefined })
}

const selectResult = () => {
  closeSearch()
  emit('close')
}

watch([isSearchFocus, searchTerm], ([isFocus, term]) => {
  if (isFocus || term) {
    stopSearchPlaceholderTyping()
    return
  }
  startSearchPlaceholderTyping()
})

watch(locale, () => {
  stopSearchPlaceholderTyping(true)
  activePlaceholderSampleIndex.value = 0
  startSearchPlaceholderTyping()
})

onMounted(async () => {
  if (props.autofocus) {
    await nextTick()
    searchInput.value?.focus()
    return
  }
  startSearchPlaceholderTyping()
})

onBeforeUnmount(() => {
  if (closeTimer) clearTimeout(closeTimer)
  stopSearchPlaceholderTyping()
})

defineExpose({ closeSearch })
</script>

<template>
  <form
    :class="['header-search', `header-search--${variant}`, { 'is-active': isSearchFocus || searchTerm }]"
    role="search"
    @submit.prevent="submitSearch()"
  >
    <div class="header-search__control">
      <input
        ref="searchInput"
        v-model="searchTerm"
        class="header-search__field"
        type="search"
        :placeholder="animatedSearchPlaceholder"
        autocomplete="off"
        @focus="focusSearch"
        @blur="closeSearchSoon"
        @keydown.esc="closeSearch"
      >

      <button
        type="submit"
        class="header-search__submit"
        :class="{ 'is-active': normalizedSearchTerm.length > 2 }"
        :aria-label="terms.common.search"
      >
        <BaseIcon name="search" size="xxs" />
      </button>
    </div>

    <HeaderSearchResults
      v-if="isSearchResultVisible"
      class="header-search__result"
      :query="normalizedSearchTerm"
      :loading="isSearchLoading"
      :results="suggestions"
      :category-tree="categoryTree"
      @select="selectResult"
      @suggestion="submitSearch"
    />
  </form>
</template>

<style scoped>
.header-search {
  position: relative;
  width: min(100%, 25rem);
  min-width: 14rem;
}

.header-search.is-active {
  z-index: 84;
}

.header-search__control {
  position: relative;
  display: flex;
  width: 100%;
  background: rgb(23 23 23 / 0.025);
  transition: background-color 180ms ease;
}

.header-search__control:focus-within {
  background: rgb(23 23 23 / 0.05);
}

.header-search__field {
  position: relative;
  z-index: 1;
  width: 100%;
  min-width: 0;
  min-height: 2.5rem;
  border: 0;
  border-radius: 0;
  background: transparent;
  padding: 0 2.9rem 0 0.9rem;
  color: #0a0a0a;
  font-size: 0.9rem;
  outline: none;
}

.header-search__field::placeholder {
  color: rgb(82 82 82 / 0.72);
}

.header-search__submit {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 2;
  display: inline-flex;
  width: 2.9rem;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: #0a0a0a;
}

.header-search__submit {
  right: 0;
  background: #f3f4f7;
  transition:
    background-color 180ms ease,
    color 180ms ease;
}

.header-search__submit.is-active {
  background: #0a0a0a;
  color: #ffffff;
}

.header-search__submit:focus-visible {
  outline: none;
}

.header-search__result {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  left: 0;
  z-index: 84;
  width: 100%;
}

.header-search--modal {
  width: 100%;
  min-width: 0;
}

.header-search--modal .header-search__control {
  border: 0;
  background: #ffffff;
}

.header-search--modal .header-search__field {
  min-height: 3rem;
}

.header-search--modal .header-search__result {
  position: relative;
  inset: auto;
  width: 100%;
  max-height: calc(100dvh - 8.5rem);
  margin-top: 0.75rem;
  border: 0;
}
</style>
