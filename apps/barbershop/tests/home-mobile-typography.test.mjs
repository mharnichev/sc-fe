import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sectionSource = name => readFile(new URL(`../components/sections/${name}`, import.meta.url), 'utf8')

test('home page body copy uses the 14px mobile typography tier', async () => {
  const [services, booking, bot, feedback] = await Promise.all([
    sectionSource('ServicesGrid.vue'),
    sectionSource('BookingSection.vue'),
    sectionSource('BotSection.vue'),
    sectionSource('FeedbackSection.vue'),
  ])

  assert.match(services, /text-sm leading-6 text-neutral-600 md:text-base md:leading-8/)
  assert.match(booking, /text-sm leading-6 text-white\/65 md:mt-6 md:text-base md:leading-8/)
  assert.match(booking, /text-sm leading-6 text-neutral-700 md:text-base md:leading-7/)
  assert.match(bot, /text-sm leading-6 text-white\/68 md:text-lg md:leading-8/)
  assert.match(feedback, /text-sm leading-6 text-neutral-600 md:text-base md:leading-8/)
})
