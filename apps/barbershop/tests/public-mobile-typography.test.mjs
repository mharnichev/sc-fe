import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const pageSource = path => readFile(new URL(`../pages/${path}`, import.meta.url), 'utf8')

test('public pages use the 14px mobile body-copy tier', async () => {
  const [about, blogFaq, odesa, masters, master, services, service, waitlist, terms] = await Promise.all([
    pageSource('about.vue'),
    pageSource('blog-faq.vue'),
    pageSource('barbershop-odesa.vue'),
    pageSource('masters/index.vue'),
    pageSource('masters/[slug].vue'),
    pageSource('services/index.vue'),
    pageSource('services/[slug].vue'),
    pageSource('booking/waitlist-offer.vue'),
    pageSource('terms.vue'),
  ])

  assert.match(about, /text-sm leading-6 text-stone-600 md:text-lg md:leading-8/)
  assert.match(about, /text-sm leading-6 text-stone-600 md:text-base md:leading-8/)
  assert.match(blogFaq, /text-sm leading-6 text-stone-600 md:text-lg md:leading-8/)
  assert.match(odesa, /text-sm leading-6 text-stone-700 md:text-lg md:leading-8/)
  assert.match(masters, /text-sm leading-6 text-stone-700 md:text-lg md:leading-8/)
  assert.match(master, /text-sm leading-6 text-neutral-700 md:text-lg md:leading-8/)
  assert.match(services, /text-sm leading-6 text-stone-700 md:text-lg md:leading-8/)
  assert.match(service, /text-sm leading-6 text-stone-700 md:text-lg md:leading-8/)
  assert.match(waitlist, /text-sm leading-6 text-neutral-600 md:text-base md:leading-7/)
  assert.match(terms, /font-size: 0\.875rem;[\s\S]*?line-height: 1\.7;/)
  assert.match(terms, /@media \(min-width: 640px\)[\s\S]*?font-size: 1rem;[\s\S]*?line-height: 1\.85;/)
})
