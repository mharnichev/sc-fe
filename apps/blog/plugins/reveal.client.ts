import type { Directive } from 'vue'

const REVEAL_ITEM_SELECTOR = '[data-sc-reveal-item]'
const REVEAL_ITEM_DELAY_MS = 100
const revealObservers = new WeakMap<HTMLElement, IntersectionObserver>()

const getRevealItems = (container: HTMLElement) => {
  const nestedItems = Array.from(
    container.querySelectorAll<HTMLElement>(REVEAL_ITEM_SELECTOR),
  )

  if (container.matches(REVEAL_ITEM_SELECTOR)) {
    return [container, ...nestedItems]
  }

  return nestedItems.length ? nestedItems : [container]
}

const revealImmediately = (container: HTMLElement) => {
  getRevealItems(container).forEach((item) => {
    item.style.setProperty('--sc-reveal-delay', '0ms')
  })
  container.classList.add('sc-reveal-list--visible')
}

const revealDirective: Directive<HTMLElement> = {
  mounted(container) {
    const items = getRevealItems(container)

    items.forEach((item, index) => {
      item.style.setProperty(
        '--sc-reveal-delay',
        `${index * REVEAL_ITEM_DELAY_MS}ms`,
      )
    })

    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || typeof window.IntersectionObserver !== 'function'
    ) {
      revealImmediately(container)
      return
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some(entry => entry.isIntersecting)) return

      container.classList.add('sc-reveal-list--visible')
      observer.disconnect()
      revealObservers.delete(container)
    }, {
      rootMargin: '0px 0px -20% 0px',
      threshold: 0,
    })

    revealObservers.set(container, observer)
    observer.observe(container)
  },
  beforeUnmount(container) {
    revealObservers.get(container)?.disconnect()
    revealObservers.delete(container)
  },
}

export default defineNuxtPlugin((nuxtApp) => {
  document.documentElement.classList.add('sc-reveal-ready')
  nuxtApp.vueApp.directive('reveal-list', revealDirective)
})
