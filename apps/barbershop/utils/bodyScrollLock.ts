const activeLocks = new Set<symbol>()
let previousBodyOverflow = ''

export const acquireBodyScrollLock = () => {
  const lock = Symbol('body-scroll-lock')
  if (!import.meta.client) return lock

  if (!activeLocks.size) previousBodyOverflow = document.body.style.overflow
  activeLocks.add(lock)
  document.body.classList.add('sc-modal-open')
  document.body.style.overflow = 'hidden'
  return lock
}

export const releaseBodyScrollLock = (lock: symbol | null) => {
  if (!import.meta.client || !lock || !activeLocks.delete(lock) || activeLocks.size) return

  document.body.classList.remove('sc-modal-open')
  document.body.style.overflow = previousBodyOverflow
}
