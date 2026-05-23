const revealSelector = '[data-reveal]'

export default defineNuxtPlugin(() => {
  const observedElements = new WeakSet<Element>()
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let observer: IntersectionObserver | null = null

  const showElement = (element: Element) => {
    element.classList.add('is-visible')
    observer?.unobserve(element)
  }

  const prepareElement = (element: Element) => {
    if (!(element instanceof HTMLElement) || observedElements.has(element)) return

    observedElements.add(element)

    const delay = Number(element.dataset.revealDelay || 0)
    if (delay > 0) {
      element.style.transitionDelay = `${delay}ms`
    }

    if (prefersReducedMotion.matches) {
      showElement(element)
      return
    }

    observer?.observe(element)
  }

  const prepareTree = (root: ParentNode) => {
    if (root instanceof Element && root.matches(revealSelector)) {
      prepareElement(root)
    }

    root.querySelectorAll(revealSelector).forEach(prepareElement)
  }

  const startRevealObserver = () => {
    document.documentElement.classList.add('reveal-ready')

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) showElement(entry.target)
        })
      },
      {
        threshold: 0.14,
        rootMargin: '0px 0px -12% 0px',
      },
    )

    prepareTree(document)

    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) prepareTree(node)
        })
      })
    })

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startRevealObserver, { once: true })
    return
  }

  requestAnimationFrame(startRevealObserver)
})
