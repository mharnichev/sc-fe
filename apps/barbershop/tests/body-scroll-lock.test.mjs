import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = (await readFile(new URL('../utils/bodyScrollLock.ts', import.meta.url), 'utf8'))
  .replaceAll('import.meta.client', 'true')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText

test('nested modals keep body scrolling locked until the last modal closes', async () => {
  const classes = new Set()
  globalThis.document = {
    body: {
      style: { overflow: 'auto' },
      classList: {
        add: value => classes.add(value),
        remove: value => classes.delete(value),
      },
    },
  }
  const scrollLock = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

  const drawer = scrollLock.acquireBodyScrollLock()
  const calendar = scrollLock.acquireBodyScrollLock()
  assert.equal(document.body.style.overflow, 'hidden')
  assert.equal(classes.has('sc-modal-open'), true)

  scrollLock.releaseBodyScrollLock(calendar)
  assert.equal(document.body.style.overflow, 'hidden')
  scrollLock.releaseBodyScrollLock(drawer)
  assert.equal(document.body.style.overflow, 'auto')
  assert.equal(classes.has('sc-modal-open'), false)

  delete globalThis.document
})

test('booking price details use the base accordion', async () => {
  const booking = await readFile(new URL('../components/sections/BookingSection.vue', import.meta.url), 'utf8')
  const accordion = await readFile(new URL('../components/ui/BaseAccordion.vue', import.meta.url), 'utf8')
  assert.match(booking, /<BaseAccordion/)
  assert.match(booking, /v-model="quoteDetailsOpen"/)
  assert.doesNotMatch(booking, /quoteAccepted|quoteCopy\.accept/)
  assert.match(booking, /<AppTransition mode="default">[\s\S]*?<section[\s\S]*?v-if="activeStepIndex === lastStepIndex && isContactComplete"/)
  assert.doesNotMatch(booking, /:aria-expanded="quoteDetailsOpen"/)
  assert.match(booking, /booking-price-review/)
  assert.match(booking, /quoteReview\.quote\?\.applied_promotion \? 'booking-price-review--promotion'/)
  assert.match(booking, /<Transition name="booking-accordion-appear" appear>[\s\S]*?<BaseAccordion[\s\S]*?v-if="quoteReview\.quote\.applied_promotion"/)
  assert.match(booking, /<div v-if="!quoteReview\.quote\.applied_promotion" class="flex flex-col gap-3 py-1">/)
  assert.match(booking, /booking-accordion-appear-enter-active/)
  assert.match(booking, /max-height 420ms cubic-bezier/)
  assert.match(booking, /booking-accordion-appear-leave-active \{\s+pointer-events: none/)
  assert.doesNotMatch(booking, /quoteCopy\.unavailable/)
  assert.match(booking, /animation: booking-price-background 14s ease-in-out infinite/)
  assert.doesNotMatch(booking, /booking-price-review[^\n]*border/)
  assert.match(accordion, /heightDuration: 420/)
  assert.match(accordion, /contentDuration: 260/)
  assert.match(accordion, /cubic-bezier\(0\.3, 1, 0\.3, 1\)/)
  assert.match(accordion, /prefers-reduced-motion: reduce/)
})

test('first-visit promotion highlights only the backend discount and uses special-offer wording', async () => {
  const notice = await readFile(new URL('../components/ui/BookingPromotionNotice.vue', import.meta.url), 'utf8')
  assert.match(notice, /booking-promotion-notice__discount/)
  assert.match(notice, /−\{\{ offer\.discount_percent \}\}%/)
  assert.match(notice, /animation: booking-discount-glow/)
  assert.match(notice, /animation: booking-offer-background 12s ease-in-out infinite/)
  assert.match(notice, /background-size: 300% 300%/)
  assert.match(notice, /booking-promotion-notice--light/)
  assert.match(notice, /color: white/)
  assert.match(notice, /clip-path: polygon\(0 8%, 7% 2%, 15% 7%/)
  assert.match(notice, /booking-promotion-notice--compact \{[\s\S]*padding: 0\.7rem 1rem 0\.55rem/)
  assert.match(notice, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(notice, /color: white/)
  assert.match(notice, /спеціальної пропозиції/)
  assert.match(notice, /Для нових гостей/)
  assert.doesNotMatch(notice, /Для нових клієнтів/)
  assert.doesNotMatch(notice, /умовами акції/)
})

test('services show one light-theme first-visit notice outside service cards', async () => {
  const services = await readFile(new URL('../components/sections/ServicesGrid.vue', import.meta.url), 'utf8')
  assert.equal((services.match(/<BookingPromotionNotice/g) || []).length, 1)
  assert.match(services, /theme="light"/)
  assert.match(services, /servicesFirstVisitOffer/)
})

test('team cards do not repeat the first-visit promotion', async () => {
  const team = await readFile(new URL('../components/sections/TeamSection.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(team, /BookingPromotionNotice|activeMemberOffer/)
})

test('hero uses a compact backend-driven offer badge above its booking CTA', async () => {
  const hero = await readFile(new URL('../components/sections/HeroSection.vue', import.meta.url), 'utf8')
  assert.match(hero, /`−\$\{firstVisitOffer\.value\.discount_percent\}% на перший візит`/)
  assert.match(hero, /v-if="firstVisitBadge"[\s\S]*hero-offer-badge[\s\S]*<BaseButton variant="light"/)
  assert.doesNotMatch(hero, /<BookingPromotionNotice/)
})
