import type { Directive } from 'vue'

const REVEAL_ITEM_SELECTOR = '[data-sc-reveal-item]'
const REVEAL_ITEM_VISIBLE_CLASS = 'sc-reveal-item--visible'
const REVEAL_ITEM_DELAY_MS = 100

interface RevealState {
  intersectionObserver: IntersectionObserver | null
  mutationObserver: MutationObserver
  items: Set<HTMLElement>
}

const revealStates = new WeakMap<HTMLElement, RevealState>()

const getRevealItems = (container: HTMLElement) => {
  const nestedItems = Array.from(
    container.querySelectorAll<HTMLElement>(REVEAL_ITEM_SELECTOR),
  )

  if (container.matches(REVEAL_ITEM_SELECTOR)) {
    return [container, ...nestedItems]
  }

  return nestedItems
}

const revealImmediately = (items: HTMLElement[]) => {
  items.forEach((item) => {
    item.style.setProperty('--sc-reveal-delay', '0ms')
    item.classList.add(REVEAL_ITEM_VISIBLE_CLASS)
  })
}

const revealDirective: Directive<HTMLElement> = {
  mounted(container) {
    const shouldRevealImmediately = (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || typeof window.IntersectionObserver !== 'function'
    )

    const intersectionObserver = shouldRevealImmediately
      ? null
      : new IntersectionObserver((entries, observer) => {
          const visibleItems = entries
            .filter(entry => entry.isIntersecting)
            .map(entry => entry.target as HTMLElement)
            .sort((first, second) => {
              const position = first.compareDocumentPosition(second)
              return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
            })

          visibleItems.forEach((item, index) => {
            item.style.setProperty(
              '--sc-reveal-delay',
              `${index * REVEAL_ITEM_DELAY_MS}ms`,
            )
            item.classList.add(REVEAL_ITEM_VISIBLE_CLASS)
            observer.unobserve(item)
          })
        }, {
          rootMargin: '0px 0px -10% 0px',
          threshold: 0.05,
        })

    const state: RevealState = {
      intersectionObserver,
      mutationObserver: new MutationObserver(() => syncRevealItems()),
      items: new Set(),
    }

    const syncRevealItems = () => {
      const currentItems = new Set(getRevealItems(container))

      state.items.forEach((item) => {
        if (currentItems.has(item)) return

        state.intersectionObserver?.unobserve(item)
        state.items.delete(item)
      })

      currentItems.forEach((item) => {
        if (state.items.has(item)) return

        state.items.add(item)
        if (shouldRevealImmediately) {
          revealImmediately([item])
        }
        else {
          state.intersectionObserver?.observe(item)
        }
      })
    }

    state.mutationObserver.observe(container, {
      childList: true,
      subtree: true,
    })
    revealStates.set(container, state)
    syncRevealItems()
  },
  beforeUnmount(container) {
    const state = revealStates.get(container)
    state?.intersectionObserver?.disconnect()
    state?.mutationObserver.disconnect()
    revealStates.delete(container)
  },
}

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('reveal-list', revealDirective)

  if (import.meta.client) {
    document.documentElement.classList.add('sc-reveal-ready')
  }
})
